#!/usr/bin/env python3
"""Turn a project's markdown log into one AsciiDoc chapter with a section per note."""
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT/'docs/sections/generated/engineering-log.adoc'
IMAGES = ROOT/'docs/images/logs'

def slug(text):
    value = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return value or 'entry'

def title_for(path, text):
    date = ''
    match = re.match(r'(\d{4}-\d{2}-\d{2})', path.name)
    if match:
        date = match.group(1)
    heading = ''
    for line in text.splitlines():
        if line.startswith('# '):
            heading = line[2:].strip()
            break
    if not heading:
        stem = re.sub(r'^\d{4}-\d{2}-\d{2}[ _-]*', '', path.stem).replace('_', ' ').strip(' -')
        heading = stem or path.stem
    if date and not heading.startswith(date):
        return f'{date} — {heading}'
    return heading

def sort_key(path):
    match = re.match(r'(\d{4}-\d{2}-\d{2})', path.name)
    return (match.group(1) if match else '0000-00-00', path.name.lower())

def copy_image(url, base, stamp):
    if not url or url.startswith(('http://', 'https://', 'data:', '#')):
        return url
    clean = url.split('?', 1)[0].split('#', 1)[0]
    source = (base/clean).resolve()
    try:
        source.relative_to(ROOT)
    except ValueError:
        return url
    if not source.is_file():
        return None
    IMAGES.mkdir(parents=True, exist_ok=True)
    target = IMAGES/f'{stamp}-{slug(source.stem)}{source.suffix.lower()}'
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        shutil.copyfile(source, target)
    return f'images/logs/{target.name}'

def local_url(url, base, notes, site):
    raw = url.strip()
    if raw.startswith('<') and raw.endswith('>'):
        raw = raw[1:-1].strip()
    if raw.startswith(('http://', 'https://', 'mailto:', '#')):
        return raw
    path_part = unquote(raw.split('#', 1)[0].split('?', 1)[0])
    name = Path(path_part).name
    if name in notes:
        return '#' + notes[name]
    if raw in ('.', './', ''):
        return '#engineering-log'
    repository = (site.get('repository') or '').rstrip('/')
    if not repository:
        return raw
    try:
        relative = (base / path_part).resolve().relative_to(ROOT)
    except (ValueError, OSError):
        return raw
    branch = site.get('branch') or 'main'
    return repository + '/blob/' + branch + '/' + relative.as_posix()

def inline(text, base, stamp, notes, site):
    def autolink(match):
        url = match.group(1)
        href = local_url(url, base, notes, site)
        return f'<a href="{html.escape(href, quote=True)}">{html.escape(url)}</a>'
    text = re.sub(r'<(\.{1,2}/[^>\s]+)>', autolink, text)
    def image(match):
        alt, url = match.group(1), match.group(2)
        src = copy_image(url, base, stamp)
        if not src:
            return f'<p><em>Figure not in the repository ({html.escape(url)}).</em></p>'
        return f'<img src="{html.escape(src, quote=True)}" alt="{html.escape(alt or "Figure", quote=True)}">'
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', image, text)
    def link(match):
        label, url = match.group(1), match.group(2)
        href = local_url(url, base, notes, site)
        safe = label if '<' in label else html.escape(label)
        return f'<a href="{html.escape(href, quote=True)}">{safe}</a>'
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = re.sub(r'`([^`]+)`', lambda m: f'<code>{html.escape(m.group(1))}</code>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', text)
    return text

def rewrite_html(block, base, stamp, notes, site):
    def img(match):
        tag = match.group(0)
        src = re.search(r'\bsrc="([^"]+)"', tag) or re.search(r"\bsrc='([^']+)'", tag)
        if not src:
            return tag
        updated = copy_image(src.group(1), base, stamp)
        if not updated:
            return f'<p><em>Figure not in the repository ({html.escape(src.group(1))}).</em></p>'
        tag = tag[:src.start(1)] + updated + tag[src.end(1):]
        if not re.search(r'\balt="[^"]+"', tag) and not re.search(r"\balt='[^']+'", tag):
            tag = tag.replace('<img', '<img alt="Figure"', 1)
        return tag
    block = re.sub(r'<img\b[^>]*>', img, block, flags=re.I)
    def href(match):
        return 'href="' + html.escape(local_url(match.group(1), base, notes, site), quote=True) + '"'
    block = re.sub(r'href="([^"]+)"', href, block)
    def media(match):
        url = match.group(1)
        if url.startswith(('http://', 'https://', 'images/', '#')):
            return match.group(0)
        copied = copy_image(url, base, stamp)
        if copied:
            return 'src="' + copied + '"'
        return 'src="' + html.escape(local_url(url, base, notes, site), quote=True) + '"'
    block = re.sub(r'\bsrc="([^"]+)"', media, block)
    def link(match):
        label, url = match.group(1), match.group(2)
        copied = None if url.startswith(('http://', 'https://', '#')) else copy_image(url, base, stamp)
        href = copied or local_url(url, base, notes, site)
        safe = label if '<' in label else html.escape(label)
        return f'<a href="{html.escape(href, quote=True)}">{safe}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, block)

