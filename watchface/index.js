// ORBIT: digital watchface for the Bip 6 (390x450). Date and battery on top, hours white and minutes in
// the accent color, the weekday, the weather (icon, temperature, high and low of the day) and
// three rings. In the watchface editor the accent color, the content of each ring, the date style and
// the row under the time (weekday, location or nothing) can be chosen.
// All pictures come from tools/make_assets.py, their sizes and the accent colors from the generated sizes.js.
// Words that change rarely (date, battery, weekday or city, ring labels, AM/PM) are text in the Sora font;
// numbers that change often (time, ring values) and everything the system draws are pictures.
// lib/: layout.js (positions, ring contents), draw.js (widgets), lang.js (languages, numbers), editor.js.
import * as hmUI from '@zos/ui'
import { getLanguage, getTimeFormat, getDistanceUnit, TIME_FORMAT_12, DISTANCE_UNIT_IMPERIAL } from '@zos/settings'
import { getProfile } from '@zos/user'
import { SYSTEM_APP_STATUS, SYSTEM_APP_HR, SYSTEM_APP_WEATHER } from '@zos/router'
import {
  Time,
  Battery,
  Step,
  HeartRate,
  Calorie,
  Distance,
  Pai,
  Stand,
  BloodOxygen,
  Stress,
  Weather,
} from '@zos/sensor'
import { SIZES } from './sizes'
import * as L from './lib/layout'
import { KIND } from './lib/layout'
import {
  NORMAL,
  FONT,
  FONT_SB,
  TEXT_H,
  LIGHT,
  GRAY,
  RED,
  textW,
  digits,
  img,
  label,
  update,
  setText,
  show,
  numberRow,
  ring,
  tapArea,
  dataTap,
} from './lib/draw'
import { langOf, loadLang, chars, stepChars, distChars } from './lib/lang'
import { readEditor } from './lib/editor'

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
const CITY_EVERY = 3600000 // the city name is read again at most once an hour (ms)

function safeRead(fn, fallback = 0) {
  try {
    const v = fn()
    return typeof v === 'number' && !isNaN(v) ? v : fallback
  } catch (e) {
    return fallback
  }
}

