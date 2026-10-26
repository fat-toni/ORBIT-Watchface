// Every combination of the editor: all pictures exist, nothing leaves the screen, the values fit
// into their rings, also the longest ones.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build, shown, pictures, exists, box, rings, editGroups, imgs, KINDS, LANGS, W, H } from './face.mjs'

const zos = globalThis.zos

// The longest value each ring content can show.
const LONGEST = {
  step: { step: { current: 99999, target: 8000 } },
  heart: { heart: { current: 220, last: 220 } },
  cal: { cal: { current: 9999, target: 300 } },
  battery: { battery: 100 },
  distance: { distance: 99999 },
  pai: { pai: 525 },
  stand: { stand: { current: 12, target: 12 } },
  spo2: { spo2: 100 },
  stress: { stress: 100 },
}

function check(label) {
  const problems = []
  for (const w of zos.widgets)
    for (const p of pictures(w)) if (!exists(p)) problems.push(`${w.type}: missing picture ${p}`)
  for (const w of shown()) {
    if (!['IMG', 'ARC', 'TEXT', 'TEXT_IMG', 'IMG_LEVEL', 'IMG_CLICK'].includes(w.type)) continue
    const b = box(w)
    if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H)
      problems.push(`${w.type} ${w.props.src || ''} at ${b.x},${b.y} ${b.w}x${b.h} leaves the screen`)
  }
  for (const r of rings()) {
    for (const v of r.values) {
      const b = box(v)
      // the farthest corner of every digit must stay inside the ring's inner edge
      const dx = Math.max(Math.abs(b.x - r.cx), Math.abs(b.x + b.w - r.cx))
      const dy = Math.max(Math.abs(b.y - r.cy), Math.abs(b.y + b.h - r.cy))
      if (Math.hypot(dx, dy) > r.inner) {
        problems.push(`"${r.text}" touches the ring at ${r.cx}`)
        break
      }
    }
  }
  assert.deepEqual(problems, [], label)
}

test('every color, date style, row, language and time format', async () => {
  let n = 0
  for (let color = 0; color < 6; color++)
    for (let date = 0; date < 3; date++)
      for (const row of ['day', 'city', 'empty'])
        for (const lang of LANGS)
          for (const hour12 of [false, true]) {
            // the widest date: Wednesday 30 September 2026 / 12 for the 12-hour format
            const now = { year: 2026, month: 9, date: 30, day: 3, hours: hour12 ? 12 : 20, minutes: 48 }
            await build({ color, date, row, lang, hour12, now })
            check(JSON.stringify({ color, date, row, lang, hour12 }))
            n++
          }
  assert.equal(n, 6 * 3 * 3 * LANGS.length * 2)
})

test('every ring content in every ring, with its longest value', async () => {
  for (const kind of KINDS)
    for (let slot = 0; slot < 3; slot++)
      for (const lang of LANGS)
        for (const imperial of [false, true]) {
          const kinds = ['empty', 'empty', 'empty']
          kinds[slot] = kind
          await build({ lang, imperial, rings: kinds, values: LONGEST[kind] })
          check(`${kind} in ring ${slot} ${lang}${imperial ? ' miles' : ''}`)
        }
})

test('random full combinations with the longest values', async () => {
  let seed = 7
  const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n)
  for (let i = 0; i < 300; i++) {
    const kinds = [KINDS[rnd(10)], KINDS[rnd(10)], KINDS[rnd(10)]]
    const o = { color: rnd(6), date: rnd(3), row: ['day', 'city', 'empty'][rnd(3)], lang: LANGS[rnd(LANGS.length)] }
    await build({
      ...o,
      hour12: !!rnd(2),
      imperial: !!rnd(2),
      rings: kinds,
      values: Object.assign({}, ...kinds.map((k) => LONGEST[k] || {})),
    })
    check(JSON.stringify({ ...o, kinds }))
  }
})

test('an empty ring draws nothing', async () => {
  await build({ rings: ['empty', 'empty', 'empty'] })
  assert.equal(rings().length, 0)
  assert.equal(shown().filter((w) => w.type === 'IMG_CLICK').length, 0)
  assert.equal(shown().filter((w) => w.type === 'IMG' && /icon\/(step|heart|cal)|txt\/u_/.test(w.props.src)).length, 0)
})

test('the editor areas lie on the screen and do not overlap', async () => {
  await build()
  const boxes = editGroups().map((g) => ({ id: g.props.edit_id, ...box(g) }))
  assert.equal(boxes.length, 6)
  for (const b of boxes) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `area ${b.id}`)
  for (const a of boxes)
    for (const b of boxes)
      if (a.id < b.id)
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} and ${b.id}`)
  for (const g of editGroups()) {
    const x = g.props.x + g.props.tips_x
    assert.ok(x >= 0 && x + g.props.tips_width <= W, `tips of ${g.props.edit_id}`)
  }
})

test('always-on display: only the dimmed time', async () => {
  await build()
  const aod = zos.widgets.filter((w) => w.props.show_level === 2)
  assert.deepEqual(
    aod.map((w) => w.type),
    ['IMG_TIME'],
  )
})

test('in every language and month the date stays clear of the battery at 100 %', async () => {
  const bad = []
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  for (const lang of LANGS)
    for (let date = 0; date < 3; date++)
      for (let month = 1; month <= 12; month++)
        for (let day = 1; day <= (date === 1 ? 7 : 1); day++) {
          const now = { year: 2028, month, date: days[month - 1] === 31 ? 30 : days[month - 1], day, hours: 10 }
          await build({ lang, date, now, values: { battery: 100 } })
          const row = imgs(/num\/date_|txt\/\w+\/(mon|mons|wd)_\d+\.png/)
          const right = Math.max(...row.map((w) => w.props.x + w.props.w))
          const battery = Math.min(...imgs(/icon\/bat_/).map((w) => w.props.x))
          if (right > battery - 8)
            bad.push(`${lang} style ${date} month ${month} day ${day}: ${right} > ${battery - 8}`)
        }
  assert.deepEqual(bad, [])
})
