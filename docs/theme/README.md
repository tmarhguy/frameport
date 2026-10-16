# Documentation template

A small, original Asciidoctor theme inspired by the compact layout of
[Fumadocs Notebook](https://www.fumadocs.dev/docs/ui/layouts/notebook) and the
navigation conventions of [Starlight](https://starlight.astro.build/).
No React, Node, npm install, web fonts, or icon package. The theme is plain CSS
and JavaScript; install Asciidoctor once on your machine and share it across projects.
The existing performance chapter uses Asciidoctor's MathJax integration, which
loads MathJax from a CDN for equations. Navigation and search work offline.

## Build and preview this repository

```sh
make docs
python3 -m http.server 8000 --bind 127.0.0.1 --directory build/docs
```

Open http://localhost:8000. AsciiDoc edits require another `make docs` and a browser
refresh. Output is in the ignored `build/docs` directory. The existing Pages
workflow builds the same files. Nothing has been deployed by the redesign.

## Use in another project

1. Copy `docs/theme/`, the docs scripts in `scripts/`, and the docs targets from `Makefile`.
2. Copy `starter.adoc` to `docs/index.adoc` in that project.
3. Copy `site.example.json` to `docs/site.json`, then edit: name, label, repository, source, optional website URL,
   optional per-chapter source URLs, and chapter-group labels (zero-based positions).
4. Change the CSS variables at the top of `docs.css` for colors and widths.
5. Add `==` chapters, each with a stable explicit `[#id]`. Use `===` subsections.
   Larger manuals can use `include::sections/01-name.adoc[]` just like this project.
6. Run `make docs-check`, then `make docs-open`.

The theme discovers chapters and subsection links from generated HTML. No route
manifest or per-page JavaScript is needed. Hash URLs support direct links and
browser back/forward. With JavaScript disabled, the entire manual and original
Asciidoctor table of contents remain available. Print shows all chapters.

The opening page is documentation, with a title, introduction, quick start, and
contents. Use ordinary AsciiDoc headings, prose, tables, code, and admonitions.
There are no landing-page components or decorative assets.

## Included interactions

- Chapter navigation, current-page highlighting, previous/next links.
- Contextual subsection rail with scroll position on wide screens.
- Full-text section search: `/`, Cmd/Ctrl+K, arrow keys, Enter, and Escape.
- System-aware light/dark theme with a saved user override.
- Mobile menu, visible keyboard focus, skip link, reduced-motion support.
- Code copy with text-selection fallback if clipboard access fails.
- Horizontally scrollable tables and code, printable complete manual.

Search indexes the rendered manual at load time. There is no tracking, remote
search service, or generated search bundle. Large manuals may eventually benefit
from split HTML pages; this design deliberately keeps the current single-file build.

## Author page

The exported starter ships a placeholder biography. Replace it with the author's
name and project links. Keep an explicit `[#about]` anchor, and set `"about": "#about"`
in `docs/site.json`. This adds a persistent About me link in the header, including
on phones. The page also appears in the chapter sidebar. Update its group index
if you add or remove chapters.

## Diagrams and documentation figures

Use a concise system figure under the introduction when it helps explain the
project; keep the quick start and reference content on the same page. Do not add
promotional hero text or decorative cards.

Figures are committed SVGs, generated with Python's standard library. There is
no Mermaid runtime, diagram CDN, or image-generation dependency. Edit
`docs/diagrams/*.json`, then run `make docs-diagrams`. Each file defines a title,
subtitle, and ordered rows of `[label, explanation, optional size]`.
For a vertical step flow, copy `docs/theme/flow.example.json` to
`docs/diagrams/<name>.json` and adapt its rows; for a three-column banner,
copy `docs/theme/hero.example.json` instead.
Use short descriptions (about 85 characters maximum) to avoid clipped text.
The generator includes accessible SVG titles/descriptions. AsciiDoc must also
include meaningful alternative text:

```adoc
.System overview
image::system-overview.svg[Describe the actual flow,width=800,link=images/system-overview.svg]
```

Copy a diagram JSON definition into a new project's `docs/diagrams/` and regenerate;
do not reuse SeaLion-specific labels for unrelated systems. SVGs are clickable
at full size and scroll horizontally on narrow screens. Examples, terminal output,
and actual code remain text blocks with copy buttons.

## Callouts

The shell stays black, white, and gray. Semantic callouts use restrained color:
Only the label is colored: NOTE is blue, TIP green, CAUTION amber, and WARNING/IMPORTANT red. Backgrounds and borders remain neutral. Every callout
also has a text label, so its meaning does not depend on color. Both themes define
separate readable colors. Use native AsciiDoc syntax (`WARNING: ...`); starter
examples cover all five types.

## Testing

`make docs-check` builds with warnings treated as errors and checks:

- Generated SVGs match their JSON definitions.
- Internal anchors are unique and every local link/asset resolves.
- Figures have alternative text; SVGs are well-formed with title/description.
- Overview and About pages exist; theme CSS/JS stays below 100 KB.
- The starter builds independently in a temporary project.
- Deliberately broken links and missing assets fail validation.

These are static checks, not a browser accessibility audit. Before publishing,
check desktop and phone layouts, About navigation, search (including no results),
keyboard focus, copy buttons, light/dark callouts, diagram text, back/forward, and
print preview. No external websites are probed by the validator. The current
manual's MathJax equations still need the existing CDN to render.

## GitHub Actions and Pages

Copy `.github/workflows/docs.yml` into the next project along with the files above.
In the repository's **Settings → Pages → Build and deployment**, select **GitHub
Actions** as the source. Change `main` in the workflow if your default branch has
a different name. Protect the `github-pages` environment as appropriate for your
repository.

Pushes and pull requests affecting documentation run `make docs-check` and
JavaScript syntax validation. Node is already available on the hosted runner;
there is no npm install or project `node_modules`. The validated `build/docs`
directory is uploaded as the Pages artifact. Deployment runs only for `main`
outside pull requests, after the build succeeds. Pages write and OIDC permissions
are limited to the deployment job. Configure Pages uses read access in the build
job. The deployment step has an `id` so the environment URL resolves correctly.

The workflow can also be run manually from the Actions tab. Publishing happens
when that workflow runs on the deployment branch; local preview commands do not
publish. See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Single project configuration

`docs/site.json` is the source of truth for navigation branding and social metadata.
`name`, `title`, and `description` identify the project. `url` optionally overrides the inferred public Pages URL, including its repository path. `repository` controls the GitHub button;
`website` is optional and an empty value removes that button. `about` links to the
shared author page. `groups` uses zero-based chapter positions. The build generates
`theme/config.js`; do not edit that generated file.

The actual SeaLion repository is `tmarhguy/sealion`, and its Pages URL is
https://tmarhguy.github.io/sealion/. Do not copy these URLs into another project's
configuration. CI can override `url` with `DOCS_SITE_URL`, including for a custom domain.

## Dark diagrams and code formatting

Generated SVG figures are embedded during the build and inherit CSS color variables.
There is no runtime SVG request or diagram JavaScript library. Duplicate figure IDs
are prefixed during embedding so multiple copies remain accessible. Ordinary photos
are not inverted. All generated figures use dark surfaces in dark mode.

Build-time code highlighting supports Rust, shell, JSON, TOML, and simple Python
examples. This is a small lexical highlighter, not a language parser. Unknown languages
remain plain text. The code toolbar has Copy and Wrap controls, and copy preserves the
original code text. No highlighter package is downloaded by the browser.

## Open Graph and social image

Set `title`, `description`, `url`, and optional `image` in `docs/site.json`. The build
writes canonical, Open Graph, and Twitter tags into static HTML (not JavaScript).
For a large preview card, commit a 1200x630 PNG such as `docs/images/social-card.png`
and set `image` to `images/social-card.png`.

Run `python3 scripts/render-docs-social.py` in a shared Python environment with Pillow
to generate the card. Pillow is an optional authoring dependency, not a build or
runtime dependency. Regenerate after changing branding. If you omit `image`, the
starter uses a text-summary social card until you add your own artwork. Platforms
cache link previews and may require a fresh scrape after deployment. Hash chapter
URLs share one preview; GitHub's repository social image is a separate repository
setting and is not changed by the Pages build.

## Export a public template repository

`python3 scripts/export-docs-template.py` creates
`build/docs/downloads/docs-template.zip`. The build also exports it automatically.
The archive has generic project configuration and author text, the documentation
workflow, a root README, and the template's MIT license. It excludes SeaLion's
chapters, media, build output, `.git`, and secrets. The MIT license in this theme
covers the reusable template; it does not relicense the SeaLion application.

Extract the archive into a new repository, customize its configuration, run
`make docs-check`, and enable Pages through Actions. To expose GitHub's **Use this
template** button, enable **Template repository** in Settings → General. The local
export does not create a remote repository or publish anything by itself.

## Optional overview image and URL fallbacks

The opening page has a `<!-- docs-hero -->` marker. The homepage always shows
a hero visual there when a conventional file exists — SVG, PNG, GIF, JPG, or
WebP named `overview-hero.*`, `hero.*`, or `demo.gif` under `docs/images/`.
This works for diagrams, screenshots, photos, and demo GIFs with no extra
configuration; the build uses the project title for alternative text when
`hero.alt` is not set. Diagrams render full-width; photos, screenshots, and
GIFs render centered at 60% (full-width on phones) and expand full-size when
clicked.

Set `hero` in `docs/site.json` to override the image, alternative text, and
caption:

```json
"hero": {
  "image": "images/overview-hero.svg",
  "alt": "Describe what the diagram or photograph shows",
  "caption": "Optional brief caption"
}
```

Set `hero` to `null` with no conventional image file for text-only
documentation. Use local image paths under `docs/`; alternative text is
required for explicit heroes, and captions are optional. Ordinary
photos and GIFs retain their original appearance. Generated SVGs inherit light/dark themes.
For a lightweight landscape diagram, copy `docs/theme/hero.example.json` to
`docs/diagrams/overview-hero.json`, replace its example labels, and run
`make docs-diagrams`. No diagram package is needed.

URL resolution, from highest priority to lowest:

1. `DOCS_SITE_URL`, supplied by the Pages configuration action in deployment builds.
2. An explicit `url` in `docs/site.json`, useful for a custom domain.
3. A GitHub repository URL, producing `https://OWNER.github.io/REPOSITORY/`.
4. `GITHUB_REPOSITORY` on the Actions runner, using the same Pages convention.

A repository named `OWNER.github.io` resolves to the root user/organization site.
If no URL or repository is known during a local build, the site remains usable:
canonical and URL-dependent image metadata are omitted rather than invented.
The configured title and description remain available. The published CI build
resolves the actual repository automatically. `website` is independent: omit it
or set it to an empty string when there is no separate application/site. The
GitHub button is likewise omitted when no repository is known. Source links
default to the repository's `main` branch; configure `branch` for another branch.

## Project accent

Leave `accent` and `accentDark` empty for the monochrome notebook. Set both to
`#rrggbb` when a project needs a color: `accent` is used on the light theme and
`accentDark` on the dark theme. They color links, the active chapter, and the
reading-progress bar. Paper, ink, and type stay the same.

## Engineering log

Set `logs` to a directory of markdown notes inside the repository, for example
`"logs": "log"` or `"logs": "docs/log"`. The build converts every note except
`README.md` into a subsection of one Engineering log chapter. Add this include
before the about page:

```adoc
ifdef::has-logs[]
include::sections/generated/engineering-log.adoc[]

endif::[]
```

The sidebar shows that chapter with an arrow. `nested` may list chapter ids
that should expand the same way; `engineering-log` is the default. `searchHint`
replaces the empty-search sentence when it is non-empty.

## Measured charts

Put recorded series in `docs/charts/<name>.json` (`title`, `subtitle`, `ylabel`,
`categories`, and `series` of `{name, values}`). `scripts/render-docs-charts.py`
draws them with matplotlib and recolors the SVG so it follows the accent in
both themes. Do not invent values. Embed the result with `image::`.
