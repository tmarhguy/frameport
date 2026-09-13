# Documentation images

![docs-only](https://img.shields.io/badge/docs--only-excluded_from_VSIX-636363?style=flat-square)
![runtime](https://img.shields.io/badge/runtime-lives_in_media-007ACC?style=flat-square)

These images are for the repository, journal and Marketplace README. They are excluded from the runtime VSIX; `media/` contains runtime assets only.

`media/` and `docs/images/` cannot merge: `media/icon.png`, `media/preview.js` and `media/preview.css` ship inside the VSIX and load at runtime paths, while everything here is repo documentation. Merging would either bloat installs by ~1.4 MB or break the webview.

| File | Origin | Use |
| --- | --- | --- |
| `tomato-live.png` | User-provided `frameport_showing_tomato.png`, moved without editing | Live FPGA output / README hero |
| `source-picker.png` | User-provided `frame_port_source_select.png`, moved without editing | Device selection / source journal |
| `capture-modes.png` | User-provided `capture_mode_list.png`, moved without editing | Requested camera modes |
| `focus-recording.png` | Fresh `npm run test:ui` capture of current markup | Recording journal; explicitly labeled synthetic harness with injected recording state |
| `preview-idle.png` | Fresh `npm run test:ui` capture of current markup | Empty-state harness shot; theme-verification reference, not hardware evidence |
| `preview-light.png` | Fresh `npm run test:ui` capture of current markup | Light-theme harness shot; theme-verification reference, not hardware evidence |
| `preview-high-contrast.png` | Fresh `npm run test:ui` capture of current markup | High-contrast harness shot; theme-verification reference, not hardware evidence |

The three user-provided screenshots show an earlier candidate. They are workflow illustrations, not current performance benchmarks. The source-picker image includes the user's device names as supplied. Do not infer phone-screen mirroring from the presence of an iPhone camera.

Regenerate browser artifacts with `npm run test:ui`, inspect them, then copy only the images needed for documentation. Keep redundant test screenshots in ignored `artifacts/`.
