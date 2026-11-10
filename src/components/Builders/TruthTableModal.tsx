import { useMemo, useState } from 'react'
import { CheckCircle2, FlaskConical, Info, XCircle } from 'lucide-react'
import { Button, Field, Modal, Segmented, TextInput } from '../ui'
import { buildTruthTable, truthTableToLatex, truthTableToMarkdown } from '../../core/mathEvaluator'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'

const EXAMPLES = [
  '(P \\land Q) \\to (\\neg R \\lor P)',
  'A & B -> C',
  '(P \\lor Q) \\land \\neg(P \\land Q)',
  'P \\iff \\neg\\neg P',
  '(A \\to B) \\land (B \\to C) \\to (A \\to C)',
]

export default function TruthTableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const showToast = useEditorStore((s) => s.showToast)
  const [expr, setExpr] = useState(EXAMPLES[0])
  const [format, setFormat] = useState<'markdown' | 'latex'>('markdown')

  const result = useMemo(() => buildTruthTable(expr), [expr])

  const output = useMemo(
    () => (format === 'markdown' ? truthTableToMarkdown(result, expr) : truthTableToLatex(result, expr)),
    [result, format, expr]
  )

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="真值表自动生成器"
      subtitle="离散数学 / 数字逻辑：输入命题逻辑表达式，自动枚举全部 2ⁿ 行"
      icon={<FlaskConical size={18} />}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!result.ok}
            onClick={() => {
              if (!result.ok) return
              editorBridge.current?.insertBlock(output)
              showToast(format === 'markdown' ? '已插入 Markdown 表格' : '已插入 LaTeX 数组', 'success')
              onClose()
            }}
          >
            插入到文档
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="逻辑表达式"
          hint="支持 \land \lor \neg \to \iff \oplus，或 & | ! -> <-> xor；也支持中文符号 ∧ ∨ ¬ → ↔"
        >
          <TextInput value={expr} onChange={setExpr} mono placeholder="(P \land Q) \to R" />
        </Field>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-400">示例：</span>
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => setExpr(e)}
              className="rounded-md bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-600 transition hover:bg-accent-50 hover:text-accent-700"
            >
              {e}
            </button>
          ))}
        </div>

        {!result.ok && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
            <XCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">表达式无法解析</div>
              <div className="mt-0.5 text-[11.5px] text-rose-500">{result.error}</div>
            </div>
          </div>
        )}

        {result.ok && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400">命题变元</span>
                {result.variables.length ? (
                  result.variables.map((v) => (
                    <span key={v} className="rounded bg-accent-50 px-1.5 py-0.5 font-mono text-accent-700">
                      {v}
                    </span>
                  ))
                ) : (
                  <span className="text-ink-400">无</span>
                )}
              </div>
              <span className="text-ink-300">|</span>
              <span className="text-ink-500">
                {result.rows.length} 行 = 2<sup>{result.variables.length}</sup>
              </span>
              <span className="text-ink-300">|</span>
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                  result.tautology ? 'bg-emerald-50 text-emerald-700' : result.contradiction ? 'bg-rose-50 text-rose-600' : 'bg-ink-100 text-ink-600'
                }`}
              >
                <CheckCircle2 size={11} />
                {result.tautology ? '重言式' : result.contradiction ? '矛盾式' : '可满足式'}
              </span>
            </div>

            <div className="max-h-[280px] overflow-auto rounded-lg border border-ink-200">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 bg-ink-50">
                  <tr>
                    {result.variables.map((v) => (
                      <th key={v} className="border-b border-ink-200 px-2 py-1.5 font-mono font-semibold text-ink-700">
                        {v}
                      </th>
                    ))}
                    <th className="border-b border-l border-ink-200 bg-accent-50/60 px-2 py-1.5 text-accent-800">
                      {expr}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-ink-50/60">
                      {row.values.map((v, k) => (
                        <td key={k} className={`px-2 py-1 text-center font-mono ${v ? 'text-ink-800' : 'text-ink-400'}`}>
                          {v ? 'T' : 'F'}
                        </td>
                      ))}
                      <td
                        className={`border-l border-ink-100 px-2 py-1 text-center font-mono font-semibold ${
                          row.result ? 'bg-emerald-50/60 text-emerald-700' : 'bg-rose-50/50 text-rose-600'
                        }`}
                      >
                        {row.result ? 'T' : 'F'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink-600">输出格式</span>
                <Segmented
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: 'markdown', label: 'Markdown 表格' },
                    { value: 'latex', label: 'LaTeX 数组' },
                  ]}
                />
              </div>
              <pre className="max-h-[180px] overflow-auto rounded-lg bg-solid px-3 py-2 font-mono text-[11.5px] leading-relaxed text-white/85">
                {output}
              </pre>
            </div>
          </>
        )}

        <div className="flex items-start gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-[11.5px] leading-relaxed text-ink-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          运算符优先级（由高到低）：¬ → ∧ → ⊕ → ∨ → → → ↔。蕴含为右结合，可用括号显式指定。
        </div>
      </div>
    </Modal>
  )
}
