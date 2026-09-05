/* Bundle dist/ into ONE self-contained HTML file.
 *
 * Claude Artifacts enforce a strict CSP that blocks every external request —
 * no script src, no stylesheet link, no font file. So the CSS, the JS, and the
 * fonts all have to be inlined, fonts as base64 data URIs.
 *
 * The publish step wraps the file in its own <!doctype>/<html>/<head>/<body>,
 * so this emits head content followed by body content and no document tags.
 *
 * Usage: npm run build && node scripts/bundle-artifact.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'dist')
const out = path.join(root, 'artifact', 'billing-prototype.html')

/* Cascadia SemiBold is omitted: it costs ~630KB base64 and the browser
 * synthesises the weight acceptably for the few bold monospace runs. */
const FONTS = [
  ['Quicksand', 400, 'Quicksand-Regular.ttf'],
  ['Quicksand', 500, 'Quicksand-Medium.ttf'],
  ['Quicksand', 600, 'Quicksand-SemiBold.ttf'],
  ['Quicksand', 700, 'Quicksand-Bold.ttf'],
  ['Cascadia Code', 400, 'CascadiaCode-Regular.ttf'],
]

const assets = await readdir(path.join(dist, 'assets'))
const cssName = assets.find((f) => f.endsWith('.css'))
const jsName = assets.find((f) => f.endsWith('.js'))
if (!cssName || !jsName) throw new Error('dist/assets is missing a CSS or JS bundle — run `npm run build` first')

let css = await readFile(path.join(dist, 'assets', cssName), 'utf8')
const js = await readFile(path.join(dist, 'assets', jsName), 'utf8')

// Replace the built @font-face src URLs with inline data URIs.
let fontCss = ''
for (const [family, weight, file] of FONTS) {
  const data = await readFile(path.join(root, 'public', 'fonts', file))
  fontCss +=
    `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:swap;` +
    `src:url(data:font/ttf;base64,${data.toString('base64')}) format('truetype')}\n`
}
// Drop the original @font-face blocks, which point at files that will not exist.
css = css.replace(/@font-face\s*\{[^}]*\}/g, '')

const bytes = (s) => `${(Buffer.byteLength(s) / 1024 / 1024).toFixed(2)} MB`

const html = `<title>Legal Analytics Suite — Billing</title>
<meta name="description" content="Standalone billing front end for the Ankura Legal Analytics Suite, reskinned to Vero.">
<style>
${fontCss}${css}
/* The artifact host paints its own ground behind the page, so the app root
   must set an opaque background of its own or it borrows the host's theme. */
html,body{margin:0;padding:0;background:#F7F8FA}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`

await writeFile(out, html, 'utf8')
console.log(`wrote ${path.relative(root, out)}`)
console.log(`  css   ${bytes(css)}`)
console.log(`  fonts ${bytes(fontCss)}`)
console.log(`  js    ${bytes(js)}`)
console.log(`  total ${bytes(html)}`)
