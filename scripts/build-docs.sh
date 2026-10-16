#!/usr/bin/env bash
# Build the static technical manual with Asciidoctor.
# No dependency installation happens here; install Asciidoctor first:
#   macOS:  brew install asciidoctor
#   Linux:  sudo apt-get install -y asciidoctor   (or: gem install asciidoctor)
#   Other:  gem install asciidoctor
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SRC="$REPO_ROOT/docs/index.adoc"
OUT_DIR="$REPO_ROOT/build/docs"
OUT_FILE="$OUT_DIR/index.html"

cd "$REPO_ROOT"

if ! command -v asciidoctor >/dev/null 2>&1; then
  echo "error: asciidoctor not found on PATH." >&2
  echo "Install it first:" >&2
  echo "  macOS:  brew install asciidoctor" >&2
  echo "  Debian/Ubuntu: sudo apt-get install -y asciidoctor" >&2
  echo "  RubyGems (any OS with Ruby): gem install asciidoctor" >&2
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "error: missing source $SRC" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/theme" "$OUT_DIR/images"

python3 "$REPO_ROOT/scripts/ingest-logs.py"
if [ -d "$REPO_ROOT/docs/diagrams" ]; then
  python3 "$REPO_ROOT/scripts/render-docs-diagrams.py"
fi
if [ -d "$REPO_ROOT/docs/charts" ]; then
  python3 "$REPO_ROOT/scripts/render-docs-charts.py"
fi
python3 "$REPO_ROOT/scripts/prepare-docs.py" head

REVDATE="$(git -C "$REPO_ROOT" log -1 --format=%cs 2>/dev/null || date +%F)"
REVNUM="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unversioned)"

DOCINFO_DIR="$(mktemp -d "$REPO_ROOT/docs/theme/.docinfo.XXXXXX")"
trap 'rm -rf "$DOCINFO_DIR"' EXIT
cp "$OUT_DIR/theme/docinfo.html" "$DOCINFO_DIR/docinfo.html"

HAS_LOGS=0
if [ -f "$REPO_ROOT/docs/sections/generated/engineering-log.adoc" ]; then
  HAS_LOGS=1
fi

if [ "$HAS_LOGS" -eq 1 ]; then
  asciidoctor \
    --failure-level WARN \
    --backend html5 \
    --safe-mode safe \
    --attribute docinfo=shared \
    --attribute docinfodir="$DOCINFO_DIR" \
    --attribute revdate="$REVDATE" \
    --attribute revnumber="$REVNUM" \
    --attribute has-logs \
    --out-file "$OUT_FILE" \
    "$SRC"
else
  asciidoctor \
    --failure-level WARN \
    --backend html5 \
    --safe-mode safe \
    --attribute docinfo=shared \
    --attribute docinfodir="$DOCINFO_DIR" \
    --attribute revdate="$REVDATE" \
    --attribute revnumber="$REVNUM" \
    --out-file "$OUT_FILE" \
    "$SRC"
fi

for asset in docs.css nav.js search.js; do
  cp "$REPO_ROOT/docs/theme/$asset" "$OUT_DIR/theme/$asset"
done

if [ -d "$REPO_ROOT/docs/images" ]; then
  cp -R "$REPO_ROOT/docs/images/." "$OUT_DIR/images/"
fi
if [ -d "$REPO_ROOT/docs/assets" ]; then
  cp "$REPO_ROOT/docs/assets/"*.* "$OUT_DIR/images/" 2>/dev/null || true
fi

python3 "$REPO_ROOT/scripts/prepare-docs.py" page
if [ -f "$REPO_ROOT/docs/404.html" ]; then
  python3 "$REPO_ROOT/scripts/prepare-docs.py" not-found
fi
python3 "$REPO_ROOT/scripts/export-docs-template.py"

echo "Built $OUT_FILE"
