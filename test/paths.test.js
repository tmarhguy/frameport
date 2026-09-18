const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const {
  resolveSaveRoot,
  resolveCaptureDir,
  uniquePath,
  nextSequentialIndex,
  buildCapturePath,
  timestampStamp
} = require('../src/paths');

test('resolveSaveRoot uses workspace-relative media by default', () => {
  assert.equal(
    resolveSaveRoot({ workspaceFolders: [{ uri: { scheme: 'file', fsPath: '/proj' } }], home: '/home/me' }),
    join('/proj', 'media')
  );
});

test('resolveSaveRoot falls back to ~/FramePort without a workspace', () => {
  assert.equal(resolveSaveRoot({ workspaceFolders: [], home: '/home/me' }), join('/home/me', 'FramePort'));
});

test('resolveSaveRoot accepts absolute saveRoot', () => {
  assert.equal(
    resolveSaveRoot({ saveRoot: '/data/captures', workspaceFolders: [{ uri: { scheme: 'file', fsPath: '/proj' } }] }),
    '/data/captures'
  );
});

test('resolveCaptureDir nests screenshots and videos under the root', () => {
  const folders = [{ uri: { scheme: 'file', fsPath: '/proj' } }];
  assert.equal(resolveCaptureDir({ kind: 'screenshot', workspaceFolders: folders }), join('/proj', 'media', 'screenshots'));
  assert.equal(resolveCaptureDir({ kind: 'video', workspaceFolders: folders }), join('/proj', 'media', 'videos'));
});

test('uniquePath never overwrites existing files', () => {
  const existing = new Set([join('/out', 'frameport-1.png'), join('/out', 'frameport-1-2.png')]);
  assert.equal(uniquePath(join('/out', 'frameport-1.png'), path => existing.has(path)), join('/out', 'frameport-1-3.png'));
  assert.equal(uniquePath(join('/out', 'fresh.png'), path => existing.has(path)), join('/out', 'fresh.png'));
});

test('nextSequentialIndex scans existing frameport-NNNN files', () => {
  assert.equal(nextSequentialIndex('/missing', 'png', () => false, () => []), 1);
  assert.equal(
    nextSequentialIndex('/dir', 'png', () => true, () => ['frameport-0001.png', 'frameport-0007.png', 'other.png']),
    8
  );
});

test('buildCapturePath timestamp style uses dated frameport names', () => {
  const now = new Date(2026, 8, 18, 18, 52, 3);
  const path = buildCapturePath({
    kind: 'screenshot',
    workspaceFolders: [{ uri: { scheme: 'file', fsPath: '/proj' } }],
    now,
    exists: () => false
  });
  assert.equal(path, join('/proj', 'media', 'screenshots', `frameport-${timestampStamp(now)}.png`));
});

test('buildCapturePath sequential style pads indices', () => {
  const path = buildCapturePath({
    kind: 'video',
    filenameStyle: 'sequential',
    workspaceFolders: [{ uri: { scheme: 'file', fsPath: '/proj' } }],
    exists: path => path.endsWith('videos') || path.endsWith('frameport-0001.mp4'),
    listDir: () => ['frameport-0001.mp4']
  });
  assert.equal(path, join('/proj', 'media', 'videos', 'frameport-0002.mp4'));
});
