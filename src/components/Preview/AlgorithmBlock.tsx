import { useMemo } from 'react'
import { renderMathSafely, type MacroMap, escapeHtml } from '../../core/katexSafeRender'

/**
 * ============================================================================
 *  AlgorithmBlock.tsx —— 教科书级（algorithm2e / algpseudocode 风格）伪代码块
 * ----------------------------------------------------------------------------
 *  语法：```algorithm 代码块
 *    \caption{快速排序}        <- 算法标题
 *    输入: ... / Input: ...    <- 输入声明
 *    输出: ... / Output: ...   <- 输出声明
 *    Function Foo(a, b)        <- 缩进即层级，关键字自动加粗
 *      If a < b
 *        Return $a+b$          <- 行内公式照常渲染
 *      EndIf
 *    EndFunction
 * ============================================================================
 */

export interface AlgorithmLine {
  kind: 'caption' | 'input' | 'output' | 'code'
  depth: number
  keyword?: string
  content: string
  /** 代码行序号（caption/io 不占号） */
  lineNo?: number
  closing?: boolean
}

export interface ParsedAlgorithm {
  caption?: string
  input?: string
  output?: string
  lines: AlgorithmLine[]
}

const KEYWORDS = [
  'Function', 'Procedure', 'Algorithm', 'Method',
  'If', 'Then', 'ElseIf', 'Else', 'EndIf', 'End If',
  'For', 'To', 'Downto', 'Do', 'EndFor', 'End For',
  'While', 'EndWhile', 'End While', 'Repeat', 'Until',
  'Return', 'Break', 'Continue', 'Output', 'Input',
  'EndFunction', 'End Function', 'EndProcedure',
]

const CLOSERS = new Set([
  'EndIf', 'End If', 'Else', 'ElseIf', 'EndFor', 'End For', 'EndWhile',
  'End While', 'EndFunction', 'End Function', 'EndProcedure', 'Until',
])

export function parseAlgorithm(source: string): ParsedAlgorithm {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n')
  const parsed: ParsedAlgorithm = { lines: [] }

  const body: string[] = []
  for (const line of rawLines) {
    const cap = /^\s*\\caption\s*\{([\s\S]*)\}\s*$/.exec(line)
    if (cap && !parsed.caption) {
      parsed.caption = cap[1].trim()
      continue
    }
    body.push(line)
  }

  // 计算缩进单位：所有非零缩进的最小值
  let unit = 2
  const indents = body
    .filter((l) => l.trim())
    .map((l) => (/^[ \t]*/.exec(l)?.[0].length ?? 0))
    .filter((n) => n > 0)
  if (indents.length) unit = Math.max(1, Math.min(...indents))

  let lineNo = 0
  for (const line of body) {
    if (!line.trim()) {
      parsed.lines.push({ kind: 'code', depth: 0, content: '', })
      continue
    }
    const indent = /^[ \t]*/.exec(line)?.[0].length ?? 0
    const text = line.trim()

    const io = /^(输入|输入参数|Input|INPUT)\s*[:：]\s*(.*)$/.exec(text)
    if (io && !parsed.input) {
      parsed.input = io[2].trim()
      continue
    }
    const out = /^(输出|返回值|Output|OUTPUT)\s*[:：]\s*(.*)$/.exec(text)
    if (out && !parsed.output) {
      parsed.output = out[2].trim()
      continue
    }

    const firstWord = /^([A-Za-z][A-Za-z]*)(?:\s+[A-Za-z]+)?/.exec(text)
    let keyword: string | undefined
    if (firstWord) {
      const two = text.split(/\s+/).slice(0, 2).join(' ')
      if (KEYWORDS.includes(two)) keyword = two
      else if (KEYWORDS.includes(firstWord[1])) keyword = firstWord[1]
    }

    let depth = Math.round(indent / unit)
    const closing = keyword ? CLOSERS.has(keyword) : false
    if (closing) depth = Math.max(0, depth - 1)

    lineNo++
    parsed.lines.push({
      kind: 'code',
      depth,
      keyword,
      content: text,
      lineNo: closing || keyword === 'Return' ? lineNo : lineNo,
      closing,
    })
  }
  // 去掉末尾空行
  while (parsed.lines.length && !parsed.lines[parsed.lines.length - 1].content) parsed.lines.pop()
  return parsed
}

