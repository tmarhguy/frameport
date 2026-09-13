const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateScreenshotData, lastCaptureAction, maxPixelsForLimit, SCREENSHOT_LIMIT_BYTES } = require('../src/screenshot');
const { requestText } = require('../src/session');

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('valid PNG passes without allocating a huge image', () => {
  const result = validateScreenshotData(tinyPng);
  assert.equal(result.ok, true);
  assert.ok(result.bytes.length > 8);
});

test('oversized payload is rejected with a small configured limit', () => {
  const result = validateScreenshotData(tinyPng, 10);
  assert.equal(result.ok, false);
  assert.match(result.error, /too large/);
});

test('non-PNG and corrupt payloads fail visibly instead of silently', () => {
  assert.equal(validateScreenshotData('not-a-data-url').ok, false);
  assert.equal(validateScreenshotData('data:image/png;base64,!!!!').ok, false);
  assert.equal(validateScreenshotData('data:image/jpeg;base64,/9j/').ok, false);
});

test('pixel budget matches the encoded byte limit', () => {
  assert.equal(maxPixelsForLimit(), Math.floor((SCREENSHOT_LIMIT_BYTES * 3) / 4 / 4));
  assert.ok(maxPixelsForLimit() > 6000000);
});

test('last-capture reveal distinguishes local, missing, and remote destinations', () => {
  assert.deepEqual(lastCaptureAction(undefined), { kind: 'none' });
  assert.deepEqual(lastCaptureAction({ scheme: 'file', fsPath: '/tmp/a.png' }, true), { kind: 'reveal' });
  assert.deepEqual(lastCaptureAction({ scheme: 'file', fsPath: '/tmp/a.png' }, false), { kind: 'missing' });
  assert.deepEqual(lastCaptureAction({ scheme: 'vscode-remote', path: '/a.png' }, true), { kind: 'remote' });
  assert.deepEqual(lastCaptureAction({ scheme: 'untitled', path: 'x' }, true), { kind: 'remote' });
});

test('streaming status never reports an unapplied camera resolution for screens', () => {
  assert.equal(requestText({ name: 'USB Video' }, { label: '1280 × 720 · 30 fps', fps: 30 }), 'USB Video · Requested 1280 × 720 · 30 fps');
  assert.equal(requestText({ name: 'Capture screen 0', screen: true }, { label: '1280 × 720 · 30 fps', fps: 30 }), 'Capture screen 0 · Native size · 30 fps requested');
  assert.equal(requestText({ name: 'Capture screen 0', screen: true }, { label: '1920 × 1080 · 60 fps', fps: 60 }), 'Capture screen 0 · Native size · 60 fps requested');
});
