#!/usr/bin/env python3
"""Validate a generated docs site: references, assets, semantics, and size budgets."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys
import struct
import xml.etree.ElementTree as ET

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.references, self.images, self.chapters = [], [], [], 0
        self.metadata, self.canonical, self.figures = {}, [], []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.metadata[attrs.get('property', attrs.get('name',''))] = attrs.get('content','')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href',''))
        if tag == 'svg':
            self.figures.append(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'h2':
            self.chapters += 1
        if tag == 'img':
            self.images.append(attrs)
        for attr in ('href', 'src'):
            if attrs.get(attr):
                self.references.append(attrs[attr])

root = Path(sys.argv[1] if len(sys.argv)>1 else 'build/docs').resolve()
text = (root/'index.html').read_text()
page = Page(text)
errors = []
not_found = root/'404.html'
if not not_found.is_file():
    errors.append('Missing custom 404 page')
else:
    missing_text = not_found.read_text()
    if '<meta name="robots" content="noindex">' not in missing_text or 'id="home"' not in missing_text:
        errors.append('404 page needs noindex and a home link')
ids = set(page.ids)
for key, count in Counter(page.ids).items():
    if count > 1:
        errors.append(f'Duplicate anchor: {key}')
for ref in page.references:
    url = urlsplit(ref)
    if url.scheme or url.netloc:
        continue  # External links are not probed during offline builds.
    if not url.path:
        if url.fragment and unquote(url.fragment) not in ids:
            errors.append(f'Missing anchor: {ref}')
        continue
    asset = (root/unquote(url.path)).resolve()
    if not asset.is_relative_to(root) or not asset.is_file():
        errors.append(f'Missing or out-of-root resource: {ref}')
for img in page.images:
    if not img.get('alt','').strip():
        errors.append(f'Image missing alternative text: {img.get("src")}')
for figure in page.figures:
    labels = figure.get('aria-labelledby','').split()
    if figure.get('role') != 'img' or len(labels) != 2 or any(label not in ids for label in labels):
        errors.append('Inline figure missing valid accessible title/description')
for key in ('og:type','og:title','og:description','twitter:card'):
    if not page.metadata.get(key):
        errors.append(f'Missing social metadata: {key}')
if page.canonical != ([page.metadata['og:url']] if page.metadata.get('og:url') else []):
    errors.append('Canonical URL and Open Graph URL must match')
if page.metadata.get('og:url') and not page.metadata['og:url'].startswith('https://'):
    errors.append('Social URL must be absolute HTTPS')
if page.metadata.get('og:image'):
    base = page.metadata.get('og:url','')
    image = page.metadata['og:image']
    if not image.startswith(base):
        errors.append('Social image must use the configured Pages base URL')
    else:
        card = root/image[len(base):]
        if not card.is_file():
            errors.append('Social image file is missing')
        else:
            data = card.read_bytes()
            if data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',data[16:24]) != (1200,630):
                errors.append('Social image must be a 1200x630 PNG')
for name in ('overview', 'about'):
    if name not in ids:
        errors.append(f'Missing required page: {name}')
if page.chapters < 2:
    errors.append('Expected multiple documentation chapters')
if 'Unresolved directive' in text:
    errors.append('Unresolved AsciiDoc include')
for svg in (root/'images').glob('*.svg'):
    try:
        tree = ET.parse(svg)
        ns = '{http://www.w3.org/2000/svg}'
        if tree.find(ns+'title') is None or tree.find(ns+'desc') is None:
            errors.append(f'SVG requires title and description: {svg.name}')
        if tree.find('.//'+ns+'script') is not None:
            errors.append(f'SVG must not contain scripts: {svg.name}')
    except ET.ParseError as exc:
        errors.append(f'Invalid SVG {svg.name}: {exc}')
assets = [*(root/'theme').glob('*.css'), *(root/'theme').glob('*.js')]
size = sum(p.stat().st_size for p in assets)
if size > 100_000:
    errors.append(f'Theme exceeds 100 KB budget: {size} bytes')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Validated {page.chapters} chapters, {len(ids)} anchors, {len(page.images)+len(page.figures)} figures; theme {size:,} bytes.')
