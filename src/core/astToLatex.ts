import { parseMarkdown, parseBlockMeta } from './renderMarkdown'
import { parseAlgorithm } from '../components/Preview/AlgorithmBlock'
import { escapeHtml, healLatex } from './katexSafeRender'
import type { BibEntry } from '../store/useEditorStore'

/**
 * ============================================================================
 *  astToLatex.ts —— Markdown(AST) -> 可直接编译的纯 LaTeX 源码
 * ----------------------------------------------------------------------------
 *  模板：ctexart（中文作业/实验报告） / article（英文论文） / IEEEtran（双栏会议）
 *  规则：标题->section，表格->booktabs 三线表，::: theorem->\begin{theorem}，
 *        ```algorithm->algorithm + algorithmic，宏与文献自动注入导言区/文末
 * ============================================================================
 */

export type TexTemplate = 'ctexart' | 'ctexbook' | 'article' | 'IEEEtran'

export interface TexExportOptions {
  title?: string
  author?: string
  template?: TexTemplate
  macrosPreamble?: string
  bib?: BibEntry[]
  /** 只产出文档体（不含导言区与 document 环境），供 main.tex 用 \input 合并 */
  bodyOnly?: boolean
  /** 顶层标题映射：合并成书时用 chapter，单篇论文用 section */
  headingBase?: 'section' | 'chapter'
  /** 标题自动标签（sec-1、sec-2…）的前缀，合并成书时用来跨章去重 */
  labelPrefix?: string
}

const THM_ENV: Record<string, string> = {
  theorem: 'theorem',
  lemma: 'lemma',
  definition: 'definition',
  proposition: 'proposition',
  corollary: 'corollary',
  example: 'example',
  remark: 'remark',
  proof: 'proof',
  algorithm: 'algorithm',
  exercise: 'exercise',
  solution: 'solution',
}

export function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

interface Ctx {
  template: TexTemplate
  zh: boolean
  headingIds: string[]
  headingCounter: number
  headingBase: 'section' | 'chapter'
  /** 标题自动标签的前缀：合并成书时按章区分，避免 \label{sec-1} 重名 */
  labelPrefix: string
  bibUsed: string[]
  bib: BibEntry[]
  /** 脚注定义：identifier -> 定义节点（\footnote 需要立刻拿到内容） */
  fnDefs: Map<string, any>
}

const REF_RE = /@(eq|thm|lem|def|prop|cor|exa|prf|alg|sec|fig|tab):([A-Za-z0-9_\-:.]+)/g
const CITE_RE = /\[@([A-Za-z0-9_\-:.]+(?:\s*[;,]\s*@?[A-Za-z0-9_\-:.]+)*)\]/g

const PREFIX_TEX: Record<string, string> = {
  eq: 'eq', thm: 'thm', lem: 'lem', def: 'def', prop: 'prop', cor: 'cor',
  exa: 'exa', prf: 'prf', alg: 'alg', sec: 'sec', fig: 'fig', tab: 'tab',
}

function refLatex(kind: string, id: string, ctx: Ctx): string {
  const prefix = PREFIX_TEX[kind] ?? kind
  const label = `${prefix}:${id.replace(new RegExp(`^${prefix}:`), '')}`
  if (kind === 'eq') return `${ctx.zh ? '式' : 'Eq.'}~\\eqref{${label}}`
  const cn: Record<string, string> = {
    thm: '定理', lem: '引理', def: '定义', prop: '命题', cor: '推论',
    exa: '例题', alg: '算法', sec: '第', fig: '图', tab: '表',
  }
  const en: Record<string, string> = {
    thm: 'Theorem', lem: 'Lemma', def: 'Definition', prop: 'Proposition',
    cor: 'Corollary', exa: 'Example', alg: 'Algorithm', sec: 'Section', fig: 'Figure', tab: 'Table',
  }
  const name = ctx.zh ? cn[kind] ?? '' : en[kind] ?? ''
  return `${name}~\\ref{${label}}`
}

