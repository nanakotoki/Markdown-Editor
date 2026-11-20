/**
 * ============================================================================
 *  viewAnchor.ts —— 每个文档「看到第几行」的临时记忆
 * ----------------------------------------------------------------------------
 *  切换 源码 / 分屏 / 阅读 时，组件会被整体卸载重建（两种排版根本不是同一棵
 *  DOM），于是滚动位置一丢就回到开头。这里用一个模块级 Map 记住每篇文档
 *  最后停留的源码行号：离开的模式里滚动时写，进入的模式挂载后读。
 *
 *  不放进 zustand store 是有意的——滚动每秒几十次，写 store 会让整个 App
 *  跟着重渲染，反而把滚动搞卡。这里只是几个数字，不参与 React 渲染。
 *
 *  行号的粒度是「块」。一个跨几十行的证明如果只按块首行对齐，切过去就会
 *  落到块顶。所以两头都要在块内做插值：上报时按块内位置补足小数，
 *  恢复时按「目标行在相邻两个锚点之间的比例」落到块中间。
 * ============================================================================
 */

const lines = new Map<string, number>()

/** 上报/恢复统一用同一个顶部偏移，否则「报出来的行」和「恢复到的行」永远差一截 */
const EDGE = 12

export function setViewLine(docId: string, line: number) {
  if (!docId || !Number.isFinite(line) || line < 1) return
  lines.set(docId, Math.round(line))
}

export function getViewLine(docId: string): number {
  return lines.get(docId) ?? 0
}

export function forgetViewLine(docId: string) {
  lines.delete(docId)
}

type Anchor = { el: HTMLElement; line: number; top: number }

function collectAnchors(root: HTMLElement): Anchor[] {
  const out: Anchor[] = []
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-mf-line]'))) {
    if (el.closest('.mf-sheet-measure')) continue
    const line = Number(el.dataset.mfLine)
    if (!Number.isFinite(line) || line <= 0) continue
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
    // 嵌套锚点（例如证明里的段落）会把同一个行号重复登记，留第一个即可
    out.push({ el, line, top })
  }
  out.sort((a, b) => a.top - b.top)
  return out
}

/**
 * 在滚动容器里定位到「源码第 line 行」。
 * 找到夹住它的两个块后按行号线性插值，这样一个 30 行的证明也能落在
 * 正确的那一段，而不是整块跳回块首。
 * 返回是否找到了落点——阅读模式下分页还没算完时会是 false，调用方可以稍后重试。
 */
export function scrollContainerToLine(root: HTMLElement, line: number): boolean {
  const anchors = collectAnchors(root)
  if (!anchors.length) return false

  let lo = anchors[0]
  let hi: Anchor | null = null
  // 先看有没有一个锚点正好覆盖这一行（行号单调，取最后一个 line <= 目标）
  for (const a of anchors) {
    if (a.line <= line) lo = a
    else if (a.top > lo.top) {
      hi = a
      break
    }
  }

  let y = lo.top
  // 相邻块之间才插值：跨标题（比如段落 49 直接跳到第 1 节的 52）说明中间还有空行、
  // 分页符之类，按行号比例硬插会落到下一段标题上。
  if (hi && hi.line > lo.line && hi.top > lo.top && hi.line - lo.line <= 3) {
    const ratio = Math.min(1, Math.max(0, (line - lo.line) / (hi.line - lo.line)))
    y = lo.top + ratio * (hi.top - lo.top)
  }
  root.scrollTop = Math.max(0, y - EDGE)
  return true
}

/**
 * 滚动容器顶部当前落在源码第几行（在相邻两个块之间插值，返回小数）。
 * 返回 0 表示这一刻还量不出来。
 */
export function lineAtContainerTop(root: HTMLElement): number {
  const anchors = collectAnchors(root)
  if (!anchors.length) return 0
  // 锚点的 top 是「滚动内容里的坐标」，探针也换算到同一套坐标系里比
  const probe = root.scrollTop + EDGE
  let prev: Anchor | null = null
  for (const a of anchors) {
    if (a.top <= probe) prev = a
    else {
      if (!prev) return 0
      const span = a.top - prev.top
      const frac = span > 0 ? (probe - prev.top) / span : 0
      return prev.line + Math.min(1, Math.max(0, frac)) * (a.line - prev.line)
    }
  }
  return prev ? prev.line : 0
}
