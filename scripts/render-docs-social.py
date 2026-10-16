#!/usr/bin/env python3
"""Regenerate the committed 1200x630 social card. Optional authoring dependency: Pillow."""
import json
import importlib.util
from pathlib import Path
import textwrap
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit('Use a shared Python environment with Pillow to regenerate this image. Normal builds do not require Pillow.')
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('docs_config',ROOT/'scripts/docs-config.py')
config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
site=config.resolve_site(json.loads((ROOT/'docs/site.json').read_text()))
if not site.get('image'):
    raise SystemExit('Set image in docs/site.json, for example images/social-card.png')
def font(size,bold=False):
    names = ['/System/Library/Fonts/Helvetica.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name,size,index=1 if bold and name.endswith('.ttc') else 0)
    return ImageFont.load_default(size=size)
image=Image.new('RGB',(1200,630),'#151515')
draw=ImageDraw.Draw(image)
draw.line((64,108,1136,108),fill='#404040',width=2)
draw.text((64,52),site['name'],font=font(25,True),fill='#ededed')
draw.text((1136,52),'Documentation',font=font(21),anchor='ra',fill='#a3a3a3')
y=168
for line in textwrap.wrap(site['title'],width=29)[:2]:
    draw.text((64,y),line,font=font(58,True),fill='#fafafa');y+=72
for line in textwrap.wrap(site['description'],width=74)[:3]:
    draw.text((66,y+22),line,font=font(25),fill='#bdbdbd');y+=38
draw.text((64,550),site.get('url','').removeprefix('https://').rstrip('/'),font=font(21),fill='#999999')
target=ROOT/'docs'/site['image'];target.parent.mkdir(parents=True,exist_ok=True)
image.save(target,optimize=True)
print(target)