function inlineTextToLatex(text: string, ctx: Ctx): string {
  let out = ''
  let last = 0
  const combined = new RegExp(`${CITE_RE.source}|${REF_RE.source}`, 'g')
  let m: RegExpExecArray | null
  while ((m = combined.exec(text))) {
    out += escapeLatex(text.slice(last, m.index))
    if (m[1] !== undefined) {
      const keys = m[1].split(/[;,]/).map((k) => k.trim().replace(/^@/, '')).filter(Boolean)
      out += `\\cite{${keys.join(',')}}`
    } else if (m[2] !== undefined) {
      out += refLatex(m[2], m[3], ctx)
    }
    last = m.index + m[0].length
  }
  out += escapeLatex(text.slice(last))
  return out
}

/**
 * 去掉标题里手写的序号（`1. 引言` / `2.1 泰勒展开` / `一、绪论`）。
 * LaTeX 会自己编号，保留手写序号会出现「1 1. 引言」这种双编号。
 */
function stripManualNumber(title: string): string {
  const cleaned = title
    .replace(/^\s*\d+(?:[.．]\d+)*\s*[.．、]?\s+/, '')
    .replace(/^\s*[一二三四五六七八九十百]+\s*[、.．]\s*/, '')
    .trim()
  return cleaned || title
}

function inlineToLatex(nodes: any[], ctx: Ctx): string {  return (nodes ?? [])
    .map((n: any) => {
      switch (n.type) {
        case 'text':
          return inlineTextToLatex(n.value ?? '', ctx)
        case 'inlineMath':
          return `$${healLatex(n.value ?? '').latex}$`
        case 'strong':
          return `\\textbf{${inlineToLatex(n.children, ctx)}}`
        case 'emphasis':
          return `\\emph{${inlineToLatex(n.children, ctx)}}`
        case 'delete':
          return inlineToLatex(n.children, ctx)
        case 'inlineCode':
          return `\\texttt{${escapeLatex(n.value ?? '')}}`
        case 'link':
          return `\\href{${escapeLatex(n.url ?? '')}}{${inlineToLatex(n.children, ctx)}}`
        case 'image':
          // 独立插图由 ::: figure / 单独成段处理；这里只可能是行内图，给个可编译的占位
          return `\\includegraphics[width=.6\\linewidth]{${escapeLatex(n.url ?? '')}}`
        case 'footnoteReference': {
          const def = ctx.fnDefs.get(String(n.identifier ?? n.label ?? ''))
          const inner = def ? blocksToLatex(def.children ?? [], ctx) : ''
          return `\\footnote{${inner}}`
        }
        case 'break':
          return '\\\\\n'
        case 'html':
          return ''
        default:
          if (n.children) return inlineToLatex(n.children, ctx)
          return escapeLatex(n.value ?? '')
      }
    })
    .join('')
}

function blocksToLatex(nodes: any[], ctx: Ctx, indent = ''): string {
  return (nodes ?? [])
    .map((n: any) => blockToLatex(n, ctx, indent))
    .filter((s: string) => s.trim().length > 0)
    .join('\n\n')
}

