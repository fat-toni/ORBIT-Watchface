# Development

Get the code and the tools first, as in [INSTALL.md](INSTALL.md) steps 1 and 2.

```bash
npm install
npm test          # all tests (see below)
npm run format    # format the code with Prettier
npm run check     # check formatting + run tests
zeus dev          # run in the simulator (choose Amazfit Bip 6)
npm run build     # check + zeus build into dist/, keeps .gitignore (zeus may reset it); for the Zepp App Store
npm run build -- --github        # the same without intermediate products, for a GitHub release
npm run release-check            # all automatic checks before a release (tools/release_check.mjs)
npm run release-check -- --zab   # the same, then builds and checks dist/ORBIT-<version>.zab
```

## How it is made

- `watchface/index.js` is the whole watchface: layout, the watchface editor (`readEditor()`), sensors and drawing.
- Every picture comes from **`tools/make_assets.py`** (`npm run assets`): digits and words in
  [Sora](https://github.com/sora-xor/sora-font), the icons drawn by hand in code, everything that has the accent
  color once per color under `assets/default.w390-s/c/<color>/`, and the previews of the editor. It also writes
  `watchface/sizes.js` with the size of every picture and the color list, which the layout uses.
  It needs Python with Pillow.
- The numbers are separate pictures, not a font: the watch draws them as images, which keeps them sharp and lets
  each digit have its own width.
- Weather, temperatures and the always-on time are system widgets, the watch updates them itself.

## Tests

The tests run without a watch or simulator: `test/mock/zos.mjs` is a simulated Bip 6 that builds the real
`watchface/index.js` and records everything it draws (`test/face.mjs` reads it back).

- **Layout** (`test/layout.test.mjs`): every color × date style × row × language × time format, every ring content
  in every ring and 300 random combinations, each with the longest values: every picture exists, nothing leaves the
  screen, the values stay inside their ring.
- **Texts and numbers** (`test/format.test.mjs`): time and AM/PM, the date styles of every language, number formats,
  thousands separators, distance in km and miles, battery below 5 %, ring filling.
- **Editor** (`test/editor.test.mjs`): the options and titles, the default look, the accent color everywhere,
  unknown choices fall back to the default, a tap opens the app of the ring's content.
- **Battery** (`test/battery.test.mjs`): sensors only for the rings shown, no timers, a minute changes only the time,
  waking up reads the settings again.

What only the real watch shows (how pictures look, taps, real sensor values) is checked by hand.

## Battery

ORBIT should cost as little as possible: sensors only for the rings that are shown, values by events instead of
timers, one update per minute for the time, and a fresh read of everything when the screen wakes up.

## README pictures

`python3 tools/readme_art.py` draws the banner and the watch pictures in `docs/images/` from the simulator
screenshots in `docs/images/screenshots/` (390×450, taken without the mouse). The simulator often has no weather
data, so the script draws the weather row from the watchface's own pictures.

← [Back to the README](../README.md)
