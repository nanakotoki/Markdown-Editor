import { useMemo, useState } from 'react'
import {
  BookMarked,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  FolderUp,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { parentDir, pathToDocId, type TreeNode } from '../../core/workspaceApi'
import { useEditorStore } from '../../store/useEditorStore'

/**
 * ============================================================================
 *  SidebarFileTree.tsx —— 本地模式下的磁盘文件树
 * ----------------------------------------------------------------------------
 *  这里展示的就是工作区目录的真实结构：新建文件直接落盘，点击即读取。
 *  目录默认展开，折叠状态记在组件本地（不需要持久化）。
 *
 *  刻意没有做拖拽移动和右键菜单——那些操作误触代价高，改用更保守的方式：
 *  重命名在标签栏双击文件名，删除走「移入回收站」并给 toast 提示。
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

export default function SidebarFileTree() {
  const { tree, activeDocId, docs, openFile, refreshTree, createLocalDoc, workspace, showToast, renameLocalDoc } =
    useEditorStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

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
              if (isDir) toggle(node.path)
              else if (isDoc(node)) void openFile(node.path)
              else showToast('这个格式不能在编辑器里打开', 'info')
            }}
            onDoubleClick={() => {
              if (isDir) return
              const next = window.prompt('重命名（含后缀）', node.name)
              if (!next || next === node.name) return
              const id = pathToDocId(node.path)
              void renameLocalDoc(id, next)
            }}
            className={`flex cursor-pointer items-center gap-1 rounded-md py-[3px] pr-1.5 text-[12px] transition ${
              isActive ? 'bg-accent-50 font-medium text-accent-800 ring-1 ring-accent-100' : 'text-ink-600 hover:bg-ink-50'
            }`}
            style={{ paddingLeft: 6 + depth * 11 }}
            title={node.path}
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
            <span className={`min-w-0 flex-1 truncate ${isDir ? 'text-ink-700' : ''}`}>{node.name}</span>
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

      <div className="pt-2 text-[10.5px] text-ink-300">
        共 {total} 篇文档 · 双击文件可重命名
      </div>
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
