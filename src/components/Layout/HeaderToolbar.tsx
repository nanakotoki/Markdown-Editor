import { useEffect, useRef, useState } from 'react'
import {
  AlignLeft,
  BookMarked,
  Blocks,
  Braces,
  Columns2,
  Download,
  FlaskConical,
  FunctionSquare,
  Grid3x3,
  Hand,
  Keyboard,
  Library,
  LineChart,
  ListTree,
  PanelLeft,
  PenTool,
  Plus,
  Quote,
  Settings2,
  Sigma,
  Sparkles,
  SquareFunction,
  Table2,
  TextCursorInput,
} from 'lucide-react'
import { Button, IconButton, Segmented } from '../ui'
import { useEditorStore, type ViewMode } from '../../store/useEditorStore'
import { editorBridge } from '../../store/editorBridge'

export const ALGORITHM_TEMPLATE = `\`\`\`algorithm
\\caption{算法名称}
输入: 描述输入
输出: 描述输出
Function Name(args)
  If 条件
    Return 结果
  EndIf
EndFunction
\`\`\``

const TABLE_TEMPLATE = `| 列一 | 列二 | 列三 |
| --- | --- | --- |
| $x$ | $y$ | $z$ |
| 1 | 2 | 3 |`

const THEOREM_TEMPLATE = `::: theorem [定理名称] {#thm:name}
在这里写定理内容，行内公式如 $f(x)=x^2$，块级公式：

$$a^2+b^2=c^2 \\label{eq:pythagoras}$$
:::`

const PROOF_TEMPLATE = `::: proof
在这里写证明过程。
:::`

