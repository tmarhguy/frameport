#!/usr/bin/env python3
"""Build the reusable starter independently, then exercise its link/asset gates."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import os
import importlib.util
import zipfile

root = Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('docs_config',root/'scripts/docs-config.py')
config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
clean_env={key:value for key,value in os.environ.items() if key not in ('DOCS_SITE_URL','GITHUB_REPOSITORY')}
saved_env=dict(os.environ)
try:
    os.environ.clear();os.environ.update(clean_env)
    assert config.resolve_site({'repository':'https://github.com/alice/engine'})['url']=='https://alice.github.io/engine/'
    assert config.resolve_site({'repository':'https://github.com/alice/alice.github.io'})['url']=='https://alice.github.io/'
    assert config.resolve_site({'repository':'https://github.com/alice/engine','url':'https://docs.example.com'})['url']=='https://docs.example.com/'
    assert config.resolve_site({})['url']==''
    os.environ['GITHUB_REPOSITORY']='alice/engine'
    assert config.resolve_site({})['repository']=='https://github.com/alice/engine'
    os.environ['DOCS_SITE_URL']='https://custom.example.com'
    assert config.resolve_site({})['url']=='https://custom.example.com/'
finally:
    os.environ.clear();os.environ.update(saved_env)
with tempfile.TemporaryDirectory(prefix='docs-template-') as directory:
    project = Path(directory)
    with zipfile.ZipFile(root/'build/docs/downloads/docs-template.zip') as archive:
        archive.extractall(project)
    assert 'Tyrone' not in (project/'docs/theme/about.adoc').read_text()
    assert 'sealion' not in (project/'docs/site.json').read_text().lower()
    subprocess.run(['bash', str(project/'scripts/build-docs.sh')], check=True, env=clean_env)
    output = project/'build/docs'
    command = ['python3', str(root/'scripts/check-docs.py'), str(output)]
    subprocess.run(command, check=True)
    index = output/'index.html'
    original = index.read_text()
    index.write_text(original + '<a href="#missing-fixture">Broken</a>')
    failure = subprocess.run(command, capture_output=True, text=True)
    assert failure.returncode != 0 and 'Missing anchor' in failure.stderr
    index.write_text(original)
    (output/'theme/nav.js').unlink()
    failure = subprocess.run(command, capture_output=True, text=True)
    assert failure.returncode != 0 and 'Missing or out-of-root resource' in failure.stderr
print('Starter build passed; broken anchor and missing asset fixtures correctly rejected.')