function blockToLatex(node: any, ctx: Ctx, indent = ''): string {
  switch (node.type) {
    case 'heading': {
      ctx.headingCounter++
      ctx.headingIds.push(`sec-${ctx.headingCounter}`)
      const title = stripManualNumber(inlineToLatex(node.children, ctx))
      const label = `\\label{${ctx.labelPrefix}${ctx.headingCounter}}`
      // 统一按「1=章 / 2=节」编号：section 基准从 2 起，chapter 基准从 1 起
      const level = ctx.headingBase === 'chapter' ? node.depth : node.depth + 1
      switch (level) {
        case 1:
          return `\\chapter{${title}}\n${label}`
        case 2:
          return `\\section{${title}}\n${label}`
        case 3:
          return `\\subsection{${title}}\n${label}`
        case 4:
          return `\\subsubsection{${title}}\n${label}`
        case 5:
          return `\\paragraph{${title}}\n${label}`
        default:
          return `\\subparagraph{${title}}\n${label}`
      }
    }
    case 'paragraph': {
      // 手动分页：源码里单写一行的 \newpage 原样带到 .tex 里
      const plain = (node.children ?? []).map((c: any) => String(c.value ?? '')).join('').trim()
      if (/^\\(newpage|pagebreak|clearpage)$/i.test(plain)) return '\\newpage'
      return inlineToLatex(node.children, ctx)
    }
    case 'blockquote':
      return `\\begin{quote}\n${blocksToLatex(node.children, ctx)}\n\\end{quote}`
    case 'list': {
      const env = node.ordered ? 'enumerate' : 'itemize'
      const items = (node.children ?? [])
        .map((li: any) => {
          const inner = (li.children ?? [])
            .map((c: any) => (c.type === 'paragraph' ? inlineToLatex(c.children, ctx) : blockToLatex(c, ctx)))
            .join('\n')
          return `  \\item ${inner}`
        })
        .join('\n')
      return `\\begin{${env}}\n${items}\n\\end{${env}}`
    }
    case 'table':
      return tableToLatex(node, ctx)
    case 'code': {
      if (node.lang === 'algorithm' || node.lang === 'algpseudocode') {
        return algorithmToLatex(node.value ?? '', ctx, parseBlockMeta(node.meta ?? ''))
      }
      return `\\begin{lstlisting}[language=${node.lang ?? 'TeX'}]\n${node.value ?? ''}\n\\end{lstlisting}`
    }
    case 'thematicBreak':
      return '\\noindent\\rule{\\linewidth}{0.4pt}'
    case 'math': {
      // 与编辑器渲染保持一致：先自愈再落盘，避免把缺括号的公式原样写进 .tex
      const body = healLatex((node.value ?? '').trim()).latex
      const hasLabel = /\\label\s*\{[^{}]*\}/.test(body)
      if (hasLabel) return `\\begin{equation}\n${body}\n\\end{equation}`
      return `\\[\n${body}\n\\]`
    }
    case 'containerDirective':
      return containerToLatex(node, ctx)
    case 'html':
      return ''
    default:
      if (node.children) return blocksToLatex(node.children, ctx)
      return escapeLatex(node.value ?? '')
  }
}

/** 在子树里找第一张图片（:: figure 用） */
function firstImage(nodes: any[]): any | null {
  for (const n of nodes ?? []) {
    if (n.type === 'image') return n
    const hit = firstImage(n.children ?? [])
    if (hit) return hit
  }
  return null
}

/** 去掉包含图片的段落，避免插图在 figure 里又出现一次 */
function withoutImages(nodes: any[]): any[] {
  return (nodes ?? []).filter((n) => {
    if (n.type === 'image') return false
    if (n.type === 'paragraph' && (n.children ?? []).every((c: any) => c.type === 'image' || (c.type === 'text' && !String(c.value ?? '').trim()))) {
      return false
    }
    return true
  })
}

