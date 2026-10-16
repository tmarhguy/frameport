const { spawn } = require('node:child_process');
const { existsSync, readdirSync, readFileSync } = require('node:fs');

const V4L2_SYS = '/sys/class/video4linux';

function supportsHardwareCapture(platform = process.platform) {
  return platform === 'darwin' || platform === 'win32' || platform === 'linux';
}

// FFmpeg emits device diagnostics on stderr, including for successful enumeration.
// Linux is not parsed from that text: the v4l2 demuxer has no -list_devices mode.
function parseDevices(text, includeScreens = false, platform = process.platform) {
  const devices = [];
  if (platform === 'linux') return devices;
  if (platform === 'win32') {
    for (const line of text.split(/\r?\n/)) {
      const dshowMatch = line.match(/\]\s+"([^"]+)"\s+\(video\)/);
      if (dshowMatch) {
        devices.push({ index: `video=${dshowMatch[1]}`, name: dshowMatch[1] });
      }
    }
  } else {
    let video = false;
    for (const line of text.split(/\r?\n/)) {
      if (line.includes('AVFoundation video devices:')) { video = true; continue; }
      if (line.includes('AVFoundation audio devices:')) { video = false; continue; }
      const match = video && line.match(/\[(\d+)\]\s+(.+)$/);
      if (match && (includeScreens || !match[2].startsWith('Capture screen'))) {
        devices.push({ index: match[1], name: match[2].trim(), ...(match[2].startsWith('Capture screen') ? { screen: true } : {}) });
      }
    }
  }
  return devices;
}

// Primary V4L2 node only. UVC drivers also publish a metadata node at index 1
// under the same name; opening that node does not produce frames.
function listV4l2Devices({
  sysRoot = V4L2_SYS,
  exists = existsSync,
  readdir = readdirSync,
  readFile = readFileSync
} = {}) {
  if (!exists(sysRoot)) return [];
  let entries = [];
  try { entries = readdir(sysRoot); } catch { return []; }
  const devices = [];
  for (const entry of entries) {
    if (!/^video\d+$/.test(entry)) continue;
    const node = `/dev/${entry}`;
    if (!exists(node)) continue;
    let name = entry;
    try { name = String(readFile(`${sysRoot}/${entry}/name`, 'utf8')).trim() || entry; } catch {}
    let index = '0';
    try { index = String(readFile(`${sysRoot}/${entry}/index`, 'utf8')).trim() || '0'; } catch {}
    if (index !== '0') continue;
    devices.push({ index: node, name });
  }
  return devices.sort((a, b) => a.index.localeCompare(b.index, undefined, { numeric: true }));
}

function enumerate(executable, platform = process.platform, v4l2) {
  if (platform === 'linux') return Promise.resolve(listV4l2Devices(v4l2));
  return new Promise((resolve, reject) => {
    let format = 'avfoundation';
    if (platform === 'win32') format = 'dshow';

    const input = platform === 'win32' ? 'dummy' : '';

    const child = spawn(executable, ['-hide_banner', '-f', format, '-list_devices', 'true', '-i', input], { stdio: ['ignore', 'ignore', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Device discovery timed out.')); }, 8000);
    child.stderr.on('data', data => { output = (output + data).slice(-65536); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', () => { clearTimeout(timer); resolve(parseDevices(output, true, platform)); });
  });
}

// Incremental JPEG parser: handles split markers and limits malformed-frame memory.
class JpegParser {
  constructor(onFrame, limit = 16 * 1024 * 1024) { this.buffer = Buffer.alloc(0); this.onFrame = onFrame; this.limit = limit; }
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const start = this.buffer.indexOf(Buffer.from([255, 216]));
      if (start < 0) { this.buffer = this.buffer.subarray(-1); return; }
      if (start) this.buffer = this.buffer.subarray(start);
      const end = this.buffer.indexOf(Buffer.from([255, 217]), 2);
      if (end < 0) {
        if (this.buffer.length > this.limit) this.buffer = Buffer.alloc(0);
        return;
      }
      if (end + 2 <= this.limit) this.onFrame(Buffer.from(this.buffer.subarray(0, end + 2)));
      this.buffer = this.buffer.subarray(end + 2);
    }
  }
}

function captureArgs(device, mode, platform = process.platform) {
  if (device.demo) {
    return ['-hide_banner', '-loglevel', 'warning', '-re', '-f', 'lavfi', '-i', `testsrc2=size=${mode.size}:rate=${mode.fps}`, '-an', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'];
  }

  if (platform === 'linux') {
    // Device path, not AVFoundation's "video:audio" token. `:none` makes v4l2
    // look for a node that does not exist.
    return ['-hide_banner', '-loglevel', 'warning', '-f', 'v4l2', '-framerate', String(mode.fps), '-video_size', mode.size, '-i', device.index, '-an', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'];
  }

  let format = 'avfoundation';
  if (platform === 'win32') format = 'dshow';

  const inputId = platform === 'win32' ? device.index : `${device.index}:none`;
  const inputArgs = ['-f', format, '-framerate', String(mode.fps), ...(device.screen ? [] : ['-video_size', mode.size]), '-i', inputId];

  return ['-hide_banner', '-loglevel', 'warning', ...inputArgs, '-an', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'];
}

module.exports = { parseDevices, enumerate, listV4l2Devices, supportsHardwareCapture, JpegParser, captureArgs };
