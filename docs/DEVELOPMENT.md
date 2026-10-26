# Development

Get the code and the tools first, as in [INSTALL.md](INSTALL.md) steps 1 and 2.

```bash
npm install
npm run format    # format the code with Prettier
npm run check     # check the formatting
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
  It needs Python with Pillow; with [fontTools](https://github.com/fonttools/fonttools) it also rebuilds the small
  font for the city name (`assets/default.w390-s/fonts/sora.ttf`).
- The numbers are separate pictures, not a font: the watch draws them as images, which keeps them sharp and lets
  each digit have its own width.
- Weather, temperatures and the always-on time are system widgets, the watch updates them itself.

## Battery

ORBIT should cost as little as possible: sensors only for the rings that are shown, values by events instead of
timers, one update per minute for the time, and a fresh read of everything when the screen wakes up.

## README pictures

`python3 tools/readme_art.py` draws the banner and the watch pictures in `docs/images/` from the simulator
screenshots in `docs/images/screenshots/` (390×450, taken without the mouse). The simulator often has no weather
data, so the script draws the weather row from the watchface's own pictures.

← [Back to the README](../README.md)
