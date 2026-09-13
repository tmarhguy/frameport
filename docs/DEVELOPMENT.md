# Developing FramePort

![tests](https://img.shields.io/badge/tests-unit_browser_host-2ea043?style=flat-square)
![needs](https://img.shields.io/badge/needs-Node_22_FFmpeg-333333?style=flat-square)

## Run and test

Use desktop VS Code, Node.js, npm and FFmpeg. The integration tests also use ffprobe. Install development dependencies with `npm ci`; no npm dependencies are loaded by the installed extension.

```sh
npm run check
npm test
npm run test:ui
```

Browser tests need an installed Playwright Chromium (`npx playwright install chromium` if absent) and permission to bind a local port. They generate screenshots under ignored `artifacts/`. These test the webview with mocked VS Code messaging; they are not evidence of device permissions or Extension Host behavior.

Press F5 to open an Extension Development Host. `npm run test:host` runs the synthetic host suite in a temporary profile and opens a VS Code window. Set `VSCODE_TEST_BINARY` if the installed binary is elsewhere. Coordinate the GUI run with other work; it does not install the candidate into the normal profile.

Set `FRAMEPORT_TEST_FFMPEG` and, if necessary, `FRAMEPORT_TEST_FFPROBE` to override test executable paths. Test actual hardware separately with one application owning the device.

## Architecture

```text
AVFoundation device / synthetic source
              ↓
       FFmpeg JPEG output
              ↓
     bounded parser / latest frame
              ├── loopback endpoint → webview canvas → PNG screenshot
              └── on-demand encoder → fragmented H.264 MP4
```

| Module | Responsibility |
| --- | --- |
| `src/capture.js` | Source enumeration, FFmpeg capture arguments and JPEG framing |
| `src/session.js` | Serialized capture lifecycle and stale-callback cancellation |
| `src/recorder.js` | Bounded encoder input, progress parsing, output confirmation and finalization |
| `src/screenshot.js` | Screenshot limits, validation and saved-file action selection |
| `src/extension.js` | Commands, dialogs, settings, local server and coordination |
| `src/view.js`, `media/preview.*` | Theme-aware markup, rendering, controls and accessibility |

FramePort runs in the local UI extension host. It binds its frame endpoint to loopback with an unpredictable session path and a restricted webview CSP. It starts capture only on an explicit action. No background service or network video upload is part of the implementation.

Recording uses the current capture feed rather than reopening the device. The input queue is bounded; encoder progress confirms frames were encoded before Saved is reported. Arrival-time timestamps are approximate and need validation against the intended source timeline. Normal teardown finalizes recording before replacing the source. Interrupted files are retained rather than silently deleted.

## Contribution checks

Follow [the UI rules](DESIGN.md). Keep source, preview and recording rates distinct. Avoid adding dependencies or new source protocols without a concrete workflow.

For changes, report which checks actually ran: unit, real FFmpeg, browser harness, Extension Host, and physical device. Include device/mode, FFmpeg version and contention status with performance measurements. Never infer hardware latency from preview FPS alone.

## Package

`npm run package` builds the private preview VSIX. `.vscodeignore` excludes tests, developer docs, screenshots and build tooling; README image paths are rewritten to repository HTTPS URLs by VSCE. Publish those referenced image files with the repository before publishing the listing.

See [publishing](PUBLISHING.md) for owner decisions and release checks. Generated artifacts and local sprint/review notes are intentionally ignored, not part of the public source or runtime package.
