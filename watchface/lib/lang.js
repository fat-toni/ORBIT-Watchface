// Languages and number formats. Every language lives in its own small file in the assets
// (lang/<code>.json, written by tools/make_assets.py from tools/langs.json); only the language of the watch
// is read, so the others never take up memory. English is built in as the fallback.
import { openAssetsSync, statAssetsSync, readSync, closeSync, O_RDONLY } from '@zos/fs'
import { SIZES } from '../sizes'

const NUM_GAP = 5 // the space that groups thousands in French, Polish ...

// Zepp language code of the watch -> 'de', 'fr', ...; English for every other language.
export const langOf = (code) => SIZES.langCodes[String(code)] || 'en'

// The rules and words of a language: { group, decimal, minGroup, dates, titles, days, daysShort, months,
// monthsShort, previews }. The file is ASCII (other letters as \u escapes), so bytes are characters.
export function loadLang(lang) {
  if (lang === 'en') return SIZES.langEn
  try {
    const path = `lang/${lang}.json`
    const size = statAssetsSync({ path }).size
    const buffer = new ArrayBuffer(size)
    const fd = openAssetsSync({ path, flag: O_RDONLY })
    readSync({ fd, buffer })
    closeSync(fd)
    const bytes = new Uint8Array(buffer)
    let text = ''
    for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096))
    return JSON.parse(text)
  } catch (e) {
    return SIZES.langEn
  }
}

// 8462 -> ['8', 'dot', '4', '6', '2'] in German, ['8', { gap }, '4', '6', '2'] in French; group: with the
// thousands separator of the language f (English has none, Spanish and Polish only from 10,000).
export function chars(n, f, group) {
  const s = String(Math.max(0, Math.round(n)))
  if (!group || !f.group || s.length < (f.minGroup === 2 ? 5 : 4)) return s.split('')
  const sep = f.group === 'space' ? { gap: NUM_GAP } : 'dot'
  const out = []
  s.split('').forEach((c, i) => {
    if (i && (s.length - i) % 3 === 0) out.push(sep)
    out.push(c)
  })
  return out
}

// the decimal sign of the language: 'comma' or 'dot'
const decimal = (f) => (f.decimal === ',' ? 'comma' : 'dot')

// Steps: in the large ring up to 99999 in full ("12.345"), in a small one up to 9999 and then with
// one decimal ("12,3k"); from 100000 short ("123k").
export function stepChars(n, f, big) {
  if (n < (big ? 100000 : 10000)) return chars(n, f, true)
  if (n >= 100000) return [...String(Math.floor(n / 1000)).split(''), 'k']
  const t = Math.floor(n / 100)
  return [...String(Math.floor(t / 10)).split(''), decimal(f), String(t % 10), 'k']
}

// Distance with one decimal ("3,4"), from 100 without.
export function distChars(d, f) {
  if (d >= 100) return chars(d, f, false)
  const t = Math.floor(d * 10)
  return [...String(Math.floor(t / 10)).split(''), decimal(f), String(t % 10)]
}
