#!/usr/bin/env python3
"""Build static metadata, configuration, inline diagrams, and small code highlights."""
import argparse
import importlib.util
import html
import json
import os
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'build/docs'
_spec = importlib.util.spec_from_file_location('docs_config', ROOT/'scripts/docs-config.py')
_config = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_config)
SITE = _config.resolve_site(json.loads((ROOT/'docs/site.json').read_text()))

HEX = re.compile(r'^#[0-9a-fA-F]{6}$')

def accent_css(site):
    """Optional project accent. Empty values keep the monochrome notebook."""
    accent = (site.get('accent') or '').strip()
    dark = (site.get('accentDark') or '').strip() or accent
    if not accent:
        return ''
    if not HEX.fullmatch(accent) or not HEX.fullmatch(dark):
        raise SystemExit('docs/site.json accent and accentDark must be #rrggbb')
    return f'<style>:root{{--accent:{accent}}} :root[data-theme=dark]{{--accent:{dark}}}</style>\n'

def head():
    url = os.environ.get('DOCS_SITE_URL') or SITE.get('url','')
    if url and (urlsplit(url).scheme != 'https' or not urlsplit(url).netloc):
        raise SystemExit('docs/site.json url must be an absolute HTTPS URL')
    url = url.rstrip('/')+'/' if url else ''
    tags = []
    def meta(key, value, attr='property'):
        if value:
            tags.append(f'<meta {attr}="{key}" content="{html.escape(str(value), quote=True)}">')
    meta('og:type','website')
    meta('og:site_name',SITE['name'])
    meta('og:title',SITE['title'])
    meta('og:description',SITE['description'])
    meta('og:url',url)
    meta('twitter:title',SITE['title'],'name')
    meta('twitter:description',SITE['description'],'name')
    if url:
        tags.append(f'<link rel="canonical" href="{html.escape(url, quote=True)}">')
    image = SITE.get('image','')
    if image and url:
        asset = (ROOT/'docs'/image).resolve()
        if not asset.is_relative_to(ROOT/'docs') or not asset.is_file():
            raise SystemExit(f'Missing social preview image: {image}')
        meta('og:image',urljoin(url,image))
        meta('og:image:alt',SITE['title'])
        meta('og:image:width','1200')
        meta('og:image:height','630')
        meta('twitter:image',urljoin(url,image),'name')
    meta('twitter:card','summary_large_image' if image and url else 'summary','name')
    # Set the initial theme before first paint, including on direct chapter links.
    initial = """<script>try{document.documentElement.dataset.theme=localStorage.getItem('notebook-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}</script>"""
    (OUT/'theme').mkdir(parents=True,exist_ok=True)
    (OUT/'theme/docinfo.html').write_text(initial+'\n'+(ROOT/'docs/theme/docinfo.html').read_text()+'\n'+accent_css(SITE)+'\n'.join(tags)+'\n')
    (OUT/'theme/config.js').write_text('window.NOTEBOOK = '+json.dumps(SITE,ensure_ascii=True)+';\n')

TOKEN = re.compile(r'(?P<comment>//[^\n]*|/\*[\s\S]*?\*/|\#[^\n]*)|(?P<string>"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')|(?P<keyword>\b(?:pub|struct|fn|let|mut|impl|use|enum|return|if|else|for|in|while|match|const|true|false|null|None|Some)\b)|(?P<number>\b\d+(?:\.\d+)?\b)')

def code(match):
    opening, language, body = match.groups()
    if language not in ('rust','bash','sh','json','toml','python'):
        return match.group(0)
    raw = html.unescape(body)
    pieces, start = [], 0
    for token in TOKEN.finditer(raw):
        pieces.append(html.escape(raw[start:token.start()]))
        pieces.append(f'<span class="token-{token.lastgroup}">{html.escape(token.group())}</span>')
        start = token.end()
    pieces.append(html.escape(raw[start:]))
    return opening+''.join(pieces)+'</code>'

HERO_CANDIDATES = (
    'images/overview-hero.svg',
    'images/hero.svg',
    'images/overview-hero.png',
    'images/hero.png',
    'images/overview-hero.gif',
    'images/hero.gif',
    'images/demo.gif',
    'images/overview-hero.jpg',
    'images/hero.jpg',
    'images/overview-hero.jpeg',
    'images/hero.jpeg',
    'images/overview-hero.webp',
    'images/hero.webp',
)

