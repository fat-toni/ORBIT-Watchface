// ORBIT: digital watchface for the Bip 6 (390x450). Date and battery on top, hours white and minutes in
// the accent color, the weekday, the weather (icon, temperature, high and low of the day) and
// three rings. In the watchface editor the accent color, the content of each ring, the date style and
// the row under the time can be chosen.
// All pictures come from tools/make_assets.py, their sizes and the accent colors from the generated sizes.js.
import * as hmUI from '@zos/ui'
import { getLanguage, getTimeFormat, getDistanceUnit, TIME_FORMAT_12, DISTANCE_UNIT_IMPERIAL } from '@zos/settings'
import { getProfile } from '@zos/user'
import { launchApp, SYSTEM_APP_STATUS, SYSTEM_APP_HR, SYSTEM_APP_WEATHER } from '@zos/router'
import { Time, Battery, Step, HeartRate, Calorie, Distance, Pai, Stand, BloodOxygen, Stress } from '@zos/sensor'
import { SIZES } from './sizes'

const TRACK = 0x232b2b // ring background

// Layout, all in px of the 390x450 screen.
const SIDE = 34
const TOP_Y = 40
const DATE_TRACK = 3 // letter spacing of the date row, as in make_assets.py
const DATE_GAP = 6 // extra space between the words of the date
const TIME_Y = 98
const TIME_GAP = 22
const TIME_TRACK = 2 // space between the digits of hours and minutes
const AMPM_GAP = 8 // AM/PM right of the minutes, 12-hour format only
const DAY_Y = 200
const WX_Y = 240
const WX_X = 98 // weather icon; temperature and high/low follow to the right
const RING_LINE = 6
const RING_Y = 362 // all ring centers on one line
const VAL_TRACK = 1

// The three rings. x = center, r = radius, set = digit pictures of the value, def = content after
// installing, size = editor area and previews (see EDIT in make_assets.py).
const SLOTS = [
  { id: 102, x: 60, r: 48, set: 'val', size: 'ring_s', def: 'cal' },
  { id: 103, x: 195, r: 64, set: 'big', size: 'ring_b', def: 'step' },
  { id: 104, x: 330, r: 48, set: 'val', size: 'ring_s', def: 'heart' },
]

// Ring contents: unit label (txt/u_*.png) and the data type that opens the matching app on tap.
const KINDS = ['step', 'heart', 'cal', 'battery', 'distance', 'pai', 'stand', 'spo2', 'stress']
const KIND = {
  step: { edit: 'STEP', data: 'STEP' },
  heart: { edit: 'HEART', data: 'HEART' },
  cal: { edit: 'CAL', data: 'CAL' },
  battery: { edit: 'BATTERY', data: 'BATTERY' },
  distance: { edit: 'DISTANCE', data: 'DISTANCE' },
  pai: { edit: 'PAI', data: 'PAI_WEEKLY' },
  stand: { edit: 'STAND', data: 'STAND' },
  spo2: { edit: 'SPO2', data: 'SPO2' },
  stress: { edit: 'STRESS', data: 'STRESS' },
}
const SENSOR = {
  step: Step,
  heart: HeartRate,
  cal: Calorie,
  distance: Distance,
  pai: Pai,
  stand: Stand,
  spo2: BloodOxygen,
  stress: Stress,
}

// Own editor types (the editor allows numbers from 100000 for these).
const COLOR_TYPE = 100001 // + index in SIZES.colors
const RING_EMPTY = 100100
const DATE_TYPE = 100201 // + date style 0-3, see dateItems()
const DATE_STYLES = 4
const ROW_TYPES = { day: 100301, empty: 100303 } // 100302 was the city, the watch does not give it

const TITLES = {
  de: {
    colors: ['Mint', 'Eisblau', 'Bernstein', 'Rosé', 'Lavendel', 'Silber'],
    empty: 'Leer',
    dates: ['Datum lang', 'Mit Wochentag', 'Zahlen', 'Mit Kalenderwoche'],
    rows: { day: 'Wochentag', empty: 'Leer' },
  },
  en: {
    colors: ['Mint', 'Ice blue', 'Amber', 'Rose', 'Lavender', 'Silver'],
    empty: 'Empty',
    dates: ['Long date', 'With weekday', 'Numbers', 'With week number'],
    rows: { day: 'Weekday', empty: 'Empty' },
  },
}

