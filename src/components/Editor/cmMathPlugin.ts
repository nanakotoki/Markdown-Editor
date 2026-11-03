import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { renderMathSafely, scanMath, type MacroMap, type MathRange } from '../../core/katexSafeRender'
import { eqTagsForText, type EqNumbering, type EqTagStyle } from '../../core/numbering'

/**
 * ============================================================================
 *  cmMathPlugin.ts —— CodeMirror 6 光标感知数学渲染
 * ----------------------------------------------------------------------------
 *  · 光标不在区间内：Decoration.replace 把源码原地替换为 KaTeX DOM
 *  · 光标进入区间：展开源码，并叠加 LaTeX 语法高亮（命令/数字/括号）
 *  · 块级公式居中 + \tag 自动编号
 *  · 错误位置波浪线
 *
 *  注意：块级 replace 装饰（block: true）只能由 StateField 提供，
 *  因此这里用 StateField 而非 ViewPlugin（否则 CM 会抛
 *  RangeError: Block decorations may not be specified via plugins）。
 * ============================================================================
 */

export const refreshMathEffect = StateEffect.define<null>()

class MathWidget extends WidgetType {
  constructor(
    readonly html: string,
    readonly display: boolean,
    readonly latex: string
  ) {
    super()
  }
  eq(other: MathWidget) {
    return other.html === this.html && other.display === this.display
  }
  toDOM() {
    const wrap = document.createElement(this.display ? 'div' : 'span')
    wrap.className = this.display ? 'mf-cm-block' : 'mf-cm-inline'
    wrap.setAttribute('aria-label', this.latex)
    wrap.innerHTML = this.html
    return wrap
  }
  ignoreEvent() {
    return false
  }
}

interface DecoItem {
  from: number
  to: number
  deco: Decoration
}

export interface EditorNumbering {
  eq: EqNumbering
  eqTag: EqTagStyle
}

function buildDecorations(state: EditorState, macros: MacroMap, numbering: EditorNumbering): DecorationSet {
  const text = state.doc.toString()
  const sel = state.selection.main
  const ranges = scanMath(text)
  const items: DecoItem[] = []
  const tags = eqTagsForText(text, numbering)

  for (const r of ranges) {
    const touches = sel.from <= r.to && sel.to >= r.from
    /**
     * 光标停在块级公式第一行的行首（`$$` 之前）时也要展开源码——
     * 否则刚把光标挪上去，整块就塌成一个渲染框，反而挡住了要改的那几行。
     */
    const atStart = sel.empty && sel.head === r.from
    const atEnd = sel.empty && sel.head === r.to
    const active = touches && !atEnd && !(r.type !== 'display' && atStart)

    if (active) {
      // 展开源码态：淡色底 + LaTeX 语法高亮 + 错误波浪线
      items.push({ from: r.from, to: r.to, deco: Decoration.mark({ class: 'cm-math-active' }) })
      const check = renderMathSafely(r.latex, r.type === 'display', macros)
      if (!check.ok) {
        items.push({ from: r.from, to: r.to, deco: Decoration.mark({ class: 'cm-math-error' }) })
      }
      const body = text.slice(r.from, r.to)
      const cmdRe = /\\[a-zA-Z]+/g
      let m: RegExpExecArray | null
      while ((m = cmdRe.exec(body))) {
        items.push({
          from: r.from + m.index,
          to: r.from + m.index + m[0].length,
          deco: Decoration.mark({ class: 'cm-tex-cmd' }),
        })
      }
      const numRe = /(?<![\w\\])\d+(?:\.\d+)?/g
      while ((m = numRe.exec(body))) {
        items.push({
          from: r.from + m.index,
          to: r.from + m.index + m[0].length,
          deco: Decoration.mark({ class: 'cm-tex-num' }),
        })
      }
      const braceRe = /[{}]/g
      while ((m = braceRe.exec(body))) {
        items.push({
          from: r.from + m.index,
          to: r.from + m.index + 1,
          deco: Decoration.mark({ class: 'cm-tex-brace' }),
        })
      }
      continue
    }

    // 渲染态
    const rendered = renderMathSafely(r.latex, r.type === 'display', macros, {
      tag: r.type === 'display' ? r.number : undefined,
      tagLabel: r.type === 'display' && r.number ? tags.get(r.number) : undefined,
    })
    if (r.type === 'display') {
      const lineFrom = state.doc.lineAt(r.from)
      const lineTo = state.doc.lineAt(r.to)
      const beforeOk = text.slice(lineFrom.from, r.from).trim() === ''
      const afterOk = text.slice(r.to, lineTo.to).trim() === ''
      if (beforeOk && afterOk) {
        items.push({
          from: lineFrom.from,
          to: lineTo.to,
          deco: Decoration.replace({ widget: new MathWidget(rendered.html, true, r.latex), block: true }),
        })
        continue
      }
    }
    items.push({
      from: r.from,
      to: r.to,
      deco: Decoration.replace({ widget: new MathWidget(rendered.html, r.type === 'display', r.latex) }),
    })
  }

  items.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  let lastFrom = -1
  let lastTo = -1
  for (const it of items) {
    if (it.from === lastFrom && it.to === lastTo) continue
    if (it.from < lastFrom) continue
    if (it.from > it.to) continue
    if (it.from < lastTo) continue
    builder.add(it.from, it.to, it.deco)
    lastFrom = it.from
    lastTo = it.to
  }
  return builder.finish()
}

/** 光标感知渲染的内联扩展（纯源码模式下不挂载） */
export function mathRenderPlugin(getMacros: () => MacroMap, getNumbering: () => EditorNumbering = () => ({ eq: 'global', eqTag: 'paren' })) {
  const field = StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state, getMacros(), getNumbering()),
    update(value, tr) {
      const forced = tr.effects.some((e) => e.is(refreshMathEffect))
      if (tr.docChanged || tr.selection || forced) {
        return buildDecorations(tr.state, getMacros(), getNumbering())
      }
      return value.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
  return [field]
}

/* ------------------------------------------------------------------ *
 *  错误波浪线（外部可强制标记一段源码）
 * ------------------------------------------------------------------ */

export const setMathError = StateEffect.define<{ from: number; to: number } | null>()

export const mathErrorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setMathError)) {
        next = e.value
          ? Decoration.set([Decoration.mark({ class: 'cm-math-error' }).range(e.value.from, e.value.to)])
          : Decoration.none
      }
    }
    return next
  },
  provide: (f) => EditorView.decorations.from(f),
})

/** 查找光标所在的数学区间（HUD 使用）：必须真正位于两个 $ 之间 */
export function activeMathAt(state: EditorState): MathRange | null {
  const text = state.doc.toString()
  const head = state.selection.main.head
  for (const r of scanMath(text)) {
    if (head > r.from && head < r.to) return r
    // 块级公式停在开头也要算「在里面」，否则工作台会突然消失
    if (r.type === 'display' && head === r.from) return r
  }
  return null
}
