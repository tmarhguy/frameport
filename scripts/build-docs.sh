#!/bin/sh
# Build the AsciiDoc technical manual into build/docs/.
# Fails clearly if Asciidoctor is missing; never installs anything.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SRC="$ROOT/docs/index.adoc"
OUT="$ROOT/build/docs"

if ! command -v asciidoctor >/dev/null 2>&1; then
  echo "error: asciidoctor is not installed." >&2
  echo "" >&2
  echo "Install the minimum dependency:" >&2
  echo "  macOS:  brew install asciidoctor" >&2
  echo "  Ubuntu: sudo apt-get install -y asciidoctor ruby-rouge" >&2
  echo "  Other:  gem install asciidoctor rouge" >&2
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "error: missing source $SRC" >&2
  exit 1
fi

mkdir -p "$OUT/theme" "$OUT/images"

# Same build used locally and in CI. Attributes duplicate index.adoc
# defaults so the command line stays explicit about the contract.
asciidoctor \
  -a toc=left \
  -a toclevels=3 \
  -a sectnums \
  -a icons=font \
  -a source-highlighter=rouge \
  -a docinfo=shared \
  -a docinfodir="$ROOT/docs/theme" \
  -D "$OUT" \
  "$SRC"

# Theme assets and figures travel with the generated HTML.
cp "$ROOT/docs/theme/docs.css" "$ROOT/docs/theme/nav.js" "$OUT/theme/"
cp -R "$ROOT/docs/images/." "$OUT/images/"
# docs/images/README.md documents the folder; it is not a figure.
rm -f "$OUT/images/README.md"
# The live-capture demo is the manual's hero figure. Its canonical copy
# lives in media/screenshots/ (it ships in the VSIX so the Extension
# Details page plays it offline); stage it into the built manual so
# image::frameport-demo.gif[] resolves in a self-contained build/.
cp "$ROOT/media/screenshots/frameport-demo.gif" "$OUT/images/"

echo "docs: built $OUT/index.html"
