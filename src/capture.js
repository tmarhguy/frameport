const { spawn } = require('node:child_process');

// FFmpeg emits device diagnostics on stderr, including for successful enumeration.
function parseDevices(text, includeScreens = false) {
  let video = false;
  const devices = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.includes('AVFoundation video devices:')) { video = true; continue; }
    if (line.includes('AVFoundation audio devices:')) video = false;
    const match = video && line.match(/\[(\d+)\]\s+(.+)$/);
    if (match && (includeScreens || !match[2].startsWith('Capture screen'))) devices.push({ index: match[1], name: match[2].trim(), ...(match[2].startsWith('Capture screen') ? { screen: true } : {}) });
  }
  return devices;
}

function enumerate(executable) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { stdio: ['ignore', 'ignore', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Device discovery timed out.')); }, 8000);
    child.stderr.on('data', data => { output = (output + data).slice(-65536); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', () => { clearTimeout(timer); resolve(parseDevices(output, true)); });
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

function captureArgs(device, mode) {
  const input = device.demo
    ? ['-re', '-f', 'lavfi', '-i', `testsrc2=size=${mode.size}:rate=${mode.fps}`]
    : ['-f', 'avfoundation', '-framerate', String(mode.fps), ...(device.screen ? [] : ['-video_size', mode.size]), '-i', `${device.index}:none`];
  return ['-hide_banner', '-loglevel', 'warning', ...input, '-an', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'];
}

module.exports = { parseDevices, enumerate, JpegParser, captureArgs };
