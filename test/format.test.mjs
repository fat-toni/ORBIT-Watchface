// What the watchface writes: time, date, battery and the ring values in both languages.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build, imgs, text, rings, tick, words, textWidget, textWidth, LANGS, SIZES } from './face.mjs'

const time = () => text(imgs(/num\/time_[hm]_/))
const date = () => words.date()
const ringText = (i) => rings()[i].text

test('time: 24-hour with leading zero, 12-hour without, AM/PM only in the 12-hour format', async () => {
  await build({ now: { hours: 9, minutes: 5 } })
  assert.equal(time(), '0905')
  assert.equal(words.ampm(), null)
  await build({ hour12: true, now: { hours: 0, minutes: 30 } })
  assert.equal(time(), '1230')
  assert.equal(words.ampm(), 'AM')
  await build({ hour12: true, now: { hours: 13, minutes: 7 } })
  assert.equal(time(), '107')
  assert.equal(words.ampm(), 'PM')
  await build({ hour12: true, now: { hours: 12, minutes: 0 } })
  assert.equal(time(), '1200')
  assert.equal(words.ampm(), 'PM')
})

test('a single hour digit gets more room before the minutes', async () => {
  const gap = () => {
    const h = imgs(/num\/time_h_/)
    const m = imgs(/num\/time_m_/)
    return Math.min(...m.map((w) => w.props.x)) - Math.max(...h.map((w) => w.props.x + w.props.w))
  }
  await build({ hour12: true, now: { hours: 13, minutes: 58 } })
  const single = gap()
  await build({ hour12: true, now: { hours: 22, minutes: 58 } })
  assert.ok(single >= gap() + 10, `${single} vs ${gap()}`)
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

test('date styles, written by hand for a few languages', async () => {
  const want = {
    de: ['26. OKTOBER', 'MO 26. OKT', '26.10.2026'],
    en: ['26 OCTOBER', 'MON 26 OCT', '10/26/2026'],
    hu: ['OKTÓBER 26.', 'OKT. 26. H', '2026. 10. 26.'],
    sv: ['26 OKTOBER', 'MÅN 26 OKT.', '2026-10-26'],
    nl: ['26 OKTOBER', 'MA 26 OKT', '26-10-2026'],
    es: ['26 DE OCTUBRE', 'LUN 26 OCT', '26/10/2026'],
  }
  for (const [lang, styles] of Object.entries(want))
    for (let style = 0; style < 3; style++) {
      await build({ lang, date: style })
      assert.equal(date(), styles[style], `${lang} style ${style}`)
    }
  await build({ lang: 'de', date: 2, now: { year: 2026, month: 3, date: 5, day: 4 } })
  assert.equal(date(), '05.03.2026')
})

test('date styles in every language follow tools/langs.json', async () => {
  for (const lang of LANGS)
    for (let style = 0; style < 3; style++) {
      await build({ lang, date: style })
      const f = SIZES.langs[lang]
      const word = {
        d: '26',
        dd: '26',
        m: '10',
        mm: '10',
        yyyy: '2026',
        MONTH: f.months[9],
        MON: f.monthsShort[9],
        WD: f.daysShort[0],
      }
      const full = f.dates[style].map((t) => word[t] ?? t).join('')
      const short = f.dates[style].map((t) => (t === 'MONTH' ? word.MON : (word[t] ?? t))).join('')
      // a long month is shortened only when it does not fit next to the battery
      if (date() === full) continue
      assert.equal(date(), short, `${lang} style ${style}`)
      assert.ok(
        textWidth(full, 3) > 390 - 68 - textWidth('100%', 1) - 9 - 38 - 14,
        `${lang} style ${style} was shortened`,
      )
    }
})

test('numbers in the style of the language', async () => {
  const gaps = () => {
    const ws = rings()[0]
      .values.slice()
      .sort((a, b) => a.props.x - b.props.x)
    return ws.slice(1).map((w, i) => w.props.x - (ws[i].props.x + ws[i].props.w))
  }
  const cases = [
    // lang, steps, text, a gap of a thousands space after the first digit
    ['fr', 8462, '8462', true],
    ['pl', 8462, '8462', false],
    ['pl', 12345, '12345', true],
    ['es', 8462, '8462', false],
    ['es', 12345, '12.345', false],
    ['it', 8462, '8.462', false],
    ['en', 12345, '12345', false],
  ]
  for (const [lang, current, txt, space] of cases) {
    await build({ lang, rings: ['empty', 'step', 'empty'], values: { step: { current, target: 8000 } } })
    assert.equal(rings()[0].text, txt, `${lang} ${current}`)
    const g = gaps()
    const at = String(current).length % 3 || 3
    assert.equal(g[at - 1] > g[0 === at - 1 ? 1 : 0], space, `${lang} ${current}: ${g}`)
  }
  await build({ lang: 'fr', rings: ['distance', 'step', 'heart'], values: { distance: 3456 } })
  assert.equal(rings()[0].text, '3,4')
})

test('location row: the city in capitals, the weekday while there is none', async () => {
  await build({ lang: 'de', row: 'city', city: 'Bad Säckingen' })
  assert.equal(words.row(), 'BAD SÄCKINGEN')
  assert.equal(textWidget((w) => w.props.y === 200).props.font, 'fonts/sora.ttf')
  await build({ lang: 'de', row: 'city', city: '' })
  assert.equal(words.row(), 'MONTAG')
  // the city arrives later: shown after waking up
  const zos = globalThis.zos
  zos.city = 'Ulm'
  zos.widgets.find((w) => w.type === 'WIDGET_DELEGATE').props.resume_call()
  assert.equal(words.row(), 'ULM')
  // long names get less letter spacing
  await build({ row: 'city', city: 'Sankt Margrethen' })
  assert.ok(textWidget((w) => w.props.y === 200).props.char_space < 8)
})

test('weekday row or nothing', async () => {
  await build({ lang: 'de', now: { day: 7 } })
  assert.equal(words.row(), 'SONNTAG')
  await build({ row: 'empty' })
  assert.equal(words.row(), null)
})

test('battery: accent color, red below 5 %', async () => {
  await build({ color: 2, values: { battery: 5 } })
  assert.equal(words.battery(), '5%')
  assert.equal(textWidget((w) => w.props.align_h === 2).props.color, SIZES.colors[2][1])
  assert.ok(imgs(/^c\/amber\/icon\/bat_0\.png$/).length === 1)
  await build({ color: 2, values: { battery: 4 } })
  assert.equal(words.battery(), '4%')
  assert.equal(textWidget((w) => w.props.align_h === 2).props.color, 0xe8564c)
  assert.equal(imgs(/^icon\/bat_low\.png$/).length, 1)
  await build({ values: { battery: 100 } })
  assert.equal(words.battery(), '100%')
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
  assert.equal(words.units()[0], 'MI')
  await build({ lang: 'en', rings: ['distance', 'step', 'heart'], values: { distance: 16093 } })
  assert.equal(words.units()[0], 'KM')
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
  for (const w of changed) assert.ok(/num\/time_[hm]_/.test(w.props.src) || w.props.text_size === 16, w.props.src)
})
