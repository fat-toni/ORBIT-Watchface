import { readFileSync, statSync } from 'node:fs'

// Stand-in for every @zos module in Node tests: a simulated Bip 6. The watchface draws into
// zos.widgets; time, sensors, settings and the editor choices come from zos and can be set by a
// test before the watchface is built (see test/face.mjs). Every sensor that is created and every
// change to a widget is counted, so tests can check what the watchface costs.
const zos = (globalThis.zos = globalThis.zos || {})

export function resetZos() {
  Object.assign(zos, {
    widgets: [],
    face: null, // the object given to WatchFace()
    language: 2, // Zepp code: 2 = English, 7 = German
    hour12: false,
    imperial: false,
    age: 40,
    // Monday, 26 October 2026, 10:08; day: 1 = Monday ... 7 = Sunday
    now: { year: 2026, month: 10, date: 26, day: 1, hours: 10, minutes: 8 },
    values: {
      battery: 88,
      step: { current: 8462, target: 8000 },
      heart: { current: 75, last: 70 },
      cal: { current: 312, target: 300 },
      distance: 3456, // meters
      pai: 64,
      stand: { current: 7, target: 12 },
      spo2: 98,
      stress: 34,
    },
    city: 'Ulm', // city name of the weather forecast ('' = none)
    forecasts: 0, // how often the whole forecast was read
    clock: 1793000000000, // ms, Time.getTime()
    files: [], // asset files read
    edit: {}, // edit_id -> type the user picked in the watchface editor
    noEditTypes: false, // a firmware without hmUI.edit_type
    sensors: {}, // sensor name -> how many were created
    listeners: {}, // sensor name -> change callbacks
    minute: [], // onPerMinute callbacks
    day: [], // onPerDay callbacks
    changes: 0, // setProperty calls
  })
}
resetZos()

// ---- @zos/ui ----
export const widget = {
  IMG: 'IMG',
  TEXT: 'TEXT',
  ARC: 'ARC',
  IMG_TIME: 'IMG_TIME',
  IMG_LEVEL: 'IMG_LEVEL',
  TEXT_IMG: 'TEXT_IMG',
  IMG_CLICK: 'IMG_CLICK',
  WIDGET_DELEGATE: 'WIDGET_DELEGATE',
  WATCHFACE_EDIT_GROUP: 'WATCHFACE_EDIT_GROUP',
  WATCHFACE_EDIT_MASK: 'WATCHFACE_EDIT_MASK',
  WATCHFACE_EDIT_FG_MASK: 'WATCHFACE_EDIT_FG_MASK',
}
export const prop = { MORE: 'more', VISIBLE: 'visible', TEXT: 'text', CURRENT_TYPE: 'current_type' }
export const align = { LEFT: 0, CENTER_H: 1, RIGHT: 2, CENTER_V: 3 }
export const text_style = { NONE: 0, WRAP: 1, ELLIPSIS: 2 }
export const event = { CLICK_DOWN: 'down', CLICK_UP: 'up' }
export const show_level = { ONLY_NORMAL: 1, ONLY_AOD: 2, ONLY_EDIT: 4 }
const KINDS = ['STEP', 'HEART', 'CAL', 'BATTERY', 'DISTANCE', 'PAI', 'STAND', 'SPO2', 'STRESS']
export const data_type = Object.fromEntries(
  [...KINDS, 'PAI_WEEKLY', 'WEATHER_CURRENT', 'WEATHER_HIGH', 'WEATHER_LOW'].map((k, i) => [k, i + 1]),
)
const editTypes = Object.fromEntries(KINDS.map((k, i) => [k, 200 + i]))
// hmUI.edit_type, missing on a firmware without it (zos.noEditTypes)
export const edit_type = new Proxy(editTypes, { get: (t, k) => (zos.noEditTypes ? undefined : t[k]) })

export function createWidget(type, props = {}) {
  if (!Object.values(widget).includes(type)) throw new Error(`unknown widget ${type}`)
  const w = {
    type,
    props: { ...props },
    visible: true,
    on: {},
    setProperty(p, v) {
      zos.changes++
      w.changed = true
      if (p === prop.MORE) Object.assign(w.props, v)
      else if (p === prop.VISIBLE) w.visible = !!v
      else if (p === prop.TEXT) w.props.text = v
      else throw new Error(`setProperty ${p}`)
    },
    getProperty(p) {
      if (p !== prop.CURRENT_TYPE) throw new Error(`getProperty ${p}`)
      return props.edit_id in zos.edit ? zos.edit[props.edit_id] : props.default_type
    },
    addEventListener(name, fn) {
      w.on[name] = fn
    },
  }
  zos.widgets.push(w)
  return w
}

