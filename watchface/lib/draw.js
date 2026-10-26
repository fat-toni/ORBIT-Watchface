// Drawing helpers: pictures, text, rows of digit pictures, rings and tap areas. Every widget is changed
// only when something is different, since every change makes the watch redraw.
import * as hmUI from '@zos/ui'
import { launchApp } from '@zos/router'
import { SIZES } from '../sizes'
import { RING_LINE } from './layout'

export const NORMAL = { show_level: hmUI.show_level.ONLY_NORMAL }
const TRACK = 0x232b2b // ring background

// Text: Sora cut down by make_assets.py (Regular, and SemiBold for the small labels). The watch measures
// text only in its own font, so widths come from the letter table of make_assets.py (Regular, 19 px).
export const FONT = 'fonts/sora.ttf'
export const FONT_SB = 'fonts/sora-sb.ttf'
export const TEXT_H = SIZES.text19.h
// keep in sync with the colors in tools/make_assets.py
export const LIGHT = 0xdadcde // date
export const GRAY = 0x969a9e // weekday, city, labels
export const RED = 0xe8564c // battery below 5 %

export function textW(text, space) {
  const adv = SIZES.text19.adv
  let w = 0
  for (const c of text) w += adv[c] !== undefined ? adv[c] : adv.M
  return Math.ceil(w + space * Math.max(0, text.length - 1))
}

export function digits(prefix) {
  const a = []
  for (let i = 0; i < 10; i++) a.push(`num/${prefix}_${i}.png`)
  return a
}

export function img(x, y, src, extra) {
  return hmUI.createWidget(hmUI.widget.IMG, { x, y, src, ...NORMAL, ...extra })
}

export function label(props) {
  return hmUI.createWidget(hmUI.widget.TEXT, {
    text: '',
    text_style: hmUI.text_style.NONE,
    align_v: hmUI.align.CENTER_V,
    ...NORMAL,
    ...props,
  })
}

// What each widget shows is kept here, not on the widget object the system hands out.
const state = new Map()
export function update(w, props) {
  const key = JSON.stringify(props)
  const st = state.get(w) || {}
  if (st.key === key) return
  state.set(w, { ...st, key })
  w.setProperty(hmUI.prop.MORE, props)
}
// Text and other properties of a TEXT widget, again only what changed.
export function setText(w, text, props) {
  if (props) update(w, props)
  const st = state.get(w) || {}
  if (st.text === text) return
  state.set(w, { ...st, text })
  w.setProperty(hmUI.prop.TEXT, text)
}
export function show(w, visible) {
  const st = state.get(w) || {}
  if (st.visible === visible) return
  state.set(w, { ...st, visible })
  w.setProperty(hmUI.prop.VISIBLE, visible)
}

// A row of pictures drawn as separate IMG widgets. Items are glyph names of the set ('7', 'dot') or extra
// space { gap }. Each update sets position and picture of every slot that changed, unused slots are hidden.
// dir puts the glyphs under c/<color>/.
export function numberRow(set, slots, y, track = 0, dir = '') {
  const g = SIZES[set]
  const parts = []
  for (let i = 0; i < slots; i++) parts.push(img(0, y, `${dir}num/${set}_0.png`))
  const itemW = (c) => (typeof c === 'string' ? g.w[c] : c.gap - track)
  const width = (items) => items.reduce((s, c) => s + itemW(c) + track, 0) - (items.length ? track : 0)
  return {
    width,
    // align: 'left' (x = left edge), 'center' (x = middle) or 'right' (x = right edge); returns the left edge.
    draw(items, x, align = 'left') {
      const w = width(items)
      let cx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x
      const left = cx
      let i = 0
      items.forEach((c) => {
        const iw = itemW(c)
        if (typeof c === 'string') {
          update(parts[i], { x: cx, y, w: iw, h: g.h, src: `${dir}num/${set}_${c}.png` })
          show(parts[i++], true)
        }
        cx += iw + track
      })
      for (; i < slots; i++) show(parts[i], false)
      return left
    },
  }
}

// Ring: dark track plus an arc in the accent color from the top, clockwise; returns fill(part 0-1).
export function ring(cx, cy, r, color) {
  const box = { x: cx - r, y: cy - r, w: r * 2, h: r * 2, line_width: RING_LINE, ...NORMAL }
  hmUI.createWidget(hmUI.widget.ARC, { ...box, start_angle: 0, end_angle: 360, color: TRACK })
  const arc = hmUI.createWidget(hmUI.widget.ARC, { ...box, start_angle: -90, end_angle: -90, color })
  return (part) => {
    const p = Math.max(0, Math.min(1, part))
    update(arc, { ...box, start_angle: -90, end_angle: -90 + Math.round(360 * p), color })
    show(arc, p > 0)
  }
}

// Invisible tap area that opens a system app.
export function tapArea(x, y, w, h, appId) {
  const hit = img(x, y, 'icon/hit.png', { w, h })
  hit.addEventListener(hmUI.event.CLICK_UP, () => {
    try {
      launchApp({ appId, native: true })
    } catch (e) {}
  })
}

// Tap area that opens the system app of a data type (hmUI.data_type name); fallback: appId.
export function dataTap(x, y, w, h, dataType, appId) {
  try {
    hmUI.createWidget(hmUI.widget.IMG_CLICK, { x, y, w, h, src: 'icon/hit.png', type: hmUI.data_type[dataType] })
  } catch (e) {
    tapArea(x, y, w, h, appId)
  }
}
