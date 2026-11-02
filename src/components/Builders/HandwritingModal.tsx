import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Eraser, PenTool, RotateCcw, ScanLine, Sparkles, Undo2 } from 'lucide-react'
import { Button, Field, Modal, TextInput } from '../ui'
import { renderMathSafely } from '../../core/katexSafeRender'
import { recognizeImage } from '../../core/aiService'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'

type Point = { x: number; y: number }

export default function HandwritingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Point[][]>([])
  const drawingRef = useRef(false)
  const [, force] = useState(0)
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const [latex, setLatex] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const aiConfig = useEditorStore((s) => s.aiConfig)
  const showToast = useEditorStore((s) => s.showToast)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    // 参考线（类似作业本四线格）
    ctx.strokeStyle = '#f1f3f7'
    ctx.lineWidth = 1
    for (let y = 40; y < H; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.strokeStyle = '#223d87'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) {
        if (stroke.length === 1) {
          ctx.beginPath()
          ctx.arc(stroke[0].x, stroke[0].y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        }
        continue
      }
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(redraw, 30)
    return () => clearTimeout(t)
  }, [open, redraw])

  useEffect(() => {
    if (!open) return
    const onPaste = async (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        setPastedImage(String(reader.result))
        setNote('已从剪贴板读取截图，点击「识别公式」开始 OCR')
      }
      reader.readAsDataURL(file)
      e.preventDefault()
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const recognize = async () => {
    const canvas = canvasRef.current
    const image = pastedImage ?? canvas?.toDataURL('image/png')
    if (!image) return
    setBusy(true)
    setNote(null)
    try {
      const r = await recognizeImage(aiConfig, image)
      setLatex(r.latex)
      setNote(r.note ?? null)
      showToast(r.source === 'ai' ? '识别完成' : '已使用本地演示识别', 'success')
    } catch (e: any) {
      setNote(e?.message ?? '识别失败')
      showToast('识别失败', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const preview = latex.trim() ? renderMathSafely(latex, true, {}) : null

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="手写公式画板 · 截图识别"
      subtitle="用鼠标 / 触控笔手写，或直接 Ctrl+V 粘贴教材、论文里的公式截图"
      icon={<PenTool size={18} />}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!latex.trim()}
            onClick={() => {
              editorBridge.current?.insertMath(latex.trim(), false)
              showToast('已插入识别结果', 'success')
              onClose()
            }}
          >
            插入到文档
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-white">
          {pastedImage ? (
            <div className="relative">
              <img src={pastedImage} alt="clipboard" className="max-h-[280px] w-full object-contain p-3" />
              <button
                onClick={() => setPastedImage(null)}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] text-ink-600 shadow-sm ring-1 ring-ink-200 hover:text-rose-600"
              >
                <RotateCcw size={11} /> 回到手写板
              </button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="h-[280px] w-full cursor-crosshair touch-none"
              onPointerDown={(e) => {
                drawingRef.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                strokesRef.current.push([pos(e)])
                force((n) => n + 1)
                redraw()
              }}
              onPointerMove={(e) => {
                if (!drawingRef.current) return
                const last = strokesRef.current[strokesRef.current.length - 1]
                last.push(pos(e))
                redraw()
              }}
              onPointerUp={() => {
                drawingRef.current = false
                force((n) => n + 1)
              }}
              onPointerLeave={() => (drawingRef.current = false)}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { strokesRef.current.pop(); redraw() }}>
            <Undo2 size={12} /> 撤销笔画
          </Button>
          <Button size="sm" variant="outline" onClick={() => { strokesRef.current = []; redraw() }}>
            <Eraser size={12} /> 清空画板
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setPastedImage(null); setNote('已切换回手写板') }}>
            <ClipboardPaste size={12} /> 粘贴截图（Ctrl+V）
          </Button>
          <Button size="sm" variant="primary" onClick={recognize} disabled={busy}>
            <ScanLine size={12} /> {busy ? '识别中…' : '识别公式'}
          </Button>
        </div>

        {note && (
          <div className="flex items-start gap-1.5 rounded-lg bg-accent-50/70 px-3 py-2 text-[11.5px] leading-relaxed text-accent-800">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            {note}
          </div>
        )}

        <Field label="识别结果（可直接编辑）" hint="未配置多模态接口时，将使用本地演示识别；配置后识别真实手写内容">
          <TextInput value={latex} onChange={setLatex} mono placeholder="\int_{0}^{\infty} e^{-x^2}\,dx" />
        </Field>

        {preview && (
          <div className="rounded-xl border border-ink-200 bg-white px-4 py-4">
            <div className="mb-1 text-[11px] text-ink-400">实时预览</div>
            <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        )}
      </div>
    </Modal>
  )
}
