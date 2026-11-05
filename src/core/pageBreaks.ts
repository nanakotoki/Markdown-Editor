/**
 * ============================================================================
 *  pageBreaks.ts —— 算出「PDF 会在哪一行换页」
 * ----------------------------------------------------------------------------
 *  编辑器里没有 A4 纸面，所以这里把一个离屏量尺（宽 = A4 版心）挂到 body，
 *  用和阅读模式完全相同的切页规则算出每页的起始块，再把块的 `data-mf-line`
 *  换回源码行号。编辑器拿到行号后就能在对应位置画一条「第 N 页」虚线。
 *
 *  代价是一次额外的布局（不是额外的 Markdown/KaTeX 解析，HTML 已经渲染好），
 *  调用方应当防抖 + 空闲时调用。
 * ============================================================================
 */

import { CONTENT_W, paginateBlocks } from './pagination'

/** 从某个顶层块开始，往后找到第一个带源码行号的块 */
function lineOfBlock(el: HTMLElement | null): number | null {
  let cur: HTMLElement | null = el
  while (cur) {
    const v = cur.getAttribute('data-mf-line')
    if (v) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) return n
    }
    cur = cur.nextElementSibling as HTMLElement | null
  }
  return null
}

/**
 * 返回「第 2 页、第 3 页……的起始行号」。
 * 第一条分页线不包含第 1 页（第 1 页从第 1 行开始，不需要标）。
 */
export function computePageBreakLines(html: string): number[] {
  if (typeof document === 'undefined' || !html.trim()) return []

  const host = document.createElement('div')
  host.className = 'mf-sheet-measure'
  host.style.width = `${CONTENT_W}px`
  const inner = document.createElement('div')
  inner.className = 'mf-academic'
  inner.innerHTML = html
  host.appendChild(inner)
  document.body.appendChild(host)

  try {
    const kids = Array.from(inner.children) as HTMLElement[]
    if (kids.length < 2) return []
    const pages = paginateBlocks(kids)
    const lines: number[] = []
    for (let p = 1; p < pages.length; p++) {
      const firstIdx = pages[p][0]
      if (firstIdx == null) continue
      const line = lineOfBlock(kids[firstIdx] ?? null)
      if (line != null && !lines.includes(line)) lines.push(line)
    }
    return lines.sort((a, b) => a - b)
  } finally {
    host.remove()
  }
}
