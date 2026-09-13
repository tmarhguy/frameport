const vscode = require('vscode');
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const { enumerate } = require('./capture');
const { CaptureSession } = require('./session');
const { renderView } = require('./view');
const { Recorder } = require('./recorder');
const { validateScreenshotData, lastCaptureAction } = require('./screenshot');

const modes = [
  { label: '1280 × 720 · 30 fps', size: '1280x720', fps: 30 },
  { label: '1920 × 1080 · 30 fps', size: '1920x1080', fps: 30 },
  { label: '1920 × 1080 · 60 fps', size: '1920x1080', fps: 60 },
  { label: '1280 × 720 · 60 fps', size: '1280x720', fps: 60 },
  { label: '640 × 480 · 30 fps', size: '640x480', fps: 30 }
];
let disposeExtension;
function activate(context) {
  let panel, server, streamUrl, device, selection = 0, recordDialog = false;
  let lastCapture = context.globalState.get('lastCapture');
  let mode = modes.find(item => item.label === context.workspaceState.get('preferredMode')) || modes[0];
  const storedScreenFps = context.workspaceState.get('preferredScreenFps');
  let screenFps = [15, 30, 60].includes(storedScreenFps) ? storedScreenFps : 30;
  const log = vscode.window.createOutputChannel('FramePort');
  function executable() {
    const configured = vscode.workspace.getConfiguration('frameport').get('ffmpegPath', 'ffmpeg');
    if (configured !== 'ffmpeg') return configured;
    if (process.platform === 'darwin') {
      for (const path of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']) if (existsSync(path)) return path;
    }
    return configured;
  }
  const post = message => panel?.webview.postMessage(message);
  function recordingEncoder() {
    return vscode.workspace.getConfiguration('frameport').get('recordingEncoder', 'software') === 'hardware'
      ? 'h264_videotoolbox'
      : 'libx264';
  }
  const recorder = new Recorder({ executable, encoder: recordingEncoder, onLog: text => log.append(text), onState: state => {
    post({ type: 'recording', ...state });
    if (state.phase === 'saved') {
      rememberCapture(vscode.Uri.file(state.path));
      void vscode.window.showInformationMessage(`FramePort: Recording saved.${state.dropped ? ` ${state.dropped} frames skipped to keep capture responsive.` : ''}`, 'Show file').then(action => { if (action) void vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(state.path)); });
    }
    if (state.phase === 'error') void vscode.window.showErrorMessage(`FramePort: Recording failed. ${state.error}`);
  } });
  const session = new CaptureSession({ executable, onState: state => {
    post({ type: 'state', ...state });
    if (state.phase === 'error' || state.phase === 'waiting') void recorder.stop();
  }, onLog: text => log.append(text), onFrame: frame => recorder.push(frame), beforeTransition: () => recorder.stop() });
  function rememberCapture(uri) {
    lastCapture = uri.toString();
    void context.globalState.update('lastCapture', lastCapture);
    post({ type: 'savedCapture', available: true });
  }
  async function toggleRecord() {
    if (recorder.active) { await recorder.stop(); return; }
    if (recordDialog) return;
    if (!session.latest) { vscode.window.showInformationMessage('FramePort: Start a source before recording.'); return; }
    recordDialog = true;
    const generation = session.generation;
    try {
      const uri = await vscode.window.showSaveDialog({ filters: { 'MP4 video': ['mp4'] }, defaultUri: vscode.Uri.file(require('node:path').join(require('node:os').homedir(), `frameport-${Date.now()}.mp4`)) });
      if (!uri) return;
      if (uri.scheme !== 'file') throw new Error('Recordings must be saved to a local file.');
      if (existsSync(uri.fsPath)) throw new Error('Choose a new filename; recording does not overwrite existing files.');
      if (!panel || generation !== session.generation || !session.latest) throw new Error('The source changed. Start recording again.');
      recorder.start(uri.fsPath, session.latest.data);
    } finally { recordDialog = false; }
  }
  function selectionMessage() {
    // Screens capture at native dimensions; only the frame rate is requested.
    // Cameras use the combined resolution/FPS preset. The footer status (from
    // the capture session) carries the same source-aware wording.
    return device?.screen
      ? { type: 'selection', device: device?.name, mode: mode.label, screen: true, fps: screenFps }
      : { type: 'selection', device: device?.name, mode: mode.label, screen: Boolean(device?.screen), fps: mode.fps };
  }
  function sync() {
    post(selectionMessage());
    post({ type: 'stream', url: streamUrl });
    post({ type: 'state', ...session.state });
    post({ type: 'recording', ...recorder.state });
    post({ type: 'savedCapture', available: Boolean(lastCapture) });
    post({ type: 'previewRate', fps: vscode.workspace.getConfiguration('frameport').get('previewFps', 30) });
  }
  async function start() {
    if (!panel || !device) return;
    if (!vscode.workspace.isTrusted) { vscode.window.showWarningMessage('Trust this workspace before starting local capture.'); return; }
    panel.title = `FramePort: ${device.name}`;
    post(selectionMessage());
    await session.start(device, device.screen ? { ...mode, fps: screenFps } : mode);
  }
  async function selectDevice() {
    const owner = panel, request = ++selection;
    const choices = [];
    if (process.platform === 'darwin') {
      try {
        const devices = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'FramePort: finding capture devices…' }, () => enumerate(executable()));
        choices.push(...devices.map(d => ({ ...d, label: d.name, description: d.screen ? 'Screen · requires screen recording permission' : `Video device ${d.index}` })));
      } catch (error) { vscode.window.showErrorMessage(`FramePort: ${error.message}. Check FFmpeg in settings.`); }
    }
    if (request !== selection || owner !== panel) return;
    choices.push({ label: 'Test pattern', name: 'Test pattern', demo: true, description: 'No camera required' });
    const preferred = context.workspaceState.get('preferredDevice');
    const selected = await vscode.window.showQuickPick(choices.map(d => ({ ...d, detail: d.name === preferred ? 'Previously selected in this workspace' : undefined })), { title: 'FramePort · Select source', placeHolder: process.platform === 'darwin' ? 'Choose your USB capture device or camera' : 'Hardware capture currently requires macOS; try the test pattern' });
    if (!selected || request !== selection || owner !== panel) return;
    device = selected;
    await context.workspaceState.update('preferredDevice', device.name);
    await start();
  }
  async function command(name, message = {}) {
    switch (name) {
      case 'ready': sync(); break;
      case 'record': await toggleRecord(); break;
      case 'lastCapture': {
        if (!lastCapture) { vscode.window.showInformationMessage('FramePort: No saved capture yet.'); break; }
        const uri = vscode.Uri.parse(lastCapture);
        const action = lastCaptureAction(uri, uri.scheme !== 'file' || existsSync(uri.fsPath));
        if (action.kind === 'missing') {
          lastCapture = undefined;
          await context.globalState.update('lastCapture', undefined);
          post({ type: 'savedCapture', available: false });
          vscode.window.showWarningMessage('FramePort: The saved file is no longer available. Take a new screenshot or recording.');
          break;
        }
        if (action.kind === 'remote') {
          vscode.window.showWarningMessage('FramePort: That capture was saved outside this machine and cannot be revealed in the OS file manager.', 'Open file').then(choice => {
            if (choice) void vscode.commands.executeCommand('vscode.open', uri);
          });
          break;
        }
        await vscode.commands.executeCommand('revealFileInOS', uri);
        break;
      }
      case 'device': await selectDevice(); break;
      case 'demo': selection++; device = { name: 'Test pattern', demo: true }; await start(); break;
      case 'mode': {
        const owner = panel;
        if (device?.screen) {
          const choice = await vscode.window.showQuickPick([15, 30, 60].map(fps => ({ label: `Native size · ${fps} fps`, fps, description: fps === screenFps ? 'Currently selected' : undefined })), { title: 'Screen capture frame rate · native dimensions always apply' });
          if (choice && owner === panel) { screenFps = choice.fps; await context.workspaceState.update('preferredScreenFps', screenFps); post(selectionMessage()); await start(); }
          break;
        }
        const choice = await vscode.window.showQuickPick(modes, { title: 'Requested capture mode · device support varies' });
        if (choice && owner === panel) { mode = choice; await context.workspaceState.update('preferredMode', mode.label); post(selectionMessage()); await start(); }
        break;
      }
      case 'restart': selection++; if (device) await start(); else await selectDevice(); break;
      case 'stop': selection++; await session.stop(); break;
      case 'diagnostics': log.show(); break;
      case 'settings': await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:tmarhguy.frameport'); break;
      case 'screenshot': post({ type: 'screenshot' }); break;
      case 'screenshotTooLarge': {
        const { width = 0, height = 0 } = message;
        vscode.window.showErrorMessage(`FramePort: That screenshot is too large to save (${width} × ${height}). Select a lower capture mode and try again.`);
        break;
      }
      case 'saveScreenshot': {
        // Never accept paths or arbitrary commands from the webview. Oversized
        // or invalid captures produce a visible error instead of disappearing.
        const checked = validateScreenshotData(message.data);
        if (!checked.ok) { vscode.window.showErrorMessage(`FramePort: Screenshot failed. ${checked.error}`); break; }
        const uri = await vscode.window.showSaveDialog({ filters: { 'PNG image': ['png'] }, defaultUri: vscode.Uri.file(require('node:path').join(require('node:os').homedir(), `frameport-${Date.now()}.png`)) });
        if (!uri) break;
        if (uri.scheme !== 'file') { vscode.window.showErrorMessage('FramePort: Screenshots must be saved to a local file.'); break; }
        await vscode.workspace.fs.writeFile(uri, checked.bytes);
        rememberCapture(uri);
        vscode.window.showInformationMessage('FramePort: Screenshot saved.');
        break;
      }
    }
  }
  async function open() {
    if (panel) { panel.reveal(); return; }
    const current = vscode.window.createWebviewPanel('frameport', 'FramePort', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] });
    panel = current;
    const token = randomBytes(24).toString('hex');
    const ownedServer = http.createServer((request, response) => {
      if (request.url !== `/${token}/frame`) { response.writeHead(404).end(); return; }
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'If-None-Match');
      response.setHeader('Access-Control-Expose-Headers', 'ETag');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      const frame = session.latest;
      if (!frame) { response.writeHead(204).end(); return; }
      const etag = `"${frame.sequence}"`;
      response.setHeader('ETag', etag);
      if (request.headers['if-none-match'] === etag) { response.writeHead(304).end(); return; }
      response.setHeader('Content-Type', 'image/jpeg');
      response.end(frame.data);
    });
    server = ownedServer;
    current.onDidDispose(() => {
      if (panel === current) { panel = undefined; selection++; void session.stop(); }
      ownedServer.close(); ownedServer.closeAllConnections();
    });
    current.webview.onDidReceiveMessage(message => {
      if (panel === current && message && typeof message.command === 'string') void command(message.command, message).catch(error => vscode.window.showErrorMessage(`FramePort: ${error.message}`));
    });
    try {
      await new Promise((resolve, reject) => { ownedServer.once('error', reject); ownedServer.listen(0, '127.0.0.1', resolve); });
      if (panel !== current) { ownedServer.close(); return; }
      const origin = `http://127.0.0.1:${ownedServer.address().port}`;
      streamUrl = `${origin}/${token}/frame`;
      current.webview.html = renderView({ nonce: randomBytes(16).toString('hex'), origin, cspSource: current.webview.cspSource, script: current.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.js')), style: current.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.css')) });
    } catch (error) { current.dispose(); throw error; }
  }
  const commands = ['open', 'device', 'screenshot', 'restart', 'stop', 'diagnostics', 'record', 'lastCapture'];
  for (const name of commands) context.subscriptions.push(vscode.commands.registerCommand(`frameport.${name}`, async () => {
    try { if (name === 'open') await open(); else if (name === 'diagnostics') log.show(); else { if (!panel) await open(); await command(name); } }
    catch (error) { vscode.window.showErrorMessage(`FramePort: ${error.message}`); }
  }));
  disposeExtension = () => { panel?.dispose(); server?.close(); server?.closeAllConnections(); return session.stop(); };
  context.subscriptions.push(log, vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('frameport.previewFps')) post({ type: 'previewRate', fps: vscode.workspace.getConfiguration('frameport').get('previewFps', 30) }); }));
}
function deactivate() { return disposeExtension?.(); }
module.exports = { activate, deactivate };