export default function HeaderToolbar({
  onExport,
  onRequestBuilder,
  onShowCheatsheet,
}: {
  onExport: () => void
  onRequestBuilder: (kind: 'matrix' | 'ai' | 'plot', latex?: string) => void
  onShowCheatsheet: () => void
}) {
  const {
    viewMode,
    setViewMode,
    docs,
    activeDocId,
    renameDoc,
    renameLocalDoc,
    sidebarOpen,
    toggleSidebar,
    settings,
    updateSettings,
    openModal,
    mode,
    workspace,
  } = useEditorStore()
  const doc = docs.find((d) => d.id === activeDocId)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(doc?.title ?? '')

  useEffect(() => setTitleDraft(doc?.title ?? ''), [doc?.title, activeDocId])

  /** 本地模式下改标题 = 改文件名，沙盒模式只改显示名 */
  const commitTitle = () => {
    const t = titleDraft.trim()
    setEditingTitle(false)
    if (!t || t === doc?.title) return
    if (mode === 'local' && doc?.filePath) void renameLocalDoc(doc.id, t)
    else renameDoc(activeDocId, t)
  }

  const insert = (text: string, caretBack = 0) => editorBridge.current?.insert(text, caretBack)

  return (
    <header className="mf-no-print flex h-14 shrink-0 items-center gap-2 border-b border-ink-200 bg-white px-3">
      <div className="flex items-center gap-2 pl-1 pr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
          <Sigma size={17} strokeWidth={2.4} />
        </div>
        <div className="leading-none">
          <div className="flex items-center gap-1.5 text-[13.5px] font-bold tracking-tight text-ink-900">
            MathFlow
            <span
              className={`rounded px-1 py-[1px] text-[9px] font-medium tracking-wide ${
                mode === 'local'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-ink-100 text-ink-500'
              }`}
              title={
                mode === 'local'
                  ? `已连接本地工作区：${workspace?.root ?? ''}`
                  : '静态部署模式：文档保存在浏览器本地存储'
              }
            >
              {mode === 'local' ? '本地' : '沙盒'}
            </span>
          </div>
          <div className="mt-0.5 max-w-[150px] truncate text-[10px] text-ink-400">
            {mode === 'local' ? (workspace?.name ?? '本地工作区') : '混合学术编辑器'}
          </div>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-ink-200" />

      <IconButton title="侧边栏" onClick={toggleSidebar} active={sidebarOpen}>
        <PanelLeft size={16} />
      </IconButton>

      {editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTitle()
            if (e.key === 'Escape') setEditingTitle(false)
          }}
          className="h-7 w-[260px] rounded-md border border-accent-300 px-2 text-[13px] outline-none focus:ring-2 focus:ring-accent-100"
        />
      ) : (
        <button
          onClick={() => setEditingTitle(true)}
          title={mode === 'local' ? '点击重命名（会同时修改文件名）' : '点击重命名'}
          className="max-w-[300px] truncate rounded-md px-2 py-1 text-left text-[13px] font-medium text-ink-700 hover:bg-ink-100"
        >
          {doc?.title ?? '未命名文档'}
        </button>
      )}

      <div className="mx-auto" />

      <Segmented<ViewMode>
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'hybrid', label: '内联混合', icon: <AlignLeft size={12} /> },
          { value: 'split', label: '左右分屏', icon: <Columns2 size={12} /> },
          { value: 'source', label: '纯源码', icon: <Braces size={12} /> },
        ]}
      />

      <Menu
        label="插入"
        icon={<Plus size={14} />}
        items={[
          { label: '行内公式 $…$', icon: <FunctionSquare size={13} />, onClick: () => insert('$$', 1) },
          { label: '块级公式 $$…$$', icon: <SquareFunction size={13} />, onClick: () => insert('$$\n\n$$', 3) },
          { label: '定理容器', icon: <Quote size={13} />, onClick: () => insert(THEOREM_TEMPLATE) },
          { label: '证明容器', icon: <Quote size={13} />, onClick: () => insert(PROOF_TEMPLATE) },
          { label: '伪代码算法块', icon: <ListTree size={13} />, onClick: () => insert(ALGORITHM_TEMPLATE) },
          { label: '三线表', icon: <Table2 size={13} />, onClick: () => insert(TABLE_TEMPLATE) },
          { label: '矩阵构造器', icon: <Grid3x3 size={13} />, onClick: () => onRequestBuilder('matrix') },
          { label: '真值表生成器', icon: <FlaskConical size={13} />, onClick: () => openModal('truth') },
          { label: '文献引用 [@key]', icon: <BookMarked size={13} />, onClick: () => insert('[@', 0) },
        ]}
      />

      <Menu
        label="工具"
        icon={<Blocks size={14} />}
        items={[
          { label: '符号面板', icon: <Library size={13} />, onClick: () => openModal('palette') },
          { label: '宏命令与文献', icon: <TextCursorInput size={13} />, onClick: () => openModal('macro') },
          { label: '手写公式画板 / 截图识别', icon: <PenTool size={13} />, onClick: () => openModal('hand') },
          { label: '函数绘图 / 矩阵计算', icon: <LineChart size={13} />, onClick: () => onRequestBuilder('plot') },
          { label: '快捷输入速查', icon: <Keyboard size={13} />, onClick: onShowCheatsheet },
          { label: 'AI 公式助手', icon: <Sparkles size={13} />, onClick: () => onRequestBuilder('ai') },
        ]}
      />

      <Menu
        label=""
        icon={<Settings2 size={15} />}
        align="right"
        items={[
          {
            label: `${settings.autoNumberEquations ? '✓ ' : ''}公式自动编号`,
            icon: <FunctionSquare size={13} />,
            onClick: () => updateSettings({ autoNumberEquations: !settings.autoNumberEquations }),
          },
          {
            label: `${settings.citationStyle === 'numeric' ? '✓ ' : ''}数字引用 [1]`,
            icon: <BookMarked size={13} />,
            onClick: () => updateSettings({ citationStyle: 'numeric' }),
          },
          {
            label: `${settings.citationStyle === 'author-year' ? '✓ ' : ''}作者-年份 (Knuth, 1984)`,
            icon: <BookMarked size={13} />,
            onClick: () => updateSettings({ citationStyle: 'author-year' }),
          },
        ]}
      />

      <Button variant="ghost" size="sm" onClick={() => openModal('hand')} title="手写画板">
        <Hand size={14} />
      </Button>

      <Button variant="primary" onClick={onExport}>
        <Download size={14} />
        导出
      </Button>
    </header>
  )
}

export function Menu({
  label,
  icon,
  items,
  align = 'right',
}: {
  label: string
  icon: React.ReactNode
  items: Array<{ label: string; icon?: React.ReactNode; onClick: () => void }>
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium transition ${
          open ? 'bg-accent-50 text-accent-700' : 'text-ink-600 hover:bg-ink-100'
        }`}
      >
        {icon}
        {label}
      </button>
      {open && (
        <div
          className={`absolute top-9 z-40 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-panel ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                it.onClick()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-ink-700 transition hover:bg-accent-50 hover:text-accent-700"
            >
              <span className="text-ink-400">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
