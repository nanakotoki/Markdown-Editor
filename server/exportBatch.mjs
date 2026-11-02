import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectBibliography, collectLabels, listDocFiles, safeJoin, parseBibtex } from './fsapi.mjs'

/**
 * ============================================================================
 *  exportBatch.mjs —— 批量编译
 * ----------------------------------------------------------------------------
 *  CLI 的 `mathflow export` 与网页里的「一键导出整本」走同一套逻辑：
 *  读工作区里的 Markdown，编译成 .tex / .html，保持原有目录结构写到输出目录。
 *
 *  HTML 是真正自包含的：KaTeX 样式、字体、学术排版 CSS 全部内联，
 *  拷到任何一台没有网络的电脑上双击都能正确显示公式。
 * ============================================================================
 */

const HERE = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    // 单文件 exe 里没有 import.meta.url，编译引擎由 configureExport 注入
    return path.dirname(process.execPath)
  }
})()
const LIB = path.join(HERE, 'lib')

let enginePromise = null
let katexCssPromise = null

/**
 * 打包成单文件 exe 后，磁盘上没有 lib/engine.mjs 与 katex-inline.css，
 * 由桌面入口把内联好的模块与样式注入进来。
 */
export function configureExport({ engine, katexCss } = {}) {
  if (engine) enginePromise = Promise.resolve(engine)
  if (katexCss) katexCssPromise = Promise.resolve(katexCss)
}

export async function loadEngine() {
  if (!enginePromise) {
    const file = path.join(LIB, 'engine.mjs')
    enginePromise = import(pathToFileURL(file).href).catch((e) => {
      enginePromise = null
      throw new Error(
        `编译引擎尚未构建（${file}）。请先在项目根目录执行：node scripts/build-engine.mjs`,
        { cause: e }
      )
    })
  }
  return enginePromise
}

