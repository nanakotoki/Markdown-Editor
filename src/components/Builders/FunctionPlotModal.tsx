import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, Download, ImagePlus, Info, LineChart, RotateCcw } from 'lucide-react'
import { Button, Field, Modal, Segmented, TextInput } from '../ui'
import { analyzeMatrix, matrixToLatex, sampleFunction, type MatrixAnalysis } from '../../core/mathEvaluator'
import { editorBridge } from '../../store/editorBridge'
import { downloadFormulaPng } from '../../core/clipboardExport'
import { renderMathSafely } from '../../core/katexSafeRender'
import { useEditorStore } from '../../store/useEditorStore'

const PRESETS = ['\\sin(x)/x', 'x^{3}-3x', 'e^{-x^{2}}', '\\frac{1}{1+e^{-x}}', '\\ln(x)', 'x^{2}\\sin(1/x)']

export default function FunctionPlotModal({
  open,
  onClose,
  seed,
}: {
  open: boolean
  onClose: () => void
  seed?: string
}) {
  const showToast = useEditorStore((s) => s.showToast)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [expr, setExpr] = useState('\\sin(x)/x')
  const [xMin, setXMin] = useState(-10)
  const [xMax, setXMax] = useState(10)
  const [domain, setDomain] = useState<[number, number]>([-10, 10])
  const [yDomain, setYDomain] = useState<[number, number]>([-1, 1])
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number } | null>(null)
  const [tab, setTab] = useState<'plot' | 'matrix'>('plot')
  const dragRef = useRef<{ x: number; y: number; d: [number, number]; dy: [number, number] } | null>(null)

  useEffect(() => {
    if (!open) return
    if (seed && seed.trim()) {
      setExpr(seed.replace(/^\s*y\s*=/, ''))
      setTab(/\\begin\{(p|b|B|v|V)?matrix\}/.test(seed) ? 'matrix' : 'plot')
    }
  }, [open, seed])

  const data = useMemo(() => sampleFunction(expr, domain[0], domain[1], 1000), [expr, domain])

  useEffect(() => {
    if (!data.ok) return
    const [lo, hi] = data.yRange
    const pad = (hi - lo) * 0.12 || 1
    setYDomain([lo - pad, hi + pad])
  }, [data])

  const plotSvg = useMemo(
    () => (data.ok ? buildPlotSvg(data.points, domain, yDomain, data.extrema, 760, 420) : ''),
    [data, domain, yDomain]
  )

  /* 绘制 */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.ok) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const [x0, x1] = domain
    const [y0, y1] = yDomain
    const sx = (x: number) => ((x - x0) / (x1 - x0)) * W
    const sy = (y: number) => H - ((y - y0) / (y1 - y0)) * H

    // 网格
    const stepX = niceStep(x1 - x0, 8)
    const stepY = niceStep(y1 - y0, 6)
    ctx.strokeStyle = '#eef0f4'
    ctx.lineWidth = 1
    for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) {
      ctx.beginPath()
      ctx.moveTo(sx(x), 0)
      ctx.lineTo(sx(x), H)
      ctx.stroke()
    }
    for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) {
      ctx.beginPath()
      ctx.moveTo(0, sy(y))
      ctx.lineTo(W, sy(y))
      ctx.stroke()
    }

    // 坐标轴
    ctx.strokeStyle = '#c6ccd8'
    ctx.lineWidth = 1.2
    if (y0 <= 0 && y1 >= 0) {
      ctx.beginPath()
      ctx.moveTo(0, sy(0))
      ctx.lineTo(W, sy(0))
      ctx.stroke()
    }
    if (x0 <= 0 && x1 >= 0) {
      ctx.beginPath()
      ctx.moveTo(sx(0), 0)
      ctx.lineTo(sx(0), H)
      ctx.stroke()
    }

    // 刻度标签
    ctx.fillStyle = '#8e97a8'
    ctx.font = '11px Inter, sans-serif'
    for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) {
      if (Math.abs(x) < 1e-9) continue
      ctx.fillText(String(Number(x.toFixed(3))), sx(x) + 2, Math.min(H - 4, Math.max(12, sy(0) + 12)))
    }

    // 曲线
    ctx.strokeStyle = '#2a55d4'
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (const p of data.points) {
      const px = sx(p.x)
      const py = sy(p.y)
      if (!Number.isFinite(px) || !Number.isFinite(py) || Math.abs(py) > H * 40) {
        started = false
        continue
      }
      if (!started) {
        ctx.moveTo(px, py)
        started = true
      } else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // 极值点
    for (const e of data.extrema) {
      const px = sx(e.x)
      const py = sy(e.y)
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue
      ctx.fillStyle = e.kind === 'max' ? '#dc2626' : '#059669'
      ctx.beginPath()
      ctx.arc(px, py, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // 悬停十字线
    if (hover) {
      ctx.strokeStyle = 'rgba(42,85,212,.35)'
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(hover.px, 0)
      ctx.lineTo(hover.px, H)
      ctx.moveTo(0, hover.py)
      ctx.lineTo(W, hover.py)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#2a55d4'
      ctx.beginPath()
      ctx.arc(hover.px, hover.py, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [data, domain, yDomain, hover])

  const matrix: MatrixAnalysis | null = useMemo(() => {
    if (!/\\(begin|begin)\{(p|b|B|v|V)?matrix\}/.test(seed ?? '') && !/^\[\[/.test((seed ?? '').trim())) return null
    return analyzeMatrix(seed ?? '')
  }, [seed])

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="函数绘图 / 矩阵计算"
      subtitle="交互式 2D 坐标系：滚轮缩放、拖拽平移、悬停查看坐标与极值点"
      icon={<LineChart size={18} />}
      width="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {tab === 'plot' ? (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  const ok = await downloadFormulaPng(expr, 'function-plot.png', true, {})
                  showToast(ok ? '已下载图片' : '导出失败', ok ? 'success' : 'warn')
                }}
              >
                <Download size={13} /> 下载 PNG
              </Button>
              <Button
                variant="primary"
                disabled={!data.ok}
                onClick={() => {
                  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plotSvg)}`
                  editorBridge.current?.insertBlock(`![函数图像 ${expr.replace(/[\\{}]/g, '')}](${uri})`)
                  showToast('函数图像已作为 SVG 插入文档', 'success')
                  onClose()
                }}
              >
                <ImagePlus size={13} /> 插入图像
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              完成
            </Button>
          )}
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'plot', label: '函数图像' },
            { value: 'matrix', label: '矩阵计算' },
          ]}
        />
        {tab === 'plot' && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => { setDomain([xMin, xMax]); setHover(null) }}>
              <RotateCcw size={11} /> 重置视图
            </Button>
          </div>
        )}
      </div>

      {tab === 'plot' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_90px_90px_auto] items-end gap-2">
            <Field label="函数表达式 f(x)" hint="支持 \sin \cos \exp \ln \sqrt \frac \pi 等，可省略 y=">
              <TextInput value={expr} onChange={setExpr} mono />
            </Field>
            <Field label="定义域起">
              <TextInput value={String(xMin)} onChange={(v) => setXMin(Number(v) || 0)} mono />
            </Field>
            <Field label="定义域止">
              <TextInput value={String(xMax)} onChange={(v) => setXMax(Number(v) || 0)} mono />
            </Field>
            <Button
              variant="primary"
              onClick={() => {
                const a = Math.min(xMin, xMax)
                const b = Math.max(xMin, xMax)
                setDomain([a === b ? a - 1 : a, a === b ? b + 1 : b])
              }}
            >
              绘制
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setExpr(p)}
                className="rounded-md bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-600 transition hover:bg-accent-50 hover:text-accent-700"
              >
                {p}
              </button>
            ))}
          </div>

          {!data.ok && (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              <Info size={13} /> {data.error}
            </div>
          )}

          <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-white">
            <canvas
              ref={canvasRef}
              className="h-[360px] w-full cursor-crosshair"
              onWheel={(e) => {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = (e.clientX - rect.left) / rect.width
                const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
                setDomain(([a, b]) => {
                  const center = a + (b - a) * ratio
                  return [center - (center - a) * factor, center + (b - center) * factor]
                })
                setYDomain(([a, b]) => {
                  const mid = (a + b) / 2
                  return [mid - (mid - a) * factor, mid + (b - mid) * factor]
                })
              }}
              onMouseDown={(e) => {
                dragRef.current = { x: e.clientX, y: e.clientY, d: domain, dy: yDomain }
              }}
              onMouseUp={() => (dragRef.current = null)}
              onMouseLeave={() => {
                dragRef.current = null
                setHover(null)
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const [x0, x1] = domain
                const [y0, y1] = yDomain
                const drag = dragRef.current
                if (drag) {
                  const dx = ((e.clientX - drag.x) / rect.width) * (drag.d[1] - drag.d[0])
                  const dy = ((e.clientY - drag.y) / rect.height) * (drag.dy[1] - drag.dy[0])
                  setDomain([drag.d[0] - dx, drag.d[1] - dx])
                  setYDomain([drag.dy[0] + dy, drag.dy[1] + dy])
                  return
                }
                const px = e.clientX - rect.left
                const py = e.clientY - rect.top
                const x = x0 + (px / rect.width) * (x1 - x0)
                const y = y1 - (py / rect.height) * (y1 - y0)
                setHover({ x, y, px, py })
              }}
            />
            {hover && (
              <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-ink-900/85 px-2 py-1 font-mono text-[11px] text-white">
                x = {hover.x.toFixed(3)} , y = {hover.y.toFixed(3)}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-ink-400">
              滚轮缩放 · 拖拽平移
            </div>
          </div>

          {data.ok && data.extrema.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-ink-400">极值点：</span>
              {data.extrema.slice(0, 8).map((e, i) => (
                <span
                  key={i}
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                    e.kind === 'max' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {e.kind === 'max' ? '极大' : '极小'} ({e.x.toFixed(2)}, {e.y.toFixed(3)})
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!matrix || !matrix.ok ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-[12.5px] text-ink-500">
              {matrix?.error ?? '当前公式中未检测到数值矩阵。请把光标放进一个 matrix / pmatrix / bmatrix 环境中再打开此面板。'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                <Stat label="尺寸" value={`${matrix.rows}×${matrix.cols}`} />
                <Stat label="秩 rank" value={String(matrix.rank)} />
                <Stat label="迹 tr" value={matrix.trace != null ? String(matrix.trace) : '—'} />
                <Stat label="行列式 det" value={matrix.detLatex ?? '—'} />
              </div>

              {matrix.inverseLatex && (
                <div className="rounded-lg border border-ink-200 p-3">
                  <div className="mb-1 text-[12px] font-medium text-ink-600">逆矩阵 A⁻¹</div>
                  <div className="overflow-auto font-mono text-[12px] text-ink-800" dangerouslySetInnerHTML={{ __html: renderLatex(matrix.inverseLatex) }} />
                </div>
              )}
              {matrix.transposeLatex && (
                <div className="rounded-lg border border-ink-200 p-3">
                  <div className="mb-1 text-[12px] font-medium text-ink-600">转置 Aᵀ</div>
                  <div className="overflow-auto font-mono text-[12px] text-ink-800" dangerouslySetInnerHTML={{ __html: renderLatex(matrix.transposeLatex) }} />
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => appendResult(seed ?? '', matrix.detLatex ? `\\det A=${matrix.detLatex}` : '')}
                >
                  <Calculator size={12} /> 追写 det = …
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => appendResult(seed ?? '', matrix.inverseLatex ? `A^{-1}=${matrix.inverseLatex}` : '')}
                >
                  追写 A⁻¹ = …
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => appendResult(seed ?? '', matrix.trace != null ? `\\operatorname{tr}A=${matrix.trace}` : '')}
                >
                  追写 tr = …
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function appendResult(seedLatex: string, extra: string) {
  if (!extra) return
  editorBridge.current?.replaceActiveMath(`${seedLatex}\n\\quad ${extra}`)
  useEditorStore.getState().showToast('已将计算结果追加到公式', 'success')
}

function renderLatex(latex: string): string {
  return renderMathSafely(latex, true, {}).html
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-2 py-1.5">
      <div className="text-[10.5px] text-ink-400">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[13px] font-semibold text-ink-800">{value}</div>
    </div>
  )
}

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

function buildPlotSvg(
  points: Array<{ x: number; y: number }>,
  domain: [number, number],
  yDomain: [number, number],
  extrema: Array<{ x: number; y: number; kind: 'max' | 'min' }>,
  W = 760,
  H = 420
): string {
  const [x0, x1] = domain
  const [y0, y1] = yDomain
  const sx = (x: number) => ((x - x0) / (x1 - x0)) * W
  const sy = (y: number) => H - ((y - y0) / (y1 - y0)) * H
  const stepX = niceStep(x1 - x0, 8)
  const stepY = niceStep(y1 - y0, 6)

  let grid = ''
  for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) {
    grid += `<line x1="${sx(x).toFixed(1)}" y1="0" x2="${sx(x).toFixed(1)}" y2="${H}" stroke="#eef0f4"/>`
  }
  for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) {
    grid += `<line x1="0" y1="${sy(y).toFixed(1)}" x2="${W}" y2="${sy(y).toFixed(1)}" stroke="#eef0f4"/>`
  }

  const axes =
    (y0 <= 0 && y1 >= 0 ? `<line x1="0" y1="${sy(0).toFixed(1)}" x2="${W}" y2="${sy(0).toFixed(1)}" stroke="#c6ccd8"/>` : '') +
    (x0 <= 0 && x1 >= 0 ? `<line x1="${sx(0).toFixed(1)}" y1="0" x2="${sx(0).toFixed(1)}" y2="${H}" stroke="#c6ccd8"/>` : '')

  let d = ''
  let started = false
  for (const p of points) {
    const px = sx(p.x)
    const py = sy(p.y)
    if (!Number.isFinite(px) || !Number.isFinite(py) || Math.abs(py) > H * 40) {
      started = false
      continue
    }
    d += `${started ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)} `
    started = true
  }

  const dots = extrema
    .filter((e) => sx(e.x) >= 0 && sx(e.x) <= W && sy(e.y) >= 0 && sy(e.y) <= H)
    .map((e) => `<circle cx="${sx(e.x).toFixed(1)}" cy="${sy(e.y).toFixed(1)}" r="3.5" fill="${e.kind === 'max' ? '#dc2626' : '#059669'}"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${grid}${axes}<path d="${d.trim()}" fill="none" stroke="#2a55d4" stroke-width="2" stroke-linejoin="round"/>${dots}</svg>`
}
