import { renderMarkdown, type RenderResult } from './renderMarkdown'
import { getInlinedKatexCss } from './clipboardExport'
import { ACADEMIC_CSS } from './academicCss'
import type { MacroMap } from './katexSafeRender'
import type { BibEntry, Settings } from '../store/useEditorStore'

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
  const settings: Settings = opts.settings ?? {
    autoNumberEquations: true,
    citationStyle: 'numeric',
    texTemplate: 'ctexart',
    showLineNumbers: true,
    previewFont: 'serif',
    previewFontSize: 16.5,
    previewLineHeight: 1.9,
    previewWeight: 400,
    editorFont: 'serif',
    editorFontSize: 15,
    syncScroll: true,
  }
  const result = renderMarkdown(markdown, {
    macros: opts.macros ?? {},
    bib: opts.bib ?? [],
    autoNumber: settings.autoNumberEquations,
    citationStyle: settings.citationStyle,
  })
  const katex = await getInlinedKatexCss()
  const date = new Date().toLocaleDateString('zh-CN')
  const html = `<!doctype html>
<html lang="zh-CN">
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
  <div class="mf-academic">${result.html}</div>
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
