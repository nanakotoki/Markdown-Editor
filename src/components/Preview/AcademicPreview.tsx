import { useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown, buildPreviewMap, type RefEntry, type RenderResult } from '../../core/renderMarkdown'
import type { MacroMap } from '../../core/katexSafeRender'
import { useEditorStore, type BibEntry, type Settings } from '../../store/useEditorStore'
import PaginatedSheets from './PaginatedSheets'

/**
 * ============================================================================
 *  AcademicPreview.tsx —— 学术级全文预览
 * ----------------------------------------------------------------------------
 *  定理/证明容器 · booktabs 三线表 · 伪代码算法块 · 公式自动编号
 *  · @引用点击跳转 · 悬停气泡预览（无需滚动页面）
 * ============================================================================
 */

export interface AcademicPreviewProps {
  content: string
  macros: MacroMap
  bib: BibEntry[]
  settings: Settings
  /** 工作区里其它文件的交叉引用索引（本地模式），用于解析跨文件引用 */
  extRefs?: RefEntry[]
  onRender?: (res: RenderResult) => void
  className?: string
  /** 分屏模式：点击某个块，让左边跳到对应源码行 */
  onJumpToSource?: (line: number) => void
  /** 是否启用「点渲染结果跳源码」（仅分屏时开） */
  jumpable?: boolean
  /** 把内部滚动容器交给外层，用于滚动联动 */
  scrollElementRef?: React.MutableRefObject<HTMLDivElement | null>
  /** read = 阅读模式：照 A4 纸面分页，看到的就是导出 PDF 的样子 */
  mode?: 'preview' | 'read'
}

interface HoverCard {
  x: number
  y: number
  title: string
  detail: string
  html: string
  /** 跨文件引用时，点击会跳到这个文件 */
  file?: string
}

