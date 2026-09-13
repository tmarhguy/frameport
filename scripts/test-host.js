// Launcher for the Extension Development Host integration test.
//
// IMPORTANT: run only with user coordination — it opens a VS Code window.
//   node scripts/test-host.js
//
// Uses the already-installed VS Code on this machine; downloads nothing and
// installs/publishes nothing. A fresh temporary user-data directory keeps the
// test profile separate from the user's normal profile.
const { spawnSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');

const root = join(dirname(__filename), '..');
const candidates = [
  process.env.VSCODE_TEST_BINARY,
  '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
  '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
].filter(Boolean);
const { existsSync } = require('node:fs');
const binary = candidates.find(p => { try { return existsSync(p); } catch { return false; } });
if (!binary) {
  console.error('No VS Code binary found. Set VSCODE_TEST_BINARY to the installed code binary.');
  process.exitCode = 2;
  return;
}
const profile = mkdtempSync(join(tmpdir(), 'frameport-test-profile-'));
const args = [
  '--extensionDevelopmentPath=' + root,
  '--extensionTestsPath=' + join(root, 'test-host', 'index.js'),
  '--user-data-dir=' + profile,
  '--extensions-dir=' + join(profile, 'extensions'),
  '--disable-workspace-trust',
  '--skip-welcome',
  '--skip-release-notes',
];
console.log(`Launching Extension Host with ${binary} (temporary profile ${profile}). Close the window when done.`);
const result = spawnSync(binary, args, { stdio: 'inherit', timeout: 240000 });
process.exitCode = result.status ?? 1;
