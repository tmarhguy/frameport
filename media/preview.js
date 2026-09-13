const vscode = acquireVsCodeApi();
const canvas = document.querySelector('#preview');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('#stage');
const empty = document.querySelector('#empty');
const metrics = document.querySelector('#metrics');
const scaling = document.querySelector('#scaling');
const pauseButton = document.querySelector('#pause');
const saved = vscode.getState() || {};
let active = false, paused = false, busy = false, endpoint, controller, generation = 0;
let previewFps = 30, recording = { phase: 'idle' };
let lastSequence = '', frames = 0, period = performance.now(), phase = 'idle';
let nextDue = 0, lastLayoutKey = '', idlePolls = 0, presented = false;
scaling.value = ['fit', 'native', 'integer'].includes(saved.scaling) ? saved.scaling : 'fit';
let smooth = saved.smooth === true;
function persist() { vscode.setState({ scaling: scaling.value, smooth }); }
function layout() {
  canvas.className = `${scaling.value}${smooth ? ' smooth' : ''}`;
  const multiplier = scaling.value === 'integer' ? Math.max(1, Math.floor(Math.min(stage.clientWidth / canvas.width, stage.clientHeight / canvas.height))) : 1;
  canvas.style.width = scaling.value === 'fit' ? '' : `${canvas.width * multiplier}px`;
  canvas.style.height = scaling.value === 'fit' ? '' : `${canvas.height * multiplier}px`;
  document.querySelector('#smooth').textContent = smooth ? 'Smooth' : 'Pixel crisp';
  document.querySelector('#smooth').setAttribute('aria-pressed', String(smooth));
}
function freeze(value) {
  paused = value;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
  document.querySelector('#paused').hidden = !paused;
  frames = 0; period = performance.now();
  nextDue = 0; idlePolls = 0; presented = false; // resume without an extra idle delay
}
document.addEventListener('visibilitychange', () => { frames = 0; period = performance.now(); nextDue = 0; idlePolls = 0; presented = false; });
function reset() {
  generation++;
  controller?.abort();
  lastSequence = '';
  canvas.hidden = true;
  empty.hidden = false;
  document.querySelector('#screenshot').disabled = true;
  pauseButton.disabled = true;
  freeze(false);
  metrics.textContent = 'No source';
}
function layoutIfNeeded() {
  // Per-frame layout() forces reflow via clientWidth and rewrites styles even
  // when nothing changed. Only recompute on dimensions/scaling/smoothing change;
  // container resizes already trigger layout() via ResizeObserver.
  const key = `${canvas.width}x${canvas.height}|${scaling.value}|${smooth}`;
  if (key !== lastLayoutKey) { lastLayoutKey = key; layout(); }
}
const SCREENSHOT_PIXEL_BUDGET = 6291456; // 32 MiB encoded bound (see src/screenshot.js); checked before allocating the PNG
function screenshot() {
  if (canvas.hidden) return;
  if (canvas.width * canvas.height > SCREENSHOT_PIXEL_BUDGET) {
    vscode.postMessage({ command: 'screenshotTooLarge', width: canvas.width, height: canvas.height });
    return;
  }
  try {
    vscode.postMessage({ command: 'saveScreenshot', data: canvas.toDataURL('image/png') });
  } catch (error) {
    vscode.postMessage({ command: 'screenshotTooLarge', width: canvas.width, height: canvas.height });
  }
}
function focus(value) {
  document.body.classList.toggle('focus', value);
  document.querySelector('#exit-focus').hidden = !value;
  document.querySelector('#focus').setAttribute('aria-pressed', String(value));
  layout();
  updateRecording();
}
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.command === 'screenshot') screenshot();
  else vscode.postMessage({ command: button.dataset.command });
}));
scaling.addEventListener('change', () => { layout(); persist(); });
document.querySelector('#smooth').addEventListener('click', () => { smooth = !smooth; layout(); persist(); });
pauseButton.addEventListener('click', () => freeze(!paused));
document.querySelector('#focus').addEventListener('click', () => focus(!document.body.classList.contains('focus')));
document.querySelector('#exit-focus').addEventListener('click', () => focus(false));
window.addEventListener('keydown', event => { if (event.key === 'Escape') focus(false); });
new ResizeObserver(layout).observe(stage);
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'state') {
    phase = message.phase;
    document.body.dataset.phase = phase;
    document.querySelector('#phase').textContent = ({ idle: 'Ready', stopped: 'Stopped', starting: 'Connecting', streaming: 'Live', waiting: 'Waiting', error: 'Capture issue' })[phase] || phase;
    document.querySelector('#status').textContent = message.text;
    if (phase !== 'streaming') {
      reset();
      document.querySelector('#empty-title').textContent = ({ idle: 'No device selected', stopped: 'Capture stopped', starting: 'Connecting…', waiting: 'No frames received', error: 'Capture failed' })[phase];
      document.querySelector('#empty-copy').textContent = message.text;
    }
    active = ['starting', 'streaming', 'waiting'].includes(phase);
    document.querySelector('#stop').disabled = !active;
  }
  if (message.type === 'stream') { endpoint = message.url; }
  if (message.type === 'selection') {
    document.querySelector('#device').textContent = message.device || 'Select device';
    const modeButton = document.querySelector('#mode');
    if (message.screen) {
      const fps = [15, 30, 60].includes(message.fps) ? message.fps : 30;
      modeButton.textContent = `Native size · ${fps} fps`;
      modeButton.disabled = false;
      modeButton.title = 'Screen sources capture at native dimensions; choose the capture frame rate';
    } else {
      modeButton.textContent = message.mode;
      modeButton.disabled = false;
      modeButton.title = '';
    }
  }
  if (message.type === 'screenshot') screenshot();
  if (message.type === 'recording') { recording = message; updateRecording(); }
  if (message.type === 'savedCapture') document.querySelector('#last-capture').disabled = !message.available;
  if (message.type === 'previewRate') previewFps = [15, 30, 60].includes(message.fps) ? message.fps : 30;
  updateRecording();
});
function updateRecording() {
  const running = recording.phase === 'recording';
  const finalizing = recording.phase === 'finalizing';
  const button = document.querySelector('#record');
  button.textContent = running ? 'Stop recording' : finalizing ? 'Saving…' : 'Record';
  button.disabled = finalizing || (!running && phase !== 'streaming');
  button.setAttribute('aria-pressed', String(running));
  const indicator = document.querySelector('#record-status');
  indicator.hidden = !running && !finalizing;
  const elapsed = Math.max(0, Math.floor((Date.now() - (recording.startedAt || Date.now())) / 1000));
  const text = finalizing ? 'Saving recording…' : `Recording ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  indicator.textContent = text;
  const badge = document.querySelector('#record-badge');
  badge.textContent = text;
  badge.hidden = (!running && !finalizing) || !document.body.classList.contains('focus');
}
setInterval(() => { if (recording.phase === 'recording') updateRecording(); }, 1000);
async function tick() {
  if (active && endpoint && !paused && !busy && !document.hidden) {
    busy = true;
    const revision = generation;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 4000);
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal, headers: lastSequence ? { 'If-None-Match': lastSequence } : {} });
      if (response.status === 200) {
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        try {
          if (revision === generation && active && !paused) {
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) { canvas.width = bitmap.width; canvas.height = bitmap.height; }
            ctx.drawImage(bitmap, 0, 0);
            lastSequence = response.headers.get('ETag') || '';
            if (canvas.hidden || !empty.hidden) { canvas.hidden = false; empty.hidden = true; }
            const shotButton = document.querySelector('#screenshot');
            if (shotButton.disabled || pauseButton.disabled) { shotButton.disabled = false; pauseButton.disabled = false; }
            frames++;
            const now = performance.now();
            if (now - period >= 1000) { metrics.textContent = `${bitmap.width} × ${bitmap.height} · ${(frames * 1000 / (now - period)).toFixed(1)} preview fps`; frames = 0; period = now; }
            layoutIfNeeded();
          }
        } finally { bitmap.close(); }
        presented = true;
      } else {
        // No new frame (304) or no frame yet (204): do not burn the presentation
        // budget. Retry soon so a frame arriving mid-interval is picked up with
        // low delay; back off while starved so polling stays cheap.
        idlePolls++;
      }
    } catch (error) {
      if (revision === generation && error.name !== 'AbortError') metrics.textContent = 'Preview connection interrupted';
      idlePolls++;
    } finally { clearTimeout(timeout); busy = false; }
  }
  // Deadline-based pacing: the frame budget includes fetch/decode/draw work.
  // Waiting a full interval after work completes caps a 30 fps request at ~27 fps.
  // Advance a deadline on presented frames instead, skipping missed beats rather
  // than catching up with stale frames. One in-flight request is enforced by `busy`.
  const streaming = active && endpoint && !paused && !document.hidden;
  let delay = 250;
  if (streaming) {
    const interval = 1000 / previewFps;
    const now = performance.now();
    if (presented) {
      presented = false;
      idlePolls = 0;
      if (!nextDue || nextDue < now - interval) nextDue = now + interval;
      else nextDue += interval;
      delay = Math.max(0, nextDue - performance.now());
    } else {
      delay = Math.min(Math.max(0, (nextDue || now) - now), 8 * 2 ** Math.min(idlePolls, 3));
    }
  } else {
    nextDue = 0;
    idlePolls = 0;
  }
  setTimeout(tick, delay);
}
layout();
vscode.postMessage({ command: 'ready' });
tick();
