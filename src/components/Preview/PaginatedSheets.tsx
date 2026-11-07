import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { paginateElements, readMetrics, type PageUnit } from '../../core/pagination'
import type { Settings } from '../../store/useEditorStore'

export { SHEET } from '../../core/pagination'

/**
 * ============================================================================
 *  PaginatedSheets.tsx —— A4 分页纸面（阅读模式 / PDF 预览）
 * ----------------------------------------------------------------------------
 *  思路：先把整篇 HTML 渲染到一个不可见的「量尺」容器里（宽度 = A4 版心），
 *  逐个量出顶层块的位置，再按「块不能跨页」的规则切成若干页，最后把每页
 *  单独渲染成一张纸。手动分页符（\newpage）直接断页。
 *
 *  证明/解答这类长块允许在段落之间拆开（见 pagination.ts 的 data-mf-splittable），
 *  拆开时把容器克隆成几段，只在首段保留「证」字、末段保留 ∎。
 *
 *  切页规则放在 core/pagination.ts，编辑器里的自动分页提示用的是同一套，
 *  两边必须算出同样的页数，否则「屏幕上第 2 页」和「PDF 第 2 页」会对不上。
 * ============================================================================
 */

export interface PaginatedSheetsProps {
  html: string
  /** 影响排版的外在因素（字号/行距/字体/页边距），变了就重新分页 */
  signature?: string
  /** 页数变化时通知外层（工具栏显示「第 x / y 页」） */
  onPages?: (n: number) => void
  /** 是否给每页加页码 */
  pageNumbers?: boolean
  /** 页眉 / 页脚 / 页码样式 */
  settings?: Settings
  /** 文档标题，供页眉占位符 {title} 使用 */
  docTitle?: string
}

/** 把一页里的单元拼回 HTML；同一可拆容器的连续片段合并成一段 */
function pageHtml(units: PageUnit[]): string {
  const out: string[] = []
  let i = 0
  while (i < units.length) {
    const u = units[i]
    if (u.child < 0) {
      out.push(u.el.outerHTML)
      i++
      continue
    }
    const el = u.el
    let from = u.child
    let to = u.child
    i++
    while (i < units.length && units[i].el === el && units[i].child >= 0) {
      to = units[i].child
      i++
    }
    out.push(fragmentHtml(el, from, to))
  }
  return out.join('\n')
}

/** 克隆可拆容器，只保留 [from, to] 这几段正文 */
function fragmentHtml(el: HTMLElement, from: number, to: number): string {
  const clone = el.cloneNode(true) as HTMLElement
  const flow = clone.querySelector('[data-mf-flow]') as HTMLElement | null
  if (!flow) return clone.outerHTML
  const kids = Array.from(flow.children) as HTMLElement[]
  const last = kids.length - 1
  kids.forEach((c, idx) => {
    if (idx < from || idx > to) c.remove()
  })
  // 「证」「解」这类开头标记只跟首段，证毕符号只跟末段
  if (from > 0) clone.querySelectorAll('[data-mf-only-first]').forEach((n) => n.remove())
  if (to < last) clone.querySelectorAll('[data-mf-only-last]').forEach((n) => n.remove())
  clone.classList.add('mf-frag')
  if (from === 0) clone.classList.add('mf-frag-start')
  if (to >= last) clone.classList.add('mf-frag-end')
  return clone.outerHTML
}

/** 页眉页脚占位符：{page} {total} {title} */
function expand(text: string, page: number, total: number, title: string): string {
  return text
    .replace(/\{page\}/g, String(page))
    .replace(/\{total\}/g, String(total))
    .replace(/\{title\}/g, title || '')
}

function pageNoText(style: Settings['pageNumber'], page: number, total: number): string {
  if (style === 'none') return ''
  if (style === 'dash') return `— ${page} —`
  if (style === 'slash') return `${page} / ${total}`
  return String(page)
}

export default function PaginatedSheets({
  html,
  signature,
  onPages,
  pageNumbers = true,
  settings,
  docTitle = '',
}: PaginatedSheetsProps) {
  const measureRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PageUnit[][] | null>(null)

  const paginate = () => {
    const host = measureRef.current
    if (!host) return
    const root = host.querySelector('.mf-academic') as HTMLElement | null
    if (!root) return
    const kids = Array.from(root.children) as HTMLElement[]
    if (!kids.length) {
      setPages([[]])
      onPages?.(1)
      return
    }
    // 量尺宽度就是版心宽度，页边距改了要跟着变
    host.style.width = `${readMetrics().contentW}px`
    const out = paginateElements(kids)
    setPages(out)
    onPages?.(out.length)
  }

  // 内容/字体变化后重新量；等布局稳定再量一次，避免首帧字体还没生效
  useLayoutEffect(() => {
    paginate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, signature])

  useEffect(() => {
    const t = window.setTimeout(paginate, 220)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, signature])

  /** 目录页码：先知道每个锚点落在第几张纸，再回填到目录行里 */
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !pages) return
    const pageOf = new Map<string, number>()
    wrap.querySelectorAll<HTMLElement>('.mf-sheet').forEach((sheet, idx) => {
      sheet.querySelectorAll<HTMLElement>('[id]').forEach((el) => {
        if (el.id && !pageOf.has(el.id)) pageOf.set(el.id, idx + 1)
      })
    })
    wrap.querySelectorAll<HTMLElement>('.mf-toc-page').forEach((el) => {
      const anchor = el.getAttribute('data-mf-toc-anchor') ?? ''
      const n = pageOf.get(anchor)
      el.textContent = n ? String(n) : ''
    })
  }, [pages, signature])

  const total = pages?.length ?? 1
  const head = settings?.pageHeader ?? ''
  const foot = settings?.pageFooter ?? ''
  const numStyle = settings?.pageNumber ?? (pageNumbers ? 'plain' : 'none')

  return (
    <div ref={wrapRef} className="mf-sheets">
      {(pages ?? [[]]).map((units, i) => (
        <section className="mf-sheet" key={i} data-sheet={i + 1}>
          {head ? (
            <div className="mf-page-head">
              <span>{expand(head, i + 1, total, docTitle)}</span>
            </div>
          ) : null}
          <div className="mf-academic" dangerouslySetInnerHTML={{ __html: pageHtml(units) }} />
          {foot || pageNoText(numStyle, i + 1, total) ? (
            <div className="mf-page-foot">
              <span className="mf-page-foot-text">{expand(foot, i + 1, total, docTitle)}</span>
              <span className="mf-page-no">{pageNoText(numStyle, i + 1, total)}</span>
            </div>
          ) : null}
        </section>
      ))}

      {/* 量尺放在最后：不参与视觉，但必须真实存在于文档里才能拿到尺寸。
          放末尾是为了让页面上「真正显示」的那一份排在前面，
          锚点跳转（#eq-xxx）才不会落到这份隐藏的副本上。 */}
      <div ref={measureRef} className="mf-sheet-measure" aria-hidden="true">
        <div className="mf-academic" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}
