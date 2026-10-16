#!/usr/bin/env python3
"""Render documentation diagrams from JSON using only the Python standard library."""
import argparse
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def escape(value):
    return html.escape(str(value), quote=True)

def banner(spec):
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360" role="img" aria-labelledby="title desc">',
             f'<title id="title">{escape(spec["title"])}</title><desc id="desc">{escape(spec["subtitle"])}</desc>',
             '<rect x="1" y="1" width="1198" height="358" rx="10" fill="var(--diagram-paper,#fff)" stroke="var(--diagram-line,#dedede)"/>',
             '<g font-family="Arial,Helvetica,sans-serif">',
             f'<text x="36" y="43" fill="var(--diagram-muted,#595959)" font-size="15">{escape(spec["title"])}</text>']
    for i, row in enumerate(spec['rows']):
        x=36+i*392
        parts += [f'<rect x="{x}" y="78" width="344" height="234" rx="7" fill="var(--diagram-row,#fafafa)" stroke="var(--diagram-line,#dedede)"/>',
                  f'<text x="{x+22}" y="112" font-size="12" fill="var(--diagram-number,#757575)">0{i+1}</text>',
                  f'<text x="{x+22}" y="150" font-size="22" font-weight="600" fill="var(--diagram-ink,#202020)">{escape(row[0])}</text>',
                  f'<text x="{x+22}" y="178" font-size="14" fill="var(--diagram-muted,#595959)">{escape(row[1])}</text>']
        for j, label in enumerate(row[2:]):
            y=206+j*29
            parts += [f'<rect x="{x+22}" y="{y}" width="300" height="22" rx="3" fill="var(--diagram-edge,#f4f4f4)"/>',f'<text x="{x+32}" y="{y+15}" font-size="12" font-family="monospace" fill="var(--diagram-muted,#595959)">{escape(label)}</text>']
        if i<2:
            parts.append(f'<path d="M{x+350} 196h34m-6-5 6 5-6 5" fill="none" stroke="var(--diagram-number,#757575)"/>')
    parts += ['</g></svg>']
    return '\n'.join(parts)+'\n'

def render(spec):
    if spec.get('layout') == 'banner':
        return banner(spec)
    rows = spec['rows']
    height = 108 + len(rows) * 88
    title = escape(spec['title'])
    desc = escape('; '.join(f"{r[0]}: {r[1]}" for r in rows))
    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="{height}" viewBox="0 0 800 {height}" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">{desc}</desc>
<style>text{{font-family:Arial,Helvetica,sans-serif;fill:var(--diagram-ink,#202020)}}.detail{{font-size:14px;fill:var(--diagram-muted,#595959)}}.label{{font-size:16px;font-weight:600}}.num{{font-family:monospace;font-size:12px;fill:var(--diagram-number,#757575)}}</style>
<rect x=".5" y=".5" width="799" height="{height-1}" rx="10" fill="var(--diagram-paper,#fff)" stroke="var(--diagram-line,#dedede)"/>
<text x="28" y="35" class="label">{title}</text>
<text x="28" y="58" class="detail">{escape(spec['subtitle'])}</text>''']
    for i, row in enumerate(rows):
        y = 78 + i * 88
        parts.append(f'<rect x="28" y="{y}" width="744" height="72" rx="6" fill="{"var(--diagram-edge,#f4f4f4)" if i in (0,len(rows)-1) else "var(--diagram-row,#fafafa)"}" stroke="var(--diagram-line,#dedede)"/>')
        parts.append(f'<text x="44" y="{y+29}" class="num">{i+1:02}</text>')
        parts.append(f'<text x="80" y="{y+29}" class="label">{escape(row[0])}</text>')
        parts.append(f'<text x="80" y="{y+51}" class="detail">{escape(row[1])}</text>')
        if len(row)>2:
            parts.append(f'<text x="750" y="{y+29}" text-anchor="end" class="num">{escape(row[2])}</text>')
        if i < len(rows)-1:
            parts.append(f'<path d="M 57 {y+72} v 13 m -3 -4 l 3 4 l 3 -4" fill="none" stroke="var(--diagram-number,#999)"/>')
    parts.append('</svg>')
    return '\n'.join(parts)+'\n'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if committed SVGs differ from their definitions')
    args = parser.parse_args()
    stale = []
    for source in sorted((ROOT/'docs/diagrams').glob('*.json')):
        target = ROOT/'docs/images'/f'{source.stem}.svg'
        target.parent.mkdir(parents=True, exist_ok=True)
        expected = render(json.loads(source.read_text()))
        if args.check:
            if not target.exists() or target.read_text() != expected:
                stale.append(str(target.relative_to(ROOT)))
        else:
            target.write_text(expected)
            print(f'Rendered {target.relative_to(ROOT)}')
    if stale:
        raise SystemExit('Outdated diagrams; run make docs-diagrams: ' + ', '.join(stale))
