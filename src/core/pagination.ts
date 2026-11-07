/**
 * ============================================================================
 *  pagination.ts —— A4 切页规则（阅读模式 / 编辑器分页提示 / 打印共用）
 * ----------------------------------------------------------------------------
 *  只做纯几何计算：给一串已排版的顶层块，按「块不能跨页」切成若干页。
 *  两个例外：
 *   · 标记了 data-mf-splittable 的块（证明、解答）允许在内部段落之间断开，
 *     否则一段长证明会被整块推到下一页，上一页留一大片空白；
 *   · data-mf-pagebreak 是手动分页符，直接断页且不进入任何一页。
 *
 *  版心尺寸不再写死：从 CSS 变量 --mf-pad-x / --mf-pad-y 读页边距，
 *  页边距改了，屏幕分页与打印分页仍然同步变化。
 * ============================================================================
 */

/** 1mm 在 96dpi 下是多少 px */
export const MM_TO_PX = 96 / 25.4

/** A4 纸面（96dpi）：210mm × 297mm。
 *  屏幕与打印共用这套 mm 尺寸，CSS 里也写 mm，避免 px 取整导致两边折行不同。 */
export const A4 = { width: 210 * MM_TO_PX, height: 297 * MM_TO_PX, padX: 18 * MM_TO_PX, padY: 20 * MM_TO_PX }

/** 兼容旧引用 */
export const SHEET = { width: A4.width, height: A4.height, padX: A4.padX, padY: A4.padY }

export interface SheetMetrics {
  width: number
  height: number
  padX: number
  padY: number
  contentW: number
  contentH: number
  /** 可用高度：留一点余量，避免最后一行贴着页脚 */
  safeH: number
}

/** 当前版心（跟随设置里的页边距） */
export function readMetrics(): SheetMetrics {
  let padX = SHEET.padX
  let padY = SHEET.padY
  if (typeof window !== 'undefined' && document?.documentElement) {
    const cs = getComputedStyle(document.documentElement)
    const vx = Number.parseFloat(cs.getPropertyValue('--mf-pad-x'))
    const vy = Number.parseFloat(cs.getPropertyValue('--mf-pad-y'))
    if (Number.isFinite(vx) && vx > 0) padX = vx
    if (Number.isFinite(vy) && vy > 0) padY = vy
  }
  const contentH = SHEET.height - padY * 2
  return {
    width: SHEET.width,
    height: SHEET.height,
    padX,
    padY,
    contentW: SHEET.width - padX * 2,
    contentH,
    safeH: contentH - 14,
  }
}

/** 版心宽度（离屏量尺用），默认值；实际请用 readMetrics().contentW */
export const CONTENT_W = SHEET.width - SHEET.padX * 2
export const CONTENT_H = SHEET.height - SHEET.padY * 2
export const SAFE_H = CONTENT_H - 18

/**
 * 分页单元。
 * 普通块：`child` 为空，整块放进一页。
 * 可拆块：`child` 是块内「流容器」的第几个子块，同一块的连续单元会被合并回一个容器。
 */
export interface PageUnit {
  el: HTMLElement
  child: number
}

/** 块内流容器的选择器（证明/解答的正文容器） */
const FLOW_SELECTOR = '[data-mf-flow]'

function isSplittable(el: HTMLElement): boolean {
  return el.hasAttribute('data-mf-splittable') && !!el.querySelector(FLOW_SELECTOR)
}

/**
 * 把顶层块切成页（阅读模式 / 打印用）。
 * 返回每一页包含的单元；调用方据此渲染每张纸面。
 */
export function paginateElements(kids: HTMLElement[], safeH = readMetrics().safeH): PageUnit[][] {
  if (!kids.length) return [[]]
  const base = kids[0].getBoundingClientRect().top
  const topOf = (el: HTMLElement) => el.getBoundingClientRect().top - base
  const heightOf = (el: HTMLElement) => el.getBoundingClientRect().height

  const pages: PageUnit[][] = []
  let cur: PageUnit[] = []
  let pageTop = 0

  const breakPage = (nextTop: number) => {
    pages.push(cur)
    cur = []
    pageTop = nextTop
  }

  /** 标题孤行：标题本身放得下、但下一段放不下时，整体挪到下一页 */
  const headingOrphan = (el: HTMLElement, i: number): boolean => {
    if (!/^H[1-6]$/.test(el.tagName)) return false
    const next = kids[i + 1]
    if (!next || next.hasAttribute('data-mf-pagebreak')) return false
    const bottom = next.getBoundingClientRect().bottom - base
    return bottom - pageTop > safeH && cur.length > 0
  }

  for (let i = 0; i < kids.length; i++) {
    const el = kids[i]
    if (el.hasAttribute('data-mf-pagebreak')) {
      if (cur.length) breakPage(topOf(el))
      pageTop = topOf(el)
      continue
    }

    if (isSplittable(el) && heightOf(el) > safeH * 0.72) {
      const flow = el.querySelector(FLOW_SELECTOR) as HTMLElement
      const parts = Array.from(flow.children) as HTMLElement[]
      if (parts.length > 1) {
        for (let c = 0; c < parts.length; c++) {
          const t = parts[c].getBoundingClientRect().top - base
          const b = t + parts[c].getBoundingClientRect().height
          // 首段带上容器顶部装饰与外层边距，多留一点空间判断
          const unitTop = c === 0 ? topOf(el) : t
          if (b - pageTop > safeH && cur.length > 0) breakPage(unitTop)
          cur.push({ el, child: c })
        }
        continue
      }
    }

    const top = topOf(el)
    const bottom = top + heightOf(el)
    if ((bottom - pageTop > safeH || headingOrphan(el, i)) && cur.length > 0) breakPage(top)
    cur.push({ el, child: -1 })
  }
  pages.push(cur)
  return pages.map((p) => p.filter(Boolean))
}

/**
 * 兼容旧调用：只关心「每页有哪些顶层块下标」时用这个。
 * 可拆块会被拆成多条单元，这里按块去重后返回其下标。
 */
export function paginateBlocks(kids: HTMLElement[], safeH = readMetrics().safeH): number[][] {
  const indexOf = new Map<HTMLElement, number>()
  kids.forEach((el, i) => indexOf.set(el, i))
  return paginateElements(kids, safeH).map((units) => {
    const seen: number[] = []
    for (const u of units) {
      const i = indexOf.get(u.el)
      if (i != null && !seen.includes(i)) seen.push(i)
    }
    return seen
  })
}
