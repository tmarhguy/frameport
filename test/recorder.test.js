const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { EventEmitter } = require('node:events');
const { execFileSync } = require('node:child_process');
const { Recorder } = require('../src/recorder');
const ffmpegBin = process.env.FRAMEPORT_TEST_FFMPEG || 'ffmpeg';
// ffprobe ships next to ffmpeg in full installs but may be absent from PATH;
// resolve it relative to the configured ffmpeg first.
const ffprobeBin = process.env.FRAMEPORT_TEST_FFPROBE || (ffmpegBin.includes('/') ? join(dirname(ffmpegBin), 'ffprobe') : 'ffprobe');
const executable = ffmpegBin;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('records timed MP4 from the existing JPEG feed and decodes it', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-record-'));
  const path = join(dir, 'capture.mp4');
  let diagnostics = '';
  const recorder = new Recorder({ executable: () => executable, onLog: text => { diagnostics += text; } });
  try {
    const jpeg = execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    recorder.start(path, jpeg);
    assert.throws(() => recorder.start(path, jpeg), /already active/);
    for (let n = 0; n < 45; n++) { await sleep(33); recorder.push(jpeg); }
    const result = await recorder.stop();
    assert.equal(result.phase, 'saved', diagnostics);
    assert.ok(readFileSync(path).length > 1000);
    const probe = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]));
    assert.equal(probe.streams[0].codec_name, 'h264');
    assert.equal(probe.streams[0].width, 320);
    assert.ok(Number(probe.format.duration) > 0.8 && Number(probe.format.duration) < 4, `Unexpected duration ${probe.format.duration}`);
    execFileSync(executable, ['-v', 'error', '-i', path, '-f', 'null', '-']);
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('existing destination is never overwritten', { timeout: 15000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-existing-'));
  const path = join(dir, 'capture.mp4');
  const original = Buffer.from('existing recording');
  writeFileSync(path, original);
  const recorder = new Recorder({ executable: () => executable });
  try {
    const jpeg = execFileSync(executable, ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=32x32', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    assert.throws(() => recorder.start(path, jpeg), /does not overwrite/);
    assert.deepEqual(readFileSync(path), original);
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('stop immediately after start still finalizes a decodable clip', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-quick-'));
  const path = join(dir, 'capture.mp4');
  const recorder = new Recorder({ executable: () => executable });
  try {
    const jpeg = execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=30', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    recorder.start(path, jpeg);
    const result = await recorder.stop();
    assert.equal(result.phase, 'saved', JSON.stringify(result));
    assert.ok(readFileSync(path).length > 0);
    execFileSync(executable, ['-v', 'error', '-i', path, '-f', 'null', '-']);
    const repeat = await recorder.stop();
    assert.equal(repeat.phase, 'saved');
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('delivery gap is reflected in wall-clock clip duration', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-gap-'));
  const path = join(dir, 'capture.mp4');
  const recorder = new Recorder({ executable: () => executable });
  try {
    const jpeg = execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=30', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    recorder.start(path, jpeg);
    // Arrival timestamps are assigned when the encoder reads frames, so the
    // initial encoder-startup delay is not represented; gaps between reads are.
    for (let n = 0; n < 4; n++) { await sleep(400); recorder.push(jpeg); }
    const result = await recorder.stop();
    assert.equal(result.phase, 'saved', JSON.stringify(result));
    const probe = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-show_format', '-of', 'json', path]));
    const duration = Number(probe.format.duration);
    assert.ok(duration > 0.4 && duration < 4, `Gap missing from duration ${probe.format.duration}`);
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('missing executable reports failure without false success', { timeout: 15000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-noexec-'));
  const path = join(dir, 'capture.mp4');
  const recorder = new Recorder({ executable: () => '/nonexistent-ffmpeg-xyz' });
  try {
    const jpeg = Buffer.from([255, 216, 1, 255, 217]);
    recorder.start(path, jpeg);
    const result = await recorder.stop();
    assert.equal(result.phase, 'error', JSON.stringify(result));
    assert.ok(result.error);
    assert.equal(existsSync(path), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unwritable destination reports failure and creates nothing', { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-unwritable-'));
  const path = join(dir, 'no-such-dir', 'capture.mp4');
  const recorder = new Recorder({ executable: () => executable });
  try {
    const jpeg = execFileSync(executable, ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=32x32', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    recorder.start(path, jpeg);
    const result = await recorder.stop();
    assert.equal(result.phase, 'error', JSON.stringify(result));
    assert.equal(existsSync(path), false);
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('killed encoder fails honestly and preserves the partial file', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-killed-'));
  const path = join(dir, 'capture.mp4');
  const recorder = new Recorder({ executable: () => executable });
  try {
    const jpeg = execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=30', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    recorder.start(path, jpeg);
    // Feed until the first fragment flushes (keyframes pace fragment output).
    let flushed = false;
    for (let n = 0; n < 420 && !flushed; n++) {
      await sleep(33);
      recorder.push(jpeg);
      if (n % 3 === 0) flushed = existsSync(path) && readFileSync(path).length > 0;
    }
    assert.ok(existsSync(path) && readFileSync(path).length > 0, 'expected flushed output before kill');
    const before = readFileSync(path);
    recorder.child.kill('SIGKILL');
    recorder.push(jpeg);
    const result = await recorder.done;
    assert.equal(result.phase, 'error', JSON.stringify(result));
    assert.deepEqual(readFileSync(path), before, 'partial file must be preserved, not truncated or removed');
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('repeat recording to a new path works after a completed clip', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-repeat-'));
  const recorder = new Recorder({ executable: () => executable });
  try {
    const jpeg = execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=30', '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1']);
    for (const name of ['first.mp4', 'second.mp4']) {
      const path = join(dir, name);
      recorder.start(path, jpeg);
      for (let n = 0; n < 10; n++) { await sleep(33); recorder.push(jpeg); }
      const result = await recorder.stop();
      assert.equal(result.phase, 'saved', `${name}: ${JSON.stringify(result)}`);
      assert.ok(readFileSync(path).length > 0);
    }
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

function mockEncoder() {
  const child = new EventEmitter();
  const stdin = new EventEmitter();
  Object.assign(stdin, {
    writableLength: 0, destroyed: false, written: [], ended: false,
    write(chunk) { this.written.push(chunk.length); return true; },
    end() { this.ended = true; }
  });
  Object.assign(child, { stdin, stderr: new EventEmitter(), exitCode: null, signalCode: null, kills: [] });
  child.kill = signal => { child.kills.push(signal); };
  return child;
}

test('slow encoder drops frames without stalling delivery', () => {
  const child = mockEncoder();
  const recorder = new Recorder({ executable: () => 'ffmpeg', spawnProcess: () => child });
  const jpeg = Buffer.from([255, 216, 1, 2, 3, 255, 217]);
  recorder.start('/tmp/frameport-mock.mp4', jpeg);
  child.stdin.writableLength = 65536; // encoder not draining
  const started = Date.now();
  for (let n = 0; n < 1000; n++) recorder.push(jpeg);
  assert.ok(Date.now() - started < 2000, 'delivery must never block on the encoder');
  assert.equal(recorder.dropped, 1000);
  assert.equal(recorder.accepted, 1);
  assert.equal(child.stdin.written.length, 1, 'at most one frame queued');
  child.emit('close', 0);
  assert.equal(recorder.state.phase, 'error');
});

test('finalization timeout kills a hung encoder and reports failure', { timeout: 10000 }, async () => {
  const child = mockEncoder();
  const recorder = new Recorder({ executable: () => 'ffmpeg', spawnProcess: () => child, finalizeTimeoutMs: 150 });
  recorder.start('/tmp/frameport-hung.mp4', Buffer.from([255, 216, 1, 255, 217]));
  const stopping = recorder.stop();
  assert.equal(recorder.state.phase, 'finalizing');
  await sleep(400);
  assert.deepEqual(child.kills, ['SIGKILL']);
  child.emit('close', null);
  const result = await stopping;
  assert.equal(result.phase, 'error', JSON.stringify(result));
  assert.match(result.error, /timed out/);
});

test('ten-second clip agrees with source timeline and preserves a one-second gap', { timeout: 40000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-timeline-'));
  const path = join(dir, 'timeline.mp4');
  const recorder = new Recorder({ executable: () => executable });
  try {
    // Distinct frames carrying visible time (testsrc2 frame counter), so a
    // compressed timeline or swallowed gap is detectable in encoded PTS.
    const video = execFileSync(executable, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=13', '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
    const frames = [];
    let start = -1;
    for (let i = 0; i < video.length - 1; i++) {
      if (video[i] === 0xFF && video[i + 1] === 0xD8) start = i;
      if (video[i] === 0xFF && video[i + 1] === 0xD9 && start >= 0) { frames.push(video.subarray(start, i + 2)); start = -1; }
    }
    assert.ok(frames.length >= 300, `need 300 distinct frames, got ${frames.length}`);
    recorder.start(path, frames[0]);
    const pushTimes = [process.hrtime.bigint()];
    for (let n = 1; n < 300; n++) {
      if (n === 150) await sleep(1000); // deliberate one-second internal gap
      else await sleep(33); // pace a 30 fps source; wallclock spans 10+ seconds
      recorder.push(frames[n % frames.length]);
      pushTimes.push(process.hrtime.bigint());
    }
    const result = await recorder.stop();
    assert.equal(result.phase, 'saved', JSON.stringify(result));
    assert.ok(result.accepted > 0, 'expected accepted frames');
    assert.ok(result.encodedFrames > 0, `expected encoded output confirmation, got ${JSON.stringify(result)}`);
    const pushSpanMs = Number(pushTimes[pushTimes.length - 1] - pushTimes[0]) / 1e6;
    assert.ok(pushSpanMs >= 10000, `push span ${pushSpanMs}ms should cover 10+ seconds`);
    const probe = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-show_format', '-of', 'json', path], { maxBuffer: 16 * 1024 * 1024 }));
    const durationMs = Number(probe.format.duration) * 1000;
    // Gate: after explicit readiness, clip agrees with source timeline within
    // 250 ms plus one source-frame interval (33 ms at 30 fps).
    assert.ok(Math.abs(durationMs - pushSpanMs) <= 250 + 34, `duration ${durationMs}ms vs push span ${pushSpanMs}ms`);
    const packets = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-show_packets', '-select_streams', 'v:0', '-of', 'json', path], { maxBuffer: 64 * 1024 * 1024 }));
    const pts = packets.packets.map(p => Number(p.pts_time)).sort((a, b) => a - b);
    assert.ok(pts.length >= 200, `expected most frames encoded, got ${pts.length}`);
    let maxGap = 0;
    for (let i = 1; i < pts.length; i++) maxGap = Math.max(maxGap, pts[i] - pts[i - 1]);
    // Gate: the deliberate one-second gap survives within 100 ms plus one frame.
    assert.ok(Math.abs(maxGap - 1) <= 0.100 + 0.034, `largest PTS gap ${maxGap}s should reflect the 1s pause`);
  } finally { await recorder.stop(); rmSync(dir, { recursive: true, force: true }); }
});

test('clean exit with header-only output and accepted input is not reported saved', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameport-headeronly-'));
  const path = join(dir, 'capture.mp4');
  const child = mockEncoder();
  // Simulate an encoder that accepts stdin, writes only a header, then exits
  // cleanly while reporting zero encoded frames on the progress pipe.
  child.stdio = { 3: new EventEmitter() };
  const recorder = new Recorder({ executable: () => 'ffmpeg', spawnProcess: () => child });
  try {
    const jpeg = Buffer.from([255, 216, 1, 2, 3, 255, 217]);
    recorder.start(path, jpeg);
    child.stdio[3].emit('data', Buffer.from('frame=0\nfps=0.00\ntotal_size=512\nout_time_ms=0\nprogress=end\n'));
    writeFileSync(path, Buffer.alloc(512)); // header-only output
    child.emit('close', 0);
    const result = await recorder.done;
    assert.equal(result.phase, 'error', JSON.stringify(result));
    assert.equal(result.encodedFrames, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('recording encoder selection builds supported arguments with software default', () => {
  const { recordingArgs } = require('../src/recorder');
  const software = recordingArgs('/tmp/a.mp4');
  assert.ok(software.includes('libx264'), 'default must remain software libx264');
  assert.ok(!software.includes('h264_videotoolbox'));
  assert.ok(software.includes('pipe:3'), 'progress must ride a separate pipe from diagnostics');
  const hardware = recordingArgs('/tmp/b.mp4', { encoder: 'h264_videotoolbox' });
  assert.ok(hardware.includes('h264_videotoolbox'));
  assert.ok(!hardware.includes('libx264'));
  assert.ok(hardware.includes('pipe:3'));
});
