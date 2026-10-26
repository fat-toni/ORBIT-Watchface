#!/usr/bin/env python3
"""Draws the pictures for the GitHub README: the banner (also the repo's social preview), the
watchface in a Bip 6 style watch frame and a row with all six accent colors.

The screens are simulator screenshots in docs/images/screenshots (390x450, taken with the mouse
hidden). The simulator often has no weather data, so the weather row is drawn on top from the
watchface's own pictures in assets/default.w390-s (run tools/make_assets.py first).
Usage: python3 tools/readme_art.py   (writes docs/images/banner.png and docs/images/watch/*.png)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, 'docs', 'images')
SHOTS = os.path.join(IMAGES, 'screenshots')
ASSETS = os.path.join(ROOT, 'assets', 'default.w390-s')
FONT = os.path.join(ROOT, 'tools', 'fonts', 'Sora.ttf')

# keep in sync with COLORS in tools/make_assets.py
COLORS = ['mint', 'ice', 'amber', 'rose', 'lavender', 'silver']
MINT = (112, 192, 152)
BG, WHITE, MUTED = (12, 14, 15), (240, 243, 245), (139, 147, 155)

# the weather row of watchface/index.js (WX_X, WX_Y and what follows) with a sample forecast
WX_X, WX_Y, WX_KIND, TEMP, HIGH, LOW = 98, 240, 'partly', '18', '21', '12'


def font(size, style='SemiBold'):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(style)
    return f


def asset(path):
    return Image.open(os.path.join(ASSETS, path)).convert('RGBA')


def weather(shot, color):
    """Draws icon, temperature and high/low over the "--" of a screenshot without weather data."""
    shot = shot.convert('RGBA')
    ImageDraw.Draw(shot).rectangle([WX_X - 10, WX_Y - 4, 330, WX_Y + 50], fill=(0, 0, 0, 255))
    shot.alpha_composite(asset(f'wx/{WX_KIND}.png'), (WX_X, WX_Y))
    acc = os.path.join(ASSETS, f'c/{color}/wx/{WX_KIND}.png')
    if os.path.exists(acc):
        shot.alpha_composite(asset(f'c/{color}/wx/{WX_KIND}.png'), (WX_X, WX_Y))

    def row(set_, chars, x, y):
        for c in chars:
            g = asset(f'num/{set_}_{c}.png')
            shot.alpha_composite(g, (x, y))
            x += g.width + 1

    temp = asset('num/temp_0.png')
    tx = WX_X + 52 + 10
    row('temp', [*TEMP, 'deg'], tx, WX_Y + (44 - temp.height) // 2)
    hx, hh = tx + 80 + 4, asset('num/hilo_0.png').height
    for i, (y, val) in enumerate([(WX_Y + 2, HIGH), (WX_Y + 44 - hh - 2, LOW)]):
        shot.alpha_composite(asset('icon/down.png' if i else 'icon/up.png'), (hx, y + (hh - 8) // 2))
        row('hilo', [*val, 'deg'], hx + 15, y)
    return shot


def watch(shot, k=1.0):
    """A screenshot (390x450) in a Bip 6 style case: graphite body, black bezel, side button, rounded
    screen corners. k scales the whole watch; transparent background. Same frame as Padel Punto."""
    S = 4
    sw, sh = shot.size
    bez, body = 22, 26
    W, H = (sw + 2 * (bez + body)) * S, (sh + 2 * (bez + body)) * S
    img = Image.new('RGBA', (W + 16 * S, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # side button (right), drawn first so the body covers its inner end
    d.rounded_rectangle([W - 20 * S, H * 0.30, W + 12 * S, H * 0.30 + 70 * S], radius=8 * S, fill=(58, 62, 68))
    # body with a lighter rim
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=118 * S, fill=(74, 79, 86))
    d.rounded_rectangle([3 * S, 3 * S, W - 3 * S, H - 3 * S], radius=115 * S, fill=(44, 47, 52))
    # black glass with the screen inside
    g = body * S
    d.rounded_rectangle([g, g, W - g, H - g], radius=92 * S, fill=(0, 0, 0))
    shot = shot.convert('RGBA')
    ImageDraw.Draw(shot).rectangle([0, 0, sw - 1, sh - 1], outline=(0, 0, 0), width=2)  # simulator's frame lines
    screen = shot.resize((sw * S, sh * S), Image.LANCZOS)
    mask = Image.new('L', screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw * S - 1, sh * S - 1], radius=58 * S, fill=255)
    img.paste(screen, ((body + bez) * S, (body + bez) * S), mask)
    # faint glass reflection on the upper left, only on the glass
    shine = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shine).polygon([(g, g), (W * 0.55, g), (g, H * 0.42)], fill=(255, 255, 255, 10))
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([g, g, W - g, H - g], radius=92 * S, fill=255)
    img.alpha_composite(Image.composite(shine, Image.new('RGBA', img.size, (0, 0, 0, 0)), m))
    return img.resize((round(img.width * k / S), round(img.height * k / S)), Image.LANCZOS)


def shadow(im, blur=28, alpha=150):
    a = im.getchannel('A').point(lambda v: alpha if v else 0)
    pad = blur * 3
    sh = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 255), (pad, pad), a)
    sh.putalpha(sh.getchannel('A').filter(ImageFilter.GaussianBlur(blur)))
    return sh, pad


def place(canvas, im, x, y, angle=0):
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh, pad = shadow(im)
    canvas.alpha_composite(sh, (x - pad + 10, y - pad + 24))
    canvas.alpha_composite(im, (x, y))


def orbits(W, H, cx, cy):
    """Faint mint orbit lines behind the watches, like the rings of the watchface."""
    S = 2
    layer = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, r in enumerate((250, 360, 470)):
        box = [(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S]
        d.ellipse(box, outline=(*MINT, 34 - 8 * i), width=3 * S)
        d.arc(box, start=-90 + 40 * i, end=-10 + 40 * i, fill=(*MINT, 110 - 25 * i), width=5 * S)
    return layer.resize((W, H), Image.LANCZOS)


def pill(d, x, y, text, f):
    w = d.textlength(text, font=f)
    d.rounded_rectangle([x, y, x + w + 30, y + 40], radius=20, fill=(30, 34, 36), outline=(52, 58, 60), width=2)
    d.text((x + 15, y + 20), text, font=f, fill=(214, 218, 220), anchor='lm')
    return x + w + 30 + 12


def banner(shots):
    W, H = 1280, 640
    img = Image.new('RGBA', (W, H), (*BG, 255))
    # soft light from the right, where the watches are
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([700, -150, 1500, 750], fill=70)
    img.paste((20, 44, 40), (0, 0), glow.filter(ImageFilter.GaussianBlur(160)))
    img.alpha_composite(orbits(W, H, 1010, 330))

    place(img, watch(shots['rose'], 0.56), 600, 215, angle=12)
    place(img, watch(shots['ice'], 0.6), 650, 40, angle=-7)
    place(img, watch(shots['mint'], 0.8), 860, 75)

    d = ImageDraw.Draw(img)
    d.text((80, 105), 'ORBIT', font=font(124, 'SemiBold'), fill=WHITE)
    d.text((84, 270), 'A calm watchface.', font=font(40, 'SemiBold'), fill=MINT)
    d.text((84, 320), 'Your colors, your rings.', font=font(40, 'SemiBold'), fill=MINT)
    d.text((84, 400), 'Digital watchface for Amazfit', font=font(25, 'Light'), fill=MUTED)
    f = font(19, 'Regular')
    x = pill(d, 84, 455, '6 accent colors', f)
    x = pill(d, x, 455, '9 ring contents', f)
    pill(d, x, 455, 'Weather', f)
    x = pill(d, 84, 505, '19 languages', f)
    pill(d, x, 505, 'Free & open source', f)
    d.text((84, 590), 'Amazfit Bip 6 · Active 2 (Square) · Zepp OS 4+', font=font(18, 'Regular'), fill=(92, 98, 104))
    img.convert('RGB').save(os.path.join(IMAGES, 'banner.png'), optimize=True)


def color_row(shots):
    """All six accent colors side by side."""
    watches = [watch(shots[c], 0.5) for c in COLORS]
    gap = 18
    w = sum(i.width for i in watches) + gap * (len(watches) - 1)
    img = Image.new('RGBA', (w + 40, watches[0].height + 60), (0, 0, 0, 0))
    x = 20
    for im in watches:
        img.alpha_composite(im, (x, 20))
        x += im.width + gap
    img.save(os.path.join(IMAGES, 'watch', 'colors.png'), optimize=True)


def main():
    os.makedirs(os.path.join(IMAGES, 'watch'), exist_ok=True)
    shots = {c: weather(Image.open(os.path.join(SHOTS, f'{c}.png')), c) for c in COLORS}
    shots['editor'] = Image.open(os.path.join(SHOTS, 'editor.png'))
    for name in ('mint', 'editor'):
        watch(shots[name], 0.62).save(os.path.join(IMAGES, 'watch', f'{name}.png'), optimize=True)
    color_row(shots)
    banner(shots)
    print('done:', IMAGES)


if __name__ == '__main__':
    main()