export default function AcademicPreview({
  content,
  macros,
  bib,
  settings,
  extRefs,
  onRender,
  className,
  onJumpToSource,
  jumpable = false,
  scrollElementRef,
  mode = 'preview',
}: AcademicPreviewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<HoverCard | null>(null)
  const [pageTotal, setPageTotal] = useState(0)

  /** 把内部滚动容器同时交给外层（滚动联动要用） */
  const attachScroll = (el: HTMLDivElement | null) => {
    scrollRef.current = el
    if (scrollElementRef) scrollElementRef.current = el
  }

  /** 事件在 effect 里绑定，用 ref 取最新的回调，避免每次重渲染都重绑 */
  const jumpRef = useRef(onJumpToSource)
  jumpRef.current = onJumpToSource
  const jumpableRef = useRef(jumpable)
  jumpableRef.current = jumpable

  const result = useMemo(
    () =>
      renderMarkdown(content, {
        macros,
        bib,
        autoNumber: settings.autoNumberEquations,
        citationStyle: settings.citationStyle,
        extRefs,
        numbering: { thm: settings.thmNumbering, eq: settings.eqNumbering, eqTag: settings.eqTagStyle },
        qed: settings.qedSymbol,
      }),
    [
      content,
      macros,
      bib,
      settings.autoNumberEquations,
      settings.citationStyle,
      settings.thmNumbering,
      settings.eqNumbering,
      settings.eqTagStyle,
      settings.qedSymbol,
      extRefs,
    ]
  )

  /** 排版参数指纹：字体/字号/容器样式变了要重新分页 */
  const layoutKey = [
    settings.previewFont,
    settings.previewFontSize,
    settings.previewLineHeight,
    settings.previewWeight,
    settings.thmStyle,
    settings.thmBodyKai,
    settings.mathStyle,
    settings.qedSymbol,
  ].join('|')

  const previews = useMemo(() => buildPreviewMap(result), [result])

  useEffect(() => {
    onRender?.(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  /* 悬停气泡 */
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-ref-id]') as HTMLElement | null
      if (!target) return
      const kind = target.getAttribute('data-ref-kind') ?? ''
      const id = target.getAttribute('data-ref-id') ?? ''
      const entry = previews[`${kind}:${id}`]
      const rect = target.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      setHover({
        x: Math.max(12, Math.min(rect.left - rootRect.left, rootRect.width - 400)),
        y: rect.bottom - rootRect.top + root.scrollTop + 8,
        title: entry?.title || target.getAttribute('data-ref-title') || kind,
        detail: entry?.detail || target.getAttribute('data-ref-detail') || '',
        html: entry?.html ?? '',
        file: target.getAttribute('data-mf-file') ?? undefined,
      })
    }
    const onOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-ref-id]')
      if (target) setHover(null)
    }
    root.addEventListener('mouseover', onOver)
    root.addEventListener('mouseout', onOut)
    return () => {
      root.removeEventListener('mouseover', onOver)
      root.removeEventListener('mouseout', onOut)
    }
  }, [previews])

  /* 点击引用跳转 */
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const scrollToAnchor = (anchor: string) => {
      if (!anchor) return
      // 阅读模式的「量尺」里也有一份同样的 id，优先取真正显示的那一份
      const hits = Array.from(root.querySelectorAll(`#${CSS.escape(anchor)}`)) as HTMLElement[]
      const el = hits.find((x) => !x.closest('.mf-sheet-measure')) ?? hits[0]
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('mf-flash')
      setTimeout(() => el.classList.remove('mf-flash'), 1500)
    }
    /** 跨文件引用：先切换到目标文件，等它渲染完再定位锚点 */
    const jumpToFile = (file: string, anchor: string) => {
      const store = useEditorStore.getState()
      if (store.mode !== 'local') return
      void store.openFile(file).then(() => {
        if (!anchor) return
        let tries = 0
        const tick = () => {
          const el = scrollRef.current?.querySelector(`#${CSS.escape(anchor)}`)
          if (el) {
            scrollToAnchor(anchor)
            return
          }
          if (tries++ < 60) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    }
    /** 把相对链接按当前文件所在目录解析成工作区相对路径 */
    const resolveHref = (href: string) => {
      const st = useEditorStore.getState()
      const cur = st.docs.find((d) => d.id === st.activeDocId)?.filePath
      if (!cur || href.startsWith('/')) return href.replace(/^\//, '')
      const dir = cur.includes('/') ? cur.slice(0, cur.lastIndexOf('/')) : ''
      const out: string[] = []
      for (const part of `${dir}/${href}`.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') out.pop()
        else out.push(part)
      }
      return out.join('/')
    }
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null

      // 0) 没点在链接上：分屏模式下「点哪儿跳哪儿」
      if (!anchor) {
        if (!jumpableRef.current) return
        const block = (e.target as HTMLElement).closest('[data-mf-line]') as HTMLElement | null
        const line = Number(block?.dataset.mfLine)
        if (!block || !Number.isFinite(line)) return
        jumpRef.current?.(line)
        return
      }

      // 1) 交叉引用 / 文献引用 / 公式编号
      if (anchor.classList.contains('mf-eq-tag')) {
        e.preventDefault()
        scrollToAnchor((anchor.getAttribute('href') ?? '').replace(/^#/, ''))
        return
      }
      if (anchor.classList.contains('mf-ref') || anchor.classList.contains('mf-cite')) {
        e.preventDefault()
        const file = anchor.getAttribute('data-mf-file')
        if (file) {
          jumpToFile(file, anchor.getAttribute('data-mf-anchor') ?? '')
          return
        }
        scrollToAnchor((anchor.getAttribute('href') ?? '').replace(/^#/, ''))
        return
      }

      const href = anchor.getAttribute('href') ?? ''
      if (!href || href.startsWith('#')) return

      // 2) 指向其它 .md 的相对链接：切到那个文件，而不是让浏览器整页跳走
      if (useEditorStore.getState().mode === 'local' && /\.(md|markdown|mdx)$/i.test(href) && !/^[a-z]+:\/\//i.test(href)) {
        e.preventDefault()
        jumpToFile(resolveHref(href), '')
        return
      }

      // 3) 外部链接不劫持 SPA
      if (/^https?:\/\//i.test(href)) {
        e.preventDefault()
        window.open(href, '_blank', 'noopener,noreferrer')
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  /**
   * 打印：把已经分好页的 A4 纸面复制到一个只供打印的容器里，
   * 原界面整体隐藏，这样打出来就是干净的论文版面，不会把工具栏、侧栏一起印上去。
   */
  const printAsPdf = () => {
    const holder = document.createElement('div')
    holder.className = 'mf-print-holder'
    document.querySelectorAll('.mf-sheet').forEach((sheet) => holder.appendChild(sheet.cloneNode(true)))
    if (!holder.childElementCount) return
    document.body.appendChild(holder)
    document.body.classList.add('mf-printing')
    const cleanup = () => {
      document.body.classList.remove('mf-printing')
      holder.remove()
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    setTimeout(cleanup, 120)
  }

  return (
    <div
      ref={attachScroll}
      data-jumpable={jumpable ? 'true' : 'false'}
      className={`mf-preview-scroll relative h-full overflow-auto ${mode === 'read' ? 'mf-read-scroll' : ''} ${className ?? ''}`}
    >
      {mode === 'read' ? (
        <>
          {settings.pageGuides && (
            <div className="mf-read-toolbar">
              <span>A4 · 共 {pageTotal || 1} 页</span>
              <span className="text-ink-300">·</span>
              <span>
                虚线处为手动分页（源码里写 <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">{'\\newpage'}</code>）
              </span>
              <button className="mf-read-print" onClick={printAsPdf} title="按当前分页打印，或另存为 PDF">
                打印 / 存为 PDF
              </button>
            </div>
          )}
          <div className="pb-10 pt-4">
            <PaginatedSheets html={result.html} signature={layoutKey} onPages={setPageTotal} />
          </div>
        </>
      ) : (
        <div className="mf-academic mx-auto max-w-[860px] px-10 pb-32 pt-8" dangerouslySetInnerHTML={{ __html: result.html }} />
      )}
      {hover && (
        <div
          className="pointer-events-none absolute z-30 w-[380px] rounded-xl border border-ink-200 bg-white p-3 shadow-panel"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-accent-700">{hover.title}</span>
            <span className="truncate text-[11px] text-ink-400">{hover.detail}</span>
          </div>
          {hover.html ? (
            <div className="mf-hover-html overflow-auto text-[13px] text-ink-700" dangerouslySetInnerHTML={{ __html: hover.html }} />
          ) : hover.file ? (
            <div className="text-[11px] text-ink-400">点击跳转到该文件并定位到目标</div>
          ) : (
            <div className="text-[11px] text-ink-400">（该目标没有可预览的公式内容）</div>
          )}
        </div>
      )}
    </div>
  )
}
