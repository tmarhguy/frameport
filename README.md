<h1 align="center">FramePort</h1>
<p align="center"><strong>HDMI and USB video capture inside VS Code.</strong></p>

<p align="center">
  <a href="https://github.com/tmarhguy/frameport/actions/workflows/ci.yml"><img src="https://github.com/tmarhguy/frameport/actions/workflows/ci.yml/badge.svg" alt="CI: Validate extension" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=tmarhguy.frameport"><img src="https://img.shields.io/visual-studio-marketplace/v/tmarhguy.frameport?style=flat-square" alt="Marketplace version" /></a>
  <a href="https://open-vsx.org/extension/tmarhguy/frameport"><img src="https://img.shields.io/open-vsx/v/tmarhguy/frameport?style=flat-square" alt="Open VSX version" /></a>
  <img src="https://img.shields.io/badge/release-0.2.4-636363?style=flat-square" alt="Release: 0.2.4" />
  <img src="https://img.shields.io/badge/VS_Code-1.95%2B-007ACC?style=flat-square" alt="VS Code 1.95 or newer" />
  <img src="https://img.shields.io/badge/hardware_capture-macOS-333333?style=flat-square" alt="Hardware capture: macOS" />
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/tmarhguy/frameport/main/media/screenshots/frameport-demo.mp4"><img src="https://raw.githubusercontent.com/tmarhguy/frameport/main/media/screenshots/frameport-demo.gif" alt="FramePort live capture demo in VS Code — click for the full clip" width="480" /></a>
  <br>
  <em>Demo: live capture inside VS Code — click the preview for the full clip.</em>
</p>

<p align="center">
  <a href="https://open-vsx.org/extension/tmarhguy/frameport"><img alt="Install on Open VSX" src="https://img.shields.io/badge/Install_on_Open_VSX-tmarhguy.frameport-007ACC?style=for-the-badge"></a>
  <a href="https://tmarhguy.github.io/frameport/"><img alt="Read the Technical Manual" src="https://img.shields.io/badge/Technical_Manual-tmarhguy.github.io-2e7d32?style=for-the-badge"></a>
</p>

FramePort opens an HDMI capture card or other USB video device in an editor tab. View FPGA HDMI output beside your code, inspect individual pixels, save a PNG screenshot, or record a silent MP4 clip without switching to a separate video application.