async function loadKatexCss() {
  if (!katexCssPromise) {
    katexCssPromise = fs
      .readFile(path.join(LIB, 'katex-inline.css'), 'utf8')
      .catch(() => {
        katexCssPromise = null
        throw new Error('找不到 katex-inline.css，请先执行 node scripts/build-engine.mjs')
      })
  }
  return katexCssPromise
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 统计「目标在别的文件里」的引用数量。
 * 这类引用在 HTML 里能跳转，但单文件编译的 LaTeX 里会变成未定义引用，
 * 所以要在提示里说清楚，而不是笼统报「找不到目标」。
 */
const REF_PATTERN = /@(eq|thm|lem|def|prop|cor|exa|prf|alg|sec|fig|tab):([A-Za-z0-9_\-:一-龥]+)/g

function countExternalRefs(markdown, labels, currentFile) {
  const local = new Set(labels.filter((l) => l.file === currentFile).map((l) => l.id))
  const elsewhere = new Set(labels.filter((l) => l.file !== currentFile).map((l) => l.id))
  const seen = new Set()
  let n = 0
  REF_PATTERN.lastIndex = 0
  let m
  while ((m = REF_PATTERN.exec(markdown))) {
    const bare = m[2].replace(/^(eq|thm|lem|def|prop|cor|exa|prf|alg|sec|fig|tab):/, '')
    if (local.has(bare) || !elsewhere.has(bare)) continue
    if (seen.has(bare)) continue
    seen.add(bare)
    n++
  }
  return n
}

/** 从正文里找标题：优先第一个 H1，退化为文件名 */function pickTitle(markdown, fallback) {
  const m = /^#\s+(.+)$/m.exec(markdown)
  if (!m) return fallback
  return m[1]
    .replace(/\{#.*\}\s*$/, '')
    .replace(/[`*_~$]/g, '')
    .trim()
    .slice(0, 120)
}

/** 自然排序：`01-引言` < `2-方法` < `10-结语`，中文按拼音 */
function naturalCompare(a, b) {
  return a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

/** 路径去掉扩展名，用作合并时的索引键 */
function stripExt(p) {
  return p.replace(/\.(md|markdown|mdx)$/i, '')
}

/**
 * 合并阅读版里，每篇文档的内联锚点都要加文件前缀，
 * 否则两篇文档里都有 `#thm-main` 时，第一个之后的全跳错地方。
 */
function scopeHtml(html, prefix, relToIndex) {
  let out = html
    // 跨文件链接 chapters/02.html#thm-x -> #f2-thm-x
    .replace(/href="([^"#]+)\.html#([^"]+)"/g, (m, file, anchor) => {
      const idx = relToIndex.get(file)
      return idx ? `href="#%XF${idx}%${anchor}"` : m
    })
    // 本文锚点统一加前缀（前面不能是 - 或字母，否则会误伤 data-ref-id 这类属性）
    .replace(/(?<![\w-])id="([^"]+)"/g, (m, id) => `id="${prefix}${id}"`)
    .replace(/(?<![\w-])href="#(?!%XF)/g, `href="#${prefix}`)
    // 最后落地跨文件前缀，避免被上一步二次加前缀
    .replace(/href="#%XF(\d+)%/g, (m, idx) => `href="#f${idx}-`)
  return out
}

const BOOK_CSS = `
.mf-book-toc { margin: 0 0 2.4em; padding: 1.2em 1.4em; background: #faf9f6; border: 1px solid #e7e3da; border-radius: 10px; }
.mf-book-toc h2 { margin: 0 0 .8em; font-size: 1.05em; letter-spacing: .12em; }
.mf-book-toc ol { margin: 0; padding-left: 1.4em; }
.mf-book-toc li { margin: .34em 0; }
.mf-book-toc a { color: #1f2937; text-decoration: none; border-bottom: 1px solid #d6d3d1; }
.mf-book-toc .mf-book-file { margin-left: .6em; font-size: .78em; color: #9ca3af; font-family: ui-monospace, monospace; }
.mf-book-chapter { padding-top: .4em; }
.mf-book-chapter + .mf-book-chapter { break-before: page; page-break-before: always; }
.mf-book-src { margin: 0 0 .6em; font-family: ui-monospace, monospace; font-size: .72em; color: #b0aca4; }
@media print { .mf-book-toc { break-after: page; page-break-after: always; } .mf-book-src { display: none; } }
`

/** 把多篇已渲染的 HTML 拼成一份「整本阅读版」 */
function composeBookHtml({ title, docs, academicCss, katexCss, meta }) {
  const relToIndex = new Map()
  docs.forEach((d, i) => relToIndex.set(stripExt(d.rel), i + 1))

  const toc = docs
    .map(
      (d, i) =>
        `<li><a href="#mfsec-${i + 1}">${escHtml(d.title)}</a><span class="mf-book-file">${escHtml(d.rel)}</span></li>`
    )
    .join('\n')

  const sections = docs
    .map((d, i) => {
      const body = scopeHtml(d.html ?? '', `f${i + 1}-`, relToIndex)
      return `<section class="mf-book-chapter" id="mfsec-${i + 1}" data-src="${escHtml(d.rel)}">
<div class="mf-book-src">${escHtml(d.rel)}</div>
${body}
</section>`
    })
    .join('\n')

  return composeHtml({
    title,
    bodyHtml: `<nav class="mf-book-toc"><h2>目录</h2><ol>\n${toc}\n</ol></nav>\n${sections}`,
    academicCss,
    katexCss,
    meta,
    extraCss: BOOK_CSS,
  })
}
function composeHtml({ title, bodyHtml, academicCss, katexCss, meta, extraCss = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(title)}</title>
<style>${katexCss}</style>
<style>${academicCss}</style>
${extraCss ? `<style>${extraCss}</style>` : ''}
</head>
<body>
<div class="mf-page">
<div class="mf-meta"><span>MathFlow 导出</span>${meta ? `<span>${escHtml(meta)}</span>` : ''}<span>${new Date().toLocaleDateString('zh-CN')}</span></div>
<div class="mf-academic">${bodyHtml}</div>
</div>
<div class="mf-print-bar"><button onclick="window.print()" class="primary">打印 / 导出 PDF</button></div>
</body>
</html>`
}

/**
 * 执行批量导出。
 * @param {object} opts
 * @param {string} opts.root            工作区根目录
 * @param {string[]} [opts.files]       指定文件（相对路径），省略则导出全部
 * @param {string[]} [opts.to]          ['tex','html'] 的任意子集
 * @param {'ctexart'|'ctexbook'|'article'|'IEEEtran'} [opts.template]
 * @param {string} [opts.outDir]        相对 root 的输出目录
 * @param {boolean} [opts.keepTree]     是否保留原子目录结构
 * @param {boolean} [opts.combine]      是否额外产出合并版（main.tex / main.html），默认多篇文档时开启
 * @param {string} [opts.title]         合并版的标题，默认取工作区目录名
 * @param {(msg:string)=>void} [opts.onProgress]
 */
export async function exportWorkspace(opts) {
  const {
    root,
    to = ['tex', 'html'],
    template = 'ctexart',
    outDir = 'export',
    keepTree = true,
    onProgress,
  } = opts

  const engine = await loadEngine()
  const katexCss = to.includes('html') ? await loadKatexCss() : ''

  const files = opts.files?.length ? opts.files : await listDocFiles(root)
  if (!files.length) return { outputs: [], warnings: ['工作区里没有找到 .md 文档'] }

  const bib = await collectBibliography(root)

  // 整个工作区的标签索引：让跨文件引用在 HTML 里也能解析成可点击的文件链接，
  // 而不是一片红色 broken 标记。
  const labels = await collectLabels(root).catch(() => [])

  const absOut = safeJoin(root, outDir)
  const outputs = []
  const warnings = []
  /** 合并版要用到：正文、标题、渲染好的 HTML */
  const docs = []

  for (const rel of files) {
    let markdown
    try {
      markdown = await fs.readFile(safeJoin(root, rel), 'utf8')
    } catch (e) {
      warnings.push(`${rel}: 读取失败（${e.message}）`)
      continue
    }

    const extRefs = engine.labelsToRefEntries(labels, rel)
    const externalRefs = countExternalRefs(markdown, labels, rel)
    if (externalRefs) {
      warnings.push(
        `${rel}: ${externalRefs} 处引用指向其它文件 —— HTML 里可点击跳转；LaTeX 需要合并编译或 \\input 才能解析`
      )
    }

    const title = pickTitle(markdown, path.basename(rel, path.extname(rel)))
    const relDir = keepTree ? path.dirname(rel) : '.'
    const base = path.basename(rel, path.extname(rel))
    const record = { src: rel, title }
    let bodyHtml = ''

    if (to.includes('tex')) {
      try {
        const res = engine.compileToLatex(markdown, { template, title, bib })
        const dest = path.join(absOut, relDir === '.' ? '' : relDir, `${base}.tex`)
        await fs.mkdir(path.dirname(dest), { recursive: true })
        await fs.writeFile(dest, res.tex, 'utf8')
        record.tex = path.relative(root, dest).split(path.sep).join('/')
        record.texBytes = Buffer.byteLength(res.tex)
        record.stats = res.stats
      } catch (e) {
        warnings.push(`${rel}: LaTeX 编译失败（${e.message}）`)
      }
    }

    if (to.includes('html')) {
      try {
        const rendered = engine.renderMarkdown(markdown, {
          macros: {},
          bib,
          autoNumber: true,
          citationStyle: 'numeric',
          extRefs,
          externalRefLinks: to.includes('html'),
        })
        const broken = (rendered.html.match(/mf-ref-broken/g) || []).length
        if (broken) warnings.push(`${rel}: ${broken} 处交叉引用在整个工作区里都找不到目标`)
        bodyHtml = rendered.html
        const html = composeHtml({
          title,
          bodyHtml: rendered.html,
          academicCss: engine.ACADEMIC_CSS,
          katexCss,
          meta: template,
        })
        const dest = path.join(absOut, relDir === '.' ? '' : relDir, `${base}.html`)
        await fs.mkdir(path.dirname(dest), { recursive: true })
        await fs.writeFile(dest, html, 'utf8')
        record.html = path.relative(root, dest).split(path.sep).join('/')
        record.htmlBytes = Buffer.byteLength(html)
      } catch (e) {
        warnings.push(`${rel}: HTML 渲染失败（${e.message}）`)
      }
    }

    outputs.push(record)
    docs.push({ rel, title, markdown, html: bodyHtml })
    onProgress?.(record)
  }

  /* ---------------------------------------------------------------- *
   *  合并版：main.tex（\input 各章）+ main.html（整本阅读）
   * ---------------------------------------------------------------- */
  const wantCombine = opts.combine ?? files.length > 1
  let combined = null
  // 显式 --combine 时哪怕只有一篇也生成，方便统一流水线
  if (wantCombine && (docs.length > 1 || opts.combine === true)) {
    const ordered = [...docs].sort((a, b) => naturalCompare(a.rel, b.rel))
    // 书名默认用工作区目录名：拿第一章标题当书名，多半不是用户想要的
    const bookTitle = opts.title || path.basename(root).replace(/^\.+/, '') || 'MathFlow 文集'

    if (to.includes('tex')) {
      try {
        const chapters = ordered.map((d, i) => ({
          title: d.title,
          markdown: d.markdown,
          inputPath: `sections/sec-${String(i + 1).padStart(2, '0')}`,
          source: d.rel,
        }))
        const book = engine.compileBook(chapters, { template, title: bookTitle, bib })
        const secDir = path.join(absOut, 'sections')
        await fs.mkdir(secDir, { recursive: true })
        for (const [i, s] of book.sections.entries()) {
          await fs.writeFile(path.join(secDir, `sec-${String(i + 1).padStart(2, '0')}.tex`), s.tex, 'utf8')
        }
        await fs.mkdir(absOut, { recursive: true })
        await fs.writeFile(path.join(absOut, 'main.tex'), book.mainTex, 'utf8')
        combined = combined ?? {}
        combined.mainTex = path.join(outDir, 'main.tex').split(path.sep).join('/')
        combined.chapters = book.sections.length
        combined.stats = book.stats
        combined.bibUsed = book.bibUsed
        // 合并后跨文件引用就都成立了，不必再逐条提示
        for (let i = warnings.length - 1; i >= 0; i--) {
          if (/LaTeX 需要合并编译/.test(warnings[i])) warnings.splice(i, 1)
        }
      } catch (e) {
        warnings.push(`合并编译失败（${e.message}）`)
      }
    }

    if (to.includes('html')) {
      try {
        const html = composeBookHtml({
          title: bookTitle,
          docs: ordered,
          academicCss: engine.ACADEMIC_CSS,
          katexCss,
          meta: `${ordered.length} 篇 · ${template}`,
        })
        await fs.mkdir(absOut, { recursive: true })
        await fs.writeFile(path.join(absOut, 'main.html'), html, 'utf8')
        combined = combined ?? {}
        combined.mainHtml = path.join(outDir, 'main.html').split(path.sep).join('/')
        combined.htmlBytes = Buffer.byteLength(html)
      } catch (e) {
        warnings.push(`合并阅读版生成失败（${e.message}）`)
      }
    }
  }

  // 顺手写一份 manifest，方便脚本化流水线知道这次编译了什么
  const manifest = {
    generatedAt: new Date().toISOString(),
    template,
    targets: to,
    bibEntries: bib.length,
    outputs,
    combined,
    warnings,
  }
  await fs.mkdir(absOut, { recursive: true })
  await fs.writeFile(path.join(absOut, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  return { outputs, warnings, outDir, combined, manifest: path.join(outDir, 'manifest.json') }
}

/** 供 HTTP API 复用：解析工作区内的 .bib 文本 */
export { parseBibtex }
