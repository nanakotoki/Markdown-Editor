import { useCallback, useEffect, useRef, useState } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { tags as t } from '@lezer/highlight'
import { activeMathAt, mathRenderPlugin, refreshMathEffect } from './cmMathPlugin'
import { snippetExtensions } from './cmSnippetPlugin'
import { markdownPreviewPlugin, markdownSmartInput } from './cmMarkdownPreview'
import { refCompletion } from './cmRefCompletion'
import FloatingMathHUD from './FloatingMathHUD'
import { editorBridge } from '../../store/editorBridge'
import { renderMathSafely, mathRangeAt, type MacroMap } from '../../core/katexSafeRender'
import { renderMarkdown, type RefEntry } from '../../core/renderMarkdown'
import { computePageBreakLines } from '../../core/pageBreaks'
import { autoPageField, setPageBreakLines } from './cmAutoPage'
import type { BibEntry } from '../../store/useEditorStore'
import { useEditorStore } from '../../store/useEditorStore'

export interface MathFlowEditorProps {
  docId: string
  initialContent: string
  onChange: (v: string) => void
  getRefs: () => RefEntry[]
  getBib: () => BibEntry[]
  getMacros: () => MacroMap
  onRequestBuilder: (kind: 'matrix' | 'ai' | 'plot', latex: string) => void
  /** 纯源码模式：关闭内联 KaTeX 替换 */
  plain?: boolean
}

const mfHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: '700', color: '#141a23', lineHeight: '1.5' },
  { tag: t.heading2, fontSize: '1.32em', fontWeight: '700', color: '#1f2733', lineHeight: '1.5' },
  { tag: t.heading3, fontSize: '1.14em', fontWeight: '700', color: '#1f2733' },
  { tag: t.heading4, fontWeight: '700', color: '#2f3846' },
  { tag: t.strong, fontWeight: '700', color: '#141a23' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: '#2a55d4', textDecoration: 'underline' },
  { tag: t.url, color: '#5d8bfa' },
  { tag: t.monospace, fontFamily: 'var(--mf-mono)', background: '#eef0f4', color: '#b4491f' },
  { tag: t.quote, color: '#5d6779', fontStyle: 'italic' },
  { tag: t.list, color: '#3b6ef0' },
  { tag: t.meta, color: '#8e97a8' },
  { tag: t.keyword, color: '#2a55d4' },
  { tag: t.comment, color: '#8e97a8' },
])

/** 行号夹取到文档范围（预览里点到的行号可能比当前文档还大） */
function clampLine(view: EditorView, line: number): number {
  return Math.min(Math.max(1, Math.round(line)), view.state.doc.lines)
}

/** .cm-content 顶端在滚动坐标系里的位置（含 scroller 的上内边距） */
function contentOffset(view: EditorView): number {
  const content = view.contentDOM.getBoundingClientRect()
  const scroller = view.scrollDOM.getBoundingClientRect()
  return content.top - scroller.top + view.scrollDOM.scrollTop
}

const mfTheme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: 'var(--mf-editor-size, 15px)', color: '#1f2733', background: 'transparent' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--mf-editor-font)',
      lineHeight: '1.95',
      padding: '26px 44px 140px',
      overflow: 'auto',
    },
    '.cm-content': { maxWidth: '840px', margin: '0 auto', caretColor: '#2a55d4' },
    '.cm-line': { padding: '0 2px' },
    '.cm-selectionBackground, ::selection': { background: '#dbe6ff !important' },
    '.cm-cursor': { borderLeftWidth: '2px', borderLeftColor: '#2a55d4' },
    '.cm-activeLine': { background: 'rgba(59,110,240,0.028)' },
    '.cm-tooltip': {
      border: '1px solid #dfe3ea',
      borderRadius: '10px',
      boxShadow: '0 12px 30px -12px rgba(20,26,35,.25)',
      overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mf-sans)', fontSize: '13px', maxHeight: '300px' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { background: '#eef4ff', color: '#223d87' },
    '.cm-completionDetail': { color: '#8e97a8', fontStyle: 'normal', marginLeft: '8px', fontSize: '11px' },
    '.cm-snippet-hint': { color: '#8e97a8' },
  },
  { dark: false }
)