// Zepp OS language codes, see "Multilingual Mapping" in the Zepp OS docs.
const SYSTEM = { 7: 'de' }

const NORMAL = { show_level: hmUI.show_level.ONLY_NORMAL }
const DAY_MS = 86400000

function digits(prefix) {
  const a = []
  for (let i = 0; i < 10; i++) a.push(`num/${prefix}_${i}.png`)
  return a
}

function img(x, y, src, extra) {
  return hmUI.createWidget(hmUI.widget.IMG, { x, y, src, ...NORMAL, ...extra })
}

function txtW(path) {
  return SIZES.txt[path] || 0
}

// A row of pictures drawn as separate IMG widgets. Items are glyph names of the set ('7', 'dot'),
// text pictures { src } or extra space { gap }. Each update sets position and picture of every slot,
// unused slots are hidden. dir puts the glyphs under c/<color>/.
function numberRow(set, slots, y, track = 0, dir = '') {
  const g = SIZES[set]
  const parts = []
  for (let i = 0; i < slots; i++) parts.push(img(0, y, `${dir}num/${set}_0.png`))
  const itemW = (c) => (typeof c === 'string' ? g.w[c] : c.gap !== undefined ? c.gap - track : txtW(c.src))
  const width = (items) => items.reduce((s, c) => s + itemW(c) + track, 0) - (items.length ? track : 0)
  return {
    width,
    // align: 'left' (x = left edge), 'center' (x = middle) or 'right' (x = right edge); returns the left edge.
    // base = path start of the glyphs of another set with the same sizes (e.g. the red 'num/batlow_')
    draw(items, x, align = 'left', base = `${dir}num/${set}_`) {
      const w = width(items)
      let cx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x
      const left = cx
      let i = 0
      items.forEach((c) => {
        const iw = itemW(c)
        if (typeof c === 'string' || c.src) {
          const src = typeof c === 'string' ? `${base}${c}.png` : c.src
          parts[i].setProperty(hmUI.prop.MORE, { x: cx, y, w: iw, h: g.h, src })
          parts[i++].setProperty(hmUI.prop.VISIBLE, true)
        }
        cx += iw + track
      })
      for (; i < slots; i++) parts[i].setProperty(hmUI.prop.VISIBLE, false)
      return left
    },
  }
}

// "8462" -> ['8', 'dot', '4', '6', '2'] in German; English gets no separator.
function chars(n, lang, group) {
  const s = String(Math.max(0, Math.round(n)))
  const t = group && lang === 'de' ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s
  return t.split('').map((c) => (c === '.' ? 'dot' : c))
}

// Steps: up to 99999 in full ("12.345"), from 100000 short ("123k").
function stepChars(n, lang) {
  if (n < 100000) return chars(n, lang, true)
  return [...String(Math.floor(n / 1000)).split(''), 'k']
}

// Distance with one decimal ("3,4"), from 100 without.
function distChars(d, lang) {
  if (d >= 100) return chars(d, lang, false)
  const t = Math.floor(d * 10)
  return [...String(Math.floor(t / 10)).split(''), lang === 'de' ? 'comma' : 'dot', String(t % 10)]
}

// ISO calendar week (weeks start on Monday, week 1 holds the first Thursday of the year).
function isoWeek(year, month, day) {
  const t = Date.UTC(year, month - 1, day)
  const thu = t + (3 - ((new Date(t).getUTCDay() + 6) % 7)) * DAY_MS
  return 1 + Math.floor((thu - Date.UTC(new Date(thu).getUTCFullYear(), 0, 1)) / (7 * DAY_MS))
}

// Ring: dark track plus an arc in the accent color from the top, clockwise.
function ring(cx, cy, r, color) {
  const box = { x: cx - r, y: cy - r, w: r * 2, h: r * 2, line_width: RING_LINE, ...NORMAL }
  hmUI.createWidget(hmUI.widget.ARC, { ...box, start_angle: 0, end_angle: 360, color: TRACK })
  const arc = hmUI.createWidget(hmUI.widget.ARC, { ...box, start_angle: -90, end_angle: -90, color })
  return (part) => {
    const p = Math.max(0, Math.min(1, part))
    arc.setProperty(hmUI.prop.MORE, { ...box, start_angle: -90, end_angle: -90 + Math.round(360 * p), color })
    arc.setProperty(hmUI.prop.VISIBLE, p > 0)
  }
}

