import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileText, FolderOpen, Info, Loader2 } from 'lucide-react'
import HeaderToolbar from './components/Layout/HeaderToolbar'
import SidebarDocTree from './components/Layout/SidebarDocTree'
import FileTabs from './components/Layout/FileTabs'
import MathFlowEditor from './components/Editor/MathFlowEditor'
import AcademicPreview from './components/Preview/AcademicPreview'
import ExportModal from './components/Layout/ExportModal'
import MatrixBuilderModal from './components/Builders/MatrixBuilderModal'
import TruthTableModal from './components/Builders/TruthTableModal'
import FunctionPlotModal from './components/Builders/FunctionPlotModal'
import HandwritingModal from './components/Builders/HandwritingModal'
import SymbolPalette from './components/Builders/SymbolPalette'
import MacroDrawer from './components/Builders/MacroDrawer'
import AIAssistantModal from './components/Builders/AIAssistantModal'
import ManualModal from './components/Layout/ManualModal'
import AppearanceModal from './components/Layout/AppearanceModal'
import { Button, Modal } from './components/ui'
import { mergeWorkspaceBib, useEditorStore, workspaceRefEntries } from './store/useEditorStore'
import { macrosToKatex } from './core/katexSafeRender'
import { renderMarkdown, type RenderResult } from './core/renderMarkdown'
import { SNIPPET_CHEATSHEET } from './core/snippetRules'
import { applyAppearance } from './core/appearance'
import { collectAnchors, flashLine, indexAnchors, lineToY, yToLine, type Anchor, type AnchorIndex } from './core/scrollSync'
import { editorBridge } from './store/editorBridge'

