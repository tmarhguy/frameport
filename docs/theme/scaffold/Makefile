.PHONY: docs docs-clean docs-open docs-check docs-diagrams docs-charts

docs:
	bash scripts/build-docs.sh

docs-clean:
	rm -rf build/docs

docs-open: docs
	python3 -m http.server --directory build/docs 8000

docs-diagrams:
	python3 scripts/render-docs-diagrams.py

docs-charts:
	python3 scripts/render-docs-charts.py

docs-check: docs
	python3 scripts/render-docs-diagrams.py --check
	python3 scripts/check-docs.py
	python3 scripts/test-docs-template.py
