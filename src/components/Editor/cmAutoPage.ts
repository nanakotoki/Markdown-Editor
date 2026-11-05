import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'

/**
 * ============================================================================
 *  cmAutoPage.ts —— 编辑器里的「自动分页」提示
 * ----------------------------------------------------------------------------
 *  行号由 core/pageBreaks.ts 用 A4 量尺算出（和阅读模式同一套切页规则），
 *  这里只负责在对应行首画一条虚线，标上「第 N 页」。
 *  `\newpage` 是作者自己写的硬分页，样式上更实一点，两者一眼能分开。
 * ============================================================================
 */

class AutoPageBreak extends WidgetType {
  constructor(readonly page: number) {
    super()
  }
  eq(other: AutoPageBreak) {
    return other.page === this.page
  }
  toDOM() {
    const el = document.createElement('div')
    el.className = 'cm-autopage'
    el.title = '按 A4 排版，这一行开始是第 ' + this.page + ' 页'
    const tag = document.createElement('span')
    tag.textContent = `第 ${this.page} 页`
    el.appendChild(tag)
    return el
  }
  ignoreEvent() {
    return true
  }
}

interface PageBreakState {
  lines: number[]
  deco: DecorationSet
}

export const setPageBreakLines = StateEffect.define<number[]>()

function buildDeco(state: EditorState, lines: number[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const seen = new Set<number>()
  let page = 2
  for (const ln of [...lines].sort((a, b) => a - b)) {
    if (ln < 1 || ln > state.doc.lines || seen.has(ln)) continue
    seen.add(ln)
    const pos = state.doc.line(ln).from
    builder.add(pos, pos, Decoration.widget({ block: true, widget: new AutoPageBreak(page), side: -1 }))
    page++
  }
  return builder.finish()
}

export const autoPageField = StateField.define<PageBreakState>({
  create: () => ({ lines: [], deco: Decoration.none }),
  update(value, tr) {
    let lines = value.lines
    let changed = false
    for (const e of tr.effects) {
      if (e.is(setPageBreakLines)) {
        lines = e.value
        changed = true
      }
    }
    if (changed) return { lines, deco: buildDeco(tr.state, lines) }
    // 文档改动后旧行号会漂，先让它跟着文本走，等新的量完再整体替换
    if (tr.docChanged) return { lines, deco: value.deco.map(tr.changes) }
    return value
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
})
