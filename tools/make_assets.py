#!/usr/bin/env python3
"""Draws every picture of the ORBIT watchface into assets/default.w390-s/.

Digits and labels use the free font Sora (tools/fonts, SIL OFL), the icons are drawn by hand.
Run with a Python that has Pillow: python3 tools/make_assets.py
Also writes watchface/sizes.js with the width of every glyph and the accent colors, the layout in
watchface/index.js uses it.

Everything that is mint in the default look exists once per accent color under c/<color>/.
"""
import json
import math
import os
import shutil

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'default.w390-s')
FONT = os.path.join(ROOT, 'tools', 'fonts', 'Sora.ttf')
SIZES = os.path.join(ROOT, 'watchface', 'sizes.js')

# Accent colors of the editor, the first one is the default. The order is the order in the editor.
COLORS = [
    ('mint', (112, 192, 152)),  # 0x70c098, a tick darker than VOLT's 0x7ed6aa
    ('ice', (111, 179, 224)),
    ('amber', (224, 168, 88)),
    ('rose', (224, 138, 168)),
    ('lavender', (165, 155, 224)),
    ('silver', (196, 200, 204)),
]
MINT = COLORS[0][1]
WHITE = (245, 245, 245)
LIGHT = (218, 220, 222)
GRAY = (150, 154, 158)
DIM = (70, 76, 80)  # rings and frames in the editor previews
RED = (232, 86, 76)  # battery below 5 %
AOD_WHITE = (120, 122, 124)
AOD_MINT = (66, 116, 92)
MARK = (255, 0, 255)  # stands for the accent color while drawing the weather icons

S = 4  # icons are drawn 4x larger and scaled down for smooth edges

sizes = {}


def font(size, style):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(style)
    return f


def save(img, path, colors=0):
    """colors > 0 reduces the picture to that many colors (editor previews, much smaller files). It stays
    RGBA: the watch shows no palette pictures."""
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if colors:
        img = img.quantize(colors=colors, method=Image.Quantize.FASTOCTREE).convert('RGBA')
    img.save(full, optimize=True)


