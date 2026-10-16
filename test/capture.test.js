const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { parseDevices, JpegParser, captureArgs, listV4l2Devices, enumerate, supportsHardwareCapture } = require('../src/capture');

test('enumeration distinguishes video, screen, and audio devices on macOS', () => {
  assert.deepEqual(parseDevices('[avfoundation @ x] AVFoundation video devices:\n[avfoundation @ x] [0] USB Capture\n[avfoundation @ x] [1] Capture screen 0\n[avfoundation @ x] AVFoundation audio devices:\n[avfoundation @ x] [0] Microphone', false, 'darwin'), [{ index: '0', name: 'USB Capture' }]);
});

test('enumeration parses Windows dshow devices', () => {
  const output = `[dshow @ 000001cc91644000] DirectShow video devices
[in#0 @ 000001cc91644000] "HP HD Camera" (video)
[in#0 @ 000001cc91644000] "Microphone" (audio)`;
  assert.deepEqual(parseDevices(output, false, 'win32'), [
    { index: 'video=HP HD Camera', name: 'HP HD Camera' }
  ]);
});

test('JPEG frames survive every possible chunk boundary', () => {
  const frame = Buffer.from([255, 216, 1, 2, 3, 255, 217]);
  const input = Buffer.concat([Buffer.from([0, 4]), frame, frame]);
  for (let split = 1; split < input.length; split++) {
    const frames = [];
    const parser = new JpegParser(f => frames.push(f));
    parser.push(input.subarray(0, split)); parser.push(input.subarray(split));
    assert.deepEqual(frames, [frame, frame]);
  }
});

test('oversized malformed frame is discarded and parser recovers', () => {
  const frames = [];
  const parser = new JpegParser(f => frames.push(f), 16);
  parser.push(Buffer.from([255, 216, ...Array(32).fill(0)]));
  assert.ok(parser.buffer.length <= 16);
  parser.push(Buffer.from([255, 216, 1, 255, 217]));
  assert.equal(frames.length, 1);
});

test('hardware capture disables audio and uses an explicit input', () => {
  const args = captureArgs({ index: '2' }, { size: '1280x720', fps: 30 }, 'darwin');
  assert.equal(args[args.indexOf('-i') + 1], '2:none');
  assert.ok(args.includes('-an'));
});

test('real FFmpeg synthetic capture produces complete JPEG frames', { timeout: 10000 }, async () => {
  const args = captureArgs({ demo: true }, { size: '320x240', fps: 10 }, 'darwin');
  args.splice(args.length - 1, 0, '-frames:v', '3');
  const frames = [];
  const parser = new JpegParser(f => frames.push(f));
  const child = spawn(process.env.FRAMEPORT_TEST_FFMPEG || 'ffmpeg', args);
  let diagnostics = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
  try {
    child.stdout.on('data', data => parser.push(data));
    child.stderr.on('data', data => { diagnostics += data; });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    assert.equal(code, 0, diagnostics);
    assert.equal(frames.length, 3);
  } finally { clearTimeout(timer); child.kill(); }
});

function v4l2Fixture(files, entries = Object.keys(files).map(path => path.split('/')[4]).filter((name, i, all) => name && all.indexOf(name) === i)) {
  const sysRoot = '/sys/class/video4linux';
  return {
    sysRoot,
    exists: path => path === sysRoot || entries.some(entry => path === `/dev/${entry}`) || path in files,
    readdir: () => entries,
    readFile: path => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path];
    }
  };
}

test('linux enumeration keeps the primary V4L2 node and skips metadata nodes', () => {
  const devices = listV4l2Devices(v4l2Fixture({
    '/sys/class/video4linux/video0/name': 'USB Capture HDMI\n',
    '/sys/class/video4linux/video0/index': '0\n',
    '/sys/class/video4linux/video1/name': 'USB Capture HDMI\n',
    '/sys/class/video4linux/video1/index': '1\n',
    '/sys/class/video4linux/video2/name': 'Integrated Camera\n',
    '/sys/class/video4linux/video2/index': '0\n'
  }, ['video0', 'video1', 'video2', 'media0']));
  assert.deepEqual(devices, [
    { index: '/dev/video0', name: 'USB Capture HDMI' },
    { index: '/dev/video2', name: 'Integrated Camera' }
  ]);
});

test('linux enumeration is empty when sysfs is absent and does not spawn FFmpeg', async () => {
  assert.deepEqual(listV4l2Devices({ exists: () => false }), []);
  assert.deepEqual(await enumerate('ffmpeg-not-used', 'linux', { exists: () => false }), []);
  assert.deepEqual(parseDevices('[0] USB Capture', false, 'linux'), []);
  assert.equal(supportsHardwareCapture('linux'), true);
});

test('linux capture opens the device node instead of an AVFoundation input', () => {
  const args = captureArgs({ index: '/dev/video0', name: 'USB Capture HDMI' }, { size: '1280x720', fps: 30 }, 'linux');
  assert.equal(args[args.indexOf('-f') + 1], 'v4l2');
  assert.equal(args[args.indexOf('-i') + 1], '/dev/video0');
  assert.equal(args.includes('-an'), true);
  assert.equal(args.some(part => String(part).includes(':none')), false);
  const size = args.indexOf('-video_size');
  const input = args.indexOf('-i');
  assert.ok(size > -1 && size < input);
});

test('screen sources are explicitly included and keep native dimensions', () => {
  const devices = parseDevices('[avfoundation] AVFoundation video devices:\n[avfoundation] [3] Capture screen 0', true, 'darwin');
  assert.equal(devices[0].screen, true);
  assert.equal(captureArgs(devices[0], { size: '1280x720', fps: 30 }, 'darwin').includes('-video_size'), false);
});
