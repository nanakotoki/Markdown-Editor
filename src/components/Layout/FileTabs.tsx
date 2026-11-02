import { useEffect, useRef } from 'react'
import { CircleAlert, FileText, X } from 'lucide-react'
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
      <div ref={scrollRef} className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {tabs.map((d) => {
          const isActive = d.id === activeDocId
          const st = fileState[d.id] ?? 'clean'
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
              className={`group relative flex max-w-[220px] shrink-0 cursor-pointer items-center gap-1.5 border-r border-ink-200 px-2.5 text-[12px] transition ${
                isActive
                  ? 'bg-white text-ink-800'
                  : 'bg-transparent text-ink-500 hover:bg-white/60 hover:text-ink-700'
              }`}
            >
              {isActive && <span className="absolute inset-x-0 top-0 h-[2px] bg-accent-500" />}
              <FileText size={12} className={isActive ? 'text-accent-600' : 'text-ink-300'} />
              <span className="truncate">{d.title}</span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_COLOR[st] ?? 'bg-transparent'}`} />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(d.id)
                }}
                disabled={tabs.length <= 1}
                className="ml-0.5 hidden shrink-0 rounded p-0.5 text-ink-300 hover:bg-ink-100 hover:text-rose-500 group-hover:block disabled:hidden"
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
        {mode === 'sandbox' && <span className="text-[10.5px] text-ink-300">浏览器内文档</span>}
      </div>
    </div>
  )
}
