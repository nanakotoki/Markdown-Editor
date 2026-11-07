import { renderMarkdown, type RenderResult } from './renderMarkdown'
import { getInlinedKatexCss } from './clipboardExport'
import { ACADEMIC_CSS } from './academicCss'
import type { MacroMap } from './katexSafeRender'
import { DEFAULT_SETTINGS, type BibEntry, type Settings } from '../store/useEditorStore'
import { KAI_STACK, resolveExportStack, roleFontStack } from './appearance'

/**
 * ============================================================================
 *  htmlExport.ts —— 单文件离线学术网页
 * ----------------------------------------------------------------------------
 *  把 KaTeX 样式与字体（base64）、学术排版 CSS 全部内嵌，
 *  下载后双击即可离线打开，Ctrl+P 即为 A4 学术排版 PDF。
 * ============================================================================
 */

export { ACADEMIC_CSS } from './academicCss'
export interface HtmlExportOptions {
  title?: string
  author?: string
  macros?: MacroMap
  bib?: BibEntry[]
  settings?: Settings
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function buildStandaloneHtml(markdown: string, opts: HtmlExportOptions = {}): Promise<{ html: string; result: RenderResult }> {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(opts.settings ?? {}) }
  const result = renderMarkdown(markdown, {
    macros: opts.macros ?? {},
    bib: opts.bib ?? [],
    autoNumber: settings.autoNumberEquations,
    citationStyle: settings.citationStyle,
    numbering: { thm: settings.thmNumbering, eq: settings.eqNumbering, eqTag: settings.eqTagStyle },
    qed: settings.qedSymbol,
    headingNumbering: settings.headingNumbering,
    figNumbering: settings.figNumbering,
  })
  const katex = await getInlinedKatexCss()
  const date = new Date().toLocaleDateString('zh-CN')
  /** 把外观设置写成内联变量：导出的 HTML 与应用里看到的排版一致 */
  const exportFont = resolveExportStack(settings)
  /** 打印时的页边距交给 .mf-page 的内边距，所以这两个变量挂在它身上 */
  const pageStyle = [
    `--mf-pad-x:${(settings.pageMarginX * (96 / 25.4)).toFixed(2)}px`,
    `--mf-pad-y:${(settings.pageMarginY * (96 / 25.4)).toFixed(2)}px`,
  ].join(';')
  const bodyStyle = [
    `--mf-serif:${exportFont}`,
    `--mf-thm-body-font:${settings.thmBodyKai ? KAI_STACK : exportFont}`,
    `--mf-thm-head-font:${roleFontStack(settings.thmHeadFont, settings.thmHeadFontCustom, 'sans')}`,
    `--mf-proof-mark-font:${roleFontStack(settings.proofMarkFont, settings.proofMarkFontCustom, 'kai')}`,
    `--mf-sol-mark-font:${roleFontStack(settings.solMarkFont, settings.solMarkFontCustom, 'serif')}`,
    `font-size:${settings.previewFontSize}px`,
    `line-height:${settings.previewLineHeight}`,
    `font-weight:${settings.previewWeight}`,
  ].join(';')
  const html = `<!doctype html>
<html lang="zh-CN" data-thm-style="${esc(settings.thmStyle)}" data-math-style="${esc(settings.mathStyle)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.title ?? 'MathFlow 文档')}</title>
<style>${katex}</style>
<style>${ACADEMIC_CSS}</style>
</head>
<body>
<div class="mf-page">
  <div class="mf-meta"><span>MathFlow 导出</span><span>${esc(opts.author || '')}</span><span>${date}</span></div>
  <div class="mf-academic" style="${bodyStyle}">${result.html}</div>
</div>
<div class="mf-print-bar">
  <button onclick="window.print()" class="primary">打印 / 导出 PDF</button>
</div>
</body>
</html>`
  return { html, result }
}

/** 打开新窗口预览（可直接 Ctrl+P 打印为 A4 PDF） */
export function openHtmlInNewWindow(html: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
