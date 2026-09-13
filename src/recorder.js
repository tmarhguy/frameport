const { existsSync, statSync } = require('node:fs');
const { spawn } = require('node:child_process');

const SOFTWARE_ENCODER = 'libx264';
const HARDWARE_ENCODER = 'h264_videotoolbox';

function recordingArgs(path, options = {}) {
  const encoder = options.encoder === HARDWARE_ENCODER ? HARDWARE_ENCODER : SOFTWARE_ENCODER;
  // Hardware path is explicit and optional: VideoToolbox trades larger files for
  // lower CPU on capable Macs. Software libx264 remains the default so existing
  // fidelity and file-size behavior do not change silently.
  const codecArgs = encoder === HARDWARE_ENCODER
    ? ['-c:v', HARDWARE_ENCODER, '-b:v', '5M', '-realtime', '1']
    : ['-c:v', SOFTWARE_ENCODER, '-preset', 'veryfast', '-crf', '23', '-threads', '2'];
  return ['-hide_banner', '-loglevel', 'warning', '-n', '-use_wallclock_as_timestamps', '1',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-i', 'pipe:0', '-an',
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', ...codecArgs,
    '-pix_fmt', 'yuv420p', '-fps_mode', 'vfr',
    '-movflags', '+frag_keyframe+empty_moov', '-frag_duration', '2000000',
    '-progress', 'pipe:3', '-stats_period', '0.5',
    '-f', 'mp4', path];
}

// Bounded machine-readable progress parsing. FFmpeg -progress reports on fd 3
// stay separate from human-readable diagnostics on stderr (fd 2).
function parseProgress(text, state) {
  for (const line of text.split('\n')) {
    const [key, value] = line.split('=', 2);
    if (value === undefined) continue;
    if (key === 'frame') { const n = parseInt(value, 10); if (Number.isFinite(n)) state.encodedFrames = Math.max(state.encodedFrames, n); }
    else if (key === 'drop_frames') { const n = parseInt(value, 10); if (Number.isFinite(n)) state.encoderDropped = Math.max(state.encoderDropped, n); }
    else if (key === 'out_time_ms') { const n = parseInt(value, 10); if (Number.isFinite(n) && n >= 0) state.outTimeMs = Math.max(state.outTimeMs, n); }
    else if (key === 'total_size') { const n = parseInt(value, 10); if (Number.isFinite(n) && n >= 0) state.totalSize = Math.max(state.totalSize, n); }
  }
}