export default function App() {
  const {
    viewMode,
    sidebarOpen,
    modal,
    openModal,
    docs,
    activeDocId,
    updateContent,
    liveContent,
    macros,
    bibEntries,
    settings,
    toast,
    boot,
    booted,
    bootError,
    mode,
    workspace,
    indexBib,
    indexLabels,
    createLocalDoc,
  } = useEditorStore()

  const setViewMode = useEditorStore((s) => s.setViewMode)

  /* ---------------- 启动：探测本地服务 ---------------- */
  useEffect(() => {
    void boot()
  }, [boot])

  /* ---------------- F1：随时唤出语法手册 ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return
      e.preventDefault()
      const s = useEditorStore.getState()
      s.openModal(s.modal === 'manual' ? null : 'manual')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Ctrl+P：直接打印会把工具栏、侧栏一起印出来。
   * 这里改成走「导出 → 可打印的 HTML」，在新窗口里 Ctrl+P 才是干净的 A4 版面。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'p') return
      e.preventDefault()
      const s = useEditorStore.getState()
      s.openModal('export')
      s.showToast('打印请走这里：导出可打印的 HTML，再在新窗口按 Ctrl+P', 'info')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view')
    if (v === 'split' || v === 'source' || v === 'hybrid' || v === 'read') setViewMode(v)
    if (mode !== 'local') {
      const d = params.get('doc')
      if (d) {
        const target = useEditorStore.getState().docs.find((x) => x.id === d || x.title.includes(d))
        if (target) useEditorStore.getState().setActiveDoc(target.id)
      }
    }
  }, [setViewMode, mode])

  const doc = docs.find((d) => d.id === activeDocId) ?? docs[0]
  const macroMap = useMemo(() => macrosToKatex(macros), [macros])

  /** 本地模式下把工作区 .bib 合并进渲染与补全的数据源 */
  const bibForRender = useMemo(() => mergeWorkspaceBib(bibEntries, indexBib), [bibEntries, indexBib])

  /** 有节流的渲染内容（避免每次按键都重排全文） */
  const [deferred, setDeferred] = useState(doc?.content ?? '')
  useEffect(() => {
    const t = window.setTimeout(() => setDeferred(liveContent), 240)
    return () => window.clearTimeout(t)
  }, [liveContent])

  const analysis = useMemo<RenderResult>(
    () =>
      renderMarkdown(deferred, {
        macros: macroMap,
        bib: bibForRender,
        autoNumber: settings.autoNumberEquations,
        citationStyle: settings.citationStyle,
      }),
    [deferred, macroMap, bibForRender, settings.autoNumberEquations, settings.citationStyle]
  )

  /** 当前文件的 refs + 工作区其它文件的 refs */
  const allRefs = useMemo(
    () => [...analysis.refs, ...workspaceRefEntries(indexLabels, doc?.filePath)],
    [analysis.refs, indexLabels, doc?.filePath]
  )

  /**
   * 工作区其它文件的引用索引（本地模式），供预览解析跨文件引用。
   * 注意：这个 memo 必须放在任何 early return 之前，否则 hooks 数量会随渲染变化。
   */
  const extRefs = useMemo(() => workspaceRefEntries(indexLabels, doc?.filePath), [indexLabels, doc?.filePath])

  const [seed, setSeed] = useState<{ kind: 'matrix' | 'ai' | 'plot'; latex: string }>({ kind: 'matrix', latex: '' })
  const requestBuilder = (kind: 'matrix' | 'ai' | 'plot', latex = '') => {
    setSeed({ kind, latex })
    openModal(kind)
  }

  const previewRef = useRef<HTMLDivElement>(null)

  /* ================================================================== *
   *  外观：字体 / 字号 / 行距 —— 写进 CSS 变量，改完立刻生效
   * ================================================================== */
  useEffect(() => {
    applyAppearance(settings)
  }, [settings])

  /* ================================================================== *
   *  分屏：源码 <-> 渲染结果，双向跳转 + 滚动联动
   *  - 预览侧每个顶层块带 data-mf-line，编辑侧用 lineBlockAt 拿到同一行的位置
   *  - 两边锚点各自成序列，中间的行线性插值
   * ================================================================== */
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const anchorsRef = useRef<{ preview: AnchorIndex; editor: AnchorIndex }>({
    preview: { byLine: [], byY: [] },
    editor: { byLine: [], byY: [] },
  })
  /** 谁刚刚被程序滚动过、多久之内忽略它自己的滚动事件（防止两边互相推） */
  const syncLock = useRef<{ side: '' | 'editor' | 'preview'; until: number }>({ side: '', until: 0 })

  const rebuildAnchors = useCallback(() => {
    const p = previewScrollRef.current
    if (!p) return
    const preview = collectAnchors(p)
    const api = editorBridge.current
    const editor: Anchor[] = []
    if (api) {
      for (const a of preview) {
        const y = api.topOfLine(a.line)
        if (y != null && Number.isFinite(y)) editor.push({ line: a.line, y })
      }
    }
    // 排序只在这里做一次；滚动事件里直接二分查表
    anchorsRef.current = { preview: indexAnchors(preview), editor: indexAnchors(editor) }
  }, [])

  /** 预览重排（内容或字号变化）之后重算锚点——等 DOM 落定再量 */
  useEffect(() => {
    if (viewMode !== 'split') return
    const t = window.setTimeout(rebuildAnchors, 90)
    return () => window.clearTimeout(t)
  }, [deferred, viewMode, activeDocId, settings.previewFontSize, settings.previewLineHeight, settings.previewFont, rebuildAnchors])

  /** 换文件时分屏两侧都回到开头——否则左栏在顶部、右栏还停在上一个文件的位置 */
  useEffect(() => {
    if (viewMode !== 'split') return
    const p = previewScrollRef.current
    if (!p) return
    // 这次滚动是我们自己做的，别让它反过来把编辑器也拽走
    syncLock.current = { side: 'preview', until: performance.now() + 300 }
    p.scrollTop = 0
  }, [activeDocId, viewMode])

  const jumpToSource = useCallback((line: number) => {
    const api = editorBridge.current
    if (!api) return
    syncLock.current = { side: 'editor', until: performance.now() + 200 }
    api.revealLine(line, true)
  }, [])

  /* 滚动联动（可在工具栏关闭） */
  useEffect(() => {
    if (viewMode !== 'split') return
    const p = previewScrollRef.current
    const api = editorBridge.current
    const el = api?.scrollEl() ?? null
    if (!p || !api || !el) return

    const blocked = (side: 'editor' | 'preview') =>
      syncLock.current.side === side && performance.now() < syncLock.current.until
    const lock = (side: '' | 'editor' | 'preview') => {
      syncLock.current = { side, until: performance.now() + 90 }
    }

    /**
     * 滚动事件按帧合并：一帧里可能来十几个 wheel/scroll，每个都去调
     * posAtCoords（要读布局）和写 scrollTop（要重排），画面就掉帧。
     * 这里只保留本帧最后一次的意图，rAF 里执行一次。
     */
    let rafEditor = 0
    let rafPreview = 0

    const applyEditorScroll = () => {
      rafEditor = 0
      if (!useEditorStore.getState().settings.syncScroll) return
      if (blocked('editor')) return
      const line = api.lineAtViewportTop()
      if (line == null) return
      const y = lineToY(anchorsRef.current.preview.byLine, line)
      if (y == null) return
      lock('preview')
      p.scrollTop = y
    }
    const applyPreviewScroll = () => {
      rafPreview = 0
      if (!useEditorStore.getState().settings.syncScroll) return
      if (blocked('preview')) return
      const line = yToLine(anchorsRef.current.preview.byY, p.scrollTop)
      if (line == null) return
      const y = lineToY(anchorsRef.current.editor.byLine, line)
      if (y == null) return
      lock('editor')
      api.scrollToY(y)
    }

    const onEditorScroll = () => {
      if (rafEditor) return
      rafEditor = requestAnimationFrame(applyEditorScroll)
    }
    const onPreviewScroll = () => {
      if (rafPreview) return
      rafPreview = requestAnimationFrame(applyPreviewScroll)
    }

    el.addEventListener('scroll', onEditorScroll, { passive: true })
    p.addEventListener('scroll', onPreviewScroll, { passive: true })
    return () => {
      if (rafEditor) cancelAnimationFrame(rafEditor)
      if (rafPreview) cancelAnimationFrame(rafPreview)
      el.removeEventListener('scroll', onEditorScroll)
      p.removeEventListener('scroll', onPreviewScroll)
    }
  }, [viewMode, settings.syncScroll, activeDocId, booted])

  /* 在源码里点一下，右边跟着滚到同一段（不改变光标，只是定位） */
  useEffect(() => {
    if (viewMode !== 'split') return
    const api = editorBridge.current
    const el = api?.scrollEl() ?? null
    const p = previewScrollRef.current
    if (!api || !el || !p) return

    const onMouseUp = () => {
      const line = api.lineAtCaret()
      if (line == null) return
      const y = lineToY(anchorsRef.current.preview.byLine, line)
      if (y == null) return
      syncLock.current = { side: 'preview', until: performance.now() + 220 }
      p.scrollTo({ top: Math.max(0, y - 10), behavior: 'smooth' })
      flashLine(p, line)
    }
    // 用 click 而不是 mouseup：拖选文本时不该把预览拽走
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return
      onMouseUp()
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [viewMode, activeDocId, booted])

  const jumpInPreview = (anchor: string) => {
    const el = previewRef.current?.querySelector(`#${CSS.escape(anchor)}`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('mf-flash')
      setTimeout(() => el.classList.remove('mf-flash'), 1400)
    } else if (viewMode !== 'split') {
      useEditorStore.getState().showToast('切到「左右分屏」可定位到源码位置', 'info')
    }
  }

  /* ---------------- 启动画面 ---------------- */
  if (!booted) return <Splash />

  /* ---------------- 空工作区 ---------------- */
  if (!doc) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[#f3f5f8]">
        <HeaderToolbar
          onExport={() => openModal('export')}
          onRequestBuilder={requestBuilder}
          onShowCheatsheet={() => openModal('cheatsheet')}
        />
        <div className="flex min-h-0 flex-1">
          {sidebarOpen && <SidebarDocTree toc={[]} onJump={() => undefined} />}
          <EmptyWorkspace
            mode={mode}
            workspaceName={workspace?.name}
            root={workspace?.root}
            readonly={workspace?.readonly}
            error={bootError}
            onCreate={() => void createLocalDoc('')}
          />
        </div>
        <Modals
          modal={modal}
          openModal={openModal}
          seed={seed}
        />
        <Toast toast={toast} />
      </div>
    )
  }

  const editorPane = (
    <MathFlowEditor
      key={doc.id}
      docId={doc.id}
      initialContent={doc.content}
      /* 纯源码用 plain；左右分屏的左栏也必须是「真源码」——
         不隐藏标记、不渲染公式/表格，否则左栏等于第二份预览，和右栏重复 */
      plain={viewMode === 'source' || viewMode === 'split'}
      onChange={(v) => updateContent(doc.id, v)}
      getRefs={() => allRefs}
      getBib={() => bibForRender}
      getMacros={() => macroMap}
      onRequestBuilder={requestBuilder}
    />
  )

  /** 工作区其它文件的引用索引（本地模式），供预览解析跨文件引用 */
  const previewPane = (
    <AcademicPreview
      content={deferred}
      macros={macroMap}
      bib={bibForRender}
      settings={settings}
      extRefs={extRefs}
      onRender={() => undefined}
      onJumpToSource={jumpToSource}
      jumpable={viewMode === 'split'}
      scrollElementRef={previewScrollRef}
      docTitle={doc.title}
    />
  )

  /** 阅读模式：整页只放排版结果，按 A4 分页 */
  const readPane = (
    <AcademicPreview
      content={deferred}
      macros={macroMap}
      bib={bibForRender}
      settings={settings}
      extRefs={extRefs}
      jumpable={false}
      mode="read"
      className="w-full flex-1"
      docTitle={doc.title}
    />
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f3f5f8]">
      <HeaderToolbar
        onExport={() => openModal('export')}
        onRequestBuilder={requestBuilder}
        onShowCheatsheet={() => openModal('cheatsheet')}
      />
      <FileTabs />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <SidebarDocTree toc={analysis.toc} onJump={jumpInPreview} />}

        <main className="relative flex min-w-0 flex-1 overflow-hidden bg-white">
          {viewMode === 'split' ? (
            <div className="flex w-full">
              <div className="relative w-1/2 border-r border-ink-200 bg-white">{editorPane}</div>
              <div ref={previewRef} className="relative w-1/2 overflow-auto bg-[#fbfcfd]">
                {previewPane}
              </div>
            </div>
          ) : viewMode === 'read' ? (
            <div ref={previewRef} className="relative flex h-full w-full overflow-hidden">
              {readPane}
            </div>
          ) : (
            <div ref={previewRef} className="relative flex w-full justify-center overflow-auto">
              <div className="w-full max-w-[980px] bg-white">{editorPane}</div>
            </div>
          )}
        </main>
      </div>

      <Modals modal={modal} openModal={openModal} seed={seed} />
      <Toast toast={toast} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 局部组件                                                            */
