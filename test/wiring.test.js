const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { CaptureSession } = require('../src/session');
const { Recorder } = require('../src/recorder');

const ffmpegBin = process.env.FRAMEPORT_TEST_FFMPEG || 'ffmpeg';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Real module wiring (headless): capture session → recorder → file.
// This is not an Extension Host test; see scripts/test-host.js for that boundary.
test('synthetic session feeds the recorder and finalizes on stop', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-wiring-'));
  const path = join(dir, 'wiring.mp4');
  const recorder = new Recorder({ executable: () => ffmpegBin, onLog: () => {}, onState: () => {} });
  const session = new CaptureSession({
    executable: () => ffmpegBin,
    onState: () => {},
    onLog: () => {},
    onFrame: frame => recorder.push(frame),
    beforeTransition: () => recorder.stop(),
  });
  try {
    await session.start({ demo: true, name: 'Test pattern' }, { label: '640 × 480 · 30 fps', size: '640x480', fps: 30 });
    // Wait for the first decoded frame (synthetic capture, no hardware).
    const deadline = Date.now() + 8000;
    while (!session.latest && Date.now() < deadline) await sleep(50);
    assert.ok(session.latest, 'expected a synthetic frame');
    assert.equal(session.state.phase, 'streaming');
    recorder.start(path, session.latest.data);
    await sleep(2500);
    assert.ok(recorder.accepted > 0, 'expected accepted frames through real wiring');
    const result = await recorder.stop();
    assert.equal(result.phase, 'saved', JSON.stringify(result));
    assert.ok(result.encodedFrames > 0, 'expected encoded output confirmation');
    assert.ok(readFileSync(path).length > 1000);
    // Teardown finalizes before the capture process exits; no owned process remains.
    await session.stop();
    await sleep(300);
    assert.equal(session.child, undefined);
    assert.equal(recorder.active, false);
  } finally {
    await recorder.stop().catch(() => {});
    await session.stop().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});