class Recorder {
  constructor({ executable, encoder = SOFTWARE_ENCODER, onState = () => {}, onLog = () => {}, spawnProcess = spawn, finalizeTimeoutMs = 10000 }) {
    Object.assign(this, { executable, onState, onLog, spawnProcess, finalizeTimeoutMs });
    this.encoderOption = encoder;
    this.state = { phase: 'idle' };
  }
  resolveEncoder() {
    const raw = typeof this.encoderOption === 'function' ? this.encoderOption() : this.encoderOption;
    return raw === HARDWARE_ENCODER ? HARDWARE_ENCODER : SOFTWARE_ENCODER;
  }
  emit(phase, extra = {}) { this.state = { ...this.state, ...extra, phase }; this.onState(this.state); }
  get active() { return ['recording', 'finalizing'].includes(this.state.phase); }
  get encoder() { return this.resolveEncoder(); }
  set encoder(value) { this.encoderOption = value; }
  start(path, frame) {
    if (this.active) throw new Error('A recording is already active.');
    if (existsSync(path)) throw new Error('Choose a new filename; recording does not overwrite existing files.');
    if (!frame) throw new Error('Wait for a video frame before recording.');
    this.dropped = 0;
    this.accepted = 0;
    this.error = undefined;
    this.encodedFrames = 0;
    this.encoderDropped = 0;
    this.outTimeMs = 0;
    this.totalSize = 0;
    this.progressBuffer = '';
    this.startedAtMono = process.hrtime.bigint();
    this.firstAcceptedAtMono = undefined;
    this.lastAcceptedAtMono = undefined;
    this.readyAtMono = undefined;
    this.currentEncoder = this.resolveEncoder();
    this.state = { path, startedAt: Date.now(), dropped: 0, accepted: 0, encoder: this.currentEncoder };
    let child;
    try {
      child = this.spawnProcess(this.executable(), recordingArgs(path, { encoder: this.currentEncoder }), { stdio: ['pipe', 'ignore', 'pipe', 'pipe'] });
    } catch (error) {
      this.emit('error', { error: `Could not launch FFmpeg: ${error.message}. Open settings to check its path.` });
      throw error;
    }
    this.child = child;
    this.done = new Promise(resolve => {
      child.stderr.on('data', data => {
        const text = data.toString();
        this.onLog(text);
        if (/Unknown encoder/.test(text)) {
          this.error = this.currentEncoder === HARDWARE_ENCODER
            ? 'Recording needs FFmpeg with VideoToolbox hardware encoding. Switch FramePort recording back to software in settings.'
            : 'Recording needs FFmpeg with libx264. Check diagnostics.';
        } else if (/Not overwriting|Error opening|Error writing|does not contain any stream/i.test(text)) this.error = 'Could not write recording. Check diagnostics.';
      });
      const progress = child.stdio && child.stdio[3];
      if (progress && typeof progress.on === 'function') {
        progress.on('data', data => {
          this.progressBuffer = (this.progressBuffer + data.toString()).slice(-65536);
          const before = this.encodedFrames;
          parseProgress(data.toString(), this);
          if (before < 1 && this.encodedFrames >= 1 && this.readyAtMono === undefined) this.readyAtMono = process.hrtime.bigint();
        });
      }
      child.stdin.on('error', error => { this.error = error.message; });
      child.once('error', error => { this.error = error.message; });
      child.once('close', code => {
        clearTimeout(this.timer);
        this.child = undefined;
        // Final progress flush may arrive with close; re-parse the bounded tail.
        if (this.progressBuffer) parseProgress(this.progressBuffer, this);
        let hasOutput = false;
        try { hasOutput = statSync(path).size > 0; } catch {}
        // Accepted counts stdin writes; encodedFrames counts frames FFmpeg
        // actually encoded (from -progress on a separate pipe). A clean exit
        // with a header-only file and accepted input must not report Saved.
        const success = code === 0 && !this.error && hasOutput && this.accepted > 0 && this.encodedFrames > 0;
        const pushSpanMs = this.firstAcceptedAtMono !== undefined && this.lastAcceptedAtMono !== undefined
          ? Number(this.lastAcceptedAtMono - this.firstAcceptedAtMono) / 1e6
          : 0;
        this.emit(success ? 'saved' : 'error', {
          dropped: this.dropped,
          accepted: this.accepted,
          encodedFrames: this.encodedFrames,
          encoderDropped: this.encoderDropped,
          pushSpanMs: Math.round(pushSpanMs),
          encoder: this.currentEncoder,
          error: success ? undefined : this.error || `FFmpeg exited (${code}). Check diagnostics. The file may be incomplete.`,
        });
        resolve(this.state);
      });
    });
    this.emit('recording');
    this.push(frame);
  }
  push(frame) {
    if (this.state.phase !== 'recording' || !this.child || this.child.stdin.destroyed) return;
    // Never block live capture on disk/encoding. Keep at most one queued frame.
    if (this.child.stdin.writableLength > 0 || frame.length > 16 * 1024 * 1024) {
      this.dropped++;
      return;
    }
    this.child.stdin.write(frame);
    const now = process.hrtime.bigint();
    if (this.firstAcceptedAtMono === undefined) {
      this.firstAcceptedAtMono = now;
      if (this.readyAtMono === undefined) this.readyAtMono = now;
    }
    this.lastAcceptedAtMono = now;
    this.accepted++;
  }
  stop() {
    if (!this.active) return Promise.resolve(this.state);
    if (this.state.phase === 'recording') {
      this.emit('finalizing', { dropped: this.dropped, accepted: this.accepted });
      this.child?.stdin.end();
      this.timer = setTimeout(() => { this.error = 'Recording finalization timed out; the file may be incomplete.'; this.child?.kill('SIGKILL'); }, this.finalizeTimeoutMs);
    }
    return this.done;
  }
}
module.exports = { Recorder, recordingArgs, SOFTWARE_ENCODER, HARDWARE_ENCODER };
