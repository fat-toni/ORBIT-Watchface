// What the watchface writes: time, date, battery and the ring values in both languages.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build, imgs, text, rings, tick } from './face.mjs'

const time = () => text(imgs(/num\/time_[hm]_/))
const date = () => text(imgs(/num\/date_|txt\/(de|en)\/(mon|mons|wd|kw)/))
const ringText = (i) => rings()[i].text

test('time: 24-hour with leading zero, 12-hour without, AM/PM only in the 12-hour format', async () => {
  await build({ now: { hours: 9, minutes: 5 } })
  assert.equal(time(), '0905')
  assert.equal(imgs(/txt\/(am|pm)\.png/).length, 0)
  await build({ hour12: true, now: { hours: 0, minutes: 30 } })
  assert.equal(time(), '1230')
  assert.equal(text(imgs(/txt\/(am|pm)\.png/)), '[am]')
  await build({ hour12: true, now: { hours: 13, minutes: 7 } })
  assert.equal(time(), '107')
  assert.equal(text(imgs(/txt\/(am|pm)\.png/)), '[pm]')
  await build({ hour12: true, now: { hours: 12, minutes: 0 } })
  assert.equal(time(), '1200')
  assert.equal(text(imgs(/txt\/(am|pm)\.png/)), '[pm]')
})

test('the time is centered', async () => {
  for (const hours of [1, 10, 11, 20]) {
    await build({ now: { hours, minutes: 11 } })
    const digits = imgs(/num\/time_[hm]_/)
    const left = Math.min(...digits.map((w) => w.props.x))
    const right = Math.max(...digits.map((w) => w.props.x + w.props.w))
    assert.ok(Math.abs(left - (390 - right)) <= 1, `${hours}:11 from ${left} to ${right}`)
  }
})

test('date styles in German and English', async () => {
  const want = {
    de: ['26.[mon_9]', '[wd_0]26.[mons_9]', '26.10.2026', '26.[mons_9]·[kw]44'],
    en: ['26[mon_9]', '[wd_0]26[mons_9]', '10/26/2026', '26[mons_9]·[kw]44'],
  }
  for (const lang of ['de', 'en'])
    for (let style = 0; style < 4; style++) {
      await build({ lang, date: style })
      assert.equal(date(), want[lang][style], `${lang} style ${style}`)
    }
  await build({ lang: 'de', date: 2, now: { year: 2026, month: 3, date: 5, day: 4 } })
  assert.equal(date(), '05.03.2026')
})

test('calendar week by ISO 8601, also around the turn of the year', async () => {
  const cases = [
    [{ year: 2026, month: 12, date: 31, day: 4 }, '53'],
    [{ year: 2027, month: 1, date: 1, day: 5 }, '53'],
    [{ year: 2027, month: 1, date: 4, day: 1 }, '1'],
    [{ year: 2025, month: 12, date: 29, day: 1 }, '1'],
    [{ year: 2026, month: 1, date: 1, day: 4 }, '1'],
    [{ year: 2024, month: 12, date: 30, day: 1 }, '1'],
  ]
  for (const [now, week] of cases) {
    await build({ lang: 'de', date: 3, now })
    assert.equal(date().split('[kw]')[1], week, JSON.stringify(now))
  }
})

test('weekday row or nothing', async () => {
  await build({ lang: 'de', now: { day: 7 } })
  assert.equal(text(imgs(/txt\/de\/day_/)), '[day_6]')
  await build({ row: 'empty' })
  assert.equal(imgs(/txt\/(de|en)\/day_/).length, 0)
})

test('battery: accent color, red below 5 %', async () => {
  await build({ color: 2, values: { battery: 5 } })
  assert.equal(text(imgs(/num\/bat_/)), '5%')
  assert.ok(imgs(/^c\/amber\/icon\/bat_0\.png$/).length === 1)
  await build({ color: 2, values: { battery: 4 } })
  assert.equal(text(imgs(/num\/batlow_/)), '4%')
  assert.equal(imgs(/^icon\/bat_low\.png$/).length, 1)
  await build({ values: { battery: 100 } })
  assert.equal(text(imgs(/num\/bat_/)), '100%')
  assert.equal(imgs(/^c\/mint\/icon\/bat_5\.png$/).length, 1)
})

