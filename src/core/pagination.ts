/**
 * ============================================================================
 *  pagination.ts —— A4 切页规则（阅读模式与编辑器分页提示共用）
 * ----------------------------------------------------------------------------
 *  只做纯几何计算：给一串已排版的顶层块，按「块不能跨页」切成若干页，
 *  返回每页包含的块下标。谁需要分页谁调用，样式与 DOM 结构保持不变。
 * ============================================================================
 */

/** A4 版心：210mm - 18mm×2 = 174mm ≈ 658px；297mm - 20mm×2 = 257mm ≈ 971px */
export const SHEET = { width: 794, height: 1123, padX: 68, padY: 76 }
export const CONTENT_H = SHEET.height - SHEET.padY * 2
/** 留一点余量，避免最后一行贴着页脚 */
export const SAFE_H = CONTENT_H - 18
/** 版心宽度，离屏量尺用 */
export const CONTENT_W = SHEET.width - SHEET.padX * 2

/**
 * 把顶层块切成页。返回值是「每页的块下标」，调用方自己决定怎么渲染。
 * 手动分页符（`\newpage` 渲染出的 data-mf-pagebreak）直接断页，且不进入任何一页。
 */
export function paginateBlocks(kids: HTMLElement[], safeH = SAFE_H): number[][] {
  const out: number[][] = []
  let cur: number[] = []
  let pageTop = kids[0]?.offsetTop ?? 0

  for (let i = 0; i < kids.length; i++) {
    const el = kids[i]
    if (el.hasAttribute('data-mf-pagebreak')) {
      out.push(cur)
      cur = []
      pageTop = el.offsetTop
      continue
    }
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    const isHeading = /^H[1-6]$/.test(el.tagName)
    const next = kids[i + 1]
    const nextBottom = next && !next.hasAttribute('data-mf-pagebreak') ? next.offsetTop + next.offsetHeight : bottom

    // 放不下就换页；标题还要看下一段——避免标题孤零零留在页尾
    const overflow = bottom - pageTop > safeH
    const orphanHeading = isHeading && nextBottom - pageTop > safeH && cur.length > 0
    if ((overflow || orphanHeading) && cur.length > 0) {
      out.push(cur)
      cur = []
      pageTop = top
    }
    cur.push(i)
  }
  out.push(cur)
  return out
}
