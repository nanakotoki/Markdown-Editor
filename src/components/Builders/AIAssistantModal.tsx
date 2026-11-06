import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Loader2, Quote, Sparkles, Wand2 } from 'lucide-react'
import { Button, Field, Modal, TextArea, TextInput } from '../ui'
import { explainFormula, isAIConfigured, nlToLatex, refactorFormula } from '../../core/aiService'
import { FORMULA_CATEGORIES, FORMULA_LIBRARY, FORMULA_SUMMARY, searchFormulas, type FormulaEntry } from '../../core/formulaLibrary'
import { renderMathSafely } from '../../core/katexSafeRender'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'

const REFACTORS = [
  { label: '转为多行 aligned 推导', instruction: '把公式改写为多行 aligned 推导格式，每步等号对齐' },
  { label: '行内分式改 \\dfrac', instruction: '把行内分式改为 \\dfrac' },
  { label: '展开为泰勒级数前 3 项', instruction: '把函数展开为泰勒级数并保留前 3 项' },
  { label: '解释该公式的含义', instruction: '__explain__' },
]

export default function AIAssistantModal({
  open,
  onClose,
  seed,
}: {
  open: boolean
  onClose: () => void
  seed?: string
}) {
  const aiConfig = useEditorStore((s) => s.aiConfig)
  const showToast = useEditorStore((s) => s.showToast)
  const [prompt, setPrompt] = useState('')
  const [latex, setLatex] = useState(seed ?? '')
  const [stream, setStream] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [explain, setExplain] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('全部')

  useEffect(() => {
    if (open) {
      setLatex(seed ?? '')
      setStream('')
      setNote(null)
      setExplain(null)
    }
  }, [open, seed])

  const configured = isAIConfigured(aiConfig)
  const preview = useMemo(() => (latex.trim() ? renderMathSafely(latex, true, {}) : null), [latex])

  const library = useMemo(() => {
    const base = query.trim() ? searchFormulas(query, 60) : FORMULA_LIBRARY
    return category === '全部' ? base : base.filter((f) => f.category === category)
  }, [query, category])

  const generate = async () => {
    if (!prompt.trim()) return
    setBusy(true)
    setStream('')
    setNote(null)
    setExplain(null)
    try {
      const r = await nlToLatex(aiConfig, prompt, (t) => setStream((s) => s + t))
      setLatex(r.latex)
      if (r.note) setNote(r.note)
    } catch (e: any) {
      setNote(e?.message ?? '生成失败')
      showToast('生成失败', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const runRefactor = async (instruction: string) => {
    if (!latex.trim()) {
      showToast('请先生成或选中一个公式', 'warn')
      return
    }
    setBusy(true)
    setExplain(null)
    try {
      if (instruction === '__explain__') {
        if (!configured) {
          setNote('解释功能需要配置 API Key；未配置时可使用本地公式库查看公式说明。')
          return
        }
        const text = await explainFormula(aiConfig, latex, (t) => setExplain((s) => (s ?? '') + t))
        setExplain(text)
      } else {
        const next = await refactorFormula(aiConfig, latex, instruction, (t) => setStream((s) => s + t))
        setLatex(next)
      }
    } catch (e: any) {
      setNote(e?.message ?? '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="AI 公式助手 · 离线公式库"
      subtitle={configured ? `已连接 ${aiConfig.provider} · ${aiConfig.model}` : `未配置 API Key：将使用本地离线公式库检索（${FORMULA_SUMMARY}）`}
      icon={<Sparkles size={18} />}
      width="max-w-5xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              editorBridge.current?.insertMath(latex, false)
              showToast('已插入行内公式', 'success')
            }}
            disabled={!latex.trim()}
          >
            插入行内
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              editorBridge.current?.insertMath(latex, true)
              showToast('已插入块级公式', 'success')
              onClose()
            }}
            disabled={!latex.trim()}
          >
            插入块级公式
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          <Field label="用中文描述你想要的公式" hint="Ctrl/Cmd + K 可在编辑器内随时呼出">
            <TextArea
              value={prompt}
              onChange={setPrompt}
              rows={3}
              placeholder="例如：写出三维高斯分布的概率密度函数，均值为 μ，协方差矩阵为 Σ"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="primary" size="sm" onClick={generate} disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {busy ? '生成中…' : '生成 LaTeX'}
            </Button>
            {REFACTORS.map((r) => (
              <Button key={r.label} size="sm" variant="outline" onClick={() => runRefactor(r.instruction)} disabled={busy}>
                <Wand2 size={11} /> {r.label}
              </Button>
            ))}
          </div>

          {note && <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-700">{note}</div>}

          <Field label="LaTeX 源码（可编辑）">
            <TextArea value={latex} onChange={setLatex} rows={4} mono />
          </Field>

          <div className="rounded-xl border border-ink-200 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-3 py-1.5">
              <span className="text-[11px] font-medium text-ink-400">实时预览</span>
              {stream && <span className="truncate text-[10.5px] text-accent-500">流式输出中…</span>}
            </div>
            <div className="min-h-[90px] overflow-auto px-4 py-4">
              {preview ? (
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              ) : (
                <div className="py-6 text-center text-[12px] text-ink-300">尚无公式</div>
              )}
            </div>
          </div>

          {(explain || stream) && (
            <div className="rounded-xl border border-accent-100 bg-accent-50/50 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-accent-700">
                <Quote size={11} /> {explain ? '公式解释' : '模型原始输出'}
              </div>
              <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-700">{explain || stream}</div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5">
            <BookOpen size={13} className="text-ink-400" />
            <span className="text-[12px] font-medium text-ink-600">离线公式库</span>
            <span className="rounded bg-ink-100 px-1 text-[10px] text-ink-500">{FORMULA_LIBRARY.length}</span>
          </div>
          <TextInput value={query} onChange={setQuery} placeholder="拼音 / 首字母 / 关键词" />
          <div className="my-2 flex flex-wrap gap-1">
            {['全部', ...FORMULA_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded px-1.5 py-0.5 text-[10.5px] transition ${
                  category === c ? 'bg-accent-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="max-h-[380px] space-y-1 overflow-auto pr-1">
            {library.map((f) => (
              <LibraryRow key={f.id} entry={f} onPick={() => setLatex(f.latex)} />
            ))}
            {library.length === 0 && <div className="py-6 text-center text-[12px] text-ink-400">没有匹配的公式</div>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function LibraryRow({ entry, onPick }: { entry: FormulaEntry; onPick: () => void }) {
  const html = useMemo(() => renderMathSafely(entry.latex, false, {}).html, [entry.latex])
  return (
    <button
      onClick={onPick}
      className="w-full rounded-lg border border-ink-100 px-2.5 py-2 text-left transition hover:border-accent-300 hover:bg-accent-50/30"
      title={entry.desc}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[12px] font-medium text-ink-700">{entry.name}</span>
        <span className="shrink-0 rounded bg-ink-100 px-1 text-[9.5px] text-ink-500">{entry.category}</span>
      </div>
      <div className="mt-1 max-h-[42px] overflow-hidden text-[11px] text-ink-600" dangerouslySetInnerHTML={{ __html: html }} />
    </button>
  )
}