test('ring values in German and English', async () => {
  const cases = [
    ['step', { step: { current: 8462, target: 8000 } }, '8.462', '8462'],
    ['step', { step: { current: 99999, target: 8000 } }, '99.999', '99999'],
    ['step', { step: { current: 123456, target: 8000 } }, '123k', '123k'],

    ['cal', { cal: { current: 1234, target: 300 } }, '1.234', '1234'],
    ['heart', { heart: { current: 0, last: 64 } }, '64', '64'],
    ['heart', { heart: { current: 0, last: 0 } }, '', ''],
    ['battery', { battery: 7 }, '7', '7'],
    ['distance', { distance: 3456 }, '3,4', '3.4'],
    ['distance', { distance: 123456 }, '123', '123'],
    ['pai', { pai: 105 }, '105', '105'],
    ['stand', { stand: { current: 12, target: 12 } }, '12', '12'],
    ['spo2', { spo2: 97 }, '97', '97'],
    ['spo2', { spo2: 0 }, '', ''],
    ['stress', { stress: 41 }, '41', '41'],
  ]
  for (const [kind, values, de, en] of cases) {
    await build({ lang: 'de', rings: ['empty', kind, 'empty'], values })
    assert.equal(ringText(0), de, `${kind} de`)
    await build({ lang: 'en', rings: ['empty', kind, 'empty'], values })
    assert.equal(ringText(0), en, `${kind} en`)
  }
})

test('steps in a small ring: from 10,000 with one decimal', async () => {
  const values = { step: { current: 12345, target: 8000 } }
  await build({ lang: 'de', rings: ['step', 'cal', 'heart'], values })
  assert.equal(ringText(0), '12,3k')
  await build({ lang: 'en', rings: ['cal', 'heart', 'step'], values })
  assert.equal(ringText(2), '12.3k')
  await build({ lang: 'de', rings: ['step', 'cal', 'heart'], values: { step: { current: 9999, target: 8000 } } })
  assert.equal(ringText(0), '9.999')
})

test('distance in miles when the watch is set to imperial', async () => {
  await build({ lang: 'en', imperial: true, rings: ['distance', 'step', 'heart'], values: { distance: 16100 } })
  assert.equal(ringText(0), '10.0')
  assert.equal(imgs(/txt\/u_mi\.png/).length, 1)
  await build({ lang: 'en', rings: ['distance', 'step', 'heart'], values: { distance: 16093 } })
  assert.equal(imgs(/txt\/u_km\.png/).length, 1)
})

test('ring filling', async () => {
  const arcs = () => globalThis.zos.widgets.filter((w) => w.type === 'ARC' && w.props.start_angle === -90)
  const sweep = (w) => (w.visible ? w.props.end_angle + 90 : 0)
  await build({
    rings: ['cal', 'step', 'heart'],
    values: { cal: { current: 150, target: 300 }, step: { current: 9000, target: 8000 }, heart: { current: 60 } },
  })
  const [cal, step, heart] = arcs()
  assert.equal(sweep(cal), 180)
  assert.equal(sweep(step), 360)
  assert.equal(sweep(heart), 0) // 60 bpm is below 40 % of 220 - 40
  await build({
    rings: ['heart', 'stand', 'pai'],
    values: { heart: { current: 180 }, stand: { current: 6, target: 12 }, pai: 50 },
  })
  const [hr, stand, pai] = arcs()
  assert.equal(sweep(hr), 360)
  assert.equal(sweep(stand), 180)
  assert.equal(sweep(pai), 180)
})

test('a new minute only redraws the time', async () => {
  await build({ hour12: true })
  const changed = tick({ hours: 14, minutes: 59 })
  assert.equal(time(), '259')
  for (const w of changed) assert.match(w.props.src, /num\/time_[hm]_|txt\/(am|pm)\.png/)
})
