# FramePort documentation targets. npm remains the build system for the
# extension; this Makefile only drives the static manual under docs/.
.PHONY: docs docs-clean docs-open

docs:
	sh scripts/build-docs.sh

docs-clean:
	rm -rf build/docs

# Portable opener: builds, then opens the entry page in the default browser.
docs-open: docs
	python3 -c "import webbrowser; webbrowser.open('build/docs/index.html')"
