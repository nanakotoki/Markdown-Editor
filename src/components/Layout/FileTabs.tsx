import { useEffect, useRef } from 'react'
import { CircleAlert, FileText, Save, X } from 'lucide-react'
import { useEditorStore } from '../../store/useEditorStore'

/**
 * ============================================================================
 *  FileTabs.tsx —— 编辑区顶部的多文件标签栏
 * ----------------------------------------------------------------------------
 *  两种模式共用：
 *   · 本地模式：标签就是磁盘上的文件，切换标签不重新读盘（内存里已有缓冲区），
 *     但会保留各自的撤销历史（编辑器按 doc id 重挂载）。
 *   · 沙盒模式：标签是浏览器内的文档，行为一致。
 *
 *  标签右侧的小圆点表达磁盘同步状态：橙色=待保存，红色=与磁盘冲突。
 * ============================================================================
 */

const STATE_COLOR: Record<string, string> = {
  dirty: 'bg-amber-400',
  saving: 'bg-sky-400 animate-pulse',
  conflict: 'bg-rose-500',
  error: 'bg-rose-400',
  clean: 'bg-transparent',
}

export default function FileTabs() {
  const { mode, docs, openTabs, activeDocId, fileState, setActiveDoc, closeTab, closeOtherTabs, saveDoc } =
    useEditorStore()

  const tabs = openTabs
    .map((id) => docs.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))

  const scrollRef = useRef<HTMLDivElement>(null)

  // 激活的标签滚进可视区
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(activeDocId)}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeDocId])

  if (!tabs.length) return null

  const active = docs.find((d) => d.id === activeDocId)
  const state = fileState[activeDocId] ?? 'clean'

  return (
    <div className="mf-no-print flex h-9 shrink-0 items-stretch border-b border-ink-200 bg-ink-50/70">
      {/*
        等分标签：每个标签 flex-1 + basis-0 + min-w-0，宽度恒为栏宽的 1/n。
        图标与关闭按钮都不参与宽度计算（关闭按钮绝对定位、只在 hover 时显隐），
        所以标签切换时既不会左右窜动，图标也不会被挤小。
      */}
      <div ref={scrollRef} className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        {tabs.map((d) => {
          const isActive = d.id === activeDocId
          const st = fileState[d.id] ?? 'clean'
          const n = tabs.length
          return (
            <div
              key={d.id}
              data-tab={d.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveDoc(d.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  closeTab(d.id)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                closeOtherTabs(d.id)
              }}
              title={d.filePath ?? d.title}
              style={{ flexBasis: n > 0 ? `${100 / n}%` : undefined }}
              className={`group relative flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-r border-ink-200 pl-2.5 pr-6 text-[12px] transition ${
                isActive
                  ? 'bg-surface text-ink-800'
                  : 'bg-transparent text-ink-500 hover:bg-surface/60 hover:text-ink-700'
              }`}
            >
              {isActive && <span className="absolute inset-x-0 top-0 h-[2px] bg-accent-500" />}
              <FileText size={12} className={`shrink-0 ${isActive ? 'text-accent-600' : 'text-ink-300'}`} />
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_COLOR[st] ?? 'bg-transparent'}`} />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(d.id)
                }}
                disabled={tabs.length <= 1}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-300 opacity-0 transition hover:bg-ink-100 hover:text-rose-500 group-hover:opacity-100 disabled:hidden"
                title="关闭标签（中键也可关闭，右键关闭其他）"
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-2 pr-3 text-[11px] text-ink-400">
        {state === 'conflict' && (
          <button
            onClick={() => active && saveDoc(active.id, true)}
            className="flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
            title="磁盘上的版本已被外部修改。点击以当前编辑内容强制覆盖"
          >
            <CircleAlert size={11} /> 冲突 · 强制保存
          </button>
        )}
        {mode === 'local' && active?.filePath && (
          <span className="max-w-[280px] truncate font-mono text-[10.5px] text-ink-300">{active.filePath}</span>
        )}
        {mode === 'local' && active?.filePath && state === 'dirty' && (
          <button
            onClick={() => active && saveDoc(active.id)}
            className="flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
            title="有未保存的改动，点击写盘（Ctrl+S）"
          >
            <Save size={10} /> 保存
          </button>
        )}
        {mode === 'sandbox' && <span className="text-[10.5px] text-ink-300">浏览器内文档</span>}
      </div>
    </div>
  )
}
