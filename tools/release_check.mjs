// Everything a machine can check before a release, in one run. Prints one line per check and
// exits with 1 if any fails.
// Usage: npm run release-check            formatting, versions, pictures, private files, privacy policy
//        npm run release-check -- --zab   the same, then builds the .zab for GitHub and checks it
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const zab = process.argv.includes('--zab')
const failed = []
const notes = []

const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts })
const git = (...args) => sh('git', args).stdout.trim()
function check(name, fn) {
  let problems
  try {
    problems = fn() || []
  } catch (e) {
    problems = [String(e.message || e)]
  }
  if (problems.length) failed.push(name)
  console.log(`${problems.length ? '✖' : '✔'} ${name}`)
  for (const p of problems) console.log(`    ${p}`)
}
// All files below dir (relative to ROOT), recursively.
function files(dir) {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return []
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  )
}

const app = JSON.parse(read('app.json'))
const version = app.app.version.name
console.log(`ORBIT ${version} (code ${app.app.version.code})\n`)

// 1. Formatting. The --zab build runs the same check itself first.
if (!zab)
  check('formatting (npm run check)', () => {
    const r = sh('npm', ['run', 'check'])
    return r.status === 0 ? [] : [(r.stdout + r.stderr).trim().split('\n').slice(-10).join('\n    ')]
  })

// 2. One version everywhere, raised since the last release, with a dated changelog entry.
check(`version ${version} in package.json, both changelogs and above the last release`, () => {
  const problems = []
  const pkg = JSON.parse(read('package.json'))
  if (pkg.version !== version) problems.push(`package.json says ${pkg.version}`)
  const head = read('CHANGELOG.md').match(/^## (\S+) · (.+)$/m)
  if (!head || head[1] !== version) problems.push(`CHANGELOG.md: newest entry is ${head && head[1]}`)
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(head[2])) problems.push(`CHANGELOG.md: "${head[2]}" instead of a date`)
  if (
    !read('CHANGELOG.md')
      .match(/^\*\*Versions:\*\*.*$/m)?.[0]
      .includes(`[${version}](#`)
  )
    problems.push('CHANGELOG.md: not in the version index at the top')
  if (existsSync(join(ROOT, 'CHANGELOG.de.md'))) {
    const h = read('CHANGELOG.de.md').match(/^## (\S+) · (.+)$/m)
    if (!h || h[1] !== version) problems.push(`CHANGELOG.de.md: newest entry is ${h && h[1]}`)
  }
  const tags = git('tag', '--sort=-v:refname').split('\n').filter(Boolean)
  if (tags.includes(`v${version}`)) notes.push(`v${version} is already released; raise the version for a new one`)
  const last = tags.find((t) => t !== `v${version}`)
  if (last) {
    const code = JSON.parse(git('show', `${last}:app.json`)).app.version.code
    if (app.app.version.code <= code)
      problems.push(`version code ${app.app.version.code} is not above ${last}'s ${code}`)
  }
  return problems
})

// 3. Pictures and sizes.js come from tools/make_assets.py, the README pictures from
// tools/readme_art.py: drawn again, nothing may change.
for (const [name, script, paths] of [
  ['watchface pictures up to date (tools/make_assets.py)', 'tools/make_assets.py', ['assets', 'watchface/sizes.js']],
  ['README pictures up to date (tools/readme_art.py)', 'tools/readme_art.py', ['docs/images']],
])
  check(name, () => {
    const dirty = () => git('status', '--porcelain', '--', ...paths)
    const before = dirty()
    if (before) return ['uncommitted changes already:', ...before.split('\n')]
    const r = sh('python3', [script])
    if (r.status !== 0) return [`${script} failed: ${(r.stderr || '').trim().split('\n').pop()}`]
    const after = dirty()
    return after ? ['were outdated and are redrawn now; look at them and commit:', ...after.split('\n')] : []
  })

// 4. The local-only files stay off GitHub.
check('private files stay local (.gitignore)', () => {
  const local = ['TODO.md', 'CHANGELOG.de.md', 'BESCHREIBUNG.md', 'store/LISTING.md', '.claude/x', 'sim-debug.log']
  const problems = []
  for (const f of local) {
    if (sh('git', ['check-ignore', '-q', '--no-index', f]).status !== 0) problems.push(`${f} is not in .gitignore`)
    if (git('ls-files', '--', f)) problems.push(`${f} is in git`)
  }
  for (const d of ['store', '.claude']) if (git('ls-files', '--', d)) problems.push(`${d}/ is in git`)
  return problems
})

// 5. Every permission is explained in the privacy policy.
check('PRIVACY.md explains every permission', () => {
  const privacy = read('PRIVACY.md')
  return app.permissions.filter((p) => !privacy.includes(`\`${p}\``)).map((p) => `PRIVACY.md: permission ${p}`)
})

// 6. --zab: the package for the GitHub release, without intermediate products, copied to
// dist/ORBIT-<version>.zab.
if (zab)
  check(`dist/ORBIT-${version}.zab (npm run build -- --github)`, () => {
    const r = sh('bash', ['tools/build.sh', '--github'])
    if (r.status !== 0) return ['the build failed:', ...(r.stdout + r.stderr).trim().split('\n').slice(-12)]
    const built = files('dist')
      .filter((f) => f.includes(`-${version}-`) && f.endsWith('.zab'))
      .sort()
      .pop()
    if (!built) return [`no ${version} .zab in dist/`]
    const list = sh('unzip', ['-Z1', join(ROOT, built)])
      .stdout.split('\n')
      .filter(Boolean)
    const manifest = JSON.parse(sh('unzip', ['-p', join(ROOT, built), 'manifest.json']).stdout)
    const problems = []
    if (list.includes('.ip-package')) problems.push('still holds the intermediate products (.ip-package)')
    for (const z of manifest.zpks)
      if (z.version.name !== version) problems.push(`${z.name} is version ${z.version.name}`)
    const screens = manifest.zpks.map((z) => z.platforms.map((p) => p.screenResolution).join()).sort()
    if (screens.join() !== '390x450') problems.push(`screen sizes: ${screens.join(', ')}`)
    if (!problems.length) copyFileSync(join(ROOT, built), join(ROOT, 'dist', `ORBIT-${version}.zab`))
    return problems
  })

for (const n of notes) console.log(`ℹ ${n}`)
console.log(failed.length ? `\n✖ ${failed.length} check(s) failed` : '\n✔ all checks passed')
process.exit(failed.length ? 1 : 0)