function containerToLatex(node: any, ctx: Ctx): string {
  if (node.name === 'pagebreak' || node.name === 'newpage' || node.name === 'clearpage') return '\\newpage'
  if (node.name === 'toc' || node.name === 'contents' || node.name === 'tableofcontents') return '\\tableofcontents'
  const env = THM_ENV[node.name]
  const id: string | undefined = node.attributes?.id
  const children = [...(node.children ?? [])]
  let title = ''
  if (children[0]?.data?.directiveLabel) {
    title = inlineToLatex(children[0].children ?? [], ctx)
    children.shift()
  }

  // 插图：\\begin{figure} + \\includegraphics + \\caption
  if (node.name === 'figure') {
    const img = firstImage(children)
    const body = blocksToLatex(withoutImages(children), ctx)
    const lines = ['\\begin{figure}[htbp]', '  \\centering']
    if (img) lines.push(`  \\includegraphics[width=.82\\linewidth]{${escapeLatex(img.url ?? '')}}`)
    if (title) lines.push(`  \\caption{${title}}`)
    if (id) lines.push(`  \\label{${id}}`)
    if (body.trim()) lines.push(body)
    lines.push('\\end{figure}')
    return lines.join('\n')
  }

  // 表格：把题注塞进 table 环境
  if (node.name === 'table') {
    const tableNode = (children ?? []).find((c: any) => c.type === 'table')
    const rest = (children ?? []).filter((c: any) => c !== tableNode)
    const inner = tableNode ? tableToLatex(tableNode, ctx) : blocksToLatex(rest, ctx)
    const extra = [
      title ? `  \\caption{${title}}` : '',
      id ? `  \\label{${id}}` : '',
    ].filter(Boolean)
    if (extra.length) {
      // tableToLatex 已经生成了完整的 table 环境，这里把题注插在 \centering 之后
      return inner.replace('  \\centering', ['  \\centering', ...extra].join('\n'))
    }
    return inner
  }

  const body = blocksToLatex(children, ctx)
  if (!env) {
    return `\\begin{quote}\n${title ? `\\textbf{${title}}\\\\\n` : ''}${body}\n\\end{quote}`
  }
  const opt = title && env !== 'proof' && env !== 'solution' ? `[${title}]` : ''
  const label = id ? `\\label{${id}}\n` : ''
  return `\\begin{${env}}${opt}\n${label}${body}\n\\end{${env}}`
}

function tableToLatex(node: any, ctx: Ctx): string {
  const rows = node.children ?? []
  const colCount = rows[0]?.children?.length ?? 1
  const aligns = (node.align ?? []) as Array<string | null>
  const spec = Array.from({ length: colCount })
    .map((_, i) => (aligns[i] === 'center' ? 'c' : aligns[i] === 'right' ? 'r' : 'l'))
    .join('')
  const cell = (c: any) => inlineToLatex(c.children ?? [], ctx)
  const head = rows[0] ? rows[0].children.map(cell).join(' & ') + ' \\\\' : ''
  const body = rows
    .slice(1)
    .map((r: any) => '  ' + r.children.map(cell).join(' & ') + ' \\\\')
    .join('\n')
  return [
    '\\begin{table}[htbp]',
    '  \\centering',
    `  \\begin{tabular}{${spec}}`,
    '    \\toprule',
    `    ${head}`,
    '    \\midrule',
    body,
    '    \\bottomrule',
    '  \\end{tabular}',
    '\\end{table}',
  ].join('\n')
}

function algorithmToLatex(source: string, ctx: Ctx, info: { title?: string; id?: string } = {}): string {
  const algo = parseAlgorithm(source)
  const lines: string[] = []
  const text = (s: string) => s.trim()

  for (const line of algo.lines) {
    if (!line.content) continue
    const kw = line.keyword
    const rest = kw ? line.content.slice(kw.length).trim() : line.content.trim()
    const body = convertInlineMath(rest)
    switch (kw) {
      case 'If':
        lines.push(`  \\If{${body}}`)
        break
      case 'ElseIf':
        lines.push(`  \\ElsIf{${body}}`)
        break
      case 'Else':
        lines.push('  \\Else')
        break
      case 'EndIf':
        lines.push('  \\EndIf')
        break
      case 'For':
        lines.push(`  \\For{${body.replace(/^=\s*/, '')}}`)
        break
      case 'EndFor':
        lines.push('  \\EndFor')
        break
      case 'While':
        lines.push(`  \\While{${body}}`)
        break
      case 'EndWhile':
        lines.push('  \\EndWhile')
        break
      case 'Return':
        lines.push(`  \\State \\Return ${body}`)
        break
      case 'Function':
      case 'Procedure':
        lines.push(`  \\State \\textbf{${kw} ${body.replace(/[()]/g, (m) => (m === '(' ? '(' : ')'))}}`)
        break
      case 'EndFunction':
      case 'EndProcedure':
        lines.push('  \\State \\textbf{End ' + kw.replace('End', '') + '}')
        break
      default:
        lines.push(`  \\State ${body}`)
    }
  }

  const captionSource = algo.caption ?? info.title
  const caption = captionSource ? convertInlineMath(captionSource) : ctx.zh ? '算法' : 'Algorithm'
  const label = info.id ? `  \\label{${info.id}}\n` : ''
  const req = algo.input ? `  \\Require ${convertInlineMath(algo.input)}\n` : ''
  const ens = algo.output ? `  \\Ensure ${convertInlineMath(algo.output)}\n` : ''
  return [
    '\\begin{algorithm}[htbp]',
    '  \\caption{' + caption + '}',
    label.replace(/\n$/, ''),
    '  \\begin{algorithmic}[1]',
    (req + ens + lines.join('\n')).replace(/\n$/, ''),
    '  \\end{algorithmic}',
    '\\end{algorithm}',
  ]
    .filter((s) => s !== '')
    .join('\n')
}

