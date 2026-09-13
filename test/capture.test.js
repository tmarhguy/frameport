const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { parseDevices, JpegParser, captureArgs } = require('../src/capture');

test('enumeration distinguishes video, screen, and audio devices', () => {
  assert.deepEqual(parseDevices('[avfoundation @ x] AVFoundation video devices:\n[avfoundation @ x] [0] USB Capture\n[avfoundation @ x] [1] Capture screen 0\n[avfoundation @ x] AVFoundation audio devices:\n[avfoundation @ x] [0] Microphone'), [{ index: '0', name: 'USB Capture' }]);
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
  const args = captureArgs({ index: '2' }, { size: '1280x720', fps: 30 });
  assert.equal(args[args.indexOf('-i') + 1], '2:none');
  assert.ok(args.includes('-an'));
});

test('real FFmpeg synthetic capture produces complete JPEG frames', { timeout: 10000 }, async () => {
  const args = captureArgs({ demo: true }, { size: '320x240', fps: 10 });
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


test('screen sources are explicitly included and keep native dimensions', () => {
  const devices = parseDevices('[avfoundation] AVFoundation video devices:\n[avfoundation] [3] Capture screen 0', true);
  assert.equal(devices[0].screen, true);
  assert.equal(captureArgs(devices[0], { size: '1280x720', fps: 30 }).includes('-video_size'), false);
});
