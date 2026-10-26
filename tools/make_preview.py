#!/usr/bin/env python3
"""Draws the preview picture of the watchface (assets/default.w390-s/icon.png): the watch's watchface list and
the Zepp App Store show it. Zepp asks for 10:09 and sample data, in 266x307 for the 390x450 screen.
Also writes store/preview.png in full screen size for the store form.

The watchface itself decides what is drawn where: tools/preview_widgets.mjs builds it on the simulated Bip 6
of the tests and lists the widgets, this script paints them with the watchface's own pictures and fonts.
Weather and temperatures are drawn by the watch itself, so they get sample values here.
Run after tools/make_assets.py (which calls it at the end): python3 tools/make_preview.py
"""
import json
import math
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets', 'default.w390-s')
STORE = os.path.join(ROOT, 'store')
W, H = 390, 450
PREVIEW = (266, 307)  # "Watchface preview image resolution" of the Bip 6 and Active 2 (Square)
S = 4  # rings are drawn 4x larger and scaled down for smooth edges

# sample weather for the data types of IMG_LEVEL / TEXT_IMG (11 current, 12 high, 13 low)
TEMPS = {11: 22, 12: 25, 13: 16}


def widgets():
    out = subprocess.run(
        ['node', '--import', './test/mock/setup.mjs', 'tools/preview_widgets.mjs'],
        cwd=ROOT, check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def asset(path):
    return Image.open(os.path.join(ASSETS, path)).convert('RGBA')


def rgb(c):
    return (c >> 16) & 255, (c >> 8) & 255, c & 255


def text(img, w):
    """TEXT: letter by letter, with char_space between them, centered vertically in the box."""
    f = ImageFont.truetype(os.path.join(ASSETS, w['font']), w['text_size'])
    s, space = w['text'], w.get('char_space', 0)
    width = sum(f.getlength(c) for c in s) + space * max(0, len(s) - 1)
    x = w['x'] + {0: 0, 1: (w['w'] - width) / 2, 2: w['w'] - width}[w.get('align_h', 0)]
    ascent, descent = f.getmetrics()
    y = w['y'] + (w['h'] - ascent - descent) / 2 + ascent
    d = ImageDraw.Draw(img)
    for c in s:
        d.text((x, y), c, font=f, fill=rgb(w['color']), anchor='ls')
        x += f.getlength(c) + space


def text_img(img, w):
    """TEXT_IMG: a number from digit pictures, left-aligned, with the unit behind it."""
    value = TEMPS[w['type']]
    pics = [w['negative_image']] if value < 0 else []
    pics += [w['font_array'][int(c)] for c in str(abs(value))] + [w['unit_en']]
    x = w['x']
    for p in pics:
        im = asset(p)
        img.alpha_composite(im, (x, w['y']))
        x += im.width + w.get('h_space', 0)


def arc(img, w):
    """ARC with round ends; 0 degrees is 3 o'clock, clockwise, like PIL."""
    big = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    lw = w['line_width'] * S
    box = [w['x'] * S, w['y'] * S, (w['x'] + w['w']) * S - 1, (w['y'] + w['h']) * S - 1]
    col = (*rgb(w['color']), 255)
    a0, a1 = w['start_angle'], w['end_angle']
    d.arc(box, a0, a1, fill=col, width=lw)
    if a1 - a0 < 360:
        r = (box[2] - box[0]) / 2 - lw / 2
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        for a in (a0, a1):
            px = cx + r * math.cos(math.radians(a))
            py = cy + r * math.sin(math.radians(a))
            d.ellipse([px - lw / 2, py - lw / 2, px + lw / 2, py + lw / 2], fill=col)
    img.alpha_composite(big.resize((W, H), Image.LANCZOS))


def main():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    for w in widgets():
        t = w['widget']
        if t == 'IMG' and not w['src'].startswith('icon/hit'):
            img.alpha_composite(asset(w['src']), (w['x'], w['y']))
        elif t == 'IMG_LEVEL':
            img.alpha_composite(asset(w['image_array'][0]), (w['x'], w['y']))  # partly cloudy
        elif t == 'TEXT':
            text(img, w)
        elif t == 'TEXT_IMG':
            text_img(img, w)
        elif t == 'ARC':
            arc(img, w)
    img.resize(PREVIEW, Image.LANCZOS).save(os.path.join(ASSETS, 'icon.png'), optimize=True)
    # full size for the "Watch Face Preview" of the store form (390x450, up to 1 MB); store/ stays local
    os.makedirs(STORE, exist_ok=True)
    img.convert('RGB').save(os.path.join(STORE, 'preview.png'), optimize=True)
    print('done:', os.path.join(ASSETS, 'icon.png'), os.path.join(STORE, 'preview.png'))


if __name__ == '__main__':
    main()