/** 算法/表格里的文字：保留 $...$ 数学，其余转义 */
function convertInlineMath(s: string): string {
  let out = ''
  let last = 0
  const re = /\$([^\n$]+?)\$/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    out += escapeLatex(s.slice(last, m.index))
    out += `$${m[1]}$`
    last = m.index + m[0].length
  }
  out += escapeLatex(s.slice(last))
  return out
}

/* ------------------------------------------------------------------ *
 *  模板
 * ------------------------------------------------------------------ */

function preamble(template: TexTemplate, opts: TexExportOptions, usedBib: string[]): string {
  const macros = opts.macrosPreamble?.trim() ? `\n% ---------- 自定义宏 ----------\n${opts.macrosPreamble.trim()}\n` : ''
  if (template === 'ctexart' || template === 'ctexbook') {
    const book = template === 'ctexbook'
    const theoremCounter = book ? 'chapter' : 'section'
    return `\\documentclass[12pt,a4paper${book ? ',openany' : ''}]{${book ? 'ctexbook' : 'ctexart'}}
% ===== 生成自 MathFlow =====
\\usepackage{amsmath,amssymb,amsthm,bm,mathtools}
\\usepackage{booktabs}
\\usepackage{graphicx}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage{geometry}
\\geometry{margin=2.5cm}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true,linkcolor=black,citecolor=black,urlcolor=blue}
\\usepackage{listings}
\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,frame=single}

\\newtheorem{theorem}{定理}[${theoremCounter}]
\\newtheorem{lemma}[theorem]{引理}
\\newtheorem{definition}[theorem]{定义}
\\newtheorem{proposition}[theorem]{命题}
\\newtheorem{corollary}[theorem]{推论}
\\theoremstyle{definition}
\\newtheorem{example}[theorem]{例题}
\\newtheorem{remark}[theorem]{注}
\\newtheorem{exercise}[theorem]{习题}
% 解答不编号，跟着上面的习题走
\\newenvironment{solution}{\\par\\noindent\\textbf{解}\\quad}{\\par}

\\title{${escapeLatex(opts.title ?? 'MathFlow 文档')}}
\\author{${escapeLatex(opts.author ?? '')}}
\\date{\\today}
${macros}`
  }
  if (template === 'IEEEtran') {
    return `\\documentclass[conference]{IEEEtran}
% ===== 生成自 MathFlow =====
\\usepackage{amsmath,amssymb,amsthm,bm,mathtools}
\\usepackage{booktabs}
\\usepackage{graphicx}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage{hyperref}
\\usepackage{listings}
\\lstset{basicstyle=\\ttfamily\\footnotesize,breaklines=true}

\\newtheorem{theorem}{Theorem}
\\newtheorem{lemma}{Lemma}
\\newtheorem{definition}{Definition}
\\newtheorem{proposition}{Proposition}
\\newtheorem{corollary}{Corollary}
\\newtheorem{example}{Example}
\\newtheorem{remark}{Remark}
\\newtheorem{exercise}{Exercise}
\\newenvironment{solution}{\\par\\noindent\\textbf{Solution.}\\quad}{\\par}

\\title{${escapeLatex(opts.title ?? 'MathFlow Document')}}
\\author{\\IEEEauthorblockN{${escapeLatex(opts.author ?? '')}}}
${macros}`
  }
  return `\\documentclass[11pt]{article}
% ===== 生成自 MathFlow =====
% 注意：article 模板为英文排版；若正文含中文，请改用 ctexart 模板。
\\usepackage{amsmath,amssymb,amsthm,bm,mathtools}
\\usepackage{booktabs}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{listings}
\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,frame=single}

\\newtheorem{theorem}{Theorem}
\\newtheorem{lemma}{Lemma}
\\newtheorem{definition}{Definition}
\\newtheorem{proposition}{Proposition}
\\newtheorem{corollary}{Corollary}
\\newtheorem{example}{Example}
\\newtheorem{remark}{Remark}
\\newtheorem{exercise}{Exercise}
\\newenvironment{solution}{\\par\\noindent\\textbf{Solution.}\\quad}{\\par}

\\title{${escapeLatex(opts.title ?? 'MathFlow Document')}}
\\author{${escapeLatex(opts.author ?? '')}}
\\date{\\today}
${macros}`
}

