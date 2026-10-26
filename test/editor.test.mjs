// The watchface editor: what the user can pick and what happens with choices the watchface does
// not know (anymore).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build, imgs, rings, editGroups, words, EDIT, TYPE, SIZES } from './face.mjs'

const zos = globalThis.zos
const group = (id) => editGroups().find((g) => g.props.edit_id === id)

test('the editor offers 6 colors, 10 ring contents, 3 date styles and 3 rows', async () => {
  await build()
  assert.equal(group(EDIT.color).props.count, 6)
  for (const id of EDIT.rings) assert.equal(group(id).props.count, 10)
  assert.equal(group(EDIT.date).props.count, 3)
  assert.equal(group(EDIT.row).props.count, 3)
  for (const g of editGroups()) {
    assert.equal(g.props.count, g.props.optional_types.length)
    // own types need a title, the editor shows it
    for (const t of g.props.optional_types)
      if (t.type >= 100000) assert.ok(t.title_en && t.title_sc && t.title_tc, `title of ${t.type}`)
  }
})

test('titles in the language of the watch', async () => {
  await build({ lang: 'de' })
  assert.deepEqual(
    group(EDIT.color).props.optional_types.map((t) => t.title_en),
    ['Mint', 'Eisblau', 'Bernstein', 'Rosé', 'Lavendel', 'Silber'],
  )
  await build({ lang: 'en' })
  assert.deepEqual(
    group(EDIT.row).props.optional_types.map((t) => t.title_en),
    ['Weekday', 'Location', 'Empty'],
  )
})

test('PAI is the PAI of the week, with its own title', async () => {
  await build({ lang: 'de' })
  const pai = group(EDIT.rings[0]).props.optional_types.find((t) => t.type === 100110)
  assert.equal(pai.title_en, 'PAI (Woche)')
  await build({ rings: ['pai', 'empty', 'empty'], values: { pai: 87 } })
  assert.equal(rings()[0].text, '87')
})

test('after installing: mint, calories | steps | heart rate, long date, weekday', async () => {
  await build()
  assert.deepEqual(
    rings().map((r) => r.cx),
    [65, 195, 325],
  )
  assert.equal(imgs(/^c\/mint\/icon\/cal\.png$/).length, 1)
  assert.equal(imgs(/^c\/mint\/icon\/step\.png$/).length, 1)
  assert.equal(imgs(/^c\/mint\/icon\/heart\.png$/).length, 1)
  assert.equal(words.date(), '26 OCTOBER')
  assert.equal(words.row(), 'MONDAY')
  assert.deepEqual(words.units(), ['KCAL', 'STEPS', 'BPM'])
})

test('the chosen color reaches everything that has the accent color', async () => {
  for (let i = 0; i < 6; i++) {
    await build({ color: i })
    const key = SIZES.colors[i][0]
    const hex = SIZES.colors[i][1]
    assert.ok(
      imgs(/num\/time_m_/).every((w) => w.props.src.startsWith(`c/${key}/`)),
      `minutes ${key}`,
    )
    assert.ok(
      globalThis.zos.widgets.find((w) => w.type === 'TEXT' && w.props.align_h === 2).props.color === hex,
      `battery ${key}`,
    )
    assert.ok(
      imgs(/icon\/(cal|step|heart)\.png/).every((w) => w.props.src.startsWith(`c/${key}/`)),
      `icons ${key}`,
    )
    const arcs = zos.widgets.filter((w) => w.type === 'ARC' && w.props.start_angle === -90)
    assert.ok(
      arcs.every((a) => a.props.color === hex),
      `rings ${key}`,
    )
    const accent = zos.widgets.filter((w) => w.type === 'IMG_LEVEL')[1].props.image_array
    assert.ok(
      accent.every((p) => p === 'wx/empty.png' || p.startsWith(`c/${key}/wx/`)),
      `weather ${key}`,
    )
  }
})

test('unknown choices fall back to the default: the old week date style, foreign types', async () => {
  await build({
    lang: 'de',
    edit: { [EDIT.row]: 100399, [EDIT.color]: 100099, [EDIT.date]: 100204, [EDIT.rings[1]]: 999 },
  })
  assert.equal(words.row(), 'MONTAG')
  assert.equal(imgs(/^c\/mint\//).length > 0, true)
  assert.equal(words.date(), '26. OKTOBER')
  assert.equal(imgs(/^c\/mint\/icon\/step\.png$/).length, 1)
})

test('a firmware without editor types still shows the default rings', async () => {
  await build({ noEditTypes: true })
  assert.equal(rings().length, 3)
  assert.equal(imgs(/^c\/mint\/icon\/step\.png$/).length, 1)
})

test('a tap on a ring opens the app of its content', async () => {
  const want = {
    step: 'STEP',
    heart: 'HEART',
    cal: 'CAL',
    battery: 'BATTERY',
    distance: 'DISTANCE',
    pai: 'PAI_WEEKLY',
    stand: 'STAND',
    spo2: 'SPO2',
    stress: 'STRESS',
  }
  const { data_type } = await import('./mock/zos.mjs')
  for (const [kind, type] of Object.entries(want)) {
    await build({ rings: [kind, 'empty', 'empty'] })
    const clicks = zos.widgets.filter((w) => w.type === 'IMG_CLICK')
    assert.deepEqual(
      clicks.map((c) => c.props.type),
      [data_type[type]],
      kind,
    )
  }
  assert.equal(TYPE.empty, 100100)
})
