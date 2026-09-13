const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { CaptureSession } = require('../src/session');
const mode = { label: 'test', size: '320x240', fps: 10 };
function fixture() {
  const children = [], states = [];
  const session = new CaptureSession({ executable: () => 'ffmpeg', onState: state => states.push(state), onLog() {}, spawnProcess() {
    const child = new EventEmitter();
    Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null, kills: [] });
    child.kill = signal => { child.kills.push(signal); };
    child.finish = () => { child.signalCode = 'SIGTERM'; child.emit('close', null); };
    children.push(child); return child;
  } });
  return { session, children, states };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('rapid restarts wait for old process and only launch newest selection', async () => {
  const { session, children } = fixture();
  await session.start({ demo: true, name: 'first' }, mode);
  const second = session.start({ demo: true, name: 'second' }, mode);
  await flush();
  const third = session.start({ demo: true, name: 'third' }, mode);
  await flush();
  assert.equal(children.length, 1);
  assert.deepEqual(children[0].kills, ['SIGTERM']);
  children[0].finish();
  await Promise.all([second, third]);
  assert.equal(children.length, 2);
  const stopping = session.stop(); await flush(); children[1].finish(); await stopping;
});
test('stop invalidates late frames and cancels pending startup', async () => {
  const { session, children } = fixture();
  await session.start({ demo: true, name: 'first' }, mode);
  const restart = session.start({ demo: true, name: 'second' }, mode);
  const stopping = session.stop();
  children[0].stdout.write(Buffer.from([255, 216, 1, 255, 217]));
  assert.equal(session.latest, undefined);
  await flush(); children[0].finish();
  await Promise.all([restart, stopping]);
  assert.equal(children.length, 1);
  assert.equal(session.state.phase, 'stopped');
});
test('spawn failure retains actionable launch error', async () => {
  const { session, children } = fixture();
  await session.start({ demo: true, name: 'first' }, mode);
  children[0].emit('error', new Error('ENOENT'));
  children[0].emit('close', -2);
  assert.match(session.state.text, /Could not launch FFmpeg.*ENOENT/);
  await session.stop();
});


test('capture teardown waits for recording finalization', async () => {
  const { session, children } = fixture();
  await session.start({ demo: true, name: 'first' }, mode);
  let finish;
  session.beforeTransition = () => new Promise(resolve => { finish = resolve; });
  const stopping = session.stop();
  await flush();
  assert.deepEqual(children[0].kills, []);
  finish(); await flush();
  assert.deepEqual(children[0].kills, ['SIGTERM']);
  children[0].finish(); await stopping;
});