function bibToLatex(keys: string[], bib: BibEntry[]): string {
  if (!keys.length) return ''
  const items = keys.map((key) => {
    const e = bib.find((b) => b.key === key)
    if (!e) return `\\bibitem{${key}} [未找到条目 ${escapeLatex(key)}]`
    const src = e.journal ? ` ${escapeLatex(e.journal)},` : ''
    return `\\bibitem{${key}}\n${escapeLatex(e.author)}. \\emph{${escapeLatex(e.title)}}.${src} ${escapeLatex(e.year)}.`
  })
  return `\n\\begin{thebibliography}{99}\n${items.join('\n\n')}\n\\end{thebibliography}\n`
}

export interface TexCompileResult {
  tex: string
  bibUsed: string[]
  stats: { sections: number; equations: number; theorems: number; algorithms: number; tables: number }
}

export type TexStats = TexCompileResult['stats']

/** 一份文档的正文编译（bodyOnly 时复用） */
function compileBody(markdown: string, opts: TexExportOptions, template: TexTemplate) {
  const zh = template === 'ctexart' || template === 'ctexbook'
  const tree = parseMarkdown(markdown)
  // 脚注定义要提前收齐：\footnote{} 是在行内转换时就展开的
  const fnDefs = new Map<string, any>()
  const collectFn = (node: any) => {
    if (node.type === 'footnoteDefinition') fnDefs.set(String(node.identifier ?? node.label ?? ''), node)
    for (const c of node.children ?? []) collectFn(c)
  }
  collectFn(tree)

  const ctx: Ctx = {
    template,
    zh,
    headingIds: [],
    headingCounter: 0,
    headingBase: opts.headingBase ?? (template === 'ctexbook' ? 'chapter' : 'section'),
    labelPrefix: opts.labelPrefix ?? 'sec-',
    bibUsed: [],
    bib: opts.bib ?? [],
    fnDefs,
  }
  const body = blocksToLatex(tree.children, ctx)
  const stats: TexStats = {
    sections: ctx.headingCounter,
    equations: (markdown.match(/\\label\s*\{[^{}]*\}/g) || []).length,
    theorems: (markdown.match(/:::\s*(theorem|lemma|definition|proposition|corollary|example|remark|proof)/g) || []).length,
    algorithms: (markdown.match(/```algorithm/g) || []).length,
    tables: (markdown.match(/^\|.*\|$/gm) || []).length ? Math.max(1, countTables(markdown)) : 0,
  }
  // 收集正文里真正的 \cite
  const cited = Array.from(
    new Set((body.match(/\\cite\{([^}]+)\}/g) || []).flatMap((c) => c.replace(/\\cite\{|\}/g, '').split(',')))
  )
  return { body, cited, stats, zh }
}

export function compileToLatex(markdown: string, opts: TexExportOptions = {}): TexCompileResult {
  const template = opts.template ?? 'ctexart'
  const { body, cited, stats } = compileBody(markdown, opts, template)

  // 只要正文时，导言区由调用方（合并编译的 main.tex）统一负责
  if (opts.bodyOnly) return { tex: `${body}\n`, bibUsed: cited, stats }

  const bib = bibToLatex(cited, opts.bib ?? [])
  const tex = `${preamble(template, opts, cited)}
\\begin{document}
\\maketitle

${body}
${bib}\\end{document}
`
  return { tex, bibUsed: cited, stats }
}

/* ------------------------------------------------------------------ *
 *  合并编译：多篇 Markdown -> 一个 main.tex + 若干章节片段
 * ------------------------------------------------------------------ */

export interface BookChapter {
  /** 章节标题（用于注释与目录兜底），一般取正文第一个 H1 */
  title: string
  markdown: string
  /** 相对 main.tex 的 \input 路径，不带 .tex 后缀 */
  inputPath: string
  /** 原始 Markdown 相对路径，仅用于注释 */
  source?: string
}

export interface BookCompileResult {
  mainTex: string
  sections: Array<{ inputPath: string; source?: string; title: string; tex: string; stats: TexStats }>
  bibUsed: string[]
  stats: TexStats
}

/**
 * 把多篇文档合并成一本可编译的 LaTeX 工程：
 *   main.tex 负责导言区、标题页、目录与文献表，正文用 \input 逐个引入。
 * 这样跨文件的 @thm:/@eq: 引用才真正成立（\label 与 \ref 落在同一份文档里）。
 */
export function compileBook(chapters: BookChapter[], opts: TexExportOptions = {}): BookCompileResult {
  const template = opts.template ?? 'ctexart'
  const headingBase = opts.headingBase ?? (template === 'ctexbook' ? 'chapter' : 'section')

  const sections: BookCompileResult['sections'] = []
  const citedAll: string[] = []
  const total: TexStats = { sections: 0, equations: 0, theorems: 0, algorithms: 0, tables: 0 }

  for (const [i, ch] of chapters.entries()) {
    const r = compileBody(ch.markdown, { ...opts, headingBase, labelPrefix: `sec-${i + 1}-` }, template)
    sections.push({ inputPath: ch.inputPath, source: ch.source, title: ch.title, tex: r.body, stats: r.stats })
    for (const k of r.cited) if (!citedAll.includes(k)) citedAll.push(k)
    total.sections += r.stats.sections
    total.equations += r.stats.equations
    total.theorems += r.stats.theorems
    total.algorithms += r.stats.algorithms
    total.tables += r.stats.tables
  }

  const isBook = template === 'ctexbook'
  const sourceMap = chapters
    .map((ch, i) => `%   sections/${ch.inputPath.split('/').pop()}.tex  ←  ${ch.source ?? ch.title}`)
    .join('\n')
  const inputs = chapters.map((ch) => `\\input{${ch.inputPath}}`).join('\n')

  const front = isBook
    ? `\\frontmatter
\\maketitle
\\tableofcontents

\\mainmatter`
    : `\\maketitle
\\tableofcontents

\\newpage`

  const mainTex = `${preamble(template, opts, citedAll)}
% ---------------------------------------------------------------------------
% 合并编译入口（由 MathFlow 生成）
${sourceMap}
% 编译：xelatex main.tex 两遍（第一遍生成 .aux，第二遍目录与交叉引用才完整）
% 注意：sections/ 里是正文片段，单独编译会缺导言区，请始终编译 main.tex
% ---------------------------------------------------------------------------
\\begin{document}
${front}

${inputs}

${bibToLatex(citedAll, opts.bib ?? [])}\\end{document}
`

  return { mainTex, sections, bibUsed: citedAll, stats: total }
}

function countTables(md: string): number {
  // 连续表格行算一个表
  const lines = md.split('\n')
  let count = 0
  let inTable = false
  for (const line of lines) {
    const isRow = /^\s*\|.*\|\s*$/.test(line)
    if (isRow && !inTable) {
      count++
      inTable = true
    } else if (!isRow) inTable = false
  }
  return count
}
