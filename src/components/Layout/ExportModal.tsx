import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  Loader2,
  Printer,
} from 'lucide-react'
import { Button, Modal, Segmented } from '../ui'
import { compileToLatex, type TexTemplate } from '../../core/astToLatex'
import { macrosToKatex, macrosToPreamble } from '../../core/katexSafeRender'
import { buildStandaloneHtml, openHtmlInNewWindow } from '../../core/htmlExport'
import { copyPlainText, downloadFile } from '../../core/clipboardExport'
import { readFile, runExport, type ExportResult } from '../../core/workspaceApi'
import { desktop } from '../../core/desktop'
import { useEditorStore } from '../../store/useEditorStore'

const TEMPLATES: Array<{ key: TexTemplate; name: string; desc: string; badge: string }> = [
  { key: 'ctexart', name: 'ctexart', desc: '中文课程作业 / 实验报告（默认）', badge: '中文' },
  { key: 'ctexbook', name: 'ctexbook', desc: '成套书稿 / 学位论文，H1 变章', badge: '成书' },
  { key: 'article', name: 'article', desc: '英文标准学术论文', badge: 'English' },
  { key: 'IEEEtran', name: 'IEEEtran', desc: 'IEEE 双栏国际会议论文', badge: '双栏' },
]

export default function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { liveContent, activeDoc, macros, bibEntries, settings, updateSettings, showToast, mode, workspace, refreshTree } =
    useEditorStore()
  const [template, setTemplate] = useState<TexTemplate>(settings.texTemplate)
  const [tab, setTab] = useState<'tex' | 'html' | 'book'>('tex')
  const [copied, setCopied] = useState(false)
  const [html, setHtml] = useState('')
  const [building, setBuilding] = useState(false)

  // —— 整本导出（只在本地模式下出现）
  const [bookTitle, setBookTitle] = useState(workspace?.name?.replace(/^\.+/, '') ?? '我的文集')
  const [bookTemplate, setBookTemplate] = useState<TexTemplate>(settings.texTemplate)
  const [bookTex, setBookTex] = useState(true)
  const [bookHtml, setBookHtml] = useState(true)
  const [bookBusy, setBookBusy] = useState(false)
  const [bookResult, setBookResult] = useState<ExportResult | null>(null)

  const doc = activeDoc()
  const title = doc?.title ?? 'MathFlow 文档'
  const macroMap = useMemo(() => macrosToKatex(macros), [macros])
  /** 文档所在目录：图片相对路径以此为基准，PDF 的保存框也默认落在这里 */
  const docDir = useMemo(() => (doc?.filePath ? doc.filePath.split('/').slice(0, -1).join('/') : ''), [doc?.filePath])
  const assetBase = useMemo(() => {
    if (!doc?.filePath || typeof location === 'undefined') return undefined
    return `${location.origin}/ws${docDir ? `/${docDir}` : ''}`
  }, [doc?.filePath, docDir])
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    if (open) setTemplate(settings.texTemplate)
  }, [open, settings.texTemplate])

  useEffect(() => {
    if (open && workspace?.name) setBookTitle((t) => (t && t !== '我的文集' ? t : workspace.name.replace(/^\.+/, '')))
  }, [open, workspace?.name])

  const compiled = useMemo(
    () =>
      compileToLatex(liveContent, {
        title,
        template,
        bib: bibEntries,
        macrosPreamble: macrosToPreamble(macros),
      }),
    [liveContent, title, template, bibEntries, macros]
  )

  useEffect(() => {
    if (!open || tab !== 'html') return
    let cancelled = false
    setBuilding(true)
    buildStandaloneHtml(liveContent, {
      title,
      macros: macroMap,
      bib: bibEntries,
      settings,
      assetBase,
      // 应用内预览与字体同源，不必把字体塞成 base64，弹窗打开更快
      inlineFonts: !assetBase,
    })
      .then((r) => {
        if (!cancelled) setHtml(r.html)
      })
      .finally(() => !cancelled && setBuilding(false))
    return () => {
      cancelled = true
    }
  }, [open, tab, liveContent, title, bibEntries, settings, assetBase])

  const texLines = useMemo(() => compiled.tex.split('\n'), [compiled.tex])

  const runBookExport = async () => {
    const to: Array<'tex' | 'html'> = []
    if (bookTex) to.push('tex')
    if (bookHtml) to.push('html')
    if (!to.length) {
      showToast('至少选一种输出格式', 'warn')
      return
    }
    setBookBusy(true)
    setBookResult(null)
    try {
      const res = await runExport({ to, template: bookTemplate, combine: true, title: bookTitle, outDir: 'export' })
      setBookResult(res)
      // 输出目录是工作区里的真实文件夹，刷一下左边栏就能直接打开 .tex / .html
      void refreshTree()
      const n = res.combined?.chapters ? `${res.combined.chapters} 章` : `${res.outputs.length} 篇`
      showToast(`已导出 ${n} 到 export/`, 'success')
    } catch (e: any) {
      showToast(e?.message ?? '导出失败', 'warn')
    } finally {
      setBookBusy(false)
    }
  }

  /**
   * 导出 PDF：桌面版走 Chromium 的 printToPDF，**不弹保存框**——
   * 文件名按文档标题起好、直接落在文档所在目录，重名自动加 (2)。
   * 打印页从本地服务取（与图片、字体同源），所以插图不会丢、字体也不用内联，
   * 整个导出通常在几百毫秒到两秒之间。
   * 浏览器版没有这条通道，只能退回新窗口 + Ctrl+P。
   */
  const exportPdf = async () => {
    setPdfBusy(true)
    try {
      const bridge = desktop()
      // 桌面版：字体不内联（同源直接取），HTML 从几 MB 降到几十 KB
      const r = await buildStandaloneHtml(liveContent, {
        title,
        macros: macroMap,
        bib: bibEntries,
        settings,
        assetBase,
        inlineFonts: !bridge,
      })
      if (bridge) {
        const res = await bridge.exportPdf({ html: r.html, defaultName: `${title}.pdf`, dirHint: docDir })
        if (res.ok) {
          const kb = res.bytes ? `，${Math.max(1, Math.round(res.bytes / 1024))} KB` : ''
          const sec = res.ms ? `，用时 ${(res.ms / 1000).toFixed(1)} 秒` : ''
          showToast(`已导出：${res.filePath}${kb}${sec}`, 'success')
        } else {
          showToast(res.error ?? '导出失败', 'warn')
        }
        return
      }
      const ok = openHtmlInNewWindow(r.html)
      showToast(ok ? '已在新窗口打开，Ctrl+P 存为 PDF' : '浏览器拦截了新窗口', ok ? 'success' : 'warn')
    } catch (e: any) {
      showToast(e?.message ?? '导出失败', 'warn')
    } finally {
      setPdfBusy(false)
    }
  }

  /** 导出的 HTML 用 blob 打开：不占用工作区路由，也不会拿到 /api 的权限 */
  const openExported = async (rel: string) => {
    try {
      const f = await readFile(rel)
      const url = URL.createObjectURL(new Blob([f.content], { type: 'text/html;charset=utf-8' }))
      const win = window.open(url, '_blank')
      if (!win) showToast('浏览器拦截了新窗口，请允许弹窗', 'warn')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: any) {
      showToast(e?.message ?? '打不开导出的文件', 'warn')
    }
  }

  const submitOverleaf = () => {
    const form = document.createElement('form')
    form.action = 'https://www.overleaf.com/docs'
    form.method = 'POST'
    form.target = '_blank'
    form.style.display = 'none'
    const snip = document.createElement('textarea')
    snip.name = 'snip'
    snip.value = compiled.tex
    const name = document.createElement('input')
    name.name = 'snip_name'
    name.value = `${title.replace(/[\\/:*?"<>|]/g, '-')}.tex`
    form.appendChild(snip)
    form.appendChild(name)
    document.body.appendChild(form)
    form.submit()
    form.remove()
    showToast('已向 Overleaf 投递项目，请在新标签页确认', 'success')
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="导出学术成品"
      subtitle="AST 级转译，不依赖任何正则替换；一次编写，三路输出"
      icon={<Download size={18} />}
      width="max-w-5xl"
      bodyClassName="px-5 py-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tex', label: 'LaTeX 源码 .tex', icon: <FileCode2 size={12} /> },
            { value: 'html', label: '独立网页 / PDF', icon: <FileText size={12} /> },
            ...(mode === 'local'
              ? [{ value: 'book' as const, label: '整本工程（写盘）', icon: <BookOpen size={12} /> }]
              : []),
          ]}
        />
        <div className="flex items-center gap-3 text-[11px] text-ink-400">
          <span>标题 {compiled.stats.sections}</span>
          <span>公式 {compiled.stats.equations}</span>
          <span>定理 {compiled.stats.theorems}</span>
          <span>算法 {compiled.stats.algorithms}</span>
          <span>表格 {compiled.stats.tables}</span>
        </div>
      </div>

      {tab === 'tex' && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTemplate(t.key)
                  updateSettings({ texTemplate: t.key })
                }}
                className={`rounded-xl border p-2.5 text-left transition ${
                  template === t.key
                    ? 'border-accent-400 bg-accent-50/60 ring-1 ring-accent-200'
                    : 'border-ink-200 hover:border-accent-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12.5px] font-semibold text-ink-800">{t.name}</span>
                  <span className="rounded bg-ink-100 px-1 text-[9.5px] text-ink-500">{t.badge}</span>
                </div>
                <div className="mt-1 text-[11px] leading-snug text-ink-500">{t.desc}</div>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-200">
            <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-3 py-1.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
                <Code2 size={12} /> {title.replace(/[\\/:*?"<>|]/g, '-')}.tex
              </span>
              <span className="text-[10.5px] text-ink-400">{texLines.length} 行</span>
            </div>
            <div className="max-h-[320px] overflow-auto bg-solid py-2">
              <pre className="font-mono text-[11.5px] leading-[1.65] text-white/80">
                {texLines.map((line, i) => (
                  <div key={i} className="flex hover:bg-surface/5">
                    <span className="w-9 shrink-0 select-none pr-3 text-right text-[10px] text-ink-500">{i + 1}</span>
                    <span className="whitespace-pre-wrap break-all pr-4">{line || ' '}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                const ok = await copyPlainText(compiled.tex)
                setCopied(ok)
                showToast(ok ? '已复制完整 .tex 源码' : '复制失败', ok ? 'success' : 'warn')
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制源码'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile(`${title.replace(/[\\/:*?"<>|]/g, '-')}.tex`, compiled.tex, 'application/x-tex;charset=utf-8')
                showToast('已下载 .tex 文件', 'success')
              }}
            >
              <Download size={13} /> 下载 .tex
            </Button>
            <Button variant="outline" onClick={submitOverleaf}>
              <ExternalLink size={13} /> 在 Overleaf 中打开
            </Button>
            <span className="ml-auto text-[11px] text-ink-400">
              编译：<code className="rounded bg-ink-100 px-1">xelatex main.tex</code>（中文模板需 XeLaTeX）
            </span>
          </div>
        </>
      )}

      {tab === 'html' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={pdfBusy} onClick={exportPdf}>
              {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              {pdfBusy ? '正在生成 PDF…' : '导出 PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // 下载给别人时保留相对路径，不把本机 localhost 地址写进文件
                const r = await buildStandaloneHtml(liveContent, { title, macros: macroMap, bib: bibEntries, settings })
                downloadFile(`${title.replace(/[\\/:*?"<>|]/g, '-')}.html`, r.html, 'text/html;charset=utf-8')
                showToast('已下载单文件网页（图片按相对路径引用）', 'success')
              }}
            >
              <Download size={13} /> 下载单文件 HTML
            </Button>
            {!desktop() && (
              <Button
                variant="outline"
                onClick={async () => {
                  const r = await buildStandaloneHtml(liveContent, { title, macros: macroMap, bib: bibEntries, settings, assetBase })
                  const ok = openHtmlInNewWindow(r.html)
                  showToast(ok ? '已在新窗口打开，可直接 Ctrl+P 打印为 A4 PDF' : '浏览器拦截了新窗口', ok ? 'success' : 'warn')
                }}
              >
                <Printer size={13} /> 打印 / 导出 A4 PDF
              </Button>
            )}
            {building && (
              <span className="flex items-center gap-1 text-[11px] text-ink-400">
                <Loader2 size={11} className="animate-spin" /> 正在内联字体…
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-200">
            <div className="border-b border-ink-100 bg-ink-50 px-3 py-1.5 text-[11px] text-ink-500">
              预览（与导出结果一致，已内嵌 Latin Modern / 思源宋体回退）
            </div>
            {html ? (
              // 预览里不需要导出网页自带的那颗「打印」浮标，按钮已经在上面了
              <iframe
                title="html-preview"
                srcDoc={html.replace('</head>', '<style>.mf-print-bar{display:none!important}</style></head>')}
                className="h-[400px] w-full bg-surface"
              />
            ) : (
              <div className="flex h-[400px] items-center justify-center text-[12px] text-ink-400">
                {building ? '正在生成…' : '点击上方按钮生成预览'}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
            HTML 采用与预览完全一致的渲染管线（定理编号、三线表、算法块、交叉引用）。
            <code className="mx-1 rounded bg-surface px-1">@media print</code>
            已针对 A4 调校：页边距 20mm、行间公式与正文同字号、
            <code className="rounded bg-surface px-1">break-inside: avoid</code> 避免公式/定理框被跨页截断。
            想控制换页位置，在源码里单独写一行 <code className="mx-1 rounded bg-surface px-1">\newpage</code>；
            想先在应用里确认分页，切到顶部「阅读」即可看到与打印一致的 A4 页面。
          </div>
        </div>
      )}
      {tab === 'book' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-ink-200 p-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-500">书名（标题页用）</span>
              <input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="例如：泛函分析讲义"
                className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-accent-400"
              />
            </label>

            <div className="mt-3">
              <span className="mb-1 block text-[11px] font-medium text-ink-500">LaTeX 模板</span>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setBookTemplate(t.key)}
                    className={`rounded-lg border p-2 text-left transition ${
                      bookTemplate === t.key
                        ? 'border-accent-400 bg-accent-50/60 ring-1 ring-accent-200'
                        : 'border-ink-200 hover:border-accent-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-semibold text-ink-800">{t.name}</span>
                      <span className="rounded bg-ink-100 px-1 text-[9.5px] text-ink-500">{t.badge}</span>
                    </div>
                    <div className="mt-1 text-[10.5px] leading-snug text-ink-500">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-ink-500">输出</span>
              {[
                { on: bookTex, set: setBookTex, label: '逐篇 .tex + main.tex' },
                { on: bookHtml, set: setBookHtml, label: '逐篇 .html + main.html' },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => o.set(!o.on)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] transition ${
                    o.on ? 'border-accent-300 bg-accent-50 text-accent-700' : 'border-ink-200 text-ink-500'
                  }`}
                >
                  <span
                    className={`flex h-3 w-3 items-center justify-center rounded border ${
                      o.on ? 'border-accent-500 bg-accent-500 text-white' : 'border-ink-300'
                    }`}
                  >
                    {o.on && <Check size={9} strokeWidth={3} />}
                  </span>
                  {o.label}
                </button>
              ))}

              <Button variant="primary" className="ml-auto" disabled={bookBusy} onClick={runBookExport}>
                {bookBusy ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
                {bookBusy ? '正在编译…' : '导出整本到 export/'}
              </Button>
            </div>
          </div>

          {bookResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-800">
                <Check size={13} /> 已写入 {bookResult.outputs.length} 篇，输出目录{' '}
                <code className="rounded bg-surface/70 px-1 font-mono text-[11px]">{bookResult.outDir}/</code>
              </div>
              <div className="mt-2 space-y-1.5">
                {bookResult.combined?.mainTex && (
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-600">
                    <FileCode2 size={12} className="text-ink-400" />
                    <code className="font-mono">{bookResult.combined.mainTex}</code>
                    <span className="text-ink-400">
                      {bookResult.combined.chapters} 章合并 · 交叉引用已统一
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={async () => {
                        const ok = await copyPlainText(`cd "${bookResult.combined?.mainTex?.replace(/\/main\.tex$/, '')}" && xelatex main.tex`)
                        showToast(ok ? '已复制编译命令' : '复制失败', ok ? 'success' : 'warn')
                      }}
                    >
                      <Copy size={11} /> 编译命令
                    </Button>
                  </div>
                )}
                {bookResult.combined?.mainHtml && (
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-600">
                    <FileText size={12} className="text-ink-400" />
                    <code className="font-mono">{bookResult.combined.mainHtml}</code>
                    <span className="text-ink-400">整本阅读版</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => openExported(bookResult.combined!.mainHtml!)}
                    >
                      <FolderOpen size={11} /> 打开
                    </Button>
                  </div>
                )}
              </div>
              {bookResult.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-emerald-200/70 pt-2 text-[11px] text-amber-700">
                  {bookResult.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                  {bookResult.warnings.length > 5 && <li>· 还有 {bookResult.warnings.length - 5} 条…</li>}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
            整本导出会把工作区里所有 Markdown 按文件名自然排序排成章节（<code className="rounded bg-surface px-1">01-引言.md</code>{' '}
            就排在 <code className="rounded bg-surface px-1">02-方法.md</code> 前面），生成{' '}
            <code className="rounded bg-surface px-1">main.tex</code> 用 <code className="rounded bg-surface px-1">\input</code>{' '}
            引入各章正文片段。跨文件的 <code className="rounded bg-surface px-1">@thm:</code> /{' '}
            <code className="rounded bg-surface px-1">@eq:</code> 引用因此在同一份 .aux 里解析，编号也统一。
          </div>
        </div>
      )}
    </Modal>
  )
}
