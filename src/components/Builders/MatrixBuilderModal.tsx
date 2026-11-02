import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, ClipboardPaste, Grid3x3, Minus, Plus, Sparkles } from 'lucide-react'
import { Button, Modal, TextArea } from '../ui'
import { renderMathSafely } from '../../core/katexSafeRender'
import { parseMatrixLatex } from '../../core/mathEvaluator'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'

type Env = 'pmatrix' | 'bmatrix' | 'Bmatrix' | 'vmatrix' | 'Vmatrix' | 'cases' | 'aligned'

const ENVS: Array<{ key: Env; label: string; sample: string }> = [
  { key: 'pmatrix', label: '圆括号矩阵', sample: '( )' },
  { key: 'bmatrix', label: '方括号矩阵', sample: '[ ]' },
  { key: 'Bmatrix', label: '花括号矩阵', sample: '{ }' },
  { key: 'vmatrix', label: '行列式', sample: '| |' },
  { key: 'Vmatrix', label: '双竖线范数', sample: '‖ ‖' },
  { key: 'cases', label: '分段函数', sample: '{ 条件' },
  { key: 'aligned', label: '多行对齐', sample: '= 对齐' },
]

export default function MatrixBuilderModal({
  open,
  onClose,
  seed,
}: {
  open: boolean
  onClose: () => void
  seed?: string
}) {
  const showToast = useEditorStore((s) => s.showToast)
  const [rows, setRows] = useState(2)
  const [cols, setCols] = useState(2)
  const [env, setEnv] = useState<Env>('pmatrix')
  const [cells, setCells] = useState<string[][]>([
    ['1', '2'],
    ['3', '4'],
  ])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    if (!open) return
    if (seed) {
      const grid = parseMatrixLatex(seed)
      if (grid && grid.length && grid[0].length) {
        const r = Math.min(8, grid.length)
        const c = Math.min(8, grid[0].length)
        setRows(r)
        setCols(c)
        setCells(Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => String(grid[i]?.[j] ?? 0))))
        return
      }
    }
    setCells(Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => cells[i]?.[j] ?? '')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed])

  const resize = (r: number, c: number) => {
    const rr = Math.max(1, Math.min(8, r))
    const cc = Math.max(1, Math.min(8, c))
    setRows(rr)
    setCols(cc)
    setCells((prev) => Array.from({ length: rr }, (_, i) => Array.from({ length: cc }, (_, j) => prev[i]?.[j] ?? '')))
  }

  const setCell = (i: number, j: number, v: string) =>
    setCells((prev) => prev.map((row, ri) => (ri === i ? row.map((c, ci) => (ci === j ? v : c)) : row)))

  const latex = useMemo(() => {
    const body = cells
      .map((row) => {
        if (env === 'cases') {
          const [expr, cond, ...rest] = row
          const condition = [cond, ...rest].filter((s) => s && s.trim()).join(' \\land ')
          return `${expr || ''}${condition ? `, & ${condition.trim().startsWith('\\text') ? condition : `\\text{${condition}}`}` : ''}`
        }
        if (env === 'aligned') {
          return row.map((c, i) => (i === 0 ? `${c} &` : c)).join(' ')
        }
        return row.map((c) => c.trim() || '0').join(' & ')
      })
      .join(' \\\\ ')
    if (env === 'cases') return `\\begin{cases}\n${body}\n\\end{cases}`
    if (env === 'aligned') return `\\begin{aligned}\n${cells.map((row, i) => `${row[0] || ''} &= ${row[1] || ''}`).join(' \\\\ ')}\n\\end{aligned}`
    return `\\begin{${env}}\n${body}\n\\end{${env}}`
  }, [cells, env])

  const preview = useMemo(() => renderMathSafely(latex, true, {}), [latex])

  const fillUnit = () => {
    setCells(Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === j ? '1' : '0'))))
  }
  const fillDiagonal = () => {
    setCells(Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === j ? `a_{${i + 1}}` : '0'))))
  }
  const fillGeneric = () => {
    setCells(
      Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => {
          if (rows >= 3 && cols >= 3) {
            if (i === 1 && j === cols - 1) return '\\vdots'
            if (i === rows - 1 && j === 1) return '\\cdots'
            if (i === rows - 1 && j === cols - 1) return '\\ddots'
          }
          return `a_{${i + 1}${j + 1}}`
        })
      )
    )
  }
  const doTranspose = () => {
    const next = Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => cells[i]?.[j] ?? ''))
    setRows(cols)
    setCols(rows)
    setCells(next)
  }

  const applyPaste = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) return
    const grid = lines.map((l) => l.split(/[\t, ]+/).filter((s) => s !== ''))
    const r = Math.min(8, grid.length)
    const c = Math.min(8, Math.max(...grid.map((g) => g.length)))
    setRows(r)
    setCols(c)
    setCells(Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => grid[i]?.[j] ?? '0')))
    setPasteOpen(false)
    setPasteText('')
    showToast('已从文本填充矩阵', 'success')
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="矩阵 / 分段函数构造器"
      subtitle="拖动网格快速选定尺寸，或直接编辑单元格；支持单位阵、转置与文本粘贴"
      icon={<Grid3x3 size={18} />}
      width="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              editorBridge.current?.insertMath(latex, true)
              showToast('已插入矩阵', 'success')
              onClose()
            }}
          >
            插入到文档
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[230px_1fr] gap-5">
        {/* 左：尺寸与环境 */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-ink-600">快速选尺寸</div>
            <div className="inline-grid grid-cols-8 gap-0.5 rounded-lg bg-ink-50 p-1.5" onMouseLeave={() => undefined}>
              {Array.from({ length: 8 }).map((_, i) =>
                Array.from({ length: 8 }).map((_, j) => (
                  <button
                    key={`${i}-${j}`}
                    onMouseEnter={() => undefined}
                    onClick={() => resize(i + 1, j + 1)}
                    className={`h-4 w-4 rounded-[3px] transition ${
                      i < rows && j < cols ? 'bg-accent-500' : 'bg-white hover:bg-accent-200'
                    }`}
                  />
                ))
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => resize(rows, cols - 1)}>
                <Minus size={11} /> 列
              </Button>
              <Button size="sm" variant="outline" onClick={() => resize(rows, cols + 1)}>
                <Plus size={11} /> 列
              </Button>
              <span className="text-[12px] font-mono text-ink-500">
                {rows}×{cols}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => resize(rows - 1, cols)}>
                <Minus size={11} /> 行
              </Button>
              <Button size="sm" variant="outline" onClick={() => resize(rows + 1, cols)}>
                <Plus size={11} /> 行
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[12px] font-medium text-ink-600">环境类型</div>
            <div className="space-y-1">
              {ENVS.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setEnv(e.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] transition ${
                    env === e.key ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200' : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <span>{e.label}</span>
                  <span className="font-mono text-[10.5px] text-ink-400">{e.key}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[12px] font-medium text-ink-600">快捷操作</div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={fillUnit}>
                <Sparkles size={11} /> 单位矩阵
              </Button>
              <Button size="sm" variant="outline" onClick={fillDiagonal}>
                对角矩阵
              </Button>
              <Button size="sm" variant="outline" onClick={fillGeneric}>
                带省略号
              </Button>
              <Button size="sm" variant="outline" onClick={doTranspose}>
                <ArrowLeftRight size={11} /> 转置
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPasteOpen((v) => !v)}>
                <ClipboardPaste size={11} /> 粘贴填充
              </Button>
            </div>
          </div>

          {pasteOpen && (
            <div className="rounded-lg border border-ink-200 p-2">
              <TextArea
                value={pasteText}
                onChange={setPasteText}
                rows={4}
                mono
                placeholder={'粘贴 Excel / 文本，每行一行矩阵：\n1 2\n3 4'}
              />
              <Button size="sm" variant="primary" className="mt-1.5 w-full" onClick={applyPaste}>
                解析并填充
              </Button>
            </div>
          )}
        </div>

        {/* 右：网格编辑 + 预览 */}
        <div className="space-y-3">
          <div className="rounded-xl border border-ink-200 p-2">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {cells.map((row, i) =>
                row.map((cell, j) => (
                  <input
                    key={`${i}-${j}`}
                    value={cell}
                    onChange={(e) => setCell(i, j, e.target.value)}
                    className="min-w-0 rounded-md border border-ink-200 bg-ink-50/40 px-1.5 py-1 text-center font-mono text-[12px] outline-none focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-100"
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-ink-200 bg-white">
            <div className="border-b border-ink-100 px-3 py-1.5 text-[11px] font-medium text-ink-400">实时预览</div>
            <div
              className="flex min-h-[96px] items-center justify-center overflow-auto px-4 py-4"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>

          <div className="rounded-lg bg-ink-900 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-100">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-400">LaTeX 源码</div>
            <pre className="whitespace-pre-wrap break-all">{latex}</pre>
          </div>
        </div>
      </div>
    </Modal>
  )
}
