import { useMemo, useState } from 'react'
import { Library, Search, Star, Trash2 } from 'lucide-react'
import { Button, Modal, TextInput } from '../ui'
import { renderMathSafely } from '../../core/katexSafeRender'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'
import { ALL_SYMBOLS, GROUPS, SYMBOL_SUMMARY } from '../../core/symbolGroups'

export default function SymbolPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [group, setGroup] = useState(GROUPS[0].key)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'fav'>('all')
  const favorites = useEditorStore((s) => s.favorites)
  const removeFavorite = useEditorStore((s) => s.removeFavorite)
  const showToast = useEditorStore((s) => s.showToast)

  /**
   * 有搜索词时在整个面板里找，而不是只在当前分组里找——
   * 面板有三百多个符号、十几个分组，只搜当前组等于让用户先猜符号属于哪个组。
   */
  const items = useMemo<Array<{ name: string; insert: string; label: string; group?: string }>>(() => {
    if (tab === 'fav') return []
    const q = query.trim().toLowerCase()
    if (!q) return (GROUPS.find((x) => x.key === group) ?? GROUPS[0]).items
    return ALL_SYMBOLS.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.insert.toLowerCase().includes(q) ||
        it.group.toLowerCase().includes(q)
    )
  }, [group, query, tab])

  const searching = tab === 'all' && query.trim().length > 0

  const insert = (latex: string) => {
    const active = editorBridge.current?.getActiveMath()
    if (active) editorBridge.current?.insert(latex)
    else editorBridge.current?.insertMath(latex, false)
    editorBridge.current?.focus()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="分类符号面板"
      subtitle={`${SYMBOL_SUMMARY}；点击即插入，搜索时跨全部分组`}
      icon={<Library size={18} />}
      width="max-w-3xl"
    >
      <div className="flex gap-4">
        <div className="max-h-[356px] w-[168px] shrink-0 space-y-1 overflow-auto pr-1">
          <button
            onClick={() => setTab('fav')}
            className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition ${
              tab === 'fav' ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <Star size={12} /> 我的收藏 ({favorites.length})
          </button>
          <div className="my-1 h-px bg-ink-100" />
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => {
                setGroup(g.key)
                setTab('all')
              }}
              className={`flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                tab === 'all' && group === g.key && !searching
                  ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200'
                  : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <span className="truncate">{g.title}</span>
              <span className="shrink-0 text-[10px] text-ink-300">{g.items.length}</span>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {tab === 'all' && (
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <TextInput value={query} onChange={setQuery} placeholder="搜索全部符号（中文名、LaTeX、分组）" className="pl-7" />
            </div>
          )}

          {tab === 'fav' ? (
            favorites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-[12px] leading-relaxed text-ink-400">
                还没有收藏公式。
                <br />
                把光标放进任意公式，点击悬浮窗右上角的书签即可收藏。
              </div>
            ) : (
              <div className="space-y-1.5">
                {favorites.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-2 hover:border-accent-200">
                    <div
                      className="min-w-0 flex-1 cursor-pointer overflow-hidden text-[13px]"
                      onClick={() => insert(f.latex)}
                      dangerouslySetInnerHTML={{ __html: renderMathSafely(f.latex, false, {}).html }}
                    />
                    <button onClick={() => removeFavorite(f.id)} className="text-ink-300 hover:text-rose-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {searching && (
                <div className="mb-1.5 text-[11px] text-ink-400">
                  在 {GROUPS.length} 个分组中找到 {items.length} 个匹配
                </div>
              )}
              <div className="grid max-h-[356px] grid-cols-4 gap-1.5 overflow-auto pr-1">
                {items.map((it) => (
                  <button
                    key={it.group + it.name + it.insert}
                    title={`${it.name}\n${it.insert}${searching ? `\n（${it.group}）` : ''}`}
                    onClick={() => insert(it.insert)}
                    className="flex h-[54px] flex-col items-center justify-center gap-1 rounded-lg border border-ink-100 bg-white px-1 transition hover:border-accent-300 hover:bg-accent-50/40"
                  >
                    <span
                      className="max-w-full overflow-hidden text-[13px] text-ink-800"
                      dangerouslySetInnerHTML={{ __html: renderMathSafely(it.label, false, {}).html }}
                    />
                    <span className="max-w-full truncate text-[10px] text-ink-400">{it.name}</span>
                  </button>
                ))}
                {items.length === 0 && <div className="col-span-4 py-8 text-center text-[12px] text-ink-400">没有匹配的符号</div>}
              </div>
            </>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-ink-400">希腊字母已收全：24 小写 + 24 大写 + 7 变体</span>
            <Button variant="outline" size="sm" onClick={() => showToast('符号已插入，可继续输入', 'success')}>
              提示：Tab 可跳转占位符
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
