# Changelog

## 0.2.0 — 2026-09-13

- Added silent MP4 source recording, elapsed state, bounded frame delivery and finalization on capture teardown.
- Recording success now requires accepted frames, a clean encoder exit and nonempty output; missing libx264 and write failures report actionable errors.
- Show Last Capture handles deleted files with a clear message instead of a silent failure.
- Screen sources capture at native size with the resolution preset control disabled and labeled honestly.
- Recording state stays visible in focus mode through a compact badge.
- Preview FPS sampling resets on pause and tab visibility changes.
- Preview pacing now uses deadline-based scheduling so a 30 fps cap delivers near 30 unique frames instead of ~27; per-frame layout work runs only when dimensions, scaling, or smoothing change.
- Recording success now requires confirmed encoded frames from FFmpeg progress on a separate pipe, in addition to accepted input, a clean exit, and nonempty output; header-only output with accepted input reports failure.
- Recording timing is measured with a monotonic clock: a 10+ second synthetic clip must agree with the pushed source timeline within 250 ms plus one frame, and a deliberate one-second gap within 100 ms plus one frame.
- Added an optional macOS VideoToolbox hardware recording path behind an explicit software-default setting; software libx264 behavior is unchanged.
- Screen sources keep native dimensions with a coherent frame-rate choice (Native size · 15/30/60 fps); the footer never reports an unapplied camera resolution.
- Oversized screenshots fail visibly on the client and host instead of disappearing; screenshot and reveal destinations are local-file only with clear messages for anything else.
- Added screen frame-rate, oversized-screenshot refusal, and high-contrast browser coverage; added screenshot-validator, reveal-destination, and recorder timeline/header-only regression tests.
- Added a synthetic session-to-recorder wiring test and an Extension Host integration test entry (run with user coordination via `npm run test:host`).
- Added wall-clock timing, backpressure, failure and overwrite regression tests; ffprobe resolves next to the configured FFmpeg.
- Added screen-mode and focus-recording browser checks. Failed-save behavior is covered by host-side validator unit tests and a recorder header-only regression test; the browser harness does not execute the host save handler.
- Excluded sprint notes from the packaged VSIX.

## 0.1.1

- Replaced decorative cyan styling with native VS Code theme colors.
- Simplified empty states, status copy, toolbar styling, and spacing.
- Added product design rules and light-theme browser verification.

## 0.1.0 — Preview

- Redesigned theme-aware preview with responsive controls and connection states.
- Added integer scaling, pixel smoothing, pause/resume, and focus mode.
- Save exact displayed frames as PNG, including paused frames.
- Added Command Palette actions for source selection, restart, stop, screenshots, and diagnostics.
- Serialized process transitions to prevent concurrent device access during restarts.
- Discard stale requests and frames after stop, restart, and capture failure.
- Detect common macOS FFmpeg locations and remember requested capture mode.
- Added extension icon, release packaging, and automated lifecycle/UI checks.

Hardware capture is currently macOS-only. Windows/Linux hardware support, audio, and measured latency guarantees are not included.