def resolve_hero(site):
    """Explicit docs/site.json hero wins; otherwise use first conventional file if it exists."""
    hero = site.get('hero') or {}
    if hero.get('image'):
        return hero['image'], hero.get('alt', ''), hero.get('caption', '')
    for candidate in HERO_CANDIDATES:
        asset = (ROOT/'docs'/candidate).resolve()
        if asset.is_relative_to(ROOT/'docs') and asset.is_file():
            alt = hero.get('alt') or f"{site.get('title') or site.get('name') or 'Project'} overview"
            return candidate, alt, hero.get('caption', '')
    return '', '', ''

def page():
    file = OUT/'index.html'
    text = file.read_text()
    image, alt, caption = resolve_hero(SITE)
    figure = ''
    if image:
        asset = (ROOT/'docs'/image).resolve()
        if not asset.is_relative_to(ROOT/'docs') or not asset.is_file() or not alt.strip():
            raise SystemExit('hero.image must be a local docs asset with non-empty hero.alt')
        size = ' width="1200" height="360"' if image.endswith('.svg') else ' width="1200"'
        cls = 'docs-hero' if image.endswith('.svg') else 'docs-hero docs-hero-media'
        figure = '<figure class="'+cls+'"><a href="'+html.escape(image,quote=True)+'" title="Click to expand"><img src="'+html.escape(image,quote=True)+'" alt="'+html.escape(alt,quote=True)+'"'+size+' decoding="async"></a>'
        if caption:
            figure += '<figcaption>'+html.escape(caption)+'</figcaption>'
        figure += '</figure>'
    text = text.replace('<!-- docs-hero -->',figure)
    text = re.sub(r'<title>.*?</title>',lambda _: '<title>'+html.escape(SITE['title'])+'</title>',text,count=1)
    description = '<meta name="description" content="'+html.escape(SITE['description'],quote=True)+'">'
    text = re.sub(r'<meta name="description"[^>]*>','',text)
    text = text.replace('</head>',description+'\n</head>',1)
    # Only inline our generated diagrams; ordinary user images remain untouched.
    count = 0
    def diagram(match):
        nonlocal count
        name = match.group(1)
        if not (ROOT/'docs/diagrams'/f'{name}.json').is_file():
            return match.group(0)
        svg = (OUT/'images'/f'{name}.svg').read_text()
        count += 1
        prefix = f'diagram-{name}-{count}'
        svg = svg.replace('<svg ', '<svg class="docs-diagram" ',1)
        svg = svg.replace('id="title"',f'id="{prefix}-title"').replace('id="desc"',f'id="{prefix}-desc"')
        svg = svg.replace('aria-labelledby="title desc"',f'aria-labelledby="{prefix}-title {prefix}-desc"')
        return svg
    text = re.sub(r'<img\s+src="images/([\w-]+)\.svg"[^>]*>',diagram,text)
    image_count = 0
    def defer_image(match):
        nonlocal image_count
        image_count += 1
        tag = match.group(0)
        if 'decoding=' not in tag:
            tag = tag.replace('<img', '<img decoding="async"', 1)
        if image_count > 1 and 'loading=' not in tag:
            tag = tag.replace('<img', '<img loading="lazy"', 1)
        return tag
    text = re.sub(r'<img\b[^>]*>',defer_image,text)
    text = re.sub(r'(<code\b[^>]*data-lang="([\w-]+)"[^>]*>)(.*?)</code>',code,text,flags=re.S)
    file.write_text(text)
    (OUT/'.nojekyll').touch()

def not_found():
    source = (ROOT/'docs/404.html').read_text()
    url = os.environ.get('DOCS_SITE_URL') or SITE.get('url','')
    site_root = urlsplit(url).path or '/'
    if not site_root.endswith('/'):
        site_root += '/'
    name = SITE.get('name') or 'Project'
    source = source.replace('__SITE_NAME__', html.escape(name))
    source = source.replace('__SITE_ROOT__', html.escape(site_root, quote=True))
    (OUT/'404.html').write_text(source)

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage',choices=['head','page','not-found'])
    args=parser.parse_args()
    {'head':head,'page':page,'not-found':not_found}[args.stage]()
