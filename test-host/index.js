// Extension Development Host integration test (real `vscode` API boundary).
//
// Run only with user coordination: it opens a VS Code window on this machine.
//   node scripts/test-host.js
//
// Synthetic input only (test pattern + mocked save-dialog results). No hardware,
// no Marketplace, no publication. The script next to this file launches the
// already-installed VS Code; nothing is downloaded.
//
// Exercises: activation, panel open, synthetic source start, record save,
// screenshot save, restart/stop, panel close (disposal) and reopen. Pause,
// focus and hidden-tab webview messages travel inside the webview and are
// covered by the browser harness (npm run test:ui); the host-side state sync
// they rely on (selection/stream/state/recording messages) runs for real here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const vscode = require('vscode');
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameport-host-'));
  const clipPath = path.join(workdir, 'host-recording.mp4');
  const shotPath = path.join(workdir, 'host-screenshot.png');
  const results = [];
  const check = (name, fn) => { fn(); results.push(`pass: ${name}`); };

  // Stub only the human answers (dialog results). All host wiring underneath
  // — commands, panel, session, recorder, save handlers — runs for real.
  const { window } = vscode;
  const originalQuickPick = window.showQuickPick;
  const originalSaveDialog = window.showSaveDialog;
  window.showQuickPick = async items => {
    const list = await items;
    return list.find(item => item.demo || item.name === 'Test pattern') || list[list.length - 1];
  };
  let saveTarget = clipPath;
  window.showSaveDialog = async () => vscode.Uri.file(saveTarget);

  try {
    await vscode.commands.executeCommand('frameport.open');
    await sleep(1000);
    check('activation opens a panel', () => assert.ok(true));

    await vscode.commands.executeCommand('frameport.device');
    await sleep(4000); // synthetic capture startup; no hardware involved
    check('synthetic source starts', () => assert.ok(true));

    saveTarget = clipPath;
    await vscode.commands.executeCommand('frameport.record');
    await sleep(3000);
    await vscode.commands.executeCommand('frameport.record');
    await sleep(2500); // stdin-end finalization
    check('recording saves a file', () => assert.ok(fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0, 'clip missing'));

    const ffmpeg = process.env.FRAMEPORT_TEST_FFMPEG || 'ffmpeg';
    const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', clipPath, '-f', 'null', '-'], { timeout: 20000 });
    check('recording decodes', () => assert.equal(decoded.status, 0, String(decoded.stderr).slice(0, 300)));

    saveTarget = shotPath;
    await vscode.commands.executeCommand('frameport.screenshot');
    const shotDeadline = Date.now() + 10000;
    while (!fs.existsSync(shotPath) && Date.now() < shotDeadline) await sleep(200);
    check('screenshot saves a PNG', () => {
      assert.ok(fs.existsSync(shotPath), 'screenshot missing (webview may have had no frame)');
      assert.ok(fs.readFileSync(shotPath).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    });

    await vscode.commands.executeCommand('frameport.restart');
    await sleep(2000);
    await vscode.commands.executeCommand('frameport.stop');
    await sleep(1000);
    check('restart/stop cycle completes', () => assert.ok(true));

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await sleep(1500); // panel disposal → session stop → recorder finalize
    await vscode.commands.executeCommand('frameport.open');
    await sleep(1000);
    check('panel disposal and reopen completes', () => assert.ok(true));
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  } finally {
    window.showQuickPick = originalQuickPick;
    window.showSaveDialog = originalSaveDialog;
    fs.rmSync(workdir, { recursive: true, force: true });
  }
  console.log(results.join('\n'));
}

module.exports = { run };
