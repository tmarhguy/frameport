const { existsSync, readdirSync } = require('node:fs');
const { isAbsolute, join } = require('node:path');
const { homedir } = require('node:os');

const DEFAULTS = {
  saveRoot: 'media',
  screenshotFolder: 'screenshots',
  videoFolder: 'videos',
  saveMode: 'auto',
  filenameStyle: 'timestamp'
};

function pad(value, width = 2) {
  return String(value).padStart(width, '0');
}

function timestampStamp(now = new Date()) {
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function resolveSaveRoot({
  saveRoot = DEFAULTS.saveRoot,
  workspaceFolders = [],
  home = homedir()
} = {}) {
  const configured = String(saveRoot || DEFAULTS.saveRoot).trim() || DEFAULTS.saveRoot;
  if (isAbsolute(configured)) return configured;
  const workspace = workspaceFolders.find(folder => folder?.uri?.scheme === 'file')?.uri?.fsPath
    || (typeof workspaceFolders[0] === 'string' ? workspaceFolders[0] : undefined);
  if (workspace) return join(workspace, configured);
  return join(home, 'FramePort');
}

function resolveCaptureDir({
  kind,
  saveRoot,
  screenshotFolder = DEFAULTS.screenshotFolder,
  videoFolder = DEFAULTS.videoFolder,
  workspaceFolders,
  home
} = {}) {
  const root = resolveSaveRoot({ saveRoot, workspaceFolders, home });
  const sub = kind === 'video'
    ? (String(videoFolder || DEFAULTS.videoFolder).trim() || DEFAULTS.videoFolder)
    : (String(screenshotFolder || DEFAULTS.screenshotFolder).trim() || DEFAULTS.screenshotFolder);
  return join(root, sub);
}

function uniquePath(candidate, exists = existsSync) {
  if (!exists(candidate)) return candidate;
  const match = candidate.match(/^(.*)(\.[^.]+)$/);
  const stem = match ? match[1] : candidate;
  const ext = match ? match[2] : '';
  for (let n = 2; n < 10000; n += 1) {
    const next = `${stem}-${n}${ext}`;
    if (!exists(next)) return next;
  }
  throw new Error('Could not find an unused capture filename.');
}

function nextSequentialIndex(dir, ext, exists = existsSync, listDir = readdirSync) {
  if (!exists(dir)) return 1;
  let max = 0;
  for (const name of listDir(dir)) {
    const match = name.match(new RegExp(`^frameport-(\\d{4})\\.${ext}$`, 'i'));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function buildCapturePath({
  kind,
  saveRoot,
  screenshotFolder,
  videoFolder,
  filenameStyle = DEFAULTS.filenameStyle,
  workspaceFolders,
  home,
  now = new Date(),
  exists = existsSync,
  listDir = readdirSync
} = {}) {
  const dir = resolveCaptureDir({ kind, saveRoot, screenshotFolder, videoFolder, workspaceFolders, home });
  const ext = kind === 'video' ? 'mp4' : 'png';
  const style = filenameStyle === 'sequential' ? 'sequential' : 'timestamp';
  const base = style === 'sequential'
    ? `frameport-${pad(nextSequentialIndex(dir, ext, exists, listDir), 4)}.${ext}`
    : `frameport-${timestampStamp(now)}.${ext}`;
  return uniquePath(join(dir, base), exists);
}

function readSaveConfig(getConfiguration) {
  const config = getConfiguration('frameport');
  return {
    saveRoot: config.get('saveRoot', DEFAULTS.saveRoot),
    screenshotFolder: config.get('screenshotFolder', DEFAULTS.screenshotFolder),
    videoFolder: config.get('videoFolder', DEFAULTS.videoFolder),
    saveMode: config.get('saveMode', DEFAULTS.saveMode) === 'ask' ? 'ask' : 'auto',
    filenameStyle: config.get('filenameStyle', DEFAULTS.filenameStyle) === 'sequential' ? 'sequential' : 'timestamp'
  };
}

module.exports = {
  DEFAULTS,
  timestampStamp,
  resolveSaveRoot,
  resolveCaptureDir,
  uniquePath,
  nextSequentialIndex,
  buildCapturePath,
  readSaveConfig
};
