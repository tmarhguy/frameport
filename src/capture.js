const { spawn } = require('node:child_process');

// FFmpeg emits device diagnostics on stderr, including for successful enumeration.
function parseDevices(text, includeScreens = false, platform = process.platform) {
  const devices = [];
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

function enumerate(executable, platform = process.platform) {
  return new Promise((resolve, reject) => {
    let format = 'avfoundation';
    if (platform === 'win32') format = 'dshow';
    else if (platform === 'linux') format = 'v4l2';

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

  let format = 'avfoundation';
  if (platform === 'win32') format = 'dshow';
  else if (platform === 'linux') format = 'v4l2';

  const inputId = platform === 'win32' ? device.index : `${device.index}:none`;
  const inputArgs = ['-f', format, '-framerate', String(mode.fps), ...(device.screen ? [] : ['-video_size', mode.size]), '-i', inputId];

  return ['-hide_banner', '-loglevel', 'warning', ...inputArgs, '-an', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'];
}

module.exports = { parseDevices, enumerate, JpegParser, captureArgs };
