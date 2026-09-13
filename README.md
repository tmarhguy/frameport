<h1 align="center">FramePort</h1>
<p align="center"><strong>HDMI and USB video capture inside VS Code.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/status-preview-636363?style=flat-square" alt="Status: preview" />
  <img src="https://img.shields.io/badge/HDMI-USB_capture-990000?style=flat-square" alt="HDMI USB capture" />
  <img src="https://img.shields.io/badge/VS_Code-1.95%2B-007ACC?style=flat-square" alt="VS Code 1.95 or newer" />
  <img src="https://img.shields.io/badge/hardware_capture-macOS-333333?style=flat-square" alt="Hardware capture: macOS" />
  <img src="https://img.shields.io/badge/output-PNG_%C2%B7_MP4-41694b?style=flat-square" alt="Output: PNG and MP4" />
</p>

FramePort opens an HDMI capture card or other USB video device in an editor tab. View FPGA HDMI output beside your code, inspect individual pixels, save a PNG screenshot, or record a silent MP4 clip without switching to a separate video application.

![Tomato OS running on an FPGA, viewed through FramePort](docs/images/tomato-live.png)

*Tomato OS through a USB capture card. Requested capture settings and observed preview FPS are shown separately; choosing 60 fps does not guarantee a 60 fps source.*

<table align="center">
  <tr>
    <td align="center" width="50%"><img src="docs/images/source-picker.png" alt="FramePort source picker with USB video, cameras, screen and test pattern" /></td>
    <td align="center" width="50%"><img src="docs/images/capture-modes.png" alt="Requested capture resolution and frame-rate presets" /></td>
  </tr>
  <tr>
    <td align="center"><em>Sources depend on the machine; an iPhone camera is not screen mirroring.</em></td>
    <td align="center"><em>Requested camera modes, not probed device capabilities.</em></td>
  </tr>
</table>

## Why I built it

