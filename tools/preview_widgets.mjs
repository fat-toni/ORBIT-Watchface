// Builds the real watchface on the simulated Bip 6 of the tests with the sample data of the Zepp watchface
// specification (10:09, August, 280 kcal, 8670 steps, 86 bpm, battery 75 %) and prints the widgets it shows
// as JSON. tools/make_preview.py draws them into the preview picture.
// Usage: node --import ./test/mock/setup.mjs tools/preview_widgets.mjs [lang]   (default English)
import { build, shown } from '../test/face.mjs'

await build({
  lang: process.argv[2] || 'en',
  // Monday, 10 August 2026, 10:09
  now: { year: 2026, month: 8, date: 10, day: 1, hours: 10, minutes: 9 },
  values: {
    battery: 75,
    step: { current: 8670, target: 10000 },
    heart: { current: 86, last: 86 },
    cal: { current: 280, target: 400 },
  },
})
const draw = ['IMG', 'TEXT', 'ARC', 'IMG_LEVEL', 'TEXT_IMG']
console.log(
  JSON.stringify(
    shown()
      .filter((w) => draw.includes(w.type))
      .map((w) => ({ ...w.props, widget: w.type })),
  ),
)
