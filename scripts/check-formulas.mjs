/**
 * 校验公式库：逐条用 KaTeX 渲染，报告条数与语法错误。
 * 用法：node scripts/check-formulas.mjs
 */
import katex from 'katex'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// 直接编译 TS 太麻烦，这里用 vite 的 transform 走一遍不现实——改用 tsx 风格的手工解析：
// formulaLibrary.ts 里的 Row 是纯数据字面量，用正则抽取 [名称, latex, 说明, 关键词] 不现实，
// 因此借助 esbuild（vite 已带）把 TS 转成 ESM 再 import。
import { build } from 'esbuild'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dir = mkdtempSync(path.join(tmpdir(), 'mf-formulas-'))
const outfile = path.join(dir, 'formulaLibrary.mjs')

await build({
  entryPoints: [path.join(root, 'src/core/formulaLibrary.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
})

const mod = await import(pathToFileURL(outfile).href)
const { FORMULA_LIBRARY, FORMULA_CATEGORIES } = mod

console.log('分类数:', FORMULA_CATEGORIES.length)
console.log('公式条数:', FORMULA_LIBRARY.length)
for (const c of FORMULA_CATEGORIES) {
  const n = FORMULA_LIBRARY.filter((f) => f.category === c).length
  console.log(`  ${c}: ${n}`)
}

const bad = []
for (const f of FORMULA_LIBRARY) {
  try {
    katex.renderToString(f.latex, { displayMode: true, throwOnError: true, strict: false })
  } catch (e) {
    bad.push([f.category, f.name, String(e.message).split('\n')[0]])
  }
}

const dupe = new Map()
for (const f of FORMULA_LIBRARY) {
  const k = f.name
  dupe.set(k, (dupe.get(k) ?? 0) + 1)
}
const dupNames = [...dupe].filter(([, n]) => n > 1)

if (bad.length) {
  console.log(`\n渲染失败 ${bad.length} 条：`)
  for (const [c, n, m] of bad) console.log(`  [${c}] ${n} — ${m}`)
} else {
  console.log('\n全部公式 KaTeX 渲染通过')
}
if (dupNames.length) console.log('重名:', dupNames)
writeFileSync(path.join(root, 'tmp/formula-check.json'), JSON.stringify({ bad, dupNames }, null, 2))
