import { useMemo, useState } from 'react'
import { BookOpen, CornerDownLeft, Lightbulb, Search, Sparkles } from 'lucide-react'
import { Modal } from '../ui'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'
import { flattenManual, MANUAL_SECTIONS, MANUAL_TIPS, type ManualEntry } from '../../core/manual'

/**
 * ============================================================================
 *  ManualModal.tsx —— 「语法与使用手册」
 * ----------------------------------------------------------------------------
 *  设计目标：按 F1 打开，左边点分类，右边直接看到语法 + 说明 + 一键插入。
 *  · 顶部搜索框会同时搜语法、标题、说明和「使用建议」；
 *  · 带「插入」按钮的条目会走 editorBridge 写进当前文档，光标位置不变的话就原位插入；
 *  · 快捷键类条目（Ctrl+S 之类）不给插入按钮，避免往正文里塞垃圾。
 * ============================================================================
 */

const isShortcutOnly = (e: ManualEntry) => e.tag === '快捷键' || /^(Ctrl|F1|Tab)/.test(e.syntax ?? '')

export default function ManualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const showToast = useEditorStore((s) => s.showToast)
  const [q, setQ] = useState('')
  const [active, setActive] = useState<string>(MANUAL_SECTIONS[0].id)

  const keyword = q.trim().toLowerCase()
  const searching = keyword.length > 0

  const all = useMemo(() => flattenManual(), [])

  const hits = useMemo(() => {
    if (!searching) return []
    return all.filter((e) =>
      [e.title, e.syntax, e.note, e.sectionTitle].filter(Boolean).join(' ').toLowerCase().includes(keyword)
    )
  }, [all, keyword, searching])

  const tipHits = useMemo(() => {
    if (!searching) return []
    return MANUAL_TIPS.filter((t) => `${t.title} ${t.body}`.toLowerCase().includes(keyword))
  }, [keyword, searching])

  const section = MANUAL_SECTIONS.find((s) => s.id === active) ?? MANUAL_SECTIONS[0]

  const insert = (e: ManualEntry) => {
    const text = e.insert ?? e.syntax
    if (!text) return
    if (e.block) editorBridge.current?.insertBlock(text)
    else editorBridge.current?.insert(text, e.caretBack ?? 0)
    showToast(`已插入：${e.title}`, 'success')
    onClose()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="语法与使用手册"
      subtitle="左边选分类，右边看语法；带「插入」的条目可以直接写进当前文档 · 随时按 F1 唤出"
      icon={<BookOpen size={18} />}
      width="max-w-5xl"
      bodyClassName="p-0"
      footer={
        <div className="mr-auto flex items-center gap-1.5 text-[11px] text-ink-400">
          <CornerDownLeft size={11} />
          插入会把内容写进光标处，不会覆盖已有文字
        </div>
      }
    >
      <div className="flex h-[66vh] min-h-[420px]">
        <aside className="flex w-[190px] shrink-0 flex-col border-r border-ink-100 bg-ink-50/40">
          <div className="p-2">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜语法 / 关键词"
                className="h-7 w-full rounded-md border border-ink-200 bg-white pl-6 pr-2 text-[11.5px] outline-none placeholder:text-ink-300 focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-auto px-1.5 pb-2">
            {MANUAL_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActive(s.id)
                  setQ('')
                }}
                className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-[5px] text-left text-[12px] transition ${
                  !searching && active === s.id
                    ? 'bg-white font-medium text-accent-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                    : 'text-ink-600 hover:bg-white/70'
                }`}
              >
                <span className="truncate">{s.title}</span>
                <span className="ml-1 shrink-0 text-[10px] text-ink-300">{s.entries.length}</span>
              </button>
            ))}
            <div className="my-1.5 h-px bg-ink-100" />
            <button
              onClick={() => {
                setActive('tips')
                setQ('')
              }}
              className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-[5px] text-left text-[12px] transition ${
                !searching && active === 'tips'
                  ? 'bg-white font-medium text-amber-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                  : 'text-ink-600 hover:bg-white/70'
              }`}
            >
              <Lightbulb size={12} className="text-amber-500" />
              使用建议
              <span className="ml-auto text-[10px] text-ink-300">{MANUAL_TIPS.length}</span>
            </button>
          </nav>
        </aside>

        <section className="flex-1 overflow-auto px-4 py-3">
          {searching ? (
            <>
              <div className="mb-2 text-[11.5px] text-ink-400">
                「{q}」匹配到 {hits.length} 条语法、{tipHits.length} 条建议
              </div>
              {hits.length === 0 && tipHits.length === 0 && (
                <p className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-[12px] text-ink-400">
                  没找到。换个词试试，比如「定理」「矩阵」「表格」「引用」。
                </p>
              )}
              <div className="space-y-2">
                {hits.map((e) => (
                  <EntryCard key={`${e.sectionId}-${e.title}`} entry={e} sectionTitle={e.sectionTitle} onInsert={insert} />
                ))}
                {tipHits.map((t) => (
                  <div key={t.title} className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-2">
                    <div className="text-[12.5px] font-medium text-ink-800">{t.title}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{t.body}</p>
                  </div>
                ))}
              </div>
            </>
          ) : active === 'tips' ? (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <Sparkles size={13} className="text-amber-500" /> 用久了才知道的 {MANUAL_TIPS.length} 条建议
              </div>
              <div className="space-y-2">
                {MANUAL_TIPS.map((t, i) => (
                  <div key={t.title} className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-ink-800">{t.title}</div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{t.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2">
                <div className="text-[13px] font-semibold text-ink-800">{section.title}</div>
                <p className="mt-0.5 text-[11.5px] text-ink-400">{section.summary}</p>
              </div>
              <div className="space-y-2">
                {section.entries.map((e) => (
                  <EntryCard key={e.title} entry={e} onInsert={insert} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}

function EntryCard({
  entry,
  sectionTitle,
  onInsert,
}: {
  entry: ManualEntry
  sectionTitle?: string
  onInsert: (e: ManualEntry) => void
}) {
  const canInsert = Boolean(entry.syntax) && !isShortcutOnly(entry)
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5 transition hover:border-ink-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-800">{entry.title}</span>
          {entry.tag && (
            <span className="shrink-0 rounded bg-accent-50 px-1 py-[1px] text-[9.5px] font-medium text-accent-600">
              {entry.tag}
            </span>
          )}
          {sectionTitle && (
            <span className="shrink-0 truncate text-[10px] text-ink-300">· {sectionTitle}</span>
          )}
        </div>
        {canInsert && (
          <button
            onClick={() => onInsert(entry)}
            className="shrink-0 rounded-md border border-ink-200 px-1.5 py-[2px] text-[10.5px] text-ink-500 transition hover:border-accent-300 hover:text-accent-700"
          >
            插入
          </button>
        )}
      </div>

      {entry.syntax && (
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-ink-900/[0.04] px-2.5 py-1.5 font-mono text-[11.5px] leading-[1.55] text-ink-700">
          {entry.syntax}
        </pre>
      )}

      {entry.note && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{entry.note}</p>}
    </div>
  )
}
