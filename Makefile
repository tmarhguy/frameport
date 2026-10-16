.PHONY: docs docs-clean docs-open docs-check docs-diagrams

# Build the complete static documentation into build/docs/.
docs:
	bash scripts/build-docs.sh

# Remove generated documentation.
docs-clean:
	rm -rf build/docs

# Serve the built manual locally (requires `make docs` first).
# Uses only the Python standard library; no npm or extra tooling.
docs-open: docs
	python3 -m http.server --directory build/docs 8000

# Regenerate lightweight SVG diagrams after editing docs/diagrams/*.json.
docs-diagrams:
	python3 scripts/render-docs-diagrams.py

# The same static validation used in CI; no third-party Python packages.
docs-check: docs
	python3 scripts/render-docs-diagrams.py --check
	python3 scripts/check-docs.py
	python3 scripts/test-docs-template.py

