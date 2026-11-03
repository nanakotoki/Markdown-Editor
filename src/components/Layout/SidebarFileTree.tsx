import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookMarked,
  ChevronRight,
  Copy,
  FileCode2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderUp,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { baseName, parentDir, type TreeNode } from '../../core/workspaceApi'
import { useEditorStore } from '../../store/useEditorStore'

/**
 * ============================================================================
 *  SidebarFileTree.tsx —— 本地模式下的磁盘文件树
 * ----------------------------------------------------------------------------
 *  这里展示的就是工作区目录的真实结构：新建文件直接落盘，点击即读取。
 *  目录默认展开，折叠状态记在组件本地（不需要持久化）。
 *
 *  交互约定：
 *   · 单击 = 打开（目录则是展开/折叠），双击 = 重命名
 *   · 右键 = 上下文菜单：打开 / 重命名 / 在此新建 / 复制路径 / 移到回收站
 *   · 删除不是真删，服务端会把它挪进工作区的 .mathflow-trash/<时间戳>/，
 *     目录结构和原文件都在，误删可以手工挪回来
 * ============================================================================
 */

const isDoc = (n: TreeNode) => /\.(md|markdown|mdx)$/i.test(n.name)

function iconFor(node: TreeNode, open: boolean) {
  if (node.type === 'dir') {
    return open ? <FolderOpen size={12} className="text-accent-500" /> : <Folder size={12} className="text-ink-400" />
  }
  if (node.ext === '.bib') return <BookMarked size={12} className="text-violet-500" />
  if (node.ext === '.tex') return <FileCode2 size={12} className="text-ink-400" />
  if (isDoc(node)) return <FileText size={12} className="text-ink-400" />
  return <FileText size={12} className="text-ink-300" />
}

interface MenuState {
  x: number
  y: number
  node: TreeNode
}

