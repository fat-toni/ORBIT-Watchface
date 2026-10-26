// Builds the real watchface on the simulated Bip 6 (test/mock/zos.mjs) and reads back what it drew.
import { readFileSync, existsSync } from 'node:fs'
import { resetZos } from './mock/zos.mjs'
import { SIZES } from '../watchface/sizes.js'

export { SIZES }
export const W = 390
export const H = 450
export const ASSETS = new URL('../assets/default.w390-s/', import.meta.url).pathname
export const LANGS = Object.keys(SIZES.langs)
export const KINDS = ['step', 'heart', 'cal', 'battery', 'distance', 'pai', 'stand', 'spo2', 'stress', 'empty']
const zos = globalThis.zos
let run = 0

// The editor ids and own types of watchface/index.js.
export const EDIT = { color: 101, rings: [102, 103, 104], date: 106, row: 105 }
export const TYPE = { color: 100001, empty: 100100, date: 100201, row: { day: 100301, city: 100302, empty: 100303 } }
const EDIT_TYPE = {
  step: 200,
  heart: 201,
  cal: 202,
  battery: 203,
  distance: 204,
  pai: 100110,
  stand: 206,
  spo2: 207,
  stress: 208,
}

// Builds the watchface. o: { lang: 'de', 'en', 'fr' ... (default English), hour12, imperial, color: 0-5, rings: [kind x3],
// date: 0-2, row: 'day'|'city'|'empty', city: name of the forecast, now: {...}, values: {...}, edit: {...raw editor choices} }
export async function build(o = {}) {
  resetZos()
  zos.language = SIZES.langs[o.lang || 'en'].zepp[0]
  zos.hour12 = !!o.hour12
  zos.imperial = !!o.imperial
  if (o.city !== undefined) zos.city = o.city
  if (o.now) Object.assign(zos.now, o.now)
  if (o.values) Object.assign(zos.values, o.values)
  if (o.color !== undefined) zos.edit[EDIT.color] = TYPE.color + o.color
  if (o.rings) o.rings.forEach((k, i) => (zos.edit[EDIT.rings[i]] = k === 'empty' ? TYPE.empty : EDIT_TYPE[k]))
  if (o.date !== undefined) zos.edit[EDIT.date] = TYPE.date + o.date
  if (o.row) zos.edit[EDIT.row] = TYPE.row[o.row]
  Object.assign(zos.edit, o.edit)
  if (o.noEditTypes) zos.noEditTypes = true
  await import(`../watchface/index.js?run=${++run}`)
  const face = zos.face
  face.onInit()
  face.build()
  return face
}

// Widgets the watchface shows in normal mode (not hidden, not only for AOD or the editor).
export function shown() {
  return zos.widgets.filter((w) => w.visible && (w.props.show_level === undefined || w.props.show_level & 1))
}

export function editGroups() {
  return zos.widgets.filter((w) => w.type === 'WATCHFACE_EDIT_GROUP')
}

// Every picture a widget points to.
export function pictures(w) {
  const p = w.props
  const list = [p.src, p.negative_image, p.invalid_image, p.unit_en, p.unit_sc, p.unit_tc, p.select_image]
  list.push(p.un_select_image, p.tips_BG)
  for (const k of ['image_array', 'font_array', 'hour_array', 'minute_array']) list.push(...(p[k] || []))
  if (p.font) list.push(p.font)
  for (const t of p.optional_types || []) list.push(t.preview)
  return list.filter(Boolean)
}

const sizes = new Map()
// Width and height of a PNG from its header.
export function pngSize(path) {
  if (!sizes.has(path)) {
    const b = readFileSync(ASSETS + path)
    sizes.set(path, { w: b.readUInt32BE(16), h: b.readUInt32BE(20) })
  }
  return sizes.get(path)
}
export const exists = (path) => existsSync(ASSETS + path)

// The box a widget covers; an IMG without w/h has the size of its picture.
export function box(w) {
  const p = w.props
  let { x, y, w: bw, h: bh } = p
  if (w.type === 'IMG' && (bw === undefined || bh === undefined)) ({ w: bw, h: bh } = pngSize(p.src))
  return { x, y, w: bw, h: bh }
}

// A row of pictures as text, left to right: "26. [mon_9]", "12.345", "88%".
const SIGNS = { dot: '.', comma: ',', slash: '/', dash: '-', pct: '%', k: 'k', deg: '°', minus: '-' }
export function text(widgets) {
  return widgets
    .slice()
    .sort((a, b) => a.props.x - b.props.x)
    .map((w) => {
      const m = w.props.src.match(/num\/.*_([a-z0-9]+)\.png$/)
      if (m) return SIGNS[m[1]] ?? m[1]
      return `[${w.props.src.match(/([^/]+)\.png$/)[1]}]`
    })
    .join('')
}

// Shown IMG widgets whose picture path matches re.
export const imgs = (re) => shown().filter((w) => w.type === 'IMG' && re.test(w.props.src))

// The rings as drawn: center, outer radius and the value pictures inside.
export function rings() {
  const tracks = shown().filter((w) => w.type === 'ARC' && w.props.start_angle === 0 && w.props.end_angle === 360)
  return tracks.map((t) => {
    const r = t.props.w / 2
    const cx = t.props.x + r
    const cy = t.props.y + r
    const values = imgs(/num\/(val|big)_/).filter((w) => Math.abs(w.props.x - cx) < r)
    return { cx, cy, r, inner: r - t.props.line_width, values, text: text(values) }
  })
}

// Plays one minute: the per-minute callbacks with a new time.
export function tick(now) {
  Object.assign(zos.now, now)
  zos.widgets.forEach((w) => (w.changed = false))
  zos.minute.forEach((fn) => fn())
  return zos.widgets.filter((w) => w.changed)
}