WatchFace({
  onInit() {
    this.sensors = {}
    this.readSettings()
  },

  // language, 12/24-hour format and distance unit of the watch; a new language is read from its file
  readSettings() {
    let lang = 'en'
    try {
      lang = langOf(getLanguage())
    } catch (e) {}
    if (lang !== this.lang) {
      this.lang = lang
      this.f = loadLang(lang)
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

  build() {
    Object.assign(this, readEditor(this.f))
    const C = this.color

    // --- top row: date left, battery right ---
    const line = { y: L.TOP_Y, h: TEXT_H, text_size: 19, font: FONT }
    this.dateLabel = label({ ...line, x: L.SIDE, w: L.W - 2 * L.SIDE, color: LIGHT, char_space: L.DATE_TRACK })
    this.batIcon = img(0, L.TOP_Y + 3, `${C.dir}icon/bat_5.png`)
    this.batText = label({
      ...line,
      x: L.W - L.SIDE - 100,
      w: 100,
      align_h: hmUI.align.RIGHT,
      char_space: L.BAT_TRACK,
    })

    // --- time: tight digits drawn one by one, so a 1 leaves no gap ---
    this.timeH = numberRow('time_h', 2, L.TIME_Y, L.TIME_TRACK)
    this.timeM = numberRow('time_m', 2, L.TIME_Y, L.TIME_TRACK, C.dir)
    this.ampm = label({ x: 0, y: L.TIME_Y + 4, w: 40, h: 22, color: GRAY, text_size: 16, char_space: 1, font: FONT_SB })
    // always-on mode runs no JavaScript, there the system draws the time (digits in equal cells)
    const tw = SIZES.aod_h.w['0']
    const aodX = Math.round((L.W - 4 * tw - L.TIME_GAP) / 2)
    hmUI.createWidget(hmUI.widget.IMG_TIME, {
      hour_zero: 1,
      hour_startX: aodX,
      hour_startY: L.TIME_Y,
      hour_space: 0,
      hour_align: hmUI.align.LEFT,
      minute_zero: 1,
      minute_startX: aodX + 2 * tw + L.TIME_GAP,
      minute_startY: L.TIME_Y,
      minute_space: 0,
      minute_align: hmUI.align.LEFT,
      hour_array: digits('aod_h'),
      minute_array: digits('aod_m'),
      show_level: hmUI.show_level.ONLY_AOD,
    })

    // --- row under the time: weekday, city or nothing; without a city name the weekday stands in ---
    if (this.row !== 'empty') {
      this.rowText = label({
        x: 20,
        y: L.DAY_Y,
        w: 350,
        h: TEXT_H,
        color: GRAY,
        text_size: 19,
        font: FONT,
        align_h: hmUI.align.CENTER_H,
        text_style: hmUI.text_style.ELLIPSIS,
      })
    }

    // --- weather: bound to the system data, the system updates it ---
    // A white layer and an accent layer, both picked by the system from the weather index.
    const wx = SIZES.wx
    const layer = (path) =>
      hmUI.createWidget(hmUI.widget.IMG_LEVEL, {
        x: L.WX_X,
        y: L.WX_Y,
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
    const tempX = L.WX_X + wx.w + 10
    tempImg('temp', tempX, L.WX_Y + Math.round((wx.h - SIZES.temp.h) / 2), 80, hmUI.data_type.WEATHER_CURRENT)
    const hiloX = tempX + 80 + 4
    const hiloH = SIZES.hilo.h
    const hiloType = [hmUI.data_type.WEATHER_HIGH, hmUI.data_type.WEATHER_LOW]
    ;[L.WX_Y + 2, L.WX_Y + wx.h - hiloH - 2].forEach((y, i) => {
      img(hiloX, y + Math.round((hiloH - 8) / 2), i ? 'icon/down.png' : 'icon/up.png')
      tempImg('hilo', hiloX + 15, y, 60, hiloType[i])
    })
    tapArea(L.WX_X - 20, L.WX_Y - 6, L.W - 2 * (L.WX_X - 20), wx.h + 12, SYSTEM_APP_WEATHER)

    // --- rings: icon above the value, unit below; an empty ring draws nothing ---
    this.slots.forEach((s) => {
      if (s.kind === 'empty') return
      const h = SIZES[s.set].h
      const valY = L.RING_Y - Math.round((h - SIZES.val.h) / 2)
      const [iw, ih] = SIZES.icons[s.kind]
      s.arc = ring(s.x, L.RING_Y, s.r, C.hex)
      img(s.x - Math.round(iw / 2), valY - 6 - ih, `${C.dir}icon/${s.kind}.png`)
      s.value = numberRow(s.set, 6, valY, L.VAL_TRACK)
      s.unit = label({
        x: s.x - s.r,
        y: valY + h + 2,
        w: 2 * s.r,
        h: 16,
        color: GRAY,
        text_size: 11,
        char_space: 2,
        font: FONT_SB,
        align_h: hmUI.align.CENTER_H,
      })
      const app = s.kind === 'heart' ? SYSTEM_APP_HR : SYSTEM_APP_STATUS
      dataTap(s.x - s.r, L.RING_Y - s.r, 2 * s.r, 2 * s.r, KIND[s.kind].data, app)
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
    // the city name comes with the weather forecast; only read when the row shows it
    if (this.row === 'city') this.weather = new Weather()
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
    const onChange = (kind) => () => this.updateRings(kind)
    Object.keys(used).forEach((kind) => {
      if (kind === 'heart') {
        this.sensor(kind).onCurrentChange(onChange(kind))
        this.sensor(kind).onLastChange(onChange(kind))
      } else if (SENSOR[kind] && kind !== 'pai') {
        this.sensor(kind).onChange(onChange(kind))
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
    // a single hour digit ("1 58") gets more room, so it does not read as one number
    const gap = h.length === 1 ? L.TIME_GAP + 12 : L.TIME_GAP
    const left = Math.round((L.W - this.timeH.width(h) - gap - this.timeM.width(m)) / 2)
    this.timeH.draw(h, left)
    const mx = left + this.timeH.width(h) + gap
    this.timeM.draw(m, mx)
    if (this.h12) setText(this.ampm, hours < 12 ? 'AM' : 'PM', { x: mx + this.timeM.width(m) + L.AMPM_GAP })
    show(this.ampm, this.h12)
  },

  // The date in the style picked in the editor: the tokens of 'dates' in tools/langs.json
  // (e.g. ['d', '.', ' ', 'MONTH'] -> "26. OKTOBER"), with its letter spacing. What does not fit next to
  // the battery at 100 % gets the short month ("30 DE SEPT"), and if that is still too long, tighter letters.
  dateText() {
    const f = this.f
    const wd = (safeRead(() => this.time.getDay(), 1) + 6) % 7 // getDay: 1 = Monday ... 7 = Sunday
    const day = safeRead(() => this.time.getDate(), 1)
    const month = safeRead(() => this.time.getMonth(), 1)
    const year = safeRead(() => this.time.getFullYear(), 2026)
    const pad = (n) => String(n).padStart(2, '0')
    const words = {
      d: String(day),
      dd: pad(day),
      m: String(month),
      mm: pad(month),
      yyyy: String(year),
      MONTH: f.months[month - 1],
      MON: f.monthsShort[month - 1],
      WD: f.daysShort[wd],
    }
    const write = (tokens) => tokens.map((t) => (words[t] !== undefined ? words[t] : t)).join('')
    const tokens = f.dates[this.dateStyle] || f.dates[0]
    const full = write(tokens)
    const maxW = L.W - 2 * L.SIDE - textW('100%', L.BAT_TRACK) - L.BAT_GAP - SIZES.bat_icon.w - 14
    if (textW(full, L.DATE_TRACK) <= maxW) return { text: full, space: L.DATE_TRACK }
    const short = write(tokens.map((t) => (t === 'MONTH' ? 'MON' : t)))
    return { text: short, space: textW(short, L.DATE_TRACK) <= maxW ? L.DATE_TRACK : 1 }
  },

  updateDate() {
    const { text, space } = this.dateText()
    setText(this.dateLabel, text, { char_space: space })
  },

  // The city of the weather forecast: getForecast() of the Weather sensor (getForecastWeather() of the
  // docs does not exist on the watch). It holds the whole forecast, so it is read at most once an hour.
  cityName() {
    const now = safeRead(() => this.time.getTime(), 0)
    if (this.cityAt !== undefined && now - this.cityAt < CITY_EVERY && now >= this.cityAt) return this.city
    let city = ''
    try {
      city = String(this.weather.getForecast().cityName || '')
        .trim()
        .toUpperCase()
    } catch (e) {}
    // a missing name is asked for again on the next wake-up, a found one after an hour
    if (city) this.cityAt = now
    this.city = city
    return city
  },

  // Weekday or city; without a city name the weekday stands in.
  updateRow() {
    if (!this.rowText) return
    const city = this.weather ? this.cityName() : ''
    // long city names get less letter spacing, so more of them fits
    if (city) return setText(this.rowText, city, { char_space: city.length > 11 ? 2 : 8 })
    const wd = (safeRead(() => this.time.getDay(), 1) + 6) % 7
    setText(this.rowText, this.f.days[wd], { char_space: L.DAY_TRACK })
  },

  updateBattery() {
    const b = Math.max(
      0,
      Math.min(
        100,
        safeRead(() => this.battery.getCurrent(), 0),
      ),
    )
    const low = b < 5 // red
    const t = `${b}%`
    setText(this.batText, t, { color: low ? RED : this.color.hex })
    const bi = SIZES.bat_icon
    update(this.batIcon, {
      x: L.W - L.SIDE - textW(t, L.BAT_TRACK) - L.BAT_GAP - bi.w,
      y: L.TOP_Y + 3,
      w: bi.w,
      h: bi.h,
      src: low ? 'icon/bat_low.png' : `${this.color.dir}icon/bat_${Math.round(b / 20)}.png`,
    })
    this.updateRings('battery')
  },

  // Value and filling of one ring content: { items, part }. big: the larger middle ring.
  readRing(kind, big) {
    const f = this.f
    const read = (fn) => safeRead(() => fn(this.sensor(kind)), 0)
    switch (kind) {
      case 'step': {
        const cur = read((s) => s.getCurrent())
        return { items: stepChars(cur, f, big), part: cur / (read((s) => s.getTarget()) || 8000) }
      }
      case 'heart': {
        let v = read((s) => s.getCurrent())
        if (!v) v = read((s) => s.getLast())
        // filling by heart rate zone: empty at rest (40 % of the maximum), full at the maximum
        return { items: v > 0 ? chars(v, f, false) : [], part: (v / this.maxHr - 0.4) / 0.6 }
      }
      case 'cal': {
        const cur = read((s) => s.getCurrent())
        return { items: chars(cur, f, true), part: cur / (read((s) => s.getTarget()) || 300) }
      }
      case 'battery': {
        const b = safeRead(() => this.battery.getCurrent(), 0)
        return { items: chars(b, f, false), part: b / 100 }
      }
      case 'distance': {
        const m = read((s) => s.getCurrent()) // meters
        return { items: distChars(this.miles ? m / 1609.344 : m / 1000, f), part: m / 10000 }
      }
      case 'pai': {
        const p = read((s) => s.getTotal())
        return { items: chars(p, f, false), part: p / 100 }
      }
      case 'stand': {
        const cur = read((s) => s.getCurrent())
        return { items: chars(cur, f, false), part: cur / (read((s) => s.getTarget()) || 12) }
      }
      default: {
        // spo2, stress: { value }
        const v = read((s) => s.getCurrent().value)
        return { items: v > 0 ? chars(v, f, false) : [], part: v / 100 }
      }
    }
  },

  // the label under the value: the same short English words in every language
  unitText(kind) {
    if (kind === 'distance') return SIZES.units[this.miles ? 'mi' : 'km']
    return SIZES.units[kind]
  },

  // all rings, or only those showing kind
  updateRings(kind) {
    this.slots.forEach((s) => {
      if (s.kind === 'empty' || (kind && s.kind !== kind)) return
      const { items, part } = this.readRing(s.kind, s.set === 'big')
      s.value.draw(items, s.x, 'center')
      s.arc(part)
      setText(s.unit, this.unitText(s.kind))
    })
  },

  onDestroy() {},
})
