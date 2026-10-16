#!/usr/bin/env python3
"""Render measured bar charts to themed SVG. Values come only from docs/charts/*.json."""
import html
import io
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'docs/images'

def escape(value):
    return html.escape(str(value), quote=True)

def render(spec, accent):
    os.environ.setdefault('MPLCONFIGDIR', str(ROOT/'build/matplotlib'))
    import matplotlib
    matplotlib.use('svg')
    import matplotlib.pyplot as plt
    import numpy as np

    categories = spec['categories']
    series = spec['series']
    fig, ax = plt.subplots(figsize=(8.4, 4.4), dpi=144)
    fig.patch.set_facecolor('#ffffff')
    ax.set_facecolor('#ffffff')
    x = np.arange(len(categories))
    count = max(1, len(series))
    width = min(0.72, 0.82 / count)
    palette = [accent, '#737373', '#a3a3a3', '#525252']
    for index, item in enumerate(series):
        offset = (index - (count - 1) / 2) * width
        ax.bar(x + offset, item['values'], width * 0.9, label=item['name'], color=palette[index % len(palette)], zorder=3)
    ax.set_xticks(x, categories)
    if spec.get('ylabel'):
        ax.set_ylabel(spec['ylabel'])
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#dedede')
    ax.spines['bottom'].set_color('#dedede')
    ax.tick_params(colors='#171717', labelsize=10)
    ax.yaxis.label.set_color('#171717')
    ax.yaxis.grid(True, color='#e5e5e5', zorder=0)
    ax.set_axisbelow(True)
    if len(series) > 1:
        legend = ax.legend(frameon=False, fontsize=10)
        for text in legend.get_texts():
            text.set_color('#171717')
    fig.tight_layout()
    buffer = io.StringIO()
    fig.savefig(buffer, format='svg')
    plt.close(fig)
    svg = buffer.getvalue()
    svg = re.sub(re.escape(accent), 'var(--accent,#171717)', svg, flags=re.I)
    svg = svg.replace('#737373', 'var(--muted,#737373)')
    svg = svg.replace('#171717', 'var(--diagram-ink,#171717)')
    svg = svg.replace('#dedede', 'var(--diagram-line,#dedede)')
    svg = svg.replace('#e5e5e5', 'var(--diagram-line,#dedede)')
    svg = svg.replace('#ffffff', 'var(--diagram-paper,#fff)')
    title = escape(spec['title'])
    desc = escape(spec.get('subtitle') or spec['title'])
    svg = re.sub(
        r'<svg\b',
        '<svg role="img" aria-labelledby="title desc"',
        svg,
        count=1,
    )
    svg = re.sub(
        r'(<svg\b[^>]*>)',
        rf'\1<title id="title">{title}</title><desc id="desc">{desc}</desc>',
        svg,
        count=1,
    )
    if '<script' in svg:
        raise SystemExit('chart SVG contained a script')
    return svg

def main():
    folder = ROOT/'docs/charts'
    if not folder.is_dir():
        return
    try:
        import matplotlib  # noqa: F401
    except ImportError:
        missing = []
        for source in sorted(folder.glob('*.json')):
            spec = json.loads(source.read_text())
            target = ROOT / spec.get('dir', 'docs/images') / f'{source.stem}.svg'
            if not target.is_file():
                missing.append(str(target.relative_to(ROOT)))
        if missing:
            raise SystemExit(
                'matplotlib is required to draw missing charts: ' + ', '.join(missing)
            )
        print('matplotlib is not installed; using the committed chart SVGs')
        return
    site = json.loads((ROOT/'docs/site.json').read_text())
    accent = (site.get('accent') or '#171717').strip() or '#171717'
    for source in sorted(folder.glob('*.json')):
        spec = json.loads(source.read_text())
        svg = render(spec, accent)
        target_dir = ROOT/spec.get('dir', 'docs/images')
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir/f'{source.stem}.svg'
        target.write_text(svg)
        print(f'Rendered {target.relative_to(ROOT)}')

if __name__ == '__main__':
    main()
