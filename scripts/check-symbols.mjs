/**
 * 校验符号面板：每个条目的预览能不能渲染、有没有重复、分组是否够全。
 * 用法：node scripts/check-symbols.mjs
 */
import katex from 'katex'
import 'katex/contrib/mhchem'
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const dir = mkdtempSync(path.join(tmpdir(), 'mf-symbols-'))
const outfile = path.join(dir, 'symbolGroups.mjs')

await build({
  entryPoints: [path.join(root, 'src/core/symbolGroups.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
})

const { GROUPS, ALL_SYMBOLS } = await import(pathToFileURL(outfile).href)

let total = 0
const bad = []
for (const g of GROUPS) {
  total += g.items.length
  for (const it of g.items) {
    try {
      katex.renderToString(it.label, { displayMode: false, throwOnError: true, strict: false })
    } catch (e) {
      bad.push([g.title, it.name, it.label, String(e.message).split('\n')[0]])
    }
  }
}

console.log(`分组 ${GROUPS.length} 个，符号 ${total} 个`)
for (const g of GROUPS) console.log(`  ${g.title}: ${g.items.length}`)

// 同名检测（同一分组内 name 重复说明复制粘贴时漏改）
const dup = []
for (const g of GROUPS) {
  const seen = new Map()
  for (const it of g.items) seen.set(it.name, (seen.get(it.name) ?? 0) + 1)
  for (const [n, c] of seen) if (c > 1) dup.push([g.title, n, c])
}

if (bad.length) {
  console.log(`\n渲染失败 ${bad.length} 条：`)
  for (const [g, n, l, m] of bad) console.log(`  [${g}] ${n}  label=${l}  — ${m}`)
} else {
  console.log('\n全部符号预览渲染通过')
}
if (dup.length) console.log('同组重名:', dup)
writeFileSync(path.join(root, 'tmp/symbol-check.json'), JSON.stringify({ total, bad, dup }, null, 2))
console.log('条目总数（含分组标注）:', ALL_SYMBOLS.length)