// ---- @zos/settings ----
export const TIME_FORMAT_12 = 12
export const TIME_FORMAT_24 = 24
export const DISTANCE_UNIT_METRIC = 0
export const DISTANCE_UNIT_IMPERIAL = 1
export const getLanguage = () => zos.language
export const getTimeFormat = () => (zos.hour12 ? TIME_FORMAT_12 : TIME_FORMAT_24)
export const getDistanceUnit = () => (zos.imperial ? DISTANCE_UNIT_IMPERIAL : DISTANCE_UNIT_METRIC)

// ---- @zos/user ----
export const getProfile = () => ({ age: zos.age, gender: 0 })

// ---- @zos/router ----
export const SYSTEM_APP_STATUS = 'status'
export const SYSTEM_APP_HR = 'hr'
export const SYSTEM_APP_WEATHER = 'weather'
export const launchApp = (o) => (zos.launched = o)

// ---- @zos/sensor ----
function sensor(name) {
  zos.sensors[name] = (zos.sensors[name] || 0) + 1
  return (fn) => (zos.listeners[name] = zos.listeners[name] || []).push(fn)
}
export class Time {
  constructor() {
    sensor('time')
  }
  getFullYear() {
    return zos.now.year
  }
  getMonth() {
    return zos.now.month
  }
  getDate() {
    return zos.now.date
  }
  getDay() {
    return zos.now.day
  }
  getHours() {
    return zos.now.hours
  }
  getTime() {
    return zos.clock
  }
  getMinutes() {
    return zos.now.minutes
  }
  onPerMinute(fn) {
    zos.minute.push(fn)
  }
  onPerDay(fn) {
    zos.day.push(fn)
  }
}
export class Battery {
  constructor() {
    this.onChange = sensor('battery')
  }
  getCurrent() {
    return zos.values.battery
  }
}
export class Step {
  constructor() {
    this.onChange = sensor('step')
  }
  getCurrent() {
    return zos.values.step.current
  }
  getTarget() {
    return zos.values.step.target
  }
}
export class Calorie {
  constructor() {
    this.onChange = sensor('cal')
  }
  getCurrent() {
    return zos.values.cal.current
  }
  getTarget() {
    return zos.values.cal.target
  }
}
export class HeartRate {
  constructor() {
    const on = sensor('heart')
    this.onCurrentChange = on
    this.onLastChange = on
  }
  getCurrent() {
    return zos.values.heart.current
  }
  getLast() {
    return zos.values.heart.last
  }
}
export class Distance {
  constructor() {
    this.onChange = sensor('distance')
  }
  getCurrent() {
    return zos.values.distance
  }
}
export class Pai {
  constructor() {
    sensor('pai')
  }
  getTotal() {
    return zos.values.pai
  }
}
export class Stand {
  constructor() {
    this.onChange = sensor('stand')
  }
  getCurrent() {
    return zos.values.stand.current
  }
  getTarget() {
    return zos.values.stand.target
  }
}
export class BloodOxygen {
  constructor() {
    this.onChange = sensor('spo2')
  }
  getCurrent() {
    return { value: zos.values.spo2, time: 0, retCode: 0 }
  }
}
export class Stress {
  constructor() {
    this.onChange = sensor('stress')
  }
  getCurrent() {
    return { value: zos.values.stress, time: 0 }
  }
}

// Like on the Bip 6: getForecast() exists, getForecastWeather() of the docs does not.
export class Weather {
  constructor() {
    sensor('weather')
  }
  getForecast() {
    zos.forecasts++
    return { cityName: zos.city, forecastData: { data: [], count: 0 }, tideData: { data: [], count: 0 } }
  }
}

// ---- @zos/fs: the assets of the watchface ----
const ASSETS = new URL('../../assets/default.w390-s/', import.meta.url).pathname
const open = new Map()
export const O_RDONLY = 0
export const statAssetsSync = ({ path }) => ({ size: statSync(ASSETS + path).size })
export function openAssetsSync({ path }) {
  zos.files.push(path)
  const fd = open.size + 3
  open.set(fd, readFileSync(ASSETS + path))
  return fd
}
export function readSync({ fd, buffer }) {
  const data = open.get(fd)
  new Uint8Array(buffer).set(data)
  return data.length
}
export const closeSync = (fd) => open.delete(typeof fd === 'object' ? fd.fd : fd)

// The watchface registers itself with this global, like on the watch.
globalThis.WatchFace = (face) => (zos.face = face)