I was working on [Tomato](https://tomato.tmarhguy.com), my 32-bit computer project, and needed to see the FPGA's HDMI output while programming it. A USB capture card removed the extra monitor, but I still needed another application just to see the feed. FramePort brings that view into VS Code.

The same workflow fits other video devices exposed by macOS: select a source, inspect it, and save what matters. The [build journal](https://github.com/tmarhguy/frameport/tree/main/docs/log) records how it started.

## Requirements and install

**This is a preview candidate, not a published Marketplace release.** Build a VSIX using the instructions below, or use a candidate supplied by the maintainer.

Requirements:

- Desktop VS Code **1.95 or newer** and a trusted workspace.
- **macOS** for device/screen capture. Windows and Linux currently support the test pattern only.
- An existing **FFmpeg** installation with `libx264` for the default MP4 recorder.

1. Run **Extensions: Install from VSIX…** and select `frameport-0.2.0.vsix`.
2. Run **FramePort: Open Capture Device** from the Command Palette.
3. Click **Select device** and choose your source. To check the UI without a camera, choose **Test pattern**.
4. Allow camera or screen-recording access if macOS requests it.

FramePort checks `/opt/homebrew/bin/ffmpeg` and `/usr/local/bin/ffmpeg` on macOS, then falls back to `ffmpeg` on PATH. Set `frameport.ffmpegPath` to the full executable path if needed. It does not download FFmpeg automatically.

The device list is shown in the gallery above. Available sources depend on your machine. An iPhone camera appearing here does not mean iPhone screen mirroring is supported.

## Features: inspect and capture

| Control | What it does |
| --- | --- |
| Source and mode | Select a video device and request a supported resolution/frame rate. Screen sources use native dimensions with a separate FPS choice. |
| Fit / native / integer | Fit the editor pane, inspect source pixels, or enlarge by whole-number factors. |
| Pixel crisp / smooth | Choose sharp pixel edges or smoothed scaling. |
| Pause / resume | Freeze the preview for inspection. Source capture and recording continue. |
| Screenshot | Save the exact displayed frame, including a paused frame, as a local PNG. Oversized captures are refused with a message. |
| Record / stop recording | Save the active source to a silent H.264 MP4. Choose a new filename; existing recordings are not overwritten. |
| Focus | Hide the toolbars. Active recording remains visible; Escape restores the controls. |
| Show last capture | Reveal the last saved screenshot or recording. |
| Stop / restart | Release or restart capture. Closing the panel finalizes recording and stops the owned capture process. |

Capture modes are shown in the gallery above. These are requested camera modes, not a list of capabilities discovered from the device. Start with a mode your capture card supports.

Recordings contain source video, not the VS Code window or preview scaling. Screenshots preserve the displayed decoded frame; the capture transport uses JPEG, so saving PNG does not make the source lossless. Audio is not recorded.

## Extension Settings

| Setting | Default | Use |
| --- | --- | --- |
| `frameport.ffmpegPath` | `ffmpeg` | Override executable discovery. |
| `frameport.previewFps` | `30` | Preview refresh cap: `15`, `30`, or `60`. Independent of source capture rate. |
| `frameport.recordingEncoder` | `software` | `libx264` by default. `hardware` uses macOS VideoToolbox when available; it can reduce CPU at the cost of larger files. If unavailable, switch back to software. |

Open FramePort's **Settings** button to configure these. Command Palette actions also cover source selection, screenshots, recording, stop/restart, diagnostics, and the last saved capture.

## Performance and limits

FramePort has **no production npm dependencies or bundled browser**. It uses VS Code's existing webview, one FFmpeg capture process while viewing, and one additional encoder while recording. Frames are not accumulated into an in-memory video. Under load, recording skips frames rather than blocking the preview and reports skips on completion.

The preview uses deadline-based scheduling and retains the latest frame. Actual responsiveness still depends on the source, USB card, selected mode and machine. Close other applications using the same capture device before comparing performance. A higher refresh cap cannot produce frames the source does not supply.

This preview does not provide audio, editing, broadcasting, phone control, or AirPlay/USB phone-screen mirroring. Screen permissions, sustained physical-device performance and clean-install acceptance still need broader validation. Browser-only VS Code is unsupported; remote-workspace integration is not yet release-validated.

## Known Issues and troubleshooting

- **FFmpeg cannot launch:** set its full path. VS Code's PATH may differ from your terminal's.
- **No frames or capture ended:** check OS permissions, the cable, other applications using the device, and a lower supported mode. Open **Diagnostics** for FFmpeg's output.
- **Slow preview:** compare a lower mode, stop recording temporarily, and check for another owner of the capture card. Preview FPS is not an end-to-end latency measurement.
- **Recording fails:** confirm your FFmpeg build includes the selected encoder and choose a writable local destination with a new filename. Failed or interrupted recordings may leave a partial file.
- **Screen capture repeats the editor:** the selected screen includes FramePort itself. Move the panel to another display or choose a different source.
- **Black frames:** a capture card may keep sending black frames when HDMI disappears. FramePort cannot always identify missing HDMI signal from the video alone.

## Build from source

```sh
npm ci
npm run check
npm test
npm run package
```

The resulting `frameport-0.2.0.vsix` installs through **Extensions: Install from VSIX…**. For development, open the repository and press **F5**. Browser and Extension Host checks are described in the [development guide](https://github.com/tmarhguy/frameport/blob/main/docs/DEVELOPMENT.md).

See the [publishing guide](https://github.com/tmarhguy/frameport/blob/main/docs/PUBLISHING.md), and [issues](https://github.com/tmarhguy/frameport/issues). Report the OS, VS Code/FFmpeg versions, capture device and requested mode when filing a problem.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md). `0.2.0` adds silent MP4 recording, screen sources at native size, an optional VideoToolbox encoder, and hardened screenshot/save handling. `0.1.x` covered the theme-aware preview, inspection controls, PNG screenshots, and palette actions.

## Author and license

Built by [Tyrone Marhguy](https://tmarhguy.com), beginning with the [Tomato](https://github.com/tmarhguy/tomato) workflow.

Distribution terms have not been selected; the manifest currently uses `UNLICENSED`. No open-source license is granted by this preview.
