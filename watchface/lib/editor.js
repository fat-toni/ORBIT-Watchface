// The watchface editor: the editable areas and what the user picked in them.
import * as hmUI from '@zos/ui'
import { SIZES } from '../sizes'
import { W, SIDE, TOP_Y, TIME_Y, DAY_Y, RING_Y, SLOTS, KINDS, KIND } from './layout'

// Own editor types (the editor allows numbers from 100000 for these).
const COLOR_TYPE = 100001 // + index in SIZES.colors
const RING_EMPTY = 100100
const DATE_TYPE = 100201 // + date style 0-2, see 'dates' in tools/langs.json
const DATE_STYLES = 3
const ROW_TYPES = { day: 100301, city: 100302, empty: 100303 }

// Editable area; returns the type the user picked (or def). options: [{ type, preview, title }], title only
// for own types.
function editGroup(id, x, y, size, def, options, tipsBelow) {
  const [w, h] = SIZES.edit[size]
  const [tw, th] = SIZES.edit.tips
  try {
    const group = hmUI.createWidget(hmUI.widget.WATCHFACE_EDIT_GROUP, {
      edit_id: id,
      x,
      y,
      w,
      h,
      select_image: `edit/sel_${size}.png`,
      un_select_image: `edit/unsel_${size}.png`,
      default_type: def,
      optional_types: options.map(({ type, preview, title }) =>
        title ? { type, preview, title_en: title, title_sc: title, title_tc: title } : { type, preview },
      ),
      count: options.length,
      tips_BG: 'edit/tips.png',
      tips_x: Math.max(4, Math.min(W - tw - 4, Math.round(x + (w - tw) / 2))) - x, // inside the screen
      tips_y: tipsBelow ? h + 6 : -th - 6,
      tips_width: tw,
      tips_margin: 10,
    })
    const t = group.getProperty(hmUI.prop.CURRENT_TYPE)
    return options.some((o) => o.type === t) ? t : def
  } catch (e) {
    return def
  }
}

// Creates the editable areas with titles and previews of language f and returns what is picked:
// { color: { dir, hex }, slots: [SLOTS entry + kind], dateStyle: 0-2, row: 'day' | 'city' | 'empty' }.
export function readEditor(f) {
  const T = f.titles
  const et = hmUI.edit_type || {}

  const colors = SIZES.colors.map((c, i) => ({
    type: COLOR_TYPE + i,
    preview: `c/${c[0]}/edit.png`,
    title: T.colors[i],
  }))
  const ci = editGroup(101, 30, TIME_Y - 7, 'color', COLOR_TYPE, colors, true) - COLOR_TYPE
  const color = { dir: `c/${SIZES.colors[ci][0]}/`, hex: SIZES.colors[ci][1] }

  // ring contents; a type the firmware does not know is left out
  const slots =
    et.STEP === undefined
      ? SLOTS.map((s) => ({ ...s, kind: s.def }))
      : SLOTS.map((s) => {
          const [w, h] = SIZES.edit[s.size]
          const options = KINDS.filter((k) => KIND[k].own || et[KIND[k].edit] !== undefined).map((k) => ({
            type: KIND[k].own || et[KIND[k].edit],
            preview: `edit/${s.size}_${k}.png`,
            title: KIND[k].own ? T[k] : undefined,
            kind: k,
          }))
          options.push({ type: RING_EMPTY, preview: `edit/${s.size}_empty.png`, title: T.empty, kind: 'empty' })
          const def = options.find((o) => o.kind === s.def) || options[options.length - 1]
          const t = editGroup(s.id, s.x - w / 2, RING_Y - h / 2, s.size, def.type, options, false)
          return { ...s, kind: options.find((o) => o.type === t).kind }
        })

  const dates = []
  for (let i = 0; i < DATE_STYLES; i++)
    dates.push({ type: DATE_TYPE + i, preview: f.previews[`date_${i}`], title: T.dates[i] })
  const dateStyle = editGroup(106, SIDE - 10, TOP_Y - 6, 'date', DATE_TYPE, dates, true) - DATE_TYPE

  const rows = Object.keys(ROW_TYPES).map((k) => ({
    type: ROW_TYPES[k],
    preview: k === 'empty' ? 'edit/row_empty.png' : f.previews[`row_${k}`],
    title: T[k],
  }))
  const rt = editGroup(105, 55, DAY_Y - 7, 'row', ROW_TYPES.day, rows, true)
  const row = Object.keys(ROW_TYPES).find((k) => ROW_TYPES[k] === rt)

  return { color, slots, dateStyle, row }
}
