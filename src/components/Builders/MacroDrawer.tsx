import { useEffect, useMemo, useState } from 'react'
import { BookMarked, Check, Cpu, Plus, Trash2, Variable } from 'lucide-react'
import { Button, Field, Modal, Segmented, TextArea, TextInput } from '../ui'
import { DEFAULT_MACRO_SOURCE, parseMacroLine, type MacroDef } from '../../core/katexSafeRender'
import { useEditorStore, type BibEntry } from '../../store/useEditorStore'

/** 极简 BibTeX 解析：@type{key, field = {value}, ...} */
export function parseBibtex(raw: string): BibEntry[] {
  const chunks = raw.split(/@(?=[A-Za-z]+\s*\{)/).filter((s) => s.trim().length > 0)
  const out: BibEntry[] = []
  for (const chunk of chunks) {
    const head = /^([A-Za-z]+)\s*\{\s*([^,\s]+)\s*,/.exec(chunk)
    if (!head) continue
    const type = head[1].toLowerCase()
    const key = head[2]
    const fields: Record<string, string> = {}
    const re = /([A-Za-z]+)\s*=\s*(\{([\s\S]*?)\}|"([\s\S]*?)"|([^,\n]+))/g
    let m: RegExpExecArray | null
    while ((m = re.exec(chunk))) {
      fields[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? '').replace(/[{}]/g, '').trim()
    }
    out.push({
      id: `bib-${key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key,
      type,
      author: fields.author ?? '',
      title: fields.title ?? '',
      year: fields.year ?? fields.date ?? '',
      journal: fields.journal ?? fields.booktitle ?? fields.publisher ?? '',
      raw: `@${type}{${key},\n${Object.entries(fields).map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`,
    })
  }
  return out
}

export default function MacroDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { macros, macroSource, setMacros, bibEntries, upsertBib, removeBib, aiConfig, setAIConfig, showToast } = useEditorStore()
  const [tab, setTab] = useState<'macro' | 'bib' | 'ai'>('macro')
  const [source, setSource] = useState(macroSource || DEFAULT_MACRO_SOURCE)
  const [bibPaste, setBibPaste] = useState('')
  const [form, setForm] = useState({ key: '', author: '', title: '', year: '', journal: '' })

  useEffect(() => {
    if (open) setSource(macroSource || DEFAULT_MACRO_SOURCE)
  }, [open, macroSource])

  const parsed = useMemo<MacroDef[]>(() => {
    return source
      .split('\n')
      .map(parseMacroLine)
      .filter((d): d is MacroDef => Boolean(d))
  }, [source])

  const save = () => {
    setMacros(parsed, source)
    showToast(`已保存 ${parsed.length} 条自定义宏`, 'success')
  }

  const addBibFromPaste = () => {
    const items = parseBibtex(bibPaste)
    if (!items.length) {
      showToast('未能解析出文献条目，请检查 @type{key, ...} 格式', 'warn')
      return
    }
    items.forEach(upsertBib)
    setBibPaste('')
    showToast(`已添加 ${items.length} 条文献`, 'success')
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="全局宏 · 参考文献 · AI 接口"
      subtitle="宏会实时注入 KaTeX 预览，并在导出 .tex 时自动写入导言区"
      icon={<Variable size={18} />}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {tab === 'macro' && (
            <Button variant="primary" onClick={save}>
              <Check size={13} /> 保存并应用
            </Button>
          )}
        </>
      }
    >
      <div className="mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'macro', label: '宏命令' },
            { value: 'bib', label: '参考文献' },
            { value: 'ai', label: 'AI 接口' },
          ]}
        />
      </div>

      {tab === 'macro' && (
        <div className="space-y-3">
          <Field label="宏定义（每行一条，支持 \newcommand / \renewcommand / \def）" hint="例：\newcommand{\R}{\mathbb{R}}">
            <TextArea value={source} onChange={setSource} rows={9} mono />
          </Field>
          <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2">
            <div className="mb-1 text-[11px] font-medium text-ink-500">已解析 {parsed.length} 条</div>
            <div className="flex flex-wrap gap-1.5">
              {parsed.map((d) => (
                <span key={d.id} className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-accent-700 ring-1 ring-ink-100">
                  {d.name}
                  {d.args ? `[${d.args}]` : ''}
                </span>
              ))}
              {parsed.length === 0 && <span className="text-[11px] text-ink-400">暂无有效宏定义</span>}
            </div>
          </div>
          <div className="text-[11px] leading-relaxed text-ink-400">
            内置宏：<code className="rounded bg-ink-100 px-1">\R</code> <code className="rounded bg-ink-100 px-1">\N</code>{' '}
            <code className="rounded bg-ink-100 px-1">\Z</code> <code className="rounded bg-ink-100 px-1">\C</code>{' '}
            <code className="rounded bg-ink-100 px-1">\E</code> <code className="rounded bg-ink-100 px-1">\Var</code>{' '}
            <code className="rounded bg-ink-100 px-1">\Cov</code> <code className="rounded bg-ink-100 px-1">\argmin</code>{' '}
            <code className="rounded bg-ink-100 px-1">\dd</code>
          </div>
        </div>
      )}

      {tab === 'bib' && (
        <div className="space-y-3">
          <Field label="粘贴 BibTeX 条目" hint="支持一次粘贴多条，例如从 Google Scholar / CNKI 导出的 .bib 内容">
            <TextArea value={bibPaste} onChange={setBibPaste} rows={5} mono placeholder={'@book{knuth1984,\n  author = {Knuth, Donald E.},\n  title = {The TeXbook},\n  year = {1984}\n}'} />
          </Field>
          <Button size="sm" variant="primary" onClick={addBibFromPaste} disabled={!bibPaste.trim()}>
            <Plus size={12} /> 解析并加入文献库
          </Button>

          <div className="rounded-lg border border-ink-200">
            <div className="border-b border-ink-100 px-3 py-1.5 text-[11.5px] font-medium text-ink-500">
              文献库（{bibEntries.length} 条）
            </div>
            <div className="max-h-[220px] overflow-auto divide-y divide-ink-50">
              {bibEntries.map((b) => (
                <div key={b.id} className="flex items-start gap-2 px-3 py-2">
                  <BookMarked size={13} className="mt-0.5 shrink-0 text-accent-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-accent-50 px-1 font-mono text-[10.5px] text-accent-700">{b.key}</span>
                      <span className="text-[10.5px] text-ink-300">{b.type} · {b.year}</span>
                    </div>
                    <div className="truncate text-[12px] text-ink-700">{b.title}</div>
                    <div className="truncate text-[11px] text-ink-400">{b.author}</div>
                  </div>
                  <button onClick={() => removeBib(b.id)} className="text-ink-300 hover:text-rose-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {bibEntries.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-ink-400">文献库为空</div>}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <Field label="引用键">
              <TextInput value={form.key} onChange={(v) => setForm({ ...form, key: v })} mono placeholder="lamport1994" />
            </Field>
            <Field label="作者">
              <TextInput value={form.author} onChange={(v) => setForm({ ...form, author: v })} />
            </Field>
            <Field label="标题">
              <TextInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            </Field>
            <Field label="年份">
              <TextInput value={form.year} onChange={(v) => setForm({ ...form, year: v })} />
            </Field>
            <Field label="出处">
              <TextInput value={form.journal} onChange={(v) => setForm({ ...form, journal: v })} />
            </Field>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!form.key.trim()) {
                showToast('请填写引用键', 'warn')
                return
              }
              upsertBib({
                id: `bib-${form.key}`,
                type: 'misc',
                raw: '',
                ...form,
              })
              setForm({ key: '', author: '', title: '', year: '', journal: '' })
              showToast('已添加文献', 'success')
            }}
          >
            <Plus size={12} /> 手动添加
          </Button>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-accent-50/60 px-3 py-2 text-[11.5px] leading-relaxed text-accent-800">
            <Cpu size={13} className="mt-0.5 shrink-0" />
            支持 OpenAI 兼容接口（DeepSeek / Moonshot / 本地 Ollama 等）与 Gemini。密钥仅保存在本机 localStorage，不会上传到任何服务器。
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="服务商">
              <select
                value={aiConfig.provider}
                onChange={(e) => {
                  const p = e.target.value as typeof aiConfig.provider
                  const presets: Record<string, { baseUrl: string; model: string }> = {
                    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
                    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
                    gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash' },
                    custom: { baseUrl: aiConfig.baseUrl, model: aiConfig.model },
                  }
                  setAIConfig({ provider: p, ...presets[p] })
                }}
                className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-accent-400"
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI / 兼容</option>
                <option value="gemini">Google Gemini</option>
                <option value="custom">自定义</option>
              </select>
            </Field>
            <Field label="模型">
              <TextInput value={aiConfig.model} onChange={(v) => setAIConfig({ model: v })} mono />
            </Field>
            <Field label="Base URL">
              <TextInput value={aiConfig.baseUrl} onChange={(v) => setAIConfig({ baseUrl: v })} mono />
            </Field>
            <Field label="API Key">
              <TextInput value={aiConfig.apiKey} onChange={(v) => setAIConfig({ apiKey: v })} mono placeholder="sk-..." />
            </Field>
            <Field label="视觉模型（手写 / 截图 OCR）" hint="需支持图片输入，如 gpt-4o-mini / gemini-1.5-flash">
              <TextInput value={aiConfig.visionModel} onChange={(v) => setAIConfig({ visionModel: v })} mono />
            </Field>
          </div>
          <div className="text-[11px] leading-relaxed text-ink-400">
            未配置密钥时，自然语言转公式会退化为本地离线公式库的检索，手写识别会使用本地演示结果——所有功能仍可完整体验。
          </div>
        </div>
      )}
    </Modal>
  )
}
