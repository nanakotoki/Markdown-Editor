/**
 * ============================================================================
 *  scrollSync.ts —— 源码与渲染结果之间的行号 <-> 像素坐标换算
 * ----------------------------------------------------------------------------
 *  预览侧每个顶层块都带 data-mf-line（见 renderMarkdown 的 withLineAttr），
 *  编辑侧用 CodeMirror 的 lineBlockAt 拿到同一行的纵向位置。
 *  两边各自收集一组 (行号, y) 锚点，中间的行用线性插值——
 *  块高度不均匀（表格/公式很高），但插值出来的位置足够贴手。
 * ============================================================================
 */

export interface Anchor {
  /** 1 起的源码行号 */
  line: number
  /** 滚动容器内容坐标系里的 y（px） */
  y: number
}

/** 从预览容器里收集锚点；y 已换算到 scrollTop 坐标系 */
export function collectAnchors(root: HTMLElement): Anchor[] {
  const rect = root.getBoundingClientRect()
  const base = root.scrollTop - rect.top
  const out: Anchor[] = []
  const seen = new Set<number>()
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-mf-line]'))) {
    const line = Number(el.dataset.mfLine)
    if (!Number.isFinite(line) || line <= 0 || seen.has(line)) continue
    seen.add(line)
    out.push({ line, y: el.getBoundingClientRect().top + base })
  }
  out.sort((a, b) => a.line - b.line)
  return out
}

/** 平均每行高度，用于首尾之外的线性外推 */
function avgLineHeight(a: Anchor[]): number {
  if (a.length < 2) return 26
  const first = a[0]
  const last = a[a.length - 1]
  const dl = last.line - first.line
  if (dl <= 0) return 26
  return Math.max(6, (last.y - first.y) / dl)
}

/** 行号 -> y（没有锚点时返回 null，交给调用方决定怎么办） */
export function lineToY(anchors: Anchor[], line: number): number | null {
  if (!anchors.length) return null
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (line <= first.line) return first.y - (first.line - line) * avgLineHeight(anchors)
  if (line >= last.line) return last.y + (line - last.line) * avgLineHeight(anchors)

  // 锚点按行号升序，顺序扫描找到包住 line 的两个块
  for (let i = 1; i < anchors.length; i++) {
    const b = anchors[i]
    if (b.line < line) continue
    const a = anchors[i - 1]
    if (b.line === a.line || b.y === a.y) return a.y
    const t = (line - a.line) / (b.line - a.line)
    return a.y + (b.y - a.y) * t
  }
  return last.y
}

/** y -> 行号（非整数：块内的比例位置）。锚点先按 y 排一遍，防止 DOM 里出现绝对定位的块。 */
export function yToLine(anchors: Anchor[], y: number): number | null {
  if (!anchors.length) return null
  const byY = [...anchors].sort((a, b) => a.y - b.y)
  const first = byY[0]
  const last = byY[byY.length - 1]
  if (y <= first.y) return first.line
  if (y >= last.y) return last.line

  for (let i = 1; i < byY.length; i++) {
    const b = byY[i]
    if (b.y < y) continue
    const a = byY[i - 1]
    if (b.y === a.y || b.line === a.line) return a.line
    const t = (y - a.y) / (b.y - a.y)
    return a.line + (b.line - a.line) * t
  }
  return last.line
}

/** 滚动时给目标块加一圈高亮，方便眼睛找到落点 */
export function flashLine(root: HTMLElement, line: number) {
  const el = root.querySelector<HTMLElement>(`[data-mf-line="${line}"]`)
  if (!el) return
  el.classList.add('mf-line-hot')
  window.setTimeout(() => el.classList.remove('mf-line-hot'), 900)
}
