#!/usr/bin/env python3
"""Export the docs tooling as a generic repository without project content."""
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build/docs/downloads/docs-template.zip'
OUT.parent.mkdir(parents=True,exist_ok=True)
files={}
for path in (ROOT/'docs/theme').iterdir():
    if path.is_file() and path.suffix in ('.css','.js','.html','.adoc','.md','.json'):
        if path.name not in ('config.js','config.example.js'):
            files[str(path.relative_to(ROOT))]=path.read_bytes()
scaffold=ROOT/'docs/theme/scaffold'
for path in scaffold.iterdir():
    if path.is_file():
        files[str(path.relative_to(ROOT))]=path.read_bytes()
for path in (ROOT/'scripts').glob('*docs*.py'):
    files[str(path.relative_to(ROOT))]=path.read_bytes()
files['scripts/ingest-logs.py']=(ROOT/'scripts/ingest-logs.py').read_bytes()
files['scripts/build-docs.sh']=files['docs/theme/scaffold/build-docs.sh']
files['Makefile']=files['docs/theme/scaffold/Makefile']
files['.github/workflows/docs.yml']=files['docs/theme/scaffold/docs.yml']
files['docs/index.adoc']=(ROOT/'docs/theme/starter.adoc').read_bytes()
files['docs/site.json']=(ROOT/'docs/theme/site.example.json').read_bytes()
files['docs/404.html']=(ROOT/'docs/404.html').read_bytes()
files['LICENSE']=(ROOT/'docs/theme/LICENSE').read_bytes()
files['docs/theme/LICENSE']=files['LICENSE']
files['.gitignore']=b'/build/\n.DS_Store\n__pycache__/\n'
files['docs/theme/about.adoc']=b'''[#about]
[preface]
== About me

Replace this text with your name, background, and connection to the project.

=== Projects

Add links to your hardware, software, or open-source work as appropriate.
'''
files['README.md']=b'''# Documentation template

A static AsciiDoc documentation template with a monochrome interface,
light/dark themes, chapter search, SVG diagrams, and GitHub Pages deployment.
No npm install or browser framework is required.

## Start

1. Install Asciidoctor and Python 3.10+ once on your machine.
2. Edit `docs/site.json`: project name, description, and repository. The Pages URL is inferred unless overridden.
3. Edit `docs/index.adoc` and `docs/theme/about.adoc`.
4. Run `make docs-check`, then `make docs-open`.
5. Open http://localhost:8000.

Set `website` to your live project's URL, or leave it empty to hide its button.
The static HTML includes canonical, Open Graph, and Twitter metadata.
To add a social image, see the theme guide; the starter deliberately has no
project-specific preview image or author biography.

## Publish or share

Create a GitHub repository from these files. Set Settings > Pages > Source to
GitHub Actions. The supplied workflow validates every change and deploys main.
Update that branch name if needed. In Settings > General, enable Template
repository if you want others to see GitHub's Use this template button.

See `docs/theme/README.md` for diagrams, callouts, social cards, testing,
and configuration. This exported template is MIT licensed (see LICENSE).
'''
with zipfile.ZipFile(OUT,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(files.items()):
        archive.writestr(name,data)
print(f'Exported {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)')
