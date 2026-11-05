import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SHEET, paginateBlocks } from '../../core/pagination'

export { SHEET }

/**
 * ============================================================================
 *  PaginatedSheets.tsx —— A4 分页纸面（阅读模式 / PDF 预览）
 * ----------------------------------------------------------------------------
 *  思路：先把整篇 HTML 渲染到一个不可见的「量尺」容器里（宽度 = A4 版心），
 *  逐个量出顶层块的位置，再按「块不能跨页」的规则切成若干页，最后把每页
 *  单独渲染成一张纸。手动分页符（\newpage）直接断页。
 *
 *  切页规则放在 core/pagination.ts，编辑器里的自动分页提示用的是同一套，
 *  两边必须算出同样的页数，否则「屏幕上第 2 页」和「PDF 第 2 页」会对不上。
 * ============================================================================
 */

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

    const out = paginateBlocks(kids).map((idxs) => idxs.map((i) => kids[i].outerHTML))
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

      {/* 量尺放在最后：不参与视觉，但必须真实存在于文档里才能拿到尺寸。
          放末尾是为了让页面上「真正显示」的那一份排在前面，
          锚点跳转（#eq-xxx）才不会落到这份隐藏的副本上。 */}
      <div ref={measureRef} className="mf-sheet-measure" aria-hidden="true">
        <div className="mf-academic" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </>
  )
}