def md_to_html(text, base, stamp, notes, site):
    lines = text.replace('\r\n', '\n').split('\n')
    if lines and lines[0].startswith('# '):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
    parts = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('```'):
            buf = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                buf.append(lines[i])
                i += 1
            i += 1
            parts.append('<pre><code>' + html.escape('\n'.join(buf)) + '</code></pre>')
            continue
        if re.match(r'^\s*<', line):
            buf = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not lines[i].startswith('#') and not lines[i].startswith('```'):
                buf.append(lines[i])
                i += 1
            parts.append(rewrite_html('\n'.join(buf), base, stamp, notes, site))
            continue
        if re.match(r'^#{2,6} ', line):
            level = min(6, line.count('#', 0, 6) + 2)
            parts.append(f'<h{level}>{inline(line.lstrip("#").strip(), base, stamp, notes, site)}</h{level}>')
            i += 1
            continue
        if line.startswith('> '):
            buf = []
            while i < len(lines) and lines[i].startswith('> '):
                buf.append(lines[i][2:])
                i += 1
            parts.append('<blockquote><p>' + inline(' '.join(buf), base, stamp, notes, site) + '</p></blockquote>')
            continue
        if re.match(r'^[-*] ', line):
            items = []
            while i < len(lines) and re.match(r'^[-*] ', lines[i]):
                items.append('<li>' + inline(lines[i][2:].strip(), base, stamp, notes, site) + '</li>')
                i += 1
            parts.append('<ul>' + ''.join(items) + '</ul>')
            continue
        if re.match(r'^\d+\. ', line):
            items = []
            while i < len(lines) and re.match(r'^\d+\. ', lines[i]):
                items.append('<li>' + inline(re.sub(r'^\d+\. ', '', lines[i]).strip(), base, stamp, notes, site) + '</li>')
                i += 1
            parts.append('<ol>' + ''.join(items) + '</ol>')
            continue
        if '|' in line and i + 1 < len(lines) and re.match(r'^\s*\|?[\s:-]+\|', lines[i + 1]):
            rows = []
            while i < len(lines) and '|' in lines[i]:
                cells = [cell.strip() for cell in lines[i].strip().strip('|').split('|')]
                rows.append(cells)
                i += 1
            if len(rows) >= 2:
                head = ''.join(f'<th>{inline(cell, base, stamp, notes, site)}</th>' for cell in rows[0])
                body = ''
                for row in rows[2:]:
                    body += '<tr>' + ''.join(f'<td>{inline(cell, base, stamp, notes, site)}</td>' for cell in row) + '</tr>'
                parts.append(f'<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>')
            continue
        if not line.strip():
            i += 1
            continue
        buf = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#', '```', '>', '-', '*', '<')) and not re.match(r'^\d+\. ', lines[i]):
            buf.append(lines[i].strip())
            i += 1
        parts.append('<p>' + inline(' '.join(buf), base, stamp, notes, site) + '</p>')
    return '\n'.join(parts)

def main():
    site = json.loads((ROOT/'docs/site.json').read_text())
    logs = (site.get('logs') or '').strip()
    if not logs:
        if GENERATED.exists():
            GENERATED.unlink()
        return
    source = (ROOT/logs).resolve()
    try:
        source.relative_to(ROOT)
    except ValueError as exc:
        raise SystemExit('docs/site.json logs must stay inside the repository') from exc
    if not source.is_dir():
        raise SystemExit(f'Missing logs directory: {logs}')
    notes = [path for path in source.iterdir() if path.suffix.lower() == '.md' and path.name.lower() != 'readme.md']
    notes.sort(key=sort_key)
    by_name = {path.name: 'log-' + slug(path.stem) for path in notes}
    if not notes:
        if GENERATED.exists():
            GENERATED.unlink()
        return
    chunks = [
        '[#engineering-log]',
        '== Engineering log',
        '',
        'Each note below is the original project log, in chronological order.',
        'Open the arrow in the sidebar to jump to an entry.',
        '',
    ]
    seen = set()
    for path in notes:
        text = path.read_text(encoding='utf-8', errors='replace')
        title = title_for(path, text)
        anchor = 'log-' + slug(path.stem)
        if anchor in seen:
            anchor += '-' + slug(path.name)
        seen.add(anchor)
        body = md_to_html(text, path.parent, anchor, by_name, site).replace('++++', '+ + + +')
        safe_title = title.replace(']', '\\]')
        chunks += [
            f'[#{anchor}]',
            f'=== {safe_title}',
            '',
            '++++',
            '<div class="log-entry">',
            body,
            '</div>',
            '++++',
            '',
        ]
    GENERATED.parent.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text('\n'.join(chunks) + '\n', encoding='utf-8')
    print(f'Ingested {len(notes)} log notes into {GENERATED.relative_to(ROOT)}')

if __name__ == '__main__':
    main()
