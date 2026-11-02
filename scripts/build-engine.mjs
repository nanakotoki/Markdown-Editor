#!/usr/bin/env node
/**
 * ============================================================================
 *  build-engine.mjs —— 为 Node 端预编译两样东西
 * ----------------------------------------------------------------------------
 *  1. server/lib/engine.mjs
 *     把 src/core 里的纯逻辑（AST 解析、LaTeX 编译、HTML 渲染）打包成一个
 *     无外部依赖的 ESM 模块。remark / katex 等库全部内联，因此分发包里
 *     不需要 node_modules —— 用户解压就能跑。
 *
 *  2. server/lib/katex-inline.css
 *     KaTeX 样式表 + 全量 woff2 字体（base64 内联）。
 *     CLI 导出的 HTML 因此是完全自包含的离线文件，断网也能正确显示公式。
 * ============================================================================
 */

import { build } from 'esbuild'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB = path.join(ROOT, 'server', 'lib')
const KATEX_DIST = path.join(ROOT, 'node_modules', 'katex', 'dist')

function kb(n) {
  return `${(n / 1024).toFixed(0)} KB`
}

async function buildEngine() {
  await fs.mkdir(LIB, { recursive: true })
  const out = path.join(LIB, 'engine.mjs')
  const started = Date.now()
  await build({
    entryPoints: [path.join(ROOT, 'src', 'core', 'cliEngine.ts')],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    // 打包全部依赖：分发包不携带 node_modules
    external: [],
    loader: { '.md': 'text' },
    minify: false,
    legalComments: 'none',
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const stat = await fs.stat(out)
  console.log(`  ✓ engine.mjs        ${kb(stat.size)}  (${Date.now() - started}ms)`)
}

async function buildKatexCss() {
  const rawCss = await fs.readFile(path.join(KATEX_DIST, 'katex.min.css'), 'utf8')

  // KaTeX 的每个 @font-face 都指向 fonts/xxx.woff2|woff|ttf。
  // 现代浏览器只需要 woff2，所以把 woff/ttf 的声明整段丢掉，只内联 woff2，
  // 否则产物会膨胀到 MySQL 级别的体积。
  const fontDir = path.join(KATEX_DIST, 'fonts')
  const files = await fs.readdir(fontDir)
  const woff2 = new Set(files.filter((f) => f.endsWith('.woff2')))

  const dataUri = new Map()
  for (const name of woff2) {
    const buf = await fs.readFile(path.join(fontDir, name))
    dataUri.set(name, `data:font/woff2;base64,${buf.toString('base64')}`)
  }

  // 逐个 @font-face 块处理：只保留含 woff2 的那个 source 声明
  let css = rawCss.replace(/@font-face\{[^}]*\}/g, (block) => {
    const hasWoff2 = /url\(fonts\/([^)]+\.woff2)\)/.exec(block)
    if (!hasWoff2) return ''
    const file = hasWoff2[1]
    const uri = dataUri.get(file)
    if (!uri) return ''
    const family = /font-family:\s*([^;]+)/.exec(block)?.[1] ?? 'KaTeX_Main'
    const weight = /font-weight:\s*([^;]+)/.exec(block)?.[1] ?? 'normal'
    const style = /font-style:\s*([^;]+)/.exec(block)?.[1] ?? 'normal'
    return `@font-face{font-family:${family};font-style:${style};font-weight:${weight};src:url(${uri}) format("woff2");}`
  })

  // 去掉 @font-face 之间的换行残留
  css = css.replace(/\n{2,}/g, '\n').trim()

  const out = path.join(LIB, 'katex-inline.css')
  await fs.writeFile(out, css, 'utf8')
  console.log(`  ✓ katex-inline.css  ${kb(Buffer.byteLength(css))}  (${woff2.size} 个 woff2 字体已内联)`)
}

async function main() {
  const t0 = Date.now()
  console.log('构建 Node 端编译引擎…')
  try {
    await buildEngine()
    await buildKatexCss()
  } catch (e) {
    console.error('\n构建失败：', e?.message ?? e)
    if (e?.errors) for (const err of e.errors) console.error('  -', err.text, err.location?.file)
    process.exit(1)
  }
  console.log(`完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
}

main()