/* ------------------------------------------------------------------ */

function Splash() {
  const mode = useEditorStore((s) => s.mode)
  return (
    <div className="flex h-screen items-center justify-center bg-[#f3f5f8]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-900 text-white shadow-panel">
          <span className="font-serif text-[19px] italic leading-none">Mf</span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-ink-500">
          <Loader2 size={13} className="animate-spin" />
          正在连接{/* 探测中，模式未知时按本地优先措辞 */}
          {mode === 'local' ? '本地工作区…' : '工作区…'}
        </div>
      </div>
    </div>
  )
}

function EmptyWorkspace({
  mode,
  workspaceName,
  root,
  readonly,
  error,
  onCreate,
}: {
  mode: 'local' | 'sandbox'
  workspaceName?: string
  root?: string
  readonly?: boolean
  error?: string | null
  onCreate: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-white">
      <div className="max-w-[420px] px-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-400">
          <FolderOpen size={22} />
        </div>
        {error ? (
          <>
            <h2 className="text-[15px] font-semibold text-ink-800">工作区加载失败</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">{error}</p>
          </>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold text-ink-800">
              {mode === 'local' ? `${workspaceName ?? '工作区'} 里还没有 Markdown 文档` : '还没有打开任何文档'}
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
              {mode === 'local' ? (
                <>
                  在 <code className="rounded bg-ink-50 px-1 font-mono text-[11px]">{root}</code>{' '}
                  下新建一个 <code className="rounded bg-ink-50 px-1 font-mono text-[11px]">.md</code>{' '}
                  文件就能开始写作，也可以在终端里用 <code className="rounded bg-ink-50 px-1 font-mono text-[11px]">mathflow init</code> 生成示例。
                </>
              ) : (
                '从左侧新建一篇文档开始。'
              )}
            </p>
          </>
        )}
        {mode === 'local' && !readonly && (
          <Button variant="primary" className="mt-5" onClick={onCreate}>
            <FileText size={13} /> 新建第一篇文档
          </Button>
        )}
      </div>
    </div>
  )
}

