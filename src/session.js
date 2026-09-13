const { spawn } = require('node:child_process');
const { JpegParser, captureArgs } = require('./capture');

function requestText(device, mode) {
  // Screens capture at native dimensions; never report an unapplied camera
  // resolution preset. The requested frame rate still applies.
  if (device.screen) return `${device.name} · Native size · ${mode.fps} fps requested`;
  return `${device.name} · Requested ${mode.label}`;
}

function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 1500);
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

// Serializes teardown and startup; generation checks invalidate superseded requests.
class CaptureSession {
  constructor({ executable, onState, onLog, spawnProcess = spawn, onFrame = () => {}, beforeTransition = async () => {} }) {
    Object.assign(this, { executable, onState, onLog, spawnProcess, onFrame, beforeTransition });
    this.generation = 0;
    this.sequence = 0;
    this.queue = Promise.resolve();
    this.state = { phase: 'idle', text: 'Select a device to begin.' };
  }
  emit(phase, text) {
    this.state = { phase, text };
    this.onState(this.state);
  }
  stop() { return this.transition(); }
  start(device, mode) { return this.transition({ device, mode }); }
  transition(next) {
    const generation = ++this.generation;
    this.latest = undefined;
    clearInterval(this.watchdog);
    this.emit(next ? 'starting' : 'stopped', next ? `Connecting to ${next.device.name}…` : 'Capture stopped. Device released after cleanup.');
    this.queue = this.queue.catch(() => {}).then(async () => {
      await this.beforeTransition();
      const previous = this.child;
      this.child = undefined;
      await terminate(previous);
      if (generation !== this.generation) return;
      if (!next) { this.emit('stopped', 'Capture stopped. Device released.'); return; }
      const { device, mode } = next;
      const child = this.spawnProcess(this.executable(), captureArgs(device, mode), { stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
      let received = false, launchError = false;
      this.lastFrame = Date.now();
      const parser = new JpegParser(data => {
        if (generation !== this.generation) return;
        this.latest = { data, sequence: ++this.sequence };
        this.onFrame(data);
        this.lastFrame = Date.now();
        if (!received) { received = true; this.emit('streaming', requestText(device, mode)); }
      });
      child.stdout.on('data', data => parser.push(data));
      child.stderr.on('data', data => this.onLog(data.toString()));
      child.once('error', error => {
        if (generation !== this.generation) return;
        launchError = true;
        this.emit('error', `Could not launch FFmpeg: ${error.message}. Open settings to check its path.`);
      });
      child.once('close', code => {
        if (generation !== this.generation) return;
        clearInterval(this.watchdog);
        this.child = undefined;
        this.latest = undefined;
        if (!launchError) this.emit('error', `Capture ended (${code ?? 'terminated'}). Check device permissions and the requested mode. Open diagnostics for details.`);
      });
      this.watchdog = setInterval(() => {
        if (Date.now() - this.lastFrame > 5000) {
          received = false;
          this.latest = undefined;
          this.emit('waiting', 'No new frames. Check the device, permissions, or requested capture mode.');
        }
      }, 2000);
    }).catch(error => { if (generation === this.generation) this.emit('error', error.message); });
    return this.queue;
  }
}
module.exports = { CaptureSession, terminate, requestText };