export default function SidebarFileTree() {
  const {
    tree,
    activeDocId,
    docs,
    openFile,
    refreshTree,
    createLocalDoc,
    deleteLocalPath,
    workspace,
    showToast,
    renameLocalPath,
  } = useEditorStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  /** 正在改名的节点路径；null 表示没有在改名 */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  /** Esc 取消时抑制随后的 blur 提交 */
  const skipBlurRef = useRef(false)

  const activePath = docs.find((d) => d.id === activeDocId)?.filePath ?? null
  const total = useMemo(() => countDocs(tree), [tree])

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleRefresh = async () => {
    setBusy(true)
    await refreshTree()
    setBusy(false)
  }

  const startRename = (node: TreeNode) => {
    skipBlurRef.current = false
    setEditing(node.path)
    setDraft(node.name)
  }

  const commitRename = (node: TreeNode) => {
    const next = draft.trim()
    setEditing(null)
    if (!next || next === node.name) return
    void renameLocalPath(node.path, next)
  }

  const remove = async (node: TreeNode) => {
    if (node.type === 'dir') {
      const ok = window.confirm(
        `把整个文件夹「${node.name}」移到回收站？\n\n里面的文件会一起进去，可在工作区的 .mathflow-trash 里找回。`
      )
      if (!ok) return
    }
    await deleteLocalPath(node.path)
  }

  const copyPath = async (node: TreeNode) => {
    try {
      await navigator.clipboard.writeText(node.path)
      showToast(`已复制路径：${node.path}`, 'success')
    } catch {
      showToast('浏览器不允许写剪贴板', 'warn')
    }
  }

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const isDir = node.type === 'dir'
      const open = !collapsed.has(node.path)
      const isActive = node.path === activePath

      return (
        <div key={node.path}>
          <div
            role="treeitem"
            aria-expanded={isDir ? open : undefined}
            onClick={() => {
              if (editing === node.path) return
              if (isDir) toggle(node.path)
              else if (isDoc(node)) void openFile(node.path)
              else showToast('这个格式不能在编辑器里打开', 'info')
            }}
            onDoubleClick={() => {
              if (editing !== node.path) startRename(node)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenu({ x: e.clientX, y: e.clientY, node })
            }}
            className={`flex cursor-pointer items-center gap-1 rounded-md py-[3px] pr-1.5 text-[12px] transition ${
              isActive ? 'bg-accent-50 font-medium text-accent-800 ring-1 ring-accent-100' : 'text-ink-600 hover:bg-ink-50'
            }`}
            style={{ paddingLeft: 6 + depth * 11 }}
            title={`${node.path}\n右键：重命名 / 新建 / 删除`}
          >
            {isDir ? (
              <ChevronRight
                size={11}
                className={`shrink-0 text-ink-300 transition-transform ${open ? 'rotate-90' : ''}`}
              />
            ) : (
              <span className="w-[11px] shrink-0" />
            )}
            <span className="shrink-0">{iconFor(node, open)}</span>
            {editing === node.path ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onFocus={(e) => {
                  // 只选中主名，后缀留着——改 .md 为 .markdown 时才不用重敲
                  const dot = e.currentTarget.value.lastIndexOf('.')
                  e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    skipBlurRef.current = true
                    setEditing(null)
                  }
                }}
                onBlur={() => {
                  if (skipBlurRef.current) {
                    skipBlurRef.current = false
                    return
                  }
                  commitRename(node)
                }}
                className="min-w-0 flex-1 rounded border border-accent-400 bg-white px-1 py-0 text-[12px] text-ink-800 outline-none"
              />
            ) : (
              <span className={`min-w-0 flex-1 truncate ${isDir ? 'text-ink-700' : ''}`}>{node.name}</span>
            )}
          </div>
          {isDir && open && node.children && node.children.length > 0 && renderNodes(node.children, depth + 1)}
        </div>
      )
    })

  const currentDir = activePath ? parentDir(activePath) : ''

  return (
    <div className="space-y-1">
      <div className="mb-1 flex items-center gap-1">
        <button
          onClick={() => void createLocalDoc(currentDir)}
          disabled={workspace?.readonly}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 px-2 py-1.5 text-[11.5px] text-ink-500 transition hover:border-accent-300 hover:text-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          title={currentDir ? `在 ${currentDir}/ 下新建` : '在工作区根目录新建'}
        >
          <Plus size={12} /> 新建文档
        </button>
        <button
          onClick={handleRefresh}
          className="rounded-lg border border-ink-200 p-1.5 text-ink-400 transition hover:border-accent-300 hover:text-accent-600"
          title="重新扫描磁盘"
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {currentDir && (
        <div className="flex items-center gap-1 px-1 text-[10.5px] text-ink-400">
          <FolderUp size={10} />
          <span className="truncate">新建到 {currentDir}/</span>
        </div>
      )}

      <div className="space-y-0.5">{tree.length ? renderNodes(tree, 0) : <EmptyTree />}</div>

      <div className="pt-2 text-[10.5px] leading-relaxed text-ink-300">
        共 {total} 篇文档 · 单击打开，双击重命名
        <br />
        右键可删除（移入回收站，不是真删）
      </div>

      {menu && (
        <TreeContextMenu
          menu={menu}
          readonly={Boolean(workspace?.readonly)}
          onClose={() => setMenu(null)}
          items={[
            ...(menu.node.type === 'file' && isDoc(menu.node)
              ? [{ icon: <FileText size={12} />, label: '打开', run: () => void openFile(menu.node.path) }]
              : []),
            { icon: <PencilLine size={12} />, label: '重命名', run: () => startRename(menu.node) },
            {
              icon: <FilePlus2 size={12} />,
              label: '在此新建文档',
              run: () => void createLocalDoc(menu.node.type === 'dir' ? menu.node.path : parentDir(menu.node.path)),
            },
            { icon: <Copy size={12} />, label: '复制相对路径', run: () => void copyPath(menu.node) },
            { divider: true },
            {
              icon: <Trash2 size={12} />,
              label: '移到回收站',
              danger: true,
              run: () => void remove(menu.node),
            },
          ]}
        />
      )}
    </div>
  )
}

interface MenuItem {
  icon?: React.ReactNode
  label?: string
  danger?: boolean
  divider?: boolean
  run?: () => void
}

function TreeContextMenu({
  menu,
  items,
  readonly,
  onClose,
}: {
  menu: MenuState
  items: MenuItem[]
  readonly: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('wheel', onClose, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('wheel', onClose)
    }
  }, [onClose])

  // 贴近右/下边界时往回收，避免菜单被裁掉
  const width = 190
  const height = items.length * 30 + 16
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))

  return (
    <div
      ref={ref}
      className="fixed z-[60] w-[190px] rounded-xl border border-ink-200 bg-white p-1 shadow-panel"
      style={{ left, top }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="truncate px-2 py-1 text-[10.5px] text-ink-400" title={menu.node.path}>
        {baseName(menu.node.path)}
      </div>
      {items.map((it, i) =>
        it.divider ? (
          <div key={`d${i}`} className="my-1 h-px bg-ink-100" />
        ) : (
          <button
            key={it.label}
            role="menuitem"
            disabled={readonly && it.danger}
            onClick={() => {
              onClose()
              it.run?.()
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-[6px] text-left text-[12px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <span className={it.danger ? 'text-rose-400' : 'text-ink-400'}>{it.icon}</span>
            {it.label}
          </button>
        )
      )}
    </div>
  )
}

function EmptyTree() {
  return (
    <div className="rounded-lg border border-dashed border-ink-200 px-3 py-5 text-center">
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        这个目录里还没有 Markdown 文档。
        <br />
        点上面的「新建文档」开个头。
      </p>
    </div>
  )
}

function countDocs(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => {
    if (node.type === 'file' && isDoc(node)) return n + 1
    if (node.children) return n + countDocs(node.children)
    return n
  }, 0)
}