**Explore:** [technical manual](https://tmarhguy.github.io/frameport/) ·
[development](docs/DEVELOPMENT.md) ·
[build journal](docs/log)

<table align="center">
  <tr>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/tmarhguy/frameport/main/media/screenshots/tomato-live.png" alt="Tomato OS running on an FPGA, viewed through FramePort" /></td>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/tmarhguy/frameport/main/media/screenshots/preview-light.png" alt="FramePort panel in the high-contrast theme" /></td>
  </tr>
  <tr>
    <td align="center"><em>Tomato OS through a USB capture card; requested settings and observed FPS shown separately.</em></td>
    <td align="center"><em>High-contrast theme supported.</em></td>
  </tr>
</table>

<table align="center">
  <tr>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/tmarhguy/frameport/main/media/screenshots/source-picker.png" alt="FramePort source picker" /><br /><em>Pick a source; a phone camera is not screen mirroring.</em></td>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/tmarhguy/frameport/main/media/screenshots/capture-modes.png" alt="Requested capture modes" /><br /><em>Requested modes, not probed capabilities.</em></td>
  </tr>
</table>

## Why I built it

I needed to see my [Tomato](https://tomato.tmarhguy.com) FPGA's HDMI output while programming it. A USB capture card replaced the extra monitor, but viewing still needed another app — so the feed moved into VS Code. The [build journal](https://github.com/tmarhguy/frameport/tree/main/docs/log) tells the story.

## Features

- **Source and mode:** request a resolution/frame rate per device; screens use native size with a separate FPS choice.
- **Fit / native / integer, crisp / smooth:** fit the pane, inspect source pixels, or scale up; sharp edges or smoothed.
- **Pause / resume:** freeze the preview; capture and recording continue.
- **Screenshot:** autosave the displayed frame as PNG under `media/screenshots` (oversized captures are refused).
- **Record:** autosave the source as silent H.264 MP4 under `media/videos`; never overwrites.
- **Focus:** hide toolbars (recording stays visible); Escape restores.
- **Stop / restart / last capture:** release or restart capture; closing finalizes recording; reveal the last PNG/MP4.

| Control | What it does |
| --- | --- |
| Source and mode | Request a resolution/frame rate per device; screens use native size with a separate FPS choice. |
| Fit / native / integer, crisp / smooth | Fit the pane, inspect source pixels, or scale up; sharp edges or smoothed. |
| Pause / resume | Freeze the preview; capture and recording continue. |
| Screenshot | Autosave PNG under `media/screenshots` (or ask via setting); oversized captures are refused. |
| Record | Autosave silent H.264 MP4 under `media/videos` (or ask via setting); never overwrites. |
| Focus | Hide toolbars (recording stays visible); Escape restores. |
| Stop / restart / last capture | Release or restart capture; closing finalizes recording; reveal the last PNG/MP4. |

## Requirements

- Desktop VS Code **1.95+** in a trusted local workspace (remote, browser-only, and untrusted workspaces are unsupported).
- **macOS** for device capture. Windows/Linux: test pattern only.
- **FFmpeg** with `libx264` on PATH. FramePort also checks `/opt/homebrew/bin/ffmpeg` and `/usr/local/bin/ffmpeg` on macOS, or set `frameport.ffmpegPath`.
- Camera and screen-recording permission when macOS asks.

Device capture is currently tested on macOS; Windows and Linux support is under development.

## Get started

1. Install **0.2.4** from either store:
   - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tmarhguy.frameport) (Extensions view → search `FramePort`)
   - [Open VSX](https://open-vsx.org/extension/tmarhguy/frameport) (Cursor, VSCodium, and other Open VSX clients)
   - Or **Extensions: Install from VSIX…** with `frameport-0.2.4.vsix`
2. Run **FramePort: Open Capture Device** → **Select device**, or **Test pattern** to verify without hardware.
3. Pick a capture mode your device supports. Allow camera access if macOS asks.
4. Use Pause, Screenshot, Record, Focus, and Diagnostics from the panel toolbar or Command Palette.

Screenshots and recordings autosave to `media/screenshots` and `media/videos` in the workspace (or `~/FramePort` with no folder open). Change folders, ask-before-save, or naming in settings.

FFmpeg is auto-found in Homebrew paths or PATH; override with `frameport.ffmpegPath` if VS Code's PATH differs from your terminal's. If FFmpeg is missing, FramePort offers to install via Homebrew on macOS, open the download guide, or jump to settings.

## Extension Settings

| Setting | Default | Use |
| --- | --- | --- |
| `frameport.ffmpegPath` | `ffmpeg` | Executable override. |
| `frameport.previewFps` | `30` | Preview cap: `15`, `30`, or `60`. |
| `frameport.recordingEncoder` | `software` | `libx264`, or macOS VideoToolbox `hardware` (larger files). |
| `frameport.saveRoot` | `media` | Capture root (workspace-relative, or absolute; else `~/FramePort`). |
| `frameport.screenshotFolder` | `screenshots` | PNG subfolder under save root. |
| `frameport.videoFolder` | `videos` | MP4 subfolder under save root. |
| `frameport.saveMode` | `auto` | `auto` writes immediately; `ask` shows the save dialog. |
| `frameport.filenameStyle` | `timestamp` | `timestamp` (`frameport-YYYYMMDD-HHMMSS`) or `sequential` (`frameport-0001`). |

## Commands

| Command | What it does |
| --- | --- |
| `FramePort: Open Capture Device` | Open the capture panel. |
| `FramePort: Select Device` | Pick a source and requested mode. |
| `FramePort: Take Screenshot` | Save the displayed frame as PNG. |
| `FramePort: Start / Stop Recording` | Record silent H.264 MP4; never overwrites. |
| `FramePort: Restart Stream` | Restart capture on the current source. |
| `FramePort: Stop Stream` | Release the device. |
| `FramePort: Show Diagnostics` | Inspect FFmpeg output on failure. |
| `FramePort: Show Last Capture` | Reveal the last PNG/MP4 in your file manager. |

## Known issues and troubleshooting

One FFmpeg process while viewing, one more while recording; frames are skipped rather than queued under load, so preview FPS is observed output, not latency. No audio, editing, broadcasting, or phone mirroring; browser-only VS Code is unsupported. The transport is JPEG, so PNG screenshots are not lossless.

- **FFmpeg won't launch:** use the Install via Homebrew / Install guide actions when offered, or set `frameport.ffmpegPath`; VS Code's PATH differs from the terminal's.
- **No frames:** check permissions, cables, other apps holding the device, and a lower mode; see **Diagnostics**.
- **Recording fails:** confirm the encoder exists in your FFmpeg build and pick a new writable filename.
- **Black frames:** some cards emit black when HDMI drops; the video alone can't always tell.

## Build from source

```sh
npm ci && npm run check && npm test && npm run package
```

Install the VSIX via **Extensions: Install from VSIX…**, or press **F5** to hack. Guides: [development](https://github.com/tmarhguy/frameport/blob/main/docs/DEVELOPMENT.md), [publishing](https://github.com/tmarhguy/frameport/blob/main/docs/PUBLISHING.md), [issues](https://github.com/tmarhguy/frameport/issues).

## Release Notes

See [CHANGELOG.md](https://github.com/tmarhguy/frameport/blob/main/CHANGELOG.md): `0.2.4` adds Windows device capture via FFmpeg `dshow`; `0.2.3` fixes store listing images and packaging; `0.2.2` adds missing-FFmpeg recovery, leaves the Marketplace preview channel, and autosaves captures under `media/`; `0.2.1` refreshes the listing; `0.2.0` adds MP4 recording, native-size screen sources, an optional VideoToolbox encoder, and hardened save handling.

## Author and license

Built by [Tyrone Marhguy](https://tmarhguy.com) from the [Tomato](https://github.com/tmarhguy/tomato) workflow. All rights reserved — see [LICENSE](https://github.com/tmarhguy/frameport/blob/main/LICENSE). No open-source license is granted.