/** 行内 $...$ 渲染 */
export function renderInlineMathInText(text: string, macros: MacroMap): string {
  let out = ''
  const re = /\$([^\n$]+?)\$/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    out += highlightPlain(text.slice(last, m.index), macros)
    const r = renderMathSafely(m[1], false, macros)
    out += `<span class="mf-algo-math">${r.html}</span>`
    last = m.index + m[0].length
  }
  out += highlightPlain(text.slice(last), macros)
  return out
}

/** 普通文本：粗体关键字、代码片段，其余转义 */
function highlightPlain(text: string, _macros: MacroMap): string {
  if (!text) return ''
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code class="mf-algo-code">$1</code>')
  // 数学符号美化（算法描述里常见的 <= 之类保持原样，仅加粗关键字）
  html = html.replace(
    /\b(Function|Procedure|If|Then|ElseIf|Else|EndIf|End If|For|To|Downto|Do|EndFor|End For|While|EndWhile|End While|Repeat|Until|Return|Break|Continue|EndFunction|End Function|EndProcedure|Input|Output)\b/g,
    '<span class="mf-algo-kw">$1</span>'
  )
  html = html.replace(/\b(and|or|not|xor)\b/g, '<span class="mf-algo-kw2">$1</span>')
  return html
}

export interface AlgorithmRenderOptions {
  macros?: MacroMap
  /** 算法编号，如 1 -> Algorithm 1 */
  number?: number
  /** 来自 info string 的标题（```algorithm [快速排序]），优先于源码里的 \caption */
  title?: string
  /** DOM 锚点，供 @alg:xxx 交叉引用跳转 */
  id?: string
  className?: string
}

export function renderAlgorithmHtml(source: string, opts: AlgorithmRenderOptions = {}): string {
  const macros = opts.macros ?? {}
  const algo = parseAlgorithm(source)
  const rows: string[] = []

  const span = computeMaxSpan(algo)

  for (const line of algo.lines) {
    if (!line.content) {
      rows.push(`<tr class="mf-algo-blank"><td class="mf-algo-ln"></td><td colspan="2"></td></tr>`)
      continue
    }
    const guides = Array.from({ length: line.depth })
      .map(() => `<span class="mf-algo-guide"></span>`)
      .join('')
    rows.push(
      `<tr class="${line.closing ? 'mf-algo-row-closing' : ''}">` +
        `<td class="mf-algo-ln">${line.lineNo ?? ''}</td>` +
        `<td class="mf-algo-indent">${guides}</td>` +
        `<td class="mf-algo-stmt">${renderInlineMathInText(line.content, macros)}</td>` +
        `</tr>`
    )
  }

  const captionText = algo.caption ?? opts.title
  const captionRow = captionText
    ? `<div class="mf-algo-caption"><span class="mf-algo-caption-label">${opts.number != null ? `算法 ${opts.number}` : 'Algorithm'}</span><span class="mf-algo-caption-text">${renderInlineMathInText(captionText, macros)}</span></div>`
    : opts.number != null
      ? `<div class="mf-algo-caption"><span class="mf-algo-caption-label">算法 ${opts.number}</span></div>`
      : ''

  const ioRows = [
    algo.input ? `<div class="mf-algo-io"><span class="mf-algo-io-label">输入</span><span>${renderInlineMathInText(algo.input, macros)}</span></div>` : '',
    algo.output ? `<div class="mf-algo-io"><span class="mf-algo-io-label">输出</span><span>${renderInlineMathInText(algo.output, macros)}</span></div>` : '',
  ].join('')

  return `<div class="mf-algo ${opts.className ?? ''}" data-span="${span}"${opts.id ? ` id="${opts.id}"` : ''}>
  <div class="mf-algo-frame">
    ${captionRow}
    <div class="mf-algo-inner">
      ${ioRows ? `<div class="mf-algo-io-block">${ioRows}</div><div class="mf-algo-rule"></div>` : ''}
      <table class="mf-algo-table"><tbody>${rows.join('')}</tbody></table>
    </div>
    <div class="mf-algo-bottom"></div>
  </div>
</div>`
}

function computeMaxSpan(algo: ParsedAlgorithm): number {
  return algo.lines.reduce((m, l) => Math.max(m, l.depth), 0)
}

/** React 包装组件（用于构造器/导出预览中直接渲染） */
export function AlgorithmBlock({ source, macros, number }: { source: string; macros?: MacroMap; number?: number }) {
  const html = useMemo(() => renderAlgorithmHtml(source, { macros, number }), [source, macros, number])
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export default AlgorithmBlock
