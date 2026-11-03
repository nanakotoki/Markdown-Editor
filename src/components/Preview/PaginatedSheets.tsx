import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * ============================================================================
 *  PaginatedSheets.tsx —— A4 分页纸面（阅读模式 / PDF 预览）
 * ----------------------------------------------------------------------------
 *  思路：先把整篇 HTML 渲染到一个不可见的「量尺」容器里（宽度 = A4 版心），
 *  逐个量出顶层块的位置，再按「块不能跨页」的规则切成若干页，最后把每页
 *  单独渲染成一张纸。手动分页符（\newpage）直接断页。
 *
 *  这样屏幕上看到的分页位置就是打印/导出 PDF 后的分页位置，
 *  写笔记时不用猜「这一段会不会被切断」。
 * ============================================================================
 */

/** A4 版心：210mm - 18mm×2 = 174mm ≈ 658px；297mm - 20mm×2 = 257mm ≈ 971px */
export const SHEET = { width: 794, height: 1123, padX: 68, padY: 76 }
const CONTENT_H = SHEET.height - SHEET.padY * 2
/** 留一点余量，避免最后一行贴着页脚 */
const SAFE_H = CONTENT_H - 18

export interface PaginatedSheetsProps {
  html: string
  /** 影响排版的外在因素（字号/行距/字体/容器样式），变了就重新分页 */
  signature?: string
  /** 页数变化时通知外层（工具栏显示「第 x / y 页」） */
  onPages?: (n: number) => void
  /** 是否给每页加页码 */
  pageNumbers?: boolean
}

export default function PaginatedSheets({ html, signature, onPages, pageNumbers = true }: PaginatedSheetsProps) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][] | null>(null)

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

    const out: string[][] = []
    let cur: string[] = []
    let pageTop = kids[0].offsetTop

    const flush = () => {
      out.push(cur)
      cur = []
    }

    for (let i = 0; i < kids.length; i++) {
      const el = kids[i]
      if (el.hasAttribute('data-mf-pagebreak')) {
        flush()
        pageTop = el.offsetTop
        continue
      }
      const top = el.offsetTop
      const bottom = top + el.offsetHeight
      const isHeading = /^H[1-6]$/.test(el.tagName)
      const next = kids[i + 1]
      const nextBottom = next && !next.hasAttribute('data-mf-pagebreak') ? next.offsetTop + next.offsetHeight : bottom

      // 放不下就换页；标题还要看下一段——避免标题孤零零留在页尾
      const overflow = bottom - pageTop > SAFE_H
      const orphanHeading = isHeading && nextBottom - pageTop > SAFE_H && cur.length > 0
      if ((overflow || orphanHeading) && cur.length > 0) {
        flush()
        pageTop = top
      }
      cur.push(el.outerHTML)
    }
    flush()
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

  return (
    <>
      {/* 量尺：不参与视觉，但必须真实存在于文档里才能拿到尺寸 */}
      <div ref={measureRef} className="mf-sheet-measure" aria-hidden="true">
        <div className="mf-academic" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      {(pages ?? [[]]).map((blocks, i) => (
        <section className="mf-sheet" key={i} data-sheet={i + 1}>
          <div className="mf-academic" dangerouslySetInnerHTML={{ __html: blocks.join('\n') }} />
          {pageNumbers && (
            <div className="mf-sheet-no">
              {i + 1} / {(pages ?? [[]]).length}
            </div>
          )}
        </section>
      ))}
    </>
  )
}