// Invisible tap area that opens a system app.
function tapArea(x, y, w, h, appId) {
  const hit = img(x, y, 'icon/hit.png', { w, h })
  hit.addEventListener(hmUI.event.CLICK_UP, () => {
    try {
      launchApp({ appId, native: true })
    } catch (e) {}
  })
}

// Tap area that opens the system app of a data type (steps, SpO2, ...).
function dataTap(x, y, w, h, kind) {
  try {
    hmUI.createWidget(hmUI.widget.IMG_CLICK, { x, y, w, h, src: 'icon/hit.png', type: hmUI.data_type[KIND[kind].data] })
  } catch (e) {
    tapArea(x, y, w, h, kind === 'heart' ? SYSTEM_APP_HR : SYSTEM_APP_STATUS)
  }
}

function safeRead(fn, fallback = 0) {
  try {
    const v = fn()
    return typeof v === 'number' && !isNaN(v) ? v : fallback
  } catch (e) {
    return fallback
  }
}

// Editable area of the watchface editor; returns the type the user picked (or def).
// options: [{ type, preview, title }], title only for own types.
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
      tips_x: Math.max(4, Math.min(390 - tw - 4, Math.round(x + (w - tw) / 2))) - x, // inside the screen
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

WatchFace({
  onInit() {
    this.readSettings()
    this.sensors = {}
  },

  // language, 12/24-hour format and distance unit of the watch
  readSettings() {
    try {
      this.lang = SYSTEM[getLanguage()] || 'en'
    } catch (e) {
      this.lang = 'en'
    }
    try {
      this.h12 = getTimeFormat() === TIME_FORMAT_12
    } catch (e) {
      this.h12 = false
    }
    try {
      this.miles = getDistanceUnit() === DISTANCE_UNIT_IMPERIAL
    } catch (e) {
      this.miles = false
    }
  },

  sensor(kind) {
    if (!this.sensors[kind]) this.sensors[kind] = new SENSOR[kind]()
    return this.sensors[kind]
  },

  // --- watchface editor: what the user picked ---
  readEditor() {
    const L = this.lang
    const T = TITLES[L]
    const et = hmUI.edit_type || {}

    const colors = SIZES.colors.map((c, i) => ({
      type: COLOR_TYPE + i,
      preview: `c/${c[0]}/edit.png`,
      title: T.colors[i],
    }))
    const ci = editGroup(101, 30, TIME_Y - 7, 'color', COLOR_TYPE, colors, true) - COLOR_TYPE
    this.color = { dir: `c/${SIZES.colors[ci][0]}/`, hex: SIZES.colors[ci][1] }

    // ring contents; a type the firmware does not know is left out
    if (et.STEP === undefined) {
      this.slots = SLOTS.map((s) => ({ ...s, kind: s.def }))
    } else
      this.slots = SLOTS.map((s) => {
        const [w, h] = SIZES.edit[s.size]
        const options = KINDS.filter((k) => et[KIND[k].edit] !== undefined).map((k) => ({
          type: et[KIND[k].edit],
          preview: `edit/${s.size}_${k}.png`,
          kind: k,
        }))
        options.push({ type: RING_EMPTY, preview: `edit/${s.size}_empty.png`, title: T.empty, kind: 'empty' })
        const def = options.find((o) => o.kind === s.def) || options[options.length - 1]
        const t = editGroup(s.id, s.x - w / 2, RING_Y - h / 2, s.size, def.type, options, false)
        return { ...s, kind: options.find((o) => o.type === t).kind }
      })

    const dates = []
    for (let i = 0; i < DATE_STYLES; i++) {
      dates.push({ type: DATE_TYPE + i, preview: `edit/${L}/date_${i}.png`, title: T.dates[i] })
    }
    this.dateStyle = editGroup(106, SIDE - 10, TOP_Y - 6, 'date', DATE_TYPE, dates, true) - DATE_TYPE

    const rows = Object.keys(ROW_TYPES).map((k) => ({
      type: ROW_TYPES[k],
      preview: `edit/${L}/row_${k}.png`,
      title: T.rows[k],
    }))
    const rt = editGroup(105, 55, DAY_Y - 7, 'row', ROW_TYPES.day, rows, true)
    this.row = Object.keys(ROW_TYPES).find((k) => ROW_TYPES[k] === rt)
  },

  build() {
    this.readEditor()
    const L = this.lang
    const C = this.color

    // --- top row: date left, battery right ---
    this.dateRow = numberRow('date', 10, TOP_Y, DATE_TRACK)
    this.batIcon = img(0, TOP_Y + 3, `${C.dir}icon/bat_5.png`)
    this.batText = numberRow('bat', 4, TOP_Y, 1, C.dir)

    // --- time: tight digits drawn one by one, so a 1 leaves no gap ---
    this.timeH = numberRow('time_h', 2, TIME_Y, TIME_TRACK)
    this.timeM = numberRow('time_m', 2, TIME_Y, TIME_TRACK, C.dir)
    this.ampm = img(0, TIME_Y, 'txt/am.png')
    // always-on mode runs no JavaScript, there the system draws the time (digits in equal cells)
    const tw = SIZES.aod_h.w['0']
    const aodX = Math.round((390 - 4 * tw - TIME_GAP) / 2)
    hmUI.createWidget(hmUI.widget.IMG_TIME, {
      hour_zero: 1,
      hour_startX: aodX,
      hour_startY: TIME_Y,
      hour_space: 0,
      hour_align: hmUI.align.LEFT,
      minute_zero: 1,
      minute_startX: aodX + 2 * tw + TIME_GAP,
      minute_startY: TIME_Y,
      minute_space: 0,
      minute_align: hmUI.align.LEFT,
      hour_array: digits('aod_h'),
      minute_array: digits('aod_m'),
      show_level: hmUI.show_level.ONLY_AOD,
    })

    // --- row under the time: weekday or nothing ---
    if (this.row !== 'empty') this.dayLong = img(0, DAY_Y, `txt/${L}/day_0.png`)

    // --- weather: bound to the system data, the system updates it ---
    // A white layer and an accent layer, both picked by the system from the weather index.
    const wx = SIZES.wx
    const layer = (path) =>
      hmUI.createWidget(hmUI.widget.IMG_LEVEL, {
        x: WX_X,
        y: WX_Y,
        image_array: wx.kinds.map(path),
        image_length: wx.n,
        type: hmUI.data_type.WEATHER_CURRENT,
        ...NORMAL,
      })
    layer((k) => `wx/${k}.png`)
    layer((k) => (wx.acc[k] ? `${C.dir}wx/${k}.png` : 'wx/empty.png'))
    // TEXT_IMG with a system temperature; without weather data it shows "--"
    const tempImg = (set, x, y, w, type) =>
      hmUI.createWidget(hmUI.widget.TEXT_IMG, {
        x,
        y,
        w,
        h: SIZES[set].h,
        font_array: digits(set),
        type,
        negative_image: `num/${set}_minus.png`,
        invalid_image: `num/${set}_none.png`,
        unit_en: `num/${set}_deg.png`,
        unit_sc: `num/${set}_deg.png`,
        unit_tc: `num/${set}_deg.png`,
        align_h: hmUI.align.LEFT,
        h_space: 1,
        ...NORMAL,
      })
    const tempX = WX_X + wx.w + 10
    tempImg('temp', tempX, WX_Y + Math.round((wx.h - SIZES.temp.h) / 2), 80, hmUI.data_type.WEATHER_CURRENT)
    const hiloX = tempX + 80 + 4
    const hiloH = SIZES.hilo.h
    const hiloType = [hmUI.data_type.WEATHER_HIGH, hmUI.data_type.WEATHER_LOW]
    ;[WX_Y + 2, WX_Y + wx.h - hiloH - 2].forEach((y, i) => {
      img(hiloX, y + Math.round((hiloH - 8) / 2), i ? 'icon/down.png' : 'icon/up.png')
      tempImg('hilo', hiloX + 15, y, 60, hiloType[i])
    })
    tapArea(WX_X - 20, WX_Y - 6, 390 - 2 * (WX_X - 20), wx.h + 12, SYSTEM_APP_WEATHER)

    // --- rings: icon above the value, unit below; an empty ring draws nothing ---
    this.slots.forEach((s) => {
      if (s.kind === 'empty') return
      const h = SIZES[s.set].h
      const valY = RING_Y - Math.round((h - SIZES.val.h) / 2)
      const [iw, ih] = SIZES.icons[s.kind]
      s.arc = ring(s.x, RING_Y, s.r, C.hex)
      img(s.x - Math.round(iw / 2), valY - 6 - ih, `${C.dir}icon/${s.kind}.png`)
      s.value = numberRow(s.set, 6, valY, VAL_TRACK)
      s.unitY = valY + h + 3
      s.unit = img(s.x, s.unitY, this.unitSrc(s.kind))
      dataTap(s.x - s.r, RING_Y - s.r, 2 * s.r, 2 * s.r, s.kind)
    })

    this.startSensors()
    // after the screen was off, everything drawn here is read again; the settings too, since the
    // watch keeps the watchface running when they are changed
    hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, {
      resume_call: () => {
        this.readSettings()
        this.updateAll()
      },
    })
  },

  startSensors() {
    this.time = new Time()
    this.battery = new Battery()
    try {
      this.maxHr = 220 - (getProfile().age || 35)
    } catch (e) {
      this.maxHr = 185
    }

    this.updateAll()

    this.time.onPerMinute(() => this.updateTime())
    this.time.onPerDay(() => {
      this.updateDate()
      this.updateRow()
    })
    this.battery.onChange(() => this.updateBattery())
    // only the sensors of the rings that are shown; PAI has no change event and is read on wake
    const used = {}
    this.slots.forEach((s) => (used[s.kind] = true))
    const update = (kind) => () => this.updateRings(kind)
    Object.keys(used).forEach((kind) => {
      if (kind === 'heart') {
        this.sensor(kind).onCurrentChange(update(kind))
        this.sensor(kind).onLastChange(update(kind))
      } else if (SENSOR[kind] && kind !== 'pai') {
        this.sensor(kind).onChange(update(kind))
      }
    })
  },

  updateAll() {
    this.updateTime()
    this.updateDate()
    this.updateRow()
    this.updateBattery()
    this.updateRings()
  },

  updateTime() {
    const two = (n) => String(n).padStart(2, '0').split('')
    const hours = safeRead(() => this.time.getHours(), 0)
    // 12-hour format: "9 15" without a leading zero, AM/PM next to it
    const h = this.h12 ? String(hours % 12 || 12).split('') : two(hours)
    const m = two(safeRead(() => this.time.getMinutes(), 0))
    const left = Math.round((390 - this.timeH.width(h) - TIME_GAP - this.timeM.width(m)) / 2)
    this.timeH.draw(h, left)
    const mx = left + this.timeH.width(h) + TIME_GAP
    this.timeM.draw(m, mx)
    if (this.h12) {
      const src = hours < 12 ? 'txt/am.png' : 'txt/pm.png'
      const x = mx + this.timeM.width(m) + AMPM_GAP
      this.ampm.setProperty(hmUI.prop.MORE, { x, y: TIME_Y + 6, w: txtW(src), h: SIZES.ampm.h, src })
    }
    this.ampm.setProperty(hmUI.prop.VISIBLE, this.h12)
  },

  // Date styles of the editor (previews in make_assets.py, date_text()):
  // 0 "26. OKTOBER", 1 "MO 26. OKT", 2 "26.10.2026", 3 "26. OKT · KW 44"; English "26 OCTOBER", "MON 26 OCT",
  // "10/26/2026", "26 OCT · WK 44".
  dateItems() {
    const L = this.lang
    const de = L === 'de'
    const wd = (safeRead(() => this.time.getDay(), 1) + 6) % 7 // getDay: 1 = Monday ... 7 = Sunday
    const day = safeRead(() => this.time.getDate(), 1)
    const month = safeRead(() => this.time.getMonth(), 1)
    const year = safeRead(() => this.time.getFullYear(), 2026)
    const num = (n, pad) => String(n).padStart(pad, '0').split('')
    const dayChars = de ? [...num(day, 1), 'dot'] : num(day, 1)
    const gap = { gap: DATE_GAP }
    const txt = (name) => ({ src: `txt/${L}/${name}.png` })
    switch (this.dateStyle) {
      case 1:
        return [txt(`wd_${wd}`), gap, ...dayChars, gap, txt(`mons_${month - 1}`)]
      case 2:
        return de
          ? [...num(day, 2), 'dot', ...num(month, 2), 'dot', ...num(year, 4)]
          : [...num(month, 1), 'slash', ...num(day, 1), 'slash', ...num(year, 4)]
      case 3:
        return [
          ...dayChars,
          gap,
          txt(`mons_${month - 1}`),
          gap,
          'mid',
          gap,
          txt('kw'),
          gap,
          ...num(isoWeek(year, month, day), 1),
        ]
      default:
        return [...dayChars, gap, txt(`mon_${month - 1}`)]
    }
  },

  updateDate() {
    this.dateRow.draw(this.dateItems(), SIDE)
  },

  updateRow() {
    if (!this.dayLong) return
    const wd = (safeRead(() => this.time.getDay(), 1) + 6) % 7
    const src = `txt/${this.lang}/day_${wd}.png`
    const dw = txtW(src)
    this.dayLong.setProperty(hmUI.prop.MORE, { x: Math.round((390 - dw) / 2), y: DAY_Y, w: dw, h: 26, src })
  },

  updateBattery() {
    const b = Math.max(
      0,
      Math.min(
        100,
        safeRead(() => this.battery.getCurrent(), 0),
      ),
    )
    const low = b < 5 // red, the red pictures only exist for 0-4 %
    const items = [...chars(b, 'en', false), 'pct']
    const left = this.batText.draw(items, 390 - SIDE, 'right', low ? 'num/batlow_' : undefined)
    const bi = SIZES.bat_icon
    this.batIcon.setProperty(hmUI.prop.MORE, {
      x: left - 9 - bi.w,
      y: TOP_Y + 3,
      w: bi.w,
      h: bi.h,
      src: low ? 'icon/bat_low.png' : `${this.color.dir}icon/bat_${Math.round(b / 20)}.png`,
    })
    this.updateRings('battery')
  },

  // Value and filling of one ring content: { items, part }.
  readRing(kind) {
    const L = this.lang
    const read = (fn) => safeRead(() => fn(this.sensor(kind)), 0)
    switch (kind) {
      case 'step': {
        const cur = read((s) => s.getCurrent())
        return { items: stepChars(cur, L), part: cur / (read((s) => s.getTarget()) || 8000) }
      }
      case 'heart': {
        let v = read((s) => s.getCurrent())
        if (!v) v = read((s) => s.getLast())
        // filling by heart rate zone: empty at rest (40 % of the maximum), full at the maximum
        return { items: v > 0 ? chars(v, 'en', false) : [], part: (v / this.maxHr - 0.4) / 0.6 }
      }
      case 'cal': {
        const cur = read((s) => s.getCurrent())
        return { items: chars(cur, L, true), part: cur / (read((s) => s.getTarget()) || 300) }
      }
      case 'battery': {
        const b = safeRead(() => this.battery.getCurrent(), 0)
        return { items: chars(b, 'en', false), part: b / 100 }
      }
      case 'distance': {
        const m = read((s) => s.getCurrent()) // meters
        return { items: distChars(this.miles ? m / 1609.344 : m / 1000, L), part: m / 10000 }
      }
      case 'pai': {
        const p = read((s) => s.getTotal())
        return { items: chars(p, 'en', false), part: p / 100 }
      }
      case 'stand': {
        const cur = read((s) => s.getCurrent())
        return { items: chars(cur, 'en', false), part: cur / (read((s) => s.getTarget()) || 12) }
      }
      default: {
        // spo2, stress: { value }
        const v = read((s) => s.getCurrent().value)
        return { items: v > 0 ? chars(v, 'en', false) : [], part: v / 100 }
      }
    }
  },

  unitSrc(kind) {
    if (kind === 'distance') return this.miles ? 'txt/u_mi.png' : 'txt/u_km.png'
    return `txt/u_${kind}.png`
  },

  // all rings, or only those showing kind
  updateRings(kind) {
    this.slots.forEach((s) => {
      if (s.kind === 'empty' || (kind && s.kind !== kind)) return
      const { items, part } = this.readRing(s.kind)
      s.value.draw(items, s.x, 'center')
      s.arc(part)
      const unit = this.unitSrc(s.kind)
      const uw = txtW(unit)
      s.unit.setProperty(hmUI.prop.MORE, { x: s.x - Math.round(uw / 2), y: s.unitY, w: uw, h: SIZES.unit_h, src: unit })
    })
  },

  onDestroy() {},
})
