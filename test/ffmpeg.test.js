const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveFfmpegPath,
  isMissingFFmpegError,
  helpButtons,
  brewPath,
  offerFFmpegHelp,
  installViaHomebrew,
  GUIDE_URL,
  BREW_URL
} = require('../src/ffmpeg');

test('resolveFfmpegPath prefers an explicit setting', () => {
  assert.equal(resolveFfmpegPath('/custom/ffmpeg', 'darwin', () => false), '/custom/ffmpeg');
});

test('resolveFfmpegPath finds Homebrew ffmpeg on macOS', () => {
  assert.equal(
    resolveFfmpegPath('ffmpeg', 'darwin', path => path === '/opt/homebrew/bin/ffmpeg'),
    '/opt/homebrew/bin/ffmpeg'
  );
  assert.equal(
    resolveFfmpegPath('ffmpeg', 'darwin', path => path === '/usr/local/bin/ffmpeg'),
    '/usr/local/bin/ffmpeg'
  );
});

test('resolveFfmpegPath leaves default on non-darwin without Homebrew paths', () => {
  assert.equal(resolveFfmpegPath('ffmpeg', 'linux', () => true), 'ffmpeg');
  assert.equal(resolveFfmpegPath('ffmpeg', 'win32', () => true), 'ffmpeg');
});

test('isMissingFFmpegError detects ENOENT and launch copy', () => {
  assert.equal(isMissingFFmpegError({ code: 'ENOENT', message: 'spawn ffmpeg ENOENT' }), true);
  assert.equal(isMissingFFmpegError(new Error('spawn /opt/homebrew/bin/ffmpeg ENOENT')), true);
  assert.equal(isMissingFFmpegError('Could not launch FFmpeg: spawn ffmpeg ENOENT. Open settings to check its path.'), true);
  assert.equal(isMissingFFmpegError(new Error('Device discovery timed out.')), false);
  assert.equal(isMissingFFmpegError(new Error('Capture ended (1). Check device permissions.')), false);
});

test('helpButtons includes Homebrew only on darwin', () => {
  assert.deepEqual(helpButtons('darwin'), ['Install via Homebrew', 'Install guide', 'Open Settings']);
  assert.deepEqual(helpButtons('linux'), ['Install guide', 'Open Settings']);
  assert.deepEqual(helpButtons('win32'), ['Install guide', 'Open Settings']);
});

test('brewPath resolves common Homebrew locations', () => {
  assert.equal(brewPath(path => path === '/opt/homebrew/bin/brew'), '/opt/homebrew/bin/brew');
  assert.equal(brewPath(() => false), undefined);
});

test('offerFFmpegHelp opens guide and settings from actions', async () => {
  const opened = [];
  const commands = [];
  const api = {
    window: {
      async showErrorMessage(message, ...buttons) {
        assert.match(message, /FramePort:/);
        assert.deepEqual(buttons, ['Install via Homebrew', 'Install guide', 'Open Settings']);
        return 'Install guide';
      }
    },
    env: { async openExternal(uri) { opened.push(uri.toString()); } },
    Uri: { parse: value => ({ toString: () => value }) },
    commands: { async executeCommand(command, query) { commands.push([command, query]); } }
  };
  assert.equal(await offerFFmpegHelp(api, { platform: 'darwin' }), 'Install guide');
  assert.deepEqual(opened, [GUIDE_URL]);

  api.window.showErrorMessage = async () => 'Open Settings';
  assert.equal(await offerFFmpegHelp(api, { platform: 'linux' }), 'Open Settings');
  assert.deepEqual(commands, [['workbench.action.openSettings', '@id:frameport.ffmpegPath']]);
});

test('installViaHomebrew opens brew.sh when brew is missing', async () => {
  const opened = [];
  const api = {
    window: {
      async showWarningMessage() { return 'Install'; },
      async showInformationMessage() { return undefined; },
      createTerminal() { throw new Error('should not create a terminal without brew'); }
    },
    env: { async openExternal(uri) { opened.push(uri.toString()); } },
    Uri: { parse: value => ({ toString: () => value }) }
  };
  await installViaHomebrew(api, () => false);
  assert.deepEqual(opened, [BREW_URL]);
});

test('installViaHomebrew runs brew install in a terminal when brew exists', async () => {
  const sent = [];
  const api = {
    window: {
      async showWarningMessage(_message, _options, ...buttons) {
        assert.deepEqual(buttons, ['Install']);
        return 'Install';
      },
      createTerminal({ name }) {
        assert.equal(name, 'FramePort · FFmpeg');
        return { show() {}, sendText(text, execute) { sent.push([text, execute]); } };
      }
    },
    env: { async openExternal() { throw new Error('should not open brew.sh'); } },
    Uri: { parse: value => ({ toString: () => value }) }
  };
  await installViaHomebrew(api, path => path === '/opt/homebrew/bin/brew');
  assert.deepEqual(sent, [['brew install ffmpeg', true]]);
});

test('installViaHomebrew cancels without opening Terminal', async () => {
  const api = {
    window: {
      async showWarningMessage() { return undefined; },
      createTerminal() { throw new Error('should not create a terminal'); }
    },
    env: { async openExternal() { throw new Error('should not open'); } },
    Uri: { parse: value => ({ toString: () => value }) }
  };
  await installViaHomebrew(api, () => true);
});