def text_img(text, f, color, tracking=0):
    """Tight width, but always the full line height so all pictures of a font line up."""
    asc, desc = f.getmetrics()
    w = sum(f.getlength(ch) + tracking for ch in text)
    img = Image.new('RGBA', (int(math.ceil(w)) + 16, asc + desc), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 4
    for ch in text:
        d.text((x, 0), ch, font=f, fill=color)
        x += f.getlength(ch) + tracking
    box = img.getbbox() or (0, 0, 1, 1)
    return img.crop((box[0], 0, box[2], asc + desc))


def trim_v(images):
    """Cuts the empty rows above and below that all pictures of one set share."""
    top = min((i.getbbox() or (0, 0, 0, 0))[1] for i in images)
    bottom = max((i.getbbox() or (0, 0, 0, i.height))[3] for i in images)
    return [i.crop((0, top, i.width, bottom)) for i in images]


def glyph_set(name, f, color, extra=(), cell=False, trim=True, count=10, prefix=''):
    """0-9 plus extra signs. cell=True puts the digits in cells of equal width (for IMG_TIME).
    trim=False keeps the full line height, so the digits line up with the texts of the same font.
    count < 10 only draws the digits 0 to count-1. prefix puts the set under c/<color>/."""
    digits = [text_img(str(n), f, color) for n in range(count)]
    signs = [text_img(ch, f, color) for _, ch in extra]
    allimgs = trim_v(digits + signs) if trim else digits + signs
    digits, signs = allimgs[:count], allimgs[count:]
    widths = {}
    cw = max(i.width for i in digits)
    for n, img in enumerate(digits):
        if cell:
            out = Image.new('RGBA', (cw, img.height), (0, 0, 0, 0))
            out.paste(img, ((cw - img.width) // 2, 0))
            img = out
        save(img, f'{prefix}num/{name}_{n}.png')
        widths[str(n)] = img.width
    for (fname, _), img in zip(extra, signs):
        save(img, f'{prefix}num/{name}_{fname}.png')
        widths[fname] = img.width
    sizes[name] = {'h': digits[0].height, 'w': widths}


def label(path, text, f, color, tracking=0, key=None):
    img = text_img(text, f, color, tracking)
    save(img, path)
    if key:
        sizes.setdefault(key, {})[path] = img.width
    return img


def canvas(w, h):
    img = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def small(img, w, h):
    return img.resize((w, h), Image.LANCZOS)


# ---------- texts ----------

WEEK_LONG = {
    'de': ['MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG', 'SONNTAG'],
    'en': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
}
WEEK_SHORT = {
    'de': ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'],
    'en': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
}
MONTHS = {
    'de': ['JANUAR', 'FEBRUAR', 'MÄRZ', 'APRIL', 'MAI', 'JUNI', 'JULI', 'AUGUST', 'SEPTEMBER', 'OKTOBER',
           'NOVEMBER', 'DEZEMBER'],
    'en': ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER',
           'NOVEMBER', 'DECEMBER'],
}
MONTHS_SHORT = {
    'de': ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'],
    'en': ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
}
WEEK_NO = {'de': 'KW', 'en': 'WK'}  # calendar week

# ring labels: the same short English words in every language
UNITS = {
    'step': 'STEPS', 'heart': 'BPM', 'cal': 'KCAL', 'battery': 'BATT', 'km': 'KM', 'mi': 'MI',
    'pai': 'PAI', 'stand': 'STAND', 'spo2': 'SPO2', 'stress': 'STRESS',
}

DATE_TRACK = 3
DAY_TRACK = 10


def texts():
    f_date = font(19, 'Regular')
    f_cap = font(11, 'SemiBold')
    for lang in ('de', 'en'):
        for i in range(7):
            label(f'txt/{lang}/day_{i}.png', WEEK_LONG[lang][i], f_date, GRAY, DAY_TRACK, key='txt')
            label(f'txt/{lang}/wd_{i}.png', WEEK_SHORT[lang][i], f_date, LIGHT, DATE_TRACK, key='txt')
        for i in range(12):
            label(f'txt/{lang}/mon_{i}.png', MONTHS[lang][i], f_date, LIGHT, DATE_TRACK, key='txt')
            label(f'txt/{lang}/mons_{i}.png', MONTHS_SHORT[lang][i], f_date, LIGHT, DATE_TRACK, key='txt')
        label(f'txt/{lang}/kw.png', WEEK_NO[lang], f_date, LIGHT, DATE_TRACK, key='txt')
    for key, text in UNITS.items():
        sizes['unit_h'] = label(f'txt/u_{key}.png', text, f_cap, GRAY, 2, key='txt').height
    # next to the minutes in the 12-hour format
    f_ampm = font(16, 'SemiBold')
    label('txt/am.png', 'AM', f_ampm, GRAY, 1, key='txt')
    sizes['ampm'] = {'h': label('txt/pm.png', 'PM', f_ampm, GRAY, 1, key='txt').height}


def numbers():
    f_time = font(110, 'SemiBold')
    # normal time: tight digits, drawn one by one in index.js, so a 1 does not leave a gap
    glyph_set('time_h', f_time, WHITE)
    for key, col in COLORS:
        glyph_set('time_m', f_time, col, prefix=f'c/{key}/')
    # always-on time: IMG_TIME needs cells of equal width
    glyph_set('aod_h', font(110, 'Light'), AOD_WHITE, cell=True)
    glyph_set('aod_m', font(110, 'Light'), AOD_MINT, cell=True)
    glyph_set('date', font(19, 'Regular'), LIGHT, [('dot', '.'), ('slash', '/'), ('mid', '·')], trim=False)
    for key, col in COLORS:
        glyph_set('bat', font(19, 'Regular'), col, [('pct', '%')], trim=False, prefix=f'c/{key}/')
    glyph_set('batlow', font(19, 'Regular'), RED, [('pct', '%')], trim=False, count=5)  # 0-4 %
    signs = [('dot', '.'), ('comma', ','), ('k', 'k')]
    glyph_set('val', font(24, 'SemiBold'), WHITE, signs)
    glyph_set('big', font(30, 'SemiBold'), WHITE, signs)  # value in the larger middle ring
    # weather: TEXT_IMG bound to the system weather data, so the order of font_array is fixed 0-9;
    # 'none' ("--") is shown when there is no weather data
    glyph_set('temp', font(36, 'SemiBold'), WHITE, [('minus', '-'), ('deg', '°'), ('none', '--')])
    glyph_set('hilo', font(17, 'Regular'), GRAY, [('minus', '-'), ('deg', '°'), ('none', '--')])


# ---------- icons ----------

def battery_icons():
    """6 steps: empty, 20, 40, 60, 80, 100 % per color, plus an empty red one for below 5 %."""
    w, h = 38, 20
    jobs = [(n, col, f'c/{key}/icon/bat_{n}.png') for key, col in COLORS for n in range(6)]
    for n, color, path in jobs + [(0, RED, 'icon/bat_low.png')]:
        img, d = canvas(w, h)
        lw = 2 * S
        d.rounded_rectangle((lw // 2, lw // 2, (w - 4) * S - lw // 2, h * S - lw // 2), radius=4 * S, outline=color, width=lw)
        d.rounded_rectangle(((w - 3) * S, 6 * S, w * S - S // 2, (h - 6) * S), radius=S, fill=color)
        if n:
            inner = (w - 4) * S - 2 * lw - 4 * S
            d.rounded_rectangle((lw + 2 * S, lw + 2 * S, lw + 2 * S + inner * n // 5, h * S - lw - 2 * S), radius=S, fill=color)
        save(small(img, w, h), path)
    sizes['bat_icon'] = {'w': w, 'h': h}


# Ring icons, one function per ring content: (width, height, draw(d, color)).

def _footprints(d, col):
    def foot(cx, cy, ang):
        # sole and heel as two ellipses, turned by ang
        sole = [(math.cos(a) * 3.2, math.sin(a) * 5.2 - 2.2) for a in (2 * math.pi * t / 36 for t in range(36))]
        heel = [(math.cos(a) * 2.6, math.sin(a) * 2.3 + 5.8) for a in (2 * math.pi * t / 36 for t in range(36))]
        c, s = math.cos(ang), math.sin(ang)
        for shape in (sole, heel):
            d.polygon([((cx + x * c - y * s) * S, (cy + x * s + y * c) * S) for x, y in shape], fill=col)

    foot(8.5, 15, -0.3)
    foot(17.5, 9.5, 0.3)


def _heart(d, col):
    pts = []
    for t in range(200):
        a = 2 * math.pi * t / 200
        x = 16 * math.sin(a) ** 3
        y = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append(((13 + x * 0.72) * S, (11.2 - y * 0.72) * S))
    d.polygon(pts, fill=col)


def _flame(d, col):
    def blob(cx, base, half, height, color):
        def side(u):
            return half * math.sin(math.pi * min(1, (1 - u) * 1.15)) * (1 - u) ** 0.35

        pts = [((cx + side(t / 100)) * S, (base - height * t / 100) * S) for t in range(101)]
        pts += [((cx - side(t / 100) * 0.9) * S, (base - height * t / 100) * S) for t in range(100, -1, -1)]
        d.polygon(pts, fill=color)
        d.ellipse(((cx - half) * S, (base - half * 1.4) * S, (cx + half) * S, (base + half * 0.15) * S), fill=color)

    blob(11, 26.5, 9.5, 26, col)
    blob(11.5, 26, 4.5, 12, (0, 0, 0, 0))


def _battery(d, col):
    lw = 2 * S
    d.rounded_rectangle((5 * S, 0, 11 * S, 3 * S), radius=S, fill=col)
    d.rounded_rectangle((S + lw // 2, 3 * S, 15 * S - lw // 2, 26 * S - lw // 2), radius=3 * S, outline=col, width=lw)
    d.rounded_rectangle((4 * S + S // 2, 13 * S, 11 * S + S // 2, 22 * S + S // 2), radius=S, fill=col)


def _pin(d, col):
    cx, cy, r = 10, 9, 8.5
    d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=col)
    d.polygon([((cx - r * 0.86) * S, (cy + r * 0.5) * S), ((cx + r * 0.86) * S, (cy + r * 0.5) * S), (cx * S, 26 * S)], fill=col)
    d.ellipse(((cx - 3.4) * S, (cy - 3.4) * S, (cx + 3.4) * S, (cy + 3.4) * S), fill=(0, 0, 0, 0))


def _pulse(d, col):
    pts = [(1, 12), (7, 12), (10.5, 3), (15, 20), (18.5, 8), (21, 12), (27, 12)]
    d.line([(x * S, y * S) for x, y in pts], fill=col, width=int(2.8 * S), joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse(((x - 1.4) * S, (y - 1.4) * S, (x + 1.4) * S, (y + 1.4) * S), fill=col)


def _stand(d, col):
    d.ellipse((5.4 * S, 0, 12.6 * S, 7.2 * S), fill=col)
    d.rounded_rectangle((5 * S, 9 * S, 13 * S, 19 * S), radius=2 * S, fill=col)
    d.rounded_rectangle((5 * S, 17 * S, 8.4 * S, 28 * S), radius=1.6 * S, fill=col)
    d.rounded_rectangle((9.6 * S, 17 * S, 13 * S, 28 * S), radius=1.6 * S, fill=col)
    d.rounded_rectangle((1.6 * S, 9.5 * S, 4.2 * S, 18 * S), radius=1.3 * S, fill=col)
    d.rounded_rectangle((13.8 * S, 9.5 * S, 16.4 * S, 18 * S), radius=1.3 * S, fill=col)


def _drop(d, col):
    cx, cy, r = 10, 17, 8.5
    d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=col)
    d.polygon([((cx - r * 0.94) * S, (cy - r * 0.34) * S), ((cx + r * 0.94) * S, (cy - r * 0.34) * S), (cx * S, 0)], fill=col)
    # small light reflex, cut out
    d.arc(((cx - 5) * S, (cy - 5) * S, (cx + 5) * S, (cy + 5) * S), start=100, end=170, fill=(0, 0, 0, 0), width=int(1.8 * S))


def _gauge(d, col):
    cx, cy, r = 14, 17, 11.5
    lw = int(3 * S)
    d.arc(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), start=180, end=360, fill=col, width=lw)
    a = math.radians(-50)
    d.line([(cx * S, cy * S), ((cx + math.cos(a) * 8.5) * S, (cy + math.sin(a) * 8.5) * S)], fill=col, width=int(2.4 * S))
    d.ellipse(((cx - 2.6) * S, (cy - 2.6) * S, (cx + 2.6) * S, (cy + 2.6) * S), fill=col)


RING_ICONS = {
    'step': (26, 26, _footprints),
    'heart': (26, 24, _heart),
    'cal': (22, 28, _flame),
    'battery': (16, 26, _battery),
    'distance': (20, 26, _pin),
    'pai': (28, 22, _pulse),
    'stand': (18, 28, _stand),
    'spo2': (20, 26, _drop),
    'stress': (28, 20, _gauge),
}


def ring_icon(name, col):
    w, h, draw = RING_ICONS[name]
    img, d = canvas(w, h)
    draw(d, col)
    return small(img, w, h)


def ring_icons():
    for key, col in COLORS:
        for name in RING_ICONS:
            save(ring_icon(name, col), f'c/{key}/icon/{name}.png')
    sizes['icons'] = {name: [w, h] for name, (w, h, _) in RING_ICONS.items()}


# weather icons, line art: white cloud, accent sun and drops. Drawn on a 60x50 grid, saved at 52x44.
# Every icon is split into a white layer (wx/) and an accent layer (c/<color>/wx/), so only the
# accent parts exist once per color.

def _sun(d, cx, cy, r, rays=True, partial=False):
    lw = int(2.6 * S)
    d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), outline=MARK, width=lw)
    if not rays:
        return
    for k in range(8):
        a = math.pi * 2 * k / 8 - math.pi / 2
        if partial and not (-math.pi * 1.05 <= a - 2 * math.pi * (a > math.pi / 2) <= 0.05):
            continue
        x1, y1 = cx + math.cos(a) * (r + 4), cy + math.sin(a) * (r + 4)
        x2, y2 = cx + math.cos(a) * (r + 8.5), cy + math.sin(a) * (r + 8.5)
        d.line([(x1 * S, y1 * S), (x2 * S, y2 * S)], fill=MARK, width=lw)


def _cloud(d, ox, oy):
    """Cloud outline: three bumps on a flat base. Background filled black so it covers the sun."""
    lw = int(2.8 * S)
    circles = [(14, 26, 8), (25, 19, 11), (36, 25, 8.5)]
    base_l, base_r, base_y = 6, 44, 34

    def P(x, y):
        return ((ox + x) * S, (oy + y) * S)

    for cx, cy, r in circles:
        d.ellipse((*P(cx - r - 1.5, cy - r - 1.5), *P(cx + r + 1.5, cy + r + 1.5)), fill=(0, 0, 0, 255))
    d.rounded_rectangle((*P(base_l - 1.5, 22), *P(base_r + 1.5, base_y + 1.5)), radius=8 * S, fill=(0, 0, 0, 255))
    # outline: filled white shape, then a black shape inset by the line width
    for color, grow in ((WHITE, 0), ((0, 0, 0, 255), -lw / S)):
        for cx, cy, r in circles:
            rr = r + grow
            d.ellipse((*P(cx - rr, cy - rr), *P(cx + rr, cy + rr)), fill=color)
        d.rounded_rectangle((*P(base_l - grow, 22 - grow), *P(base_r + grow, base_y + grow)), radius=max(1, (8 + grow) * S), fill=color)


def _drops(d, ox, oy, kind):
    lw = int(2.6 * S)
    for i, x in enumerate([16, 25, 34]):
        cx, cy = ox + x - 1, oy + 42
        if kind == 'rain' or (kind == 'sleet' and not i % 2):
            d.line([((ox + x) * S, (oy + 38) * S), ((ox + x - 3) * S, (oy + 45) * S)], fill=MARK, width=lw)
        elif kind == 'heavy':
            d.line([((ox + x) * S, (oy + 37) * S), ((ox + x - 4) * S, (oy + 47) * S)], fill=MARK, width=lw)
        elif kind in ('snow', 'sleet'):
            d.ellipse(((cx - 2.2) * S, (cy - 2.2) * S, (cx + 2.2) * S, (cy + 2.2) * S), fill=WHITE)
        elif kind == 'hail':
            d.ellipse(((cx - 2.8) * S, (cy - 2.8) * S, (cx + 2.8) * S, (cy + 2.8) * S), outline=MARK, width=int(1.8 * S))


def _moon(d, cx, cy, r):
    d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=MARK)
    d.ellipse(((cx - r + 6) * S, (cy - r - 4) * S, (cx + r + 6) * S, (cy + r - 4) * S), fill=(0, 0, 0, 0))


def _storm(d):
    _cloud(d, 5, -6)
    pts = [(31, 30), (24, 39), (30, 39), (26, 48), (36, 36), (30, 36), (34, 30)]
    d.polygon([(x * S, y * S) for x, y in pts], fill=MARK)


def _fog(d):
    lw = int(2.8 * S)
    for i, (x1, x2) in enumerate([(10, 50), (6, 42), (14, 54), (10, 46)]):
        y = 12 + i * 8
        d.line([(x1 * S, y * S), (x2 * S, y * S)], fill=WHITE if i % 2 else MARK, width=lw)


WX_DRAW = {
    'sun': lambda d: _sun(d, 30, 25, 10),
    'partly': lambda d: (_sun(d, 38, 15, 7, partial=True), _cloud(d, 2, 6)),
    'cloud': lambda d: _cloud(d, 5, 2),
    'rain': lambda d: (_cloud(d, 5, -6), _drops(d, 5, -6, 'rain')),
    'heavy': lambda d: (_cloud(d, 5, -6), _drops(d, 5, -6, 'heavy')),
    'snow': lambda d: (_cloud(d, 5, -6), _drops(d, 5, -6, 'snow')),
    'sleet': lambda d: (_cloud(d, 5, -6), _drops(d, 5, -6, 'sleet')),
    'hail': lambda d: (_cloud(d, 5, -6), _drops(d, 5, -6, 'hail')),
    'storm': _storm,
    'fog': _fog,
    'clear': lambda d: _moon(d, 30, 25, 12),
    'night': lambda d: (_moon(d, 40, 14, 8), _cloud(d, 2, 6)),
    'none': lambda d: _cloud(d, 5, 2),
}

# Zepp weather index 0-28 -> picture. The system picks the level of the IMG_LEVEL by this index.
WEATHER = [
    'partly', 'rain', 'snow', 'sun', 'cloud', 'rain', 'snow', 'rain', 'snow', 'snow',
    'heavy', 'fog', 'sleet', 'fog', 'fog', 'storm', 'snow', 'fog', 'heavy', 'hail',
    'storm', 'heavy', 'fog', 'fog', 'heavy', 'none', 'night', 'rain', 'clear',
]
WX_W, WX_H = 52, 44


def weather_icons():
    """Pictures are drawn once per kind (WX_DRAW) and saved under the kind's name; WEATHER maps the
    system index to them. Accent layers without any pixel point to the shared wx/empty.png."""
    save(Image.new('RGBA', (WX_W, WX_H), (0, 0, 0, 0)), 'wx/empty.png')
    acc = {}
    for kind, draw in WX_DRAW.items():
        img, d = canvas(60, 50)
        draw(d)
        # the 4x picture has no smoothing yet, so every pixel is exactly white, MARK or helper black
        base = Image.new('RGBA', img.size, (0, 0, 0, 0))
        mark = Image.new('RGBA', img.size, (0, 0, 0, 0))
        src, pb, pm = img.load(), base.load(), mark.load()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = src[x, y]
                if a and (r, g, b) == WHITE:
                    pb[x, y] = (*WHITE, 255)
                elif a and (r, g, b) == MARK:
                    pm[x, y] = (255, 255, 255, 255)
        save(small(base, WX_W, WX_H), f'wx/{kind}.png')
        acc[kind] = mark.getbbox() is not None
        if acc[kind]:
            alpha = small(mark, WX_W, WX_H).getchannel('A')
            for key, col in COLORS:
                layer = Image.new('RGBA', (WX_W, WX_H), (*col, 0))
                layer.putalpha(alpha)
                save(layer, f'c/{key}/wx/{kind}.png')
    sizes['wx'] = {'w': WX_W, 'h': WX_H, 'n': len(WEATHER), 'kinds': WEATHER, 'acc': acc}


def arrows():
    """Small up and down triangles in front of the day's high and low."""
    for name, up in (('up', True), ('down', False)):
        img, d = canvas(10, 8)
        pts = [(5, 0), (10, 8), (0, 8)] if up else [(0, 0), (10, 0), (5, 8)]
        d.polygon([(x * S, y * S) for x, y in pts], fill=GRAY)
        save(small(img, 10, 8), f'icon/{name}.png')


def hit():
    """Invisible picture for the tap areas."""
    save(Image.new('RGBA', (4, 4), (0, 0, 0, 0)), 'icon/hit.png')


def app_icon():
    """App list icon: mint ring with a gap at the top right on black."""
    n = 248
    img, d = canvas(n, n)
    d.ellipse((0, 0, n * S - 1, n * S - 1), fill=(10, 10, 10, 255))
    m = 58 * S
    d.arc((m, m, n * S - m, n * S - m), start=-60, end=230, fill=(46, 56, 56, 255), width=22 * S)
    d.arc((m, m, n * S - m, n * S - m), start=-90, end=150, fill=MINT, width=22 * S)
    save(small(img, n, n), 'icon.png')


# ---------- watchface editor ----------

# Size of the editable areas, the positions are in watchface/index.js. Every preview has the size of
# its area.
EDIT = {
    'color': (330, 100),
    'ring_s': (108, 108),
    'ring_b': (140, 140),
    'row': (280, 40),
    'date': (250, 36),
}
TIPS_W, TIPS_H = 190, 34
RING_PREVIEW = ['step', 'heart', 'cal', 'battery', 'distance', 'pai', 'stand', 'spo2', 'stress', 'empty']
SAMPLE = {'wd': 0, 'day': 26, 'mon': 9, 'year': 2026, 'week': 44}  # Monday, 26 October 2026
DATE_STYLES = 4  # see dateItems() in index.js


def frames():
    for name, (w, h) in EDIT.items():
        for state, color, lw in (('sel', WHITE, 3), ('unsel', DIM, 2)):
            img, d = canvas(w, h)
            d.rounded_rectangle((lw * S // 2, lw * S // 2, w * S - lw * S // 2, h * S - lw * S // 2),
                                radius=16 * S, outline=color, width=lw * S)
            save(small(img, w, h), f'edit/{state}_{name}.png')
    img, d = canvas(TIPS_W, TIPS_H)
    d.rounded_rectangle((0, 0, TIPS_W * S, TIPS_H * S), radius=TIPS_H * S // 2, fill=LIGHT)  # the system writes black
    save(small(img, TIPS_W, TIPS_H), 'edit/tips.png')
    sizes['edit'] = {name: list(wh) for name, wh in EDIT.items()}
    sizes['edit']['tips'] = [TIPS_W, TIPS_H]


def paste_center(out, img, cx, cy):
    out.alpha_composite(img, (int(round(cx - img.width / 2)), int(round(cy - img.height / 2))))


def ring_previews():
    """Gray ring with icon and label for every ring content, in both ring sizes."""
    f_cap = font(11, 'SemiBold')
    for name, r in (('ring_s', 48), ('ring_b', 64)):
        w, h = EDIT[name]
        for kind in RING_PREVIEW:
            img, d = canvas(w, h)
            box = ((w / 2 - r) * S, (h / 2 - r) * S, (w / 2 + r) * S, (h / 2 + r) * S)
            if kind == 'empty':
                for k in range(0, 360, 20):
                    d.arc(box, start=k, end=k + 10, fill=DIM, width=3 * S)
            else:
                d.ellipse(box, outline=DIM, width=6 * S)
            out = small(img, w, h)
            if kind != 'empty':
                icon = ring_icon(kind, LIGHT)
                paste_center(out, icon, w / 2, h / 2 - 4 - icon.height / 2)
                unit = text_img(UNITS['km' if kind == 'distance' else kind], f_cap, GRAY, 2)
                paste_center(out, unit, w / 2, h / 2 + 12)
            save(out, f'edit/{name}_{kind}.png', colors=48)


def color_previews():
    """The time "10 08" with the minutes in each accent color, the size of the time area."""
    f_time = font(110, 'SemiBold')
    w, h = EDIT['color']
    for key, col in COLORS:
        hrs, mins = text_img('10', f_time, WHITE, 2), text_img('08', f_time, col, 2)
        hrs, mins = trim_v([hrs, mins])
        out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        x = (w - hrs.width - 22 - mins.width) // 2
        y = (h - hrs.height) // 2
        out.alpha_composite(hrs, (x, y))
        out.alpha_composite(mins, (x + hrs.width + 22, y))
        save(out, f'c/{key}/edit.png', colors=48)


def date_text(lang, style):
    """The sample date in one of the date styles of index.js, as one string."""
    s, de = SAMPLE, lang == 'de'
    day = f"{s['day']}." if de else f"{s['day']}"
    if style == 0:
        return f"{day} {MONTHS[lang][s['mon']]}"
    if style == 1:
        return f"{WEEK_SHORT[lang][s['wd']]} {day} {MONTHS_SHORT[lang][s['mon']]}"
    if style == 2:
        return f"{s['day']}.{s['mon'] + 1}.{s['year']}" if de else f"{s['mon'] + 1}/{s['day']}/{s['year']}"
    return f"{day} {MONTHS_SHORT[lang][s['mon']]} · {WEEK_NO[lang]} {s['week']}"


def row_previews():
    f_date = font(19, 'Regular')
    for lang in ('de', 'en'):
        w, h = EDIT['date']
        for style in range(DATE_STYLES):
            out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            t = text_img(date_text(lang, style), f_date, LIGHT, DATE_TRACK)
            out.alpha_composite(t, (10, (h - t.height) // 2))  # the area starts 10 px left of the date
            save(out, f'edit/{lang}/date_{style}.png')
        w, h = EDIT['row']
        for kind, text in (('day', WEEK_LONG[lang][SAMPLE['wd']]), ('empty', '·  ·  ·')):
            out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            t = text_img(text, f_date, GRAY if kind != 'empty' else DIM, DAY_TRACK)
            paste_center(out, t, w / 2, h / 2)
            save(out, f'edit/{lang}/row_{kind}.png')


def clean():
    """Removes the old pictures, so renamed ones don't stay behind."""
    if not os.path.isdir(OUT):
        return
    for name in os.listdir(OUT):
        p = os.path.join(OUT, name)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)


def write_sizes():
    sizes['colors'] = [[key, (col[0] << 16) | (col[1] << 8) | col[2]] for key, col in COLORS]
    with open(SIZES, 'w') as f:
        f.write('// Written by tools/make_assets.py, do not edit. Widths and heights of the pictures in px.\n')
        f.write('export const SIZES = ' + json.dumps(sizes, indent=2, sort_keys=True, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    clean()
    numbers()
    texts()
    battery_icons()
    ring_icons()
    weather_icons()
    arrows()
    hit()
    app_icon()
    frames()
    ring_previews()
    color_previews()
    row_previews()
    write_sizes()
    for k in ('time_h', 'date', 'bat', 'val', 'big', 'temp', 'hilo'):
        print(k, sizes[k]['h'], sizes[k]['w'])
    print('done:', OUT)
