// What ORBIT costs: sensors only for what is shown, no timers, little work per minute.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build, imgs, tick, words, KINDS } from './face.mjs'

const zos = globalThis.zos
const SENSORS = ['step', 'heart', 'cal', 'distance', 'pai', 'stand', 'spo2', 'stress']

test('only the sensors of the rings that are shown', async () => {
  for (const kind of KINDS) {
    await build({ rings: [kind, 'empty', 'empty'] })
    const used = SENSORS.filter((s) => zos.sensors[s])
    assert.deepEqual(used, SENSORS.includes(kind) ? [kind] : [], kind)
    for (const s of used) assert.equal(zos.sensors[s], 1, `${s} created once`)
  }
  await build({ rings: ['step', 'step', 'step'] })
  assert.equal(zos.sensors.step, 1)
})

test('the weather sensor only for the location row, the city read again only when it changed', async () => {
  await build({ row: 'day' })
  assert.equal(zos.sensors.weather, undefined)
  await build({ row: 'city', city: 'Ulm' })
  assert.equal(zos.sensors.weather, 1)
  const before = zos.changes
  zos.widgets.find((w) => w.type === 'WIDGET_DELEGATE').props.resume_call()
  assert.equal(zos.changes - before, 0, 'same city: nothing redrawn')
})

test('values come by events, PAI without one is read on wake', async () => {
  await build({ rings: ['step', 'heart', 'pai'] })
  assert.ok(zos.listeners.step?.length)
  assert.ok(zos.listeners.heart?.length)
  assert.equal(zos.listeners.pai, undefined)
  zos.values.step = { current: 4321, target: 8000 }
  zos.listeners.step.forEach((fn) => fn())
  assert.ok(imgs(/num\/val_/).length > 0)
})

test('no timers: only the minute and day events of the watch', () => {
  const src = readFileSync(new URL('../watchface/index.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /setInterval|setTimeout|createTimer|@zos\/timer/)
})

test('only what changed is redrawn: a step, a minute, waking up', async () => {
  await build({ rings: ['cal', 'step', 'heart'], values: { step: { current: 8462, target: 8000 } } })
  let before = zos.changes
  zos.values.step = { current: 8463, target: 8000 }
  zos.listeners.step.forEach((fn) => fn())
  assert.equal(zos.changes - before, 1, 'one more step: one digit')
  before = zos.changes
  tick({ minutes: 9 })
  assert.equal(zos.changes - before, 1, '10:08 -> 10:09: one digit')
  before = zos.changes
  zos.widgets.find((w) => w.type === 'WIDGET_DELEGATE').props.resume_call()
  assert.equal(zos.changes - before, 0, 'waking up with nothing new')
})

test('one minute changes only the time pictures', async () => {
  await build({ rings: ['cal', 'step', 'heart'] })
  const before = zos.changes
  const changed = tick({ minutes: 9 })
  assert.ok(changed.length <= 5, `${changed.length} widgets changed`)
  for (const w of changed) assert.match(w.props.src, /num\/time_[hm]_/)
  assert.ok(zos.changes - before <= 10)
})

test('waking up reads the settings again: language and time format', async () => {
  const face = await build({ lang: 'en' })
  const resume = zos.widgets.find((w) => w.type === 'WIDGET_DELEGATE').props.resume_call
  zos.language = 7
  zos.hour12 = true
  zos.now.hours = 15
  resume()
  assert.equal(face.lang, 'de')
  assert.equal(words.row(), 'MONTAG')
  assert.equal(words.ampm(), 'PM')
})
