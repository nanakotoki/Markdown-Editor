import { FileText, HardDrive, Library, Plus, Star, Trash2, ListTree, BookMarked, Settings2, CloudOff } from 'lucide-react'
import { useEditorStore, type SidebarTab } from '../../store/useEditorStore'
import { editorBridge } from '../../store/editorBridge'
import type { TocItem } from '../../core/renderMarkdown'
import { renderMathSafely } from '../../core/katexSafeRender'
import SidebarFileTree from './SidebarFileTree'

const TABS: Array<{ key: SidebarTab; label: string; icon: React.ReactNode }> = [
  { key: 'docs', label: '文档', icon: <FileText size={13} /> },
  { key: 'outline', label: '大纲', icon: <ListTree size={13} /> },
  { key: 'favorites', label: '收藏', icon: <Star size={13} /> },
  { key: 'bib', label: '文献', icon: <BookMarked size={13} /> },
]

function fmtDate(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SidebarDocTree({ toc, onJump }: { toc: TocItem[]; onJump: (anchor: string) => void }) {
  const {
    docs,
    activeDocId,
    setActiveDoc,
    createDoc,
    deleteDoc,
    sidebarTab,
    setSidebarTab,
    favorites,
    removeFavorite,
    bibEntries,
    openModal,
    showToast,
    mode,
    workspace,
  } = useEditorStore()

  return (
    <aside className="mf-no-print flex w-[248px] shrink-0 flex-col border-r border-ink-200 bg-white">
      <div className="flex items-center gap-0.5 border-b border-ink-100 px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSidebarTab(t.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] transition ${
              sidebarTab === t.key ? 'bg-accent-50 text-accent-700' : 'text-ink-400 hover:bg-ink-50 hover:text-ink-600'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {sidebarTab === 'docs' && mode === 'local' && <SidebarFileTree />}

        {sidebarTab === 'docs' && mode === 'sandbox' && (
          <div className="space-y-1">
            <button
              onClick={() => createDoc()}
              className="mb-1.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-ink-200 px-2.5 py-1.5 text-[12px] text-ink-500 transition hover:border-accent-300 hover:text-accent-600"
            >
              <Plus size={13} /> 新建文档
            </button>
            {docs.map((d) => (
              <div
                key={d.id}
                onClick={() => setActiveDoc(d.id)}
                className={`group cursor-pointer rounded-lg px-2.5 py-1.5 transition ${
                  d.id === activeDocId ? 'bg-accent-50/80 ring-1 ring-accent-100' : 'hover:bg-ink-50'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className={`min-w-0 flex-1 truncate text-[12.5px] ${d.id === activeDocId ? 'font-semibold text-accent-800' : 'text-ink-700'}`}>
                    {d.title}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteDoc(d.id)
                    }}
                    className="hidden shrink-0 rounded p-0.5 text-ink-300 hover:bg-rose-50 hover:text-rose-500 group-hover:block"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-ink-400">{fmtDate(d.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}

        {sidebarTab === 'outline' && (
          <div className="space-y-0.5">
            {toc.length === 0 && <p className="px-2 py-3 text-[12px] text-ink-400">当前文档没有标题。</p>}
            {toc.map((h) => (
              <button
                key={h.id}
                onClick={() => onJump(h.id)}
                className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-ink-600 transition hover:bg-ink-50 hover:text-accent-700"
                style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
              >
                {h.text || '（无标题）'}
              </button>
            ))}
          </div>
        )}

        {sidebarTab === 'favorites' && (
          <div className="space-y-1.5">
            {favorites.length === 0 && (
              <p className="px-2 py-3 text-[12px] leading-relaxed text-ink-400">
                还没有收藏。把光标移入任意公式，点击悬浮窗右上角的书签图标即可收藏高频公式。
              </p>
            )}
            {favorites.map((f) => (
              <div key={f.id} className="group rounded-lg border border-ink-100 px-2 py-1.5 transition hover:border-accent-200">
                <div
                  className="cursor-pointer overflow-hidden text-[12px] text-ink-700"
                  title={f.latex}
                  onClick={() => {
                    editorBridge.current?.insertMath(f.latex, false)
                    showToast('已插入收藏公式', 'success')
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMathSafely(f.latex, false, {}).html }}
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="truncate text-[10px] text-ink-300">{f.tags.join(' / ') || '收藏'}</span>
                  <button onClick={() => removeFavorite(f.id)} className="hidden text-ink-300 hover:text-rose-500 group-hover:block">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sidebarTab === 'bib' && (
          <div className="space-y-1.5">
            <button
              onClick={() => openModal('macro')}
              className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-2 py-1.5 text-[12px] text-ink-600 hover:border-accent-300 hover:text-accent-700"
            >
              <Settings2 size={12} /> 管理 BibTeX 文献库
            </button>
            {bibEntries.map((b) => (
              <div key={b.id} className="rounded-lg border border-ink-100 px-2 py-1.5">
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="rounded bg-accent-50 px-1 font-mono text-[10px] text-accent-700">{b.key}</span>
                  <span className="text-ink-300">{b.year}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-[12px] text-ink-700">{b.title}</div>
              </div>
            ))}
            <p className="px-1 pt-1 text-[11px] leading-relaxed text-ink-400">
              在正文输入 <code className="rounded bg-ink-100 px-1">[@</code> 即可联想引用。
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 px-3 py-2 text-[10.5px] leading-relaxed text-ink-400">
        {mode === 'local' ? (
          <div title={workspace?.root}>
            <div className="flex items-center gap-1 font-medium text-ink-500">
              <HardDrive size={11} className="text-emerald-500" />
              <span className="truncate">{workspace?.name ?? '本地工作区'}</span>
              {workspace?.readonly && <span className="rounded bg-amber-50 px-1 text-[9px] text-amber-600">只读</span>}
            </div>
            <div className="mt-0.5 truncate font-mono text-[9.5px] text-ink-300">{workspace?.root}</div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <CloudOff size={11} />
            <span className="truncate">浏览器内文档 · localStorage</span>
          </div>
        )}
      </div>
    </aside>
  )
}
