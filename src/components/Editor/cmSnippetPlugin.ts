import { EditorView } from '@codemirror/view'
import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { expandFractionWrap, expandSnippet } from '../../core/snippetRules'
import { mathRangeAt } from '../../core/katexSafeRender'

/**
 * ============================================================================
 *  cmSnippetPlugin.ts —— 数学模式无感输入引擎
 * ----------------------------------------------------------------------------
 *  · 输入态自动展开（// 分式、sr 上标、;a 希腊字母、-> 箭头……）
 *  · Tab / Shift+Tab 在占位符之间丝滑跳转
 *  · 仅在光标位于 $...$ / $$...$$ 内部时生效，绝不干扰正文写作
 * ============================================================================
 */

export interface TabStops {
  stops: number[]
  index: number
}

export const setTabStops = StateEffect.define<TabStops | null>()

export const tabStopsField = StateField.define<TabStops | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setTabStops)) return e.value
    if (!value) return null
    if (tr.docChanged) {
      return {
        stops: value.stops.map((s) => tr.changes.mapPos(s, 1)),
        index: value.index,
      }
    }
    return value
  },
})

export interface SnippetOptions {
  /** 数学块内输入 ? 时回调（呼出 AI 指令框） */
  onAskAI?: (mode: 'inline' | 'display') => void
  /** 每次成功展开时回调，用于 HUD 状态提示 */
  onExpanded?: (id: string) => void
}

const EXPANDABLE = /^[a-zA-Z0-9_\-\s|/<>!=~.:;\\]$/

export function snippetExtensions(opts: SnippetOptions = {}): Extension {
  const inputHandler = EditorView.inputHandler.of((view, from, to, text) => {
    if (view.composing) return false
    if (!text || text.length !== 1) return false
    if (!EXPANDABLE.test(text)) return false

    const docText = view.state.doc.toString()
    const range = mathRangeAt(docText, to)
    // 必须真正位于两个定界符之间，避免在 $ 外侧误触发
    if (!range || to <= range.from || to >= range.to) return false

    if (text === '?' && opts.onAskAI) {
      opts.onAskAI(range.type)
      return true
    }

    // 空格：优先匹配 space 规则，再尝试「a/b + 空格」智能分式
    if (text === ' ') {
      const before = view.state.sliceDoc(Math.max(0, to - 40), to)
      let exp = expandSnippet(before, 'space')
      if (!exp) exp = expandFractionWrap(before)
      if (exp) {
        applyExpansion(view, to, exp.length, exp.insert, exp.stops)
        opts.onExpanded?.(exp.id)
        return true
      }
      return false
    }

    const before = view.state.sliceDoc(Math.max(0, to - 40), to) + text
    const exp = expandSnippet(before, 'immediate')
    if (exp) {
      applyExpansion(view, to, exp.length, exp.insert, exp.stops)
      opts.onExpanded?.(exp.id)
      return true
    }
    return false
  })

  const tabKeymap = keymap.of([
    {
      key: 'Tab',
      run: (view) => jumpTab(view, 1),
    },
    {
      key: 'Shift-Tab',
      run: (view) => jumpTab(view, -1),
    },
  ])

  return [tabStopsField, inputHandler, tabKeymap]
}

function applyExpansion(view: EditorView, pos: number, length: number, insert: string, stops: number[]) {
  const from = Math.max(0, pos - length)
  const to = pos
  const anchor = from + (stops[0] ?? insert.length)
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(anchor),
    effects: setTabStops.of({
      stops: stops.map((s) => from + s),
      index: 0,
    }),
    scrollIntoView: true,
    userEvent: 'input.snippet',
  })
}

function jumpTab(view: EditorView, dir: 1 | -1): boolean {
  const ts = view.state.field(tabStopsField, false)
  if (!ts || !ts.stops.length) return false
  let idx = ts.index + dir
  if (idx < 0) idx = 0
  if (idx >= ts.stops.length) {
    // 已经跳完所有占位符：清除状态，交回默认行为
    view.dispatch({ effects: setTabStops.of(null) })
    return true
  }
  const pos = Math.min(view.state.doc.length, ts.stops[idx])
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    effects: setTabStops.of({ ...ts, index: idx }),
    scrollIntoView: true,
  })
  return true
}

/** 判断某个位置是否在数学区间内（供外部复用） */
export function isPosInMath(doc: string, pos: number): boolean {
  return Boolean(mathRangeAt(doc, pos))
}
