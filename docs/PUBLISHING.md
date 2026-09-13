# Packaging and publishing

![release](https://img.shields.io/badge/release-0.2.0_preview-636363?style=flat-square)

FramePort is currently a 0.2.0 preview candidate. Building a VSIX does not publish it or make it searchable in VS Code.

## Before release

- Confirm ownership of the `tmarhguy` Marketplace publisher ID.
- Choose distribution terms and add the appropriate LICENSE file. `UNLICENSED` is currently a placeholder; proprietary terms are valid if that is the owner's choice.
- Validate the exact candidate in desktop VS Code: source selection, screenshots, recording, source changes, hidden view and normal shutdown.
- Run uncontended physical-device and screen-permission checks before advertising those workflows as fully supported. Record which checks were not run.
- Keep FFmpeg/encoder prerequisites and macOS-first support clear in the README.
- Publish repository images before the listing: VSCE rewrites README image paths to HTTPS repository URLs. Check them in the Marketplace preview.

## Build

```sh
npm ci
npm run check
npm test
npm run test:ui
npm run package
```

The private preview command bypasses a missing license file. After terms are selected, use `npm run package:public` instead. Inspect the actual archive, not only its filename:

```sh
unzip -l frameport-0.2.0.vsix
shasum -a 256 frameport-0.2.0.vsix
```

Expect the manifest, README, changelog, `src/`, and runtime `media/`. No tests, Chromium, node_modules, developer notes or documentation screenshots belong in the runtime archive. Test installation through **Extensions: Install from VSIX…** in a clean profile.

## Publish when approved

Upload the reviewed VSIX through [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/), or use authenticated VSCE publication. The manifest's `preview: true` label is not the separate Marketplace pre-release channel. Choose the channel deliberately and follow the current [VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

For future automation, use the current identity-based authentication guidance rather than copying old token workflows. Keep publishing separate from test CI. Credentials never belong in this repository.

After publication, verify the listing, screenshots, install flow and core capture workflow from the public artifact. Record the version and hash. Do not claim a public release until the Marketplace confirms it.
