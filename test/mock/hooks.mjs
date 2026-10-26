// Lets Node load the watchface: every @zos module comes from zos.mjs, and relative imports
// without extension (as the Zepp build allows) get ".js".
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@zos/')) return { url: new URL('./zos.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.startsWith('.') && !/\.m?js$/.test(specifier.split('?')[0])) return next(specifier + '.js', context)
  return next(specifier, context)
}
