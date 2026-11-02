import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Button, Modal } from './components/ui'
import { mergeWorkspaceBib, useEditorStore, workspaceRefEntries } from './store/useEditorStore'
import { macrosToKatex } from './core/katexSafeRender'
import { renderMarkdown, type RenderResult } from './core/renderMarkdown'
import { SNIPPET_CHEATSHEET } from './core/snippetRules'

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view')
    if (v === 'split' || v === 'source' || v === 'hybrid') setViewMode(v)
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
      plain={viewMode === 'source'}
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
