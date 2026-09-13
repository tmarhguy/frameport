# FramePort UI rules

![design](https://img.shields.io/badge/design-native_theme_only-007ACC?style=flat-square)

FramePort is a capture instrument inside an editor. Prioritize the video, source controls, and accurate state.

## Audit of the original preview

- Removed cyan decorative marks and the redundant PREVIEW badge.
- Removed the oversized welcome heading, uppercase eyebrow, slogan, and privacy/implementation tagline.
- Replaced hard-coded navy backgrounds and blue-gray text with host theme tokens. Only the live-video surface stays black.
- Reduced header/toolbar height, corner radius, and button weight. Device/mode selectors are fields; secondary actions are quiet toolbar buttons.
- Replaced conversational empty/error messages with explicit states and next steps.

## Rules for future changes

- Follow VS Code theme colors and typography, including light and high-contrast themes.
- Use color to communicate interaction or state. Do not add a brand palette to editor chrome.
- No gradients, glows, glass panels, decorative icon tiles, hero sections, marketing badges, or slogans in the capture panel.
- No oversized headings, forced letter spacing, pill-shaped controls, or gratuitous motion.
- Use short operational labels. Errors explain what failed and what the user can try.
- Show real measurements only. Distinguish requested capture settings from observed preview output.
- Keep standard keyboard focus visible; use text as well as color for state.
- Keep the generated package icon out of the working UI. Revisit the standalone brand mark separately; its glow-heavy treatment is not the product's theme.
- Verify idle/live/error and narrow layouts with dark, light, and high-contrast host tokens before release.

References: [VS Code webview UX](https://code.visualstudio.com/api/ux-guidelines/webviews), [theme colors](https://code.visualstudio.com/api/references/theme-color).