function Modals({
  modal,
  openModal,
  seed,
}: {
  modal: ReturnType<typeof useEditorStore.getState>['modal']
  openModal: (m: ReturnType<typeof useEditorStore.getState>['modal']) => void
  seed: { kind: 'matrix' | 'ai' | 'plot'; latex: string }
}) {
  return (
    <>
      <MatrixBuilderModal open={modal === 'matrix'} onClose={() => openModal(null)} seed={seed.kind === 'matrix' ? seed.latex : ''} />
      <TruthTableModal open={modal === 'truth'} onClose={() => openModal(null)} />
      <FunctionPlotModal open={modal === 'plot'} onClose={() => openModal(null)} seed={seed.kind === 'plot' ? seed.latex : ''} />
      <HandwritingModal open={modal === 'hand'} onClose={() => openModal(null)} />
      <SymbolPalette open={modal === 'palette'} onClose={() => openModal(null)} />
      <MacroDrawer open={modal === 'macro'} onClose={() => openModal(null)} />
      <AIAssistantModal open={modal === 'ai'} onClose={() => openModal(null)} seed={seed.kind === 'ai' ? seed.latex : ''} />
      <ExportModal open={modal === 'export'} onClose={() => openModal(null)} />
      <ManualModal open={modal === 'manual'} onClose={() => openModal(null)} />
      <AppearanceModal open={modal === 'appearance'} onClose={() => openModal(null)} />

      <Modal
        open={modal === 'cheatsheet'}
        onOpenChange={(v) => !v && openModal(null)}
        title="数学模式快捷输入速查"
        subtitle="仅在光标位于 $…$ 或 $$…$$ 内部时生效；Tab 在占位符间跳转，Shift+Tab 回退"
        icon={<Info size={18} />}
        width="max-w-3xl"
      >
        <div className="grid grid-cols-3 gap-4">
          {SNIPPET_CHEATSHEET.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-[12px] font-semibold text-ink-700">{g.group}</div>
              <div className="space-y-1">
                {g.items.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2 rounded bg-ink-50 px-2 py-1">
                    <span className="font-mono text-[11px] text-accent-700">{k}</span>
                    <span className="truncate text-[11px] text-ink-500">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-[11.5px] leading-relaxed text-ink-500">
          提示：输入 <code className="rounded bg-white px-1">@</code> 触发全文交叉引用联想；<code className="rounded bg-white px-1">[@</code> 联想文献；
          <code className="mx-1 rounded bg-white px-1">?</code> 在公式内呼出 AI；<code className="rounded bg-white px-1">Ctrl/Cmd + K</code> 在任意位置呼出 AI。
        </div>
      </Modal>
    </>
  )
}

function Toast({ toast }: { toast: ReturnType<typeof useEditorStore.getState>['toast'] }) {
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-fade-up">
      <div
        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] shadow-panel ${
          toast.kind === 'warn'
            ? 'bg-amber-500 text-white'
            : toast.kind === 'success'
              ? 'bg-ink-900 text-white'
              : 'bg-white text-ink-700 ring-1 ring-ink-200'
        }`}
      >
        {toast.kind === 'success' ? <CheckCircle2 size={14} /> : <Info size={14} />}
        {toast.text}
      </div>
    </div>
  )
}