export default function MathFlowEditor({
  docId,
  initialContent,
  onChange,
  getRefs,
  getBib,
  getMacros,
  onRequestBuilder,
  plain = false,
}: MathFlowEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const timerRef = useRef<number | null>(null)
  const mathCompartment = useRef(new Compartment()).current
  const [hud, setHud] = useState<{
    from: number
    to: number
    latex: string
    display: boolean
  } | null>(null)
  /** 公式工作台折叠状态：折叠后只剩一条 32px 的头部，正文区完整还给你 */
  const [hudCollapsed, setHudCollapsed] = useState(() => {
    try {
      return localStorage.getItem('mf-hud-collapsed') === '1'
    } catch {
      return false
    }
  })

  const showToast = useEditorStore((s) => s.showToast)
  const addFavorite = useEditorStore((s) => s.addFavorite)

  /** 编号规则（公式按节 / 写法）——编辑器里的行间公式要和右侧预览显示同一个编号 */
  const getNumbering = useCallback(() => {
    const st = useEditorStore.getState().settings
    return { thm: st.thmNumbering, eq: st.eqNumbering, eqTag: st.eqTagStyle } as const
  }, [])

  /**
   * 自动分页提示：停笔后用 A4 量尺量一次「PDF 会在第几行换页」。
   * 放在空闲时算，且只在内容/排版参数变化后重算，不跟着每次按键走。
   */
  const pageTimer = useRef<number | null>(null)
  const schedulePageBreaks = useCallback(() => {
    if (pageTimer.current) window.clearTimeout(pageTimer.current)
    pageTimer.current = window.setTimeout(() => {
      const run = () => {
        const view = viewRef.current
        if (!view) return
        const st = useEditorStore.getState().settings
        try {
          const res = renderMarkdown(view.state.doc.toString(), {
            macros: getMacros(),
            bib: getBib(),
            autoNumber: st.autoNumberEquations,
            citationStyle: st.citationStyle,
            extRefs: getRefs(),
            numbering: { thm: st.thmNumbering, eq: st.eqNumbering, eqTag: st.eqTagStyle },
            qed: st.qedSymbol,
          })
          view.dispatch({ effects: setPageBreakLines.of(computePageBreakLines(res.html)) })
        } catch {
          /* 渲染失败就保留上一批分页线，不打断编辑 */
        }
      }
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback
      if (ric) ric(run, { timeout: 1200 })
      else run()
    }, 600)
  }, [getMacros, getBib, getRefs])

  /** 排版参数变了（字号、行距、容器样式），分页位置也会变 */
  const layoutSignature = useEditorStore((s) =>
    [
      s.settings.previewFont,
      s.settings.previewFontCustom,
      s.settings.previewFontSize,
      s.settings.previewLineHeight,
      s.settings.previewWeight,
      s.settings.thmStyle,
      s.settings.thmBodyKai,
      s.settings.mathStyle,
      s.settings.qedSymbol,
      s.settings.thmNumbering,
      s.settings.eqNumbering,
      s.settings.eqTagStyle,
    ].join('|')
  )

  useEffect(() => {
    schedulePageBreaks()
  }, [layoutSignature, schedulePageBreaks])

  /** 折叠 / 展开公式工作台，并记住这次的选择 */
  const toggleHudCollapsed = useCallback(() => {
    setHudCollapsed((v) => {
      try {
        localStorage.setItem('mf-hud-collapsed', v ? '0' : '1')
      } catch {
        /* 存不下只影响这次会话 */
      }
      return !v
    })
  }, [])

  const flush = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    onChange(view.state.doc.toString())
  }, [onChange])

  /**
   * 工作台只关心「光标是不是在一段公式里」，不再计算屏幕坐标——
   * 它是停靠在编辑区底部的面板，不覆盖任何一行代码。
   */
  const syncHud = useCallback((view: EditorView) => {
    const range = activeMathAt(view.state)
    if (!range) {
      setHud(null)
      return
    }
    setHud((prev) => {
      if (prev && prev.from === range.from && prev.to === range.to && prev.latex === range.latex) return prev
      return {
        from: range.from,
        to: range.to,
        latex: range.latex,
        display: range.type === 'display',
      }
    })
  }, [])

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        history(),
        markdown({ codeLanguages: [] }),
        syntaxHighlighting(mfHighlight),
        EditorView.lineWrapping,
        highlightSelectionMatches(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
          {
            key: 'Mod-k',
            run: (view) => {
              const r = activeMathAt(view.state)
              onRequestBuilder('ai', r?.latex ?? '')
              return true
            },
          },
          {
            // 折叠 / 展开底部公式工作台，把高度还给正文
            key: 'Mod-Shift-m',
            run: () => {
              toggleHudCollapsed()
              return true
            },
          },
          {
            // 本地模式：立刻落盘（平时是自动保存，这里给一个「手部肌肉」出口）
            key: 'Mod-s',
            run: () => {
              const s = useEditorStore.getState()
              if (s.mode === 'local') {
                flush()
                // 自动保存模式下不弹提示：每按一次就挡一次视线，而落盘这件事本来已经由标签圆点表达
                if (s.settings.saveMode === 'manual') {
                  void s.saveDoc(docId).then(() => s.showToast('已保存到磁盘', 'success'))
                } else {
                  void s.saveDoc(docId)
                }
              } else {
                s.showToast('浏览器内文档已在本地自动保存', 'info')
              }
              return true
            },
          },
        ]),
        autoPageField,
        mathCompartment.of(plain ? [] : [...mathRenderPlugin(() => getMacros(), getNumbering), markdownPreviewPlugin(getNumbering), markdownSmartInput()]),
        snippetExtensions({
          onAskAI: () => {
            const view = viewRef.current
            const r = view ? activeMathAt(view.state) : null
            onRequestBuilder('ai', r?.latex ?? '')
          },
          onExpanded: () => {},
          isEnabled: () => useEditorStore.getState().settings.autoSnippet !== false,
        }),
        refCompletion({ getRefs, getBib, getMacros }),
        mfTheme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            if (timerRef.current) window.clearTimeout(timerRef.current)
            timerRef.current = window.setTimeout(flush, 160)
            schedulePageBreaks()
          }
          if (u.docChanged || u.selectionSet || u.focusChanged) syncHud(u.view)
        }),
        EditorView.domEventHandlers({
          mousedown: (e, view) => {
            const target = e.target as HTMLElement | null
            const widget = target?.closest('.mf-cm-inline, .mf-cm-block') as HTMLElement | null
            if (!widget) return false
            // 点哪儿就把光标放到源码里大致对应的位置：按横向比例映射到 LaTeX 字符
            const doc = view.state.doc.toString()
            const pos = view.posAtDOM(widget)
            const range = mathRangeAt(doc, Math.min(pos + 1, doc.length))
            let anchor = Math.min(doc.length, pos + 1)
            if (range) {
              const rect = widget.getBoundingClientRect()
              const frac = rect.width > 0 ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) : 0
              const span = Math.max(0, range.to - range.from - 4)
              anchor = Math.min(range.to - 1, range.from + 2 + Math.round(frac * span))
            }
            view.dispatch({ selection: { anchor }, scrollIntoView: true })
            view.focus()
            e.preventDefault()
            return true
          },
        }),
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    syncHud(view)
    // 首次进入就要有分页线，不用等用户敲第一个字
    schedulePageBreaks()

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (pageTimer.current) window.clearTimeout(pageTimer.current)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  /* ---------- 命令桥 ---------- */
  useEffect(() => {
    const view = () => viewRef.current
    editorBridge.current = {
      insert: (text: string, caretBack = 0) => {
        const v = view()
        if (!v) return
        const sel = v.state.selection.main
        v.dispatch({
          changes: { from: sel.from, to: sel.to, insert: text },
          selection: { anchor: Math.max(sel.from, sel.from + text.length - caretBack) },
          scrollIntoView: true,
        })
        v.focus()
        flush()
      },
      insertBlock: (text: string) => {
        const v = view()
        if (!v) return
        const sel = v.state.selection.main
        const doc = v.state.doc.toString()
        const before = doc.slice(0, sel.from)
        const needBefore = before.length && !/\n\n$/.test(before) ? '\n\n' : ''
        const payload = `${needBefore}${text}\n\n`
        v.dispatch({
          changes: { from: sel.from, to: sel.to, insert: payload },
          selection: { anchor: sel.from + payload.length },
          scrollIntoView: true,
        })
        v.focus()
        flush()
      },
      insertMath: (latex: string, display = false) => {
        const v = view()
        if (!v) return
        const range = activeMathAt(v.state)
        const wrapped = display ? `$$\n${latex}\n$$` : `$${latex}$`
        if (range) {
          v.dispatch({
            changes: { from: range.from, to: range.to, insert: wrapped },
            selection: { anchor: range.from + wrapped.length },
          })
        } else {
          const sel = v.state.selection.main
          const doc = v.state.doc.toString()
          const needBefore = display && sel.from > 0 && doc[sel.from - 1] !== '\n' ? '\n\n' : ''
          const needAfter = display ? '\n\n' : ''
          v.dispatch({
            changes: { from: sel.from, to: sel.to, insert: needBefore + wrapped + needAfter },
            selection: { anchor: sel.from + needBefore.length + wrapped.length + needAfter.length },
            scrollIntoView: true,
          })
        }
        v.focus()
        flush()
      },
      replaceActiveMath: (latex: string) => {
        const v = view()
        if (!v) return
        const range = activeMathAt(v.state)
        if (!range) return
        const wrapped = range.type === 'display' ? `$$\n${latex}\n$$` : `$${latex}$`
        v.dispatch({
          changes: { from: range.from, to: range.to, insert: wrapped },
          selection: { anchor: range.from + wrapped.length },
        })
        flush()
      },
      getActiveMath: () => {
        const v = view()
        if (!v) return null
        const r = activeMathAt(v.state)
        return r ? { latex: r.latex, from: r.from, to: r.to, type: r.type } : null
      },
      getSelection: () => {
        const v = view()
        if (!v) return ''
        const { from, to } = v.state.selection.main
        return v.state.sliceDoc(from, to)
      },
      focus: () => view()?.focus(),
      jumpToLabel: (id: string) => {
        const v = view()
        if (!v) return
        const text = v.state.doc.toString()
        const idx = text.indexOf(`\\label{${id}}`)
        const alt = idx >= 0 ? idx : text.indexOf(`{#${id}}`)
        if (alt >= 0) {
          v.dispatch({ selection: { anchor: alt }, scrollIntoView: true })
          v.focus()
        }
      },
      /* ---------- 分屏联动 / 预览点击跳转 ---------- */
      scrollEl: () => view()?.scrollDOM ?? null,
      lineAtViewportTop: () => {
        const v = view()
        if (!v) return null
        const pos = v.posAtCoords({ x: 48, y: 12 })
        return pos == null ? null : v.state.doc.lineAt(pos).number
      },
      lineAtCaret: () => {
        const v = view()
        if (!v) return null
        return v.state.doc.lineAt(v.state.selection.main.head).number
      },
      topOfLine: (line: number) => {
        const v = view()
        if (!v) return null
        const l = v.state.doc.line(clampLine(v, line))
        return contentOffset(v) + v.lineBlockAt(l.from).top
      },
      scrollToY: (y: number) => {
        const v = view()
        if (!v) return
        v.scrollDOM.scrollTop = Math.max(0, y)
      },
      revealLine: (line: number, putCaret = false) => {
        const v = view()
        if (!v) return
        const l = v.state.doc.line(clampLine(v, line))
        if (putCaret) {
          v.dispatch({ selection: { anchor: l.from }, scrollIntoView: true })
          v.focus()
        } else {
          v.dispatch({ effects: EditorView.scrollIntoView(l.from, { y: 'start', yMargin: 12 }) })
        }
      },
    }
    return () => {
      editorBridge.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  // 视图模式切换：重配内联渲染
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: mathCompartment.reconfigure(
        plain ? [] : [...mathRenderPlugin(() => getMacros(), getNumbering), markdownPreviewPlugin(getNumbering), markdownSmartInput()]
      ),
    })
  }, [plain, mathCompartment, getMacros, getNumbering])

  // 宏变化后强制刷新公式渲染
  const macrosKey = JSON.stringify(getMacros())
  useEffect(() => {
    viewRef.current?.dispatch({ effects: refreshMathEffect.of(null) })
  }, [macrosKey])

  // 编号规则变了（按节 / 写法）也要重画公式编号
  const numberingKey = useEditorStore((s) => `${s.settings.eqNumbering}|${s.settings.eqTagStyle}`)
  useEffect(() => {
    viewRef.current?.dispatch({ effects: refreshMathEffect.of(null) })
  }, [numberingKey])

  /**
   * 工作台展开/收起会挤压编辑区高度，光标可能被顶到可视区之外。
   * 这里每次都把光标「轻轻」滚回视野内，保证正在敲的公式不会被面板挡住。
   */
  useEffect(() => {
    const v = viewRef.current
    if (!v || !hud) return
    const head = v.state.selection.main.head
    v.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'nearest', yMargin: 36 }) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud?.from, hud?.display, hudCollapsed])

  useEffect(() => () => flush(), [])

  return (
    <div ref={containerRef} className="flex h-full w-full flex-col overflow-hidden">
      <div ref={hostRef} className="mf-editor-host min-h-0 w-full flex-1 overflow-hidden" />
      {hud && (
        <FloatingMathHUD
          latex={hud.latex}
          display={hud.display}
          macros={getMacros()}
          collapsed={hudCollapsed}
          onToggleCollapse={toggleHudCollapsed}
          onChangeLatex={(latex) => {
            const v = viewRef.current
            if (!v) return
            const range = activeMathAt(v.state)
            if (!range) return
            const wrapped = range.type === 'display' ? `$$\n${latex}\n$$` : `$${latex}$`
            v.dispatch({
              changes: { from: range.from, to: range.to, insert: wrapped },
              selection: { anchor: range.from + wrapped.length },
            })
            flush()
          }}
          onRequestBuilder={(kind) => {
            const range = viewRef.current ? activeMathAt(viewRef.current.state) : null
            onRequestBuilder(kind, range?.latex ?? hud.latex)
          }}
          onFavorite={() => {
            addFavorite({ name: hud.latex.slice(0, 28), latex: hud.latex, tags: ['收藏'] })
            showToast('已加入公式收藏夹', 'success')
          }}
        />
      )}
    </div>
  )
}
