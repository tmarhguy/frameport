#!/usr/bin/env node
// Smoke-test the missing-FFmpeg recovery path without uninstalling host FFmpeg.
// Uses a nonexistent executable path and a mocked VS Code API.
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { enumerate } = require('../src/capture');
const { CaptureSession } = require('../src/session');
const {
  resolveFfmpegPath,
  isMissingFFmpegError,
  helpButtons,
  offerFFmpegHelp,
  reportFFmpegProblem,
  installViaHomebrew,
  GUIDE_URL,
  BREW_URL
} = require('../src/ffmpeg');

const MISSING = '/nonexistent-frameport-ffmpeg-xyz';
const flush = () => new Promise(resolve => setImmediate(resolve));

function mockApi({ choice, confirm = 'Install', brewExists = false } = {}) {
  const opened = [];
  const commands = [];
  const terminals = [];
  return {
    opened,
    commands,
    terminals,
    api: {
      window: {
        async showErrorMessage(message, ...buttons) {
          return choice ?? buttons[0];
        },
        async showWarningMessage() { return confirm; },
        async showInformationMessage() { return undefined; },
        createTerminal(options) {
          const terminal = { options, shown: false, sent: [], show() { this.shown = true; }, sendText(text, execute) { this.sent.push([text, execute]); } };
          terminals.push(terminal);
          return terminal;
        }
      },
      env: { async openExternal(uri) { opened.push(String(uri)); } },
      Uri: { parse: value => value },
      commands: { async executeCommand(command, query) { commands.push([command, query]); } }
    },
    exists: path => brewExists && (path.endsWith('/brew') || path.includes('brew'))
  };
}

async function main() {
  console.log('FramePort · missing-FFmpeg smoke (no host uninstall)\n');

  // 1) Real ENOENT from a bogus path (PATH-independent).
  const probe = spawnSync(MISSING, ['-version'], { encoding: 'utf8' });
  assert.ok(probe.error || probe.status !== 0, 'bogus ffmpeg should fail to launch');
  assert.equal(isMissingFFmpegError(probe.error || { code: 'ENOENT', message: `spawn ${MISSING} ENOENT` }), true);
  console.log('✓ spawn of missing binary is detected as missing FFmpeg');

  // 2) Device enumeration fails the same way FramePort's selectDevice catch sees.
  await assert.rejects(() => enumerate(MISSING), error => {
    assert.equal(isMissingFFmpegError(error), true);
    return true;
  });
  console.log('✓ enumerate() rejects with a missing-FFmpeg error');

  // 3) Capture session surfaces actionable launch text.
  const states = [];
  const session = new CaptureSession({
    executable: () => MISSING,
    onState: state => states.push(state),
    onLog() {},
    spawnProcess(command, args, options) {
      const child = new EventEmitter();
      Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null, kill() {} });
      queueMicrotask(() => child.emit('error', Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' })));
      return child;
    }
  });
  await session.start({ demo: true, name: 'Test pattern' }, { label: 'test', size: '320x240', fps: 10 });
  await flush();
  const errorState = states.find(state => state.phase === 'error');
  assert.ok(errorState, 'session should enter error phase');
  assert.equal(isMissingFFmpegError(errorState.text), true);
  await session.stop();
  console.log('✓ CaptureSession error text triggers missing-FFmpeg help');

  // 4) Linux recovery: guide + settings (what Docker / non-mac users see).
  assert.deepEqual(helpButtons('linux'), ['Install guide', 'Open Settings']);
  {
    const mock = mockApi({ choice: 'Install guide' });
    await reportFFmpegProblem(mock.api, { code: 'ENOENT', message: `spawn ${MISSING} ENOENT` });
    assert.deepEqual(mock.opened, [GUIDE_URL]);
  }
  {
    const mock = mockApi({ choice: 'Open Settings' });
    await offerFFmpegHelp(mock.api, { platform: 'linux' });
    assert.deepEqual(mock.commands, [['workbench.action.openSettings', '@id:frameport.ffmpegPath']]);
  }
  console.log('✓ Linux help offers Install guide and Open Settings');

  // 5) macOS recovery: Homebrew confirm → Terminal, or brew.sh if brew missing.
  assert.ok(helpButtons('darwin').includes('Install via Homebrew'));
  {
    const mock = mockApi({ choice: 'Install via Homebrew', confirm: 'Install', brewExists: true });
    await offerFFmpegHelp(mock.api, { platform: 'darwin', exists: mock.exists });
    assert.equal(mock.terminals.length, 1);
    assert.deepEqual(mock.terminals[0].sent, [['brew install ffmpeg', true]]);
  }
  {
    const mock = mockApi({ confirm: 'Install', brewExists: false });
    await installViaHomebrew(mock.api, () => false);
    assert.deepEqual(mock.opened, [BREW_URL]);
  }
  console.log('✓ macOS help offers Homebrew install (Terminal) and brew.sh fallback');

  // 6) Host Homebrew paths must not leak into an explicit missing setting.
  assert.equal(resolveFfmpegPath(MISSING, 'darwin', () => true), MISSING);
  console.log('✓ explicit ffmpegPath override is respected even when Homebrew exists on the host');

  const which = spawnSync('sh', ['-c', 'command -v ffmpeg || true'], { encoding: 'utf8' });
  const hostFfmpeg = (which.stdout || '').trim();
  console.log(`\nHost ffmpeg left untouched${hostFfmpeg ? `: ${hostFfmpeg}` : ' (not on PATH in this environment)'}.`);
  console.log('PASS · missing-FFmpeg recovery smoke');
}

main().catch(error => {
  console.error('FAIL · missing-FFmpeg recovery smoke');
  console.error(error);
  process.exitCode = 1;
});
