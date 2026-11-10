import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import type { MacroMap } from './katexSafeRender'
import { escapeHtml, renderMathSafely } from './katexSafeRender'
import {
  DEFAULT_NUMBERING,
  eqTagText,
  isEnglishText,
  thmLabel,
  type EqNumbering,
  type EqTagStyle,
  type NumberingConfig,
  type ThmNumbering,
} from './numbering'
import { renderAlgorithmHtml } from '../components/Preview/AlgorithmBlock'
import type { BibEntry } from '../store/useEditorStore'

/**
 * ============================================================================
 *  renderMarkdown.ts —— 学术级 Markdown -> HTML 渲染管线
 * ----------------------------------------------------------------------------
 *  · ::: theorem / proof 等容器（自动编号）
 *  · ```algorithm 三线伪代码（编号 + 行内公式）
 *  · GFM 表格 -> booktabs 三线表
 *  · $$...$$ 自动编号 + \label 交叉引用 + 悬停预览数据
 *  · [@key] BibTeX 引用 + 文末参考文献表
 * ============================================================================
 */

export type RefKind =
  | 'eq' | 'thm' | 'lem' | 'def' | 'prop' | 'cor' | 'exa' | 'prf' | 'alg' | 'sec' | 'cite' | 'fig' | 'tab'
  | 'exe' | 'sol'

export interface RefEntry {
  kind: RefKind
  /** 裸 id（不含 kind: 前缀），用于 @kind:id 匹配 */
  id: string
  /** 文档内 DOM 锚点 */
  anchor: string
  /** 展示名，如「式 (1)」「定理 1」 */
  label: string
  /** 附加信息，用于补全菜单右侧提示 */
  detail: string
  /** 预览 HTML */
  previewHtml?: string
  /** 本地工作区模式下，目标所在的文件（跨文件引用时存在） */
  file?: string
}

export interface TocItem {
  id: string
  level: number
  text: string
  index: number
  /** 自动编号（1 / 1.1 / 1.1.1），未开启标题编号时为空 */
  no?: string
}

export interface RenderResult {
  html: string
  toc: TocItem[]
  refs: RefEntry[]
  bibUsed: string[]
}

export interface RenderOptions {
  macros?: MacroMap
  bib?: BibEntry[]
  autoNumber?: boolean
  citationStyle?: 'numeric' | 'author-year'
  /**
   * 工作区里「其它文件」的交叉引用索引。
   * 当前文件里找不到目标时回退到这里，渲染成可点击跳转到另一个文件的链接，
   * 而不是红色 broken 标记。纯浏览器模式下为空。
   */
  extRefs?: RefEntry[]
  /**
   * 跨文件引用是否输出成真实的文件链接（`other.html#anchor`）。
   * CLI 批量导出时开启，导出的 HTML 站点因此可以互相跳转；
   * 应用内预览保持关闭，由点击处理函数接管。
   */
  externalRefLinks?: boolean
  /** 编号规则：定理按节 / 公式按节 / 编号写法 */
  numbering?: Partial<NumberingConfig>
  /** 证毕符号（空串表示不加） */
  qed?: string
  /** 标题自动编号（1 / 1.1 / 1.1.1） */
  headingNumbering?: boolean
  /** 图表编号：按节（图 1.1）或全文连续（图 1） */
  figNumbering?: 'section' | 'global'
  /**
   * 工作区静态资源前缀，例如 `/ws/论文/figs`。
   * 只给应用内预览用：相对路径的图片 / 视频会被拼到它后面，
   * 这样 `<img src="figs/a.png">` 与 `![](figs/a.png)` 都能显示。
   * 导出的 HTML 不设这个值，保持相对路径，拷走整个目录就能离线打开。
   */
  assetBase?: string
}

/** 绝对地址（http:、data:、/x、#x）原样保留，只有相对路径才拼资源前缀 */
const ABS_SRC_RE = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/|\/|#|\?)/

/**
 * 把相对路径拼到资源前缀后面，顺手消掉 `.` 与 `..`。
 * 逐段 encodeURI：中文文件名、空格都能被浏览器正确取回，已编码的 `%20` 不会被二次编码。
 *
 * 前缀允许带协议与主机（`http://127.0.0.1:4321/ws/notes`）：
 * 导出 PDF 时打印页是从本地服务取的一个地址，图片必须带回完整主机名，
 * 否则会被当成 `/ws/…` 这种站点绝对路径，在打印窗口里解析到不存在的位置。
 */
export function joinAssetPath(base: string, rel: string): string {
  const m = /^([^?#]*)([?#].*)?$/.exec(rel)
  const pathPart = m?.[1] ?? ''
  const tail = m?.[2] ?? ''
  // 拆出 `scheme://host` 这一段，剩下的才当作路径段来消 `.` 与 `..`
  const originMatch = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]+)(\/[\s\S]*)?$/.exec(base)
  const origin = originMatch ? originMatch[1] : ''
  const basePath = originMatch ? (originMatch[2] ?? '') : base
  const segs = basePath.split('/').filter(Boolean)
  for (const part of pathPart.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      segs.pop()
      continue
    }
    segs.push(part)
  }
  return origin + '/' + segs.map((s) => encodeURI(s)).join('/') + tail
}

/** `<div markdown="1">…</div>`：中间没有空行时，remark 会把整块当原始 HTML，
 *  里面的 **强调**、$公式$、列表都不会解析。
 *  这里在语法树上把容器里的源码重新解析一遍再拼回去——
 *  比在文本上插空行更稳：行号不会变，点渲染结果跳源码依旧准确。 */
const MD_ATTR_OPEN_RE =
  /^<([A-Za-z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\smarkdown\s*=\s*["'](?:1|block|span|true)["']((?:[^>"']|"[^"]*"|'[^']*')*)>/

function shiftPositions(node: any, lineDelta: number, offsetDelta: number) {
  const p = node?.position
  if (p) {
    if (p.start) {
      p.start.line += lineDelta
      if (typeof p.start.offset === 'number') p.start.offset += offsetDelta
    }
    if (p.end) {
      p.end.line += lineDelta
      if (typeof p.end.offset === 'number') p.end.offset += offsetDelta
    }
  }
  for (const child of node?.children ?? []) shiftPositions(child, lineDelta, offsetDelta)
}

function promoteMarkdownContainers(tree: any, src: string, makeProcessor: () => any) {
  /** 把一段源码按 Markdown 解析，行号与偏移对齐回原文 */
  const parseSlice = (text: string, lineDelta: number, offsetDelta: number) => {
    const sub = makeProcessor().parse(text)
    shiftPositions(sub, lineDelta, offsetDelta)
    walk(sub)
    return sub
  }

  const walk = (parent: any) => {
    const kids: any[] = parent?.children
    if (!Array.isArray(kids)) return
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i]
      if (node?.type === 'html' && typeof node.value === 'string') {
        const m = MD_ATTR_OPEN_RE.exec(node.value)
        if (m) {
          const tag = m[1]
          const open = `<${tag}${m[2]}${m[3]}>`
          const baseOffset = node.position?.start?.offset
          const baseLine = node.position?.start?.line
          if (typeof baseOffset === 'number' && typeof baseLine === 'number') {
            const rest = node.value.slice(m[0].length)
            // 取「最后一个」闭标签：容器里嵌套同名标签时也能正确收口
            const closeIdx = rest.toLowerCase().lastIndexOf(`</${tag.toLowerCase()}`)
            const inline =
              closeIdx >= 0 ? new RegExp(`^</${tag}\\s*>`, 'i').exec(rest.slice(closeIdx)) : null

            if (inline) {
              // 开闭标签在同一个 HTML 节点里：<div markdown="1">内容</div>
              const inner = rest.slice(0, closeIdx)
              const tail = rest
                .slice(closeIdx)
                .replace(/\smarkdown\s*=\s*["'][^"']*["']/, '')
              const sub = parseSlice(inner, baseLine - 1, baseOffset + m[0].length)
              kids.splice(i, 1, { type: 'html', value: open }, ...(sub.children ?? []), {
                type: 'html',
                value: tail,
              })
              i += (sub.children ?? []).length + 1
              continue
            }

            // 开标签与闭标签是两个节点：找同级里那个 </tag>
            const closeOnlyRe = new RegExp(`^</${tag}\\s*>`, 'i')
            let j = i + 1
            while (j < kids.length) {
              const k = kids[j]
              if (k?.type === 'html' && closeOnlyRe.test(k.value ?? '')) break
              j++
            }
            if (j < kids.length) {
              const startOffset = node.position?.end?.offset
              const endOffset = kids[j].position?.start?.offset
              if (typeof startOffset === 'number' && typeof endOffset === 'number') {
                const inner = src.slice(startOffset, endOffset)
                const sub = parseSlice(inner, (node.position?.end?.line ?? 1) - 1, startOffset)
                kids[i] = { ...node, value: open }
                kids[j] = {
                  ...kids[j],
                  value: String(kids[j].value ?? '').replace(/\smarkdown\s*=\s*["'][^"']*["']/, ''),
                }
                kids.splice(i + 1, j - i - 1, ...(sub.children ?? []))
                i += (sub.children ?? []).length
                continue
              }
            }
          }
        }
      }
      walk(node)
    }
  }
  walk(tree)
}

const THM_TYPES: Record<string, { cn: string; en: string; kind: RefKind; env: string }> = {
  theorem: { cn: '定理', en: 'Theorem', kind: 'thm', env: 'theorem' },
  lemma: { cn: '引理', en: 'Lemma', kind: 'lem', env: 'lemma' },
  definition: { cn: '定义', en: 'Definition', kind: 'def', env: 'definition' },
  proposition: { cn: '命题', en: 'Proposition', kind: 'prop', env: 'proposition' },
  corollary: { cn: '推论', en: 'Corollary', kind: 'cor', env: 'corollary' },
  example: { cn: '例题', en: 'Example', kind: 'exa', env: 'example' },
  remark: { cn: '注', en: 'Remark', kind: 'prf', env: 'remark' },
  proof: { cn: '证明', en: 'Proof', kind: 'prf', env: 'proof' },
  algorithm: { cn: '算法', en: 'Algorithm', kind: 'alg', env: 'algorithm' },
  // 习题 / 解答：写作业与习题册用；习题带编号，解答不编号（跟着上面的习题走）
  exercise: { cn: '习题', en: 'Exercise', kind: 'exe', env: 'exercise' },
  solution: { cn: '解', en: 'Solution', kind: 'sol', env: 'solution' },
}

/**
 * 引用前缀与语言判定。
 * 环境（定理 / 证明 / 解答）一律按中文讲义排；isEnglishText 只留给文档级语言
 * （目录标题、公式引用前缀这类整体性文案）用。
 */

const REF_PREFIX_CN: Record<string, string> = {
  eq: '式', thm: '定理', lem: '引理', def: '定义', prop: '命题',
  cor: '推论', exa: '例题', alg: '算法', sec: '第', fig: '图', tab: '表',
  exe: '习题', sol: '解',
}

/** 归一化 ::: 容器语法（允许 `::: theorem [标题] {#id}` 的松散写法） */
export function normalizeDirectives(md: string): string {
  return md.replace(
    /^([ \t]*):::[ \t]*([A-Za-z][\w-]*)[ \t]*(?:\[([^\]\n]*)\])?[ \t]*(\{[^}\n]*\})?[ \t]*$/gm,
    (_m, indent: string, name: string, label?: string, attrs?: string) =>
      `${indent}:::${name}${label ? `[${label}]` : ''}${attrs ? attrs.replace(/\s+/g, '') : ''}`
  )
}

export function parseMarkdown(md: string): any {
  const makeProcessor = () =>
    unified().use(remarkParse).use(remarkMath).use(remarkGfm).use(remarkDirective)
  const source = normalizeDirectives(latexCommandsToMarkdown(md))
  const tree = makeProcessor().parse(source)
  promoteMarkdownContainers(tree, source, makeProcessor)
  promoteSingleMathParagraphs(tree)
  mergeTextDirectives(tree)
  return tree
}

/**
 * 论文写作习惯的 LaTeX 章节命令 -> Markdown 标题。
 * `\section{引言}` 与 `## 引言` 等价，`\tableofcontents` 换成目录容器。
 * 只认「整行只有一条命令」的写法，正文里偶尔出现的 \section 不会被误伤。
 */
export function latexCommandsToMarkdown(md: string): string {
  return md
    .replace(/^([ \t]*)\\chapter\*?[ \t]*\{([^{}\n]*)\}[ \t]*$/gm, '$1# $2')
    .replace(/^([ \t]*)\\section\*?[ \t]*\{([^{}\n]*)\}[ \t]*$/gm, '$1# $2')
    .replace(/^([ \t]*)\\subsection\*?[ \t]*\{([^{}\n]*)\}[ \t]*$/gm, '$1## $2')
    .replace(/^([ \t]*)\\subsubsection\*?[ \t]*\{([^{}\n]*)\}[ \t]*$/gm, '$1### $2')
    .replace(/^([ \t]*)\\paragraph\*?[ \t]*\{([^{}\n]*)\}[ \t]*$/gm, '$1#### $2')
    // 生成一对完整的 ::: 容器：只写开标记会把后面整篇都吞进目录里
    .replace(/^[ \t]*\\tableofcontents[ \t]*$/gm, '\n::: toc\n:::\n')
}

/**
 * remark-directive 会把正文里的 `:x`（例如交叉引用 `@thm:x` 的后半段）
 * 解析成 textDirective，导致引用被吃掉。这里把它还原为字面文本。
 */
function mergeTextDirectives(tree: any) {
  const visit = (parent: any) => {
    if (!Array.isArray(parent.children)) return
    const out: any[] = []
    for (const child of parent.children) {
      if (child.type === 'textDirective' || child.type === 'leafDirective') {
        const label = child.children?.length ? `[${textOf(child)}]` : ''
        const literal = `${child.type === 'textDirective' ? ':' : '::'}${child.name}${label}`
        const prev = out[out.length - 1]
        if (prev && prev.type === 'text') prev.value = String(prev.value ?? '') + literal
        else out.push({ type: 'text', value: literal })
        continue
      }
      visit(child)
      out.push(child)
    }
    // remark 会在 `}`、`{` 处把一段文字切成多个 text 节点
    // （例如 `\ref{eq:x}` 会被切成 `\ref{eq:x` + `} ...`）。
    // 交叉引用、文献引用都要看到完整片段，所以这里把相邻文本合并回去。
    const merged: any[] = []
    for (const child of out) {
      const prev = merged[merged.length - 1]
      if (prev && prev.type === 'text' && child.type === 'text') {
        prev.value = String(prev.value ?? '') + String(child.value ?? '')
        continue
      }
      merged.push(child)
    }
    parent.children = merged
  }
  visit(tree)
}

/**
 * remark-math 把「一行写完的 $$...$$」解析成段落里的 inlineMath，
 * 这里把它提升为独立的 display math 节点，确保能拿到编号与居中排版。
 */
function promoteSingleMathParagraphs(tree: any) {
  const visit = (parent: any) => {
    if (!parent.children) return
    parent.children = parent.children.map((node: any) => {
      if (node.type === 'paragraph') {
        const kids = (node.children ?? []).filter(
          (c: any) => !(c.type === 'text' && !String(c.value ?? '').trim())
        )
        if (kids.length === 1 && kids[0].type === 'inlineMath') {
          return { type: 'math', value: kids[0].value ?? '' }
        }
      }
      visit(node)
      return node
    })
  }
  visit(tree)
}

interface Ctx extends Required<Pick<RenderOptions, 'macros'>> {
  autoNumber: boolean
  bib: BibEntry[]
  citationStyle: 'numeric' | 'author-year'
  eqCounter: number
  /** 本节内的公式序号（按节编号时用） */
  eqInSection: number
  thmCounters: Record<string, number>
  algCounter: number
  headingCounter: number
  /** 当前是第几节：遇到「节标题」就 +1 */
  sectionNo: number
  /** 哪一级标题算节（H1 当标题时用 H2） */
  sectionDepth: 1 | 2
  numbering: NumberingConfig
  qed: string
  eqLabels: Map<string, { n: number; html: string }>
  thmMeta: Map<string, { label: string; previewHtml: string }>
  algLabels: Map<string, number>
  headings: Array<{ id: string; level: number; text: string }>
  citations: string[]
  refs: RefEntry[]
  toc: TocItem[]
  extRefs: RefEntry[]
  externalRefLinks: boolean
  /** 「定理 1.1」这类自然语言提及 -> 引用条目，用于自动加链接 */
  mentionIndex: Map<string, RefEntry>
  /** 整篇语言：决定引用前缀用「式/定理」还是 Eq./Theorem */
  lang: 'zh' | 'en'
  /* ---- 论文版面相关 ---- */
  headingNumbering: boolean
  /** 各级标题计数器：[H1, H2, ...] */
  headingNums: number[]
  figNumbering: 'section' | 'global'
  figCounter: number
  tabCounter: number
  /* ---- 脚注 ---- */
  /** 脚注定义：identifier -> 定义节点 */
  fnDefs: Map<string, any>
  /** 已编号的脚注：identifier -> 序号（按首次引用顺序） */
  fnNumbers: Map<string, number>
  fnOrder: string[]
  /** 相对资源路径的前缀（预览才有，导出为空） */
  assetBase?: string
}

/** 渲染阶段改写相对路径（预览专用）：导出留相对路径，方便整个目录拷走 */
function assetUrl(src: string, ctx: Ctx): string {
  const s = (src ?? '').trim()
  if (!ctx.assetBase || !s || ABS_SRC_RE.test(s)) return s
  return joinAssetPath(ctx.assetBase, s)
}

/** 原始 HTML 里的 img / video / source 也要走同一条路径规则 */
const RAW_MEDIA_SRC_RE =
  /(<(?:img|source|video|audio|embed|track)\b[^>]*?\s(?:src|poster)\s*=\s*)(["'])([^"']+)\2/gi

function rebaseRawHtml(value: string, ctx: Ctx): string {
  if (!ctx.assetBase) return value
  return value.replace(
    RAW_MEDIA_SRC_RE,
    (_m, head: string, q: string, url: string) => `${head}${q}${escapeHtml(assetUrl(url, ctx))}${q}`
  )
}

/** 标题编号：「1」「1.1」「1.1.1」 */
function headingNo(nums: number[], depth: number): string {
  return nums.slice(0, Math.max(1, depth)).filter((n) => n > 0).join('.')
}

export function renderMarkdown(md: string, opts: RenderOptions = {}): RenderResult {
  const tree = parseMarkdown(md)
  const ctx: Ctx = {
    macros: opts.macros ?? {},
    autoNumber: opts.autoNumber ?? true,
    bib: opts.bib ?? [],
    citationStyle: opts.citationStyle ?? 'numeric',
    eqCounter: 0,
    eqInSection: 0,
    thmCounters: {},
    algCounter: 0,
    headingCounter: 0,
    sectionNo: 0,
    sectionDepth: countH1(tree) >= 2 ? 1 : 2,
    numbering: {
      thm: (opts.numbering?.thm ?? DEFAULT_NUMBERING.thm) as ThmNumbering,
      eq: (opts.numbering?.eq ?? DEFAULT_NUMBERING.eq) as EqNumbering,
      eqTag: (opts.numbering?.eqTag ?? DEFAULT_NUMBERING.eqTag) as EqTagStyle,
    },
    qed: opts.qed ?? '∎',
    eqLabels: new Map(),
    thmMeta: new Map(),
    algLabels: new Map(),
    headings: [],
    citations: [],
    refs: [],
    toc: [],
    extRefs: opts.extRefs ?? [],
    externalRefLinks: opts.externalRefLinks ?? false,
    mentionIndex: new Map(),
    // 整篇的语言决定公式/定理引用显示成「式 1」「定理 1.1」还是 “Eq. (1)”“Theorem 1.1”
    lang: isEnglishText(md) ? 'en' : 'zh',
    headingNumbering: opts.headingNumbering ?? false,
    headingNums: [],
    figNumbering: opts.figNumbering ?? 'section',
    figCounter: 0,
    tabCounter: 0,
    fnDefs: new Map(),
    fnNumbers: new Map(),
    fnOrder: [],
    assetBase: opts.assetBase,
  }

  // 第一遍：为公式/定理/算法/标题分配编号与 id（保证交叉引用可以前向引用）
  collect(tree, ctx)
  ctx.mentionIndex = buildMentionIndex(ctx.refs)

  // 第二遍：渲染
  const body = (tree.children as any[])
    .map((n) => withLineAttr(renderBlock(n, ctx), n.position?.start?.line))
    .join('\n')
  const bibHtml = renderBibliography(ctx)
  const fnHtml = renderFootnotes(ctx)
  return { html: body + fnHtml + bibHtml, toc: ctx.toc, refs: ctx.refs, bibUsed: ctx.citations }
}

/**
 * 给顶层块的第一个标签打上源码行号（`data-mf-line`）。
 * 预览据此实现「点哪儿跳到哪儿」与分屏滚动联动——
 * mdast 的 position 是行号，DOM 这边用它跟编辑器对齐。
 */
/**
 * 这些标签加 `data-mf-line` 没有意义（有的还会导致解析问题），直接跳过。
 * 其余标签照常打标记——原始 HTML 因此也能「点哪儿跳到哪儿」。
 */
const NO_LINE_TAGS = new Set([
  'style', 'script', 'link', 'meta', 'title', 'base', 'head', 'html', 'body', 'template',
])

function withLineAttr(html: string, line?: number): string {
  if (!line) return html
  const m = /^(\s*)<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/.exec(html)
  if (!m) return html
  const [whole, lead, tag, attrs, selfClose] = m
  if (NO_LINE_TAGS.has(tag.toLowerCase())) return html
  if (/\sdata-mf-line=/.test(attrs)) return html
  return `${lead}<${tag}${attrs} data-mf-line="${line}"${selfClose}>${html.slice(whole.length)}`
}

/* ------------------------------------------------------------------ *
 *  收集编号
 * ------------------------------------------------------------------ */
function directiveTitle(node: any): { title: string; children: any[] } {
  const children = [...(node.children ?? [])]
  let title = ''
  if (children.length) {
    const first = children[0]
    if (first?.type === 'paragraph' && (first.data?.directiveLabel || first.children?.length === 1)) {
      const isLabel = first.data?.directiveLabel
      if (isLabel) {
        title = textOf(first)
        children.shift()
      }
    }
  }
  return { title, children }
}

function textOf(node: any): string {
  if (!node) return ''
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? ''
  if (node.type === 'inlineMath' || node.type === 'math') return node.value ?? ''
  if (node.children) return node.children.map(textOf).join('')
  return ''
}

/** 有几个 H1：决定「节」是 H1 还是 H2 */
function countH1(tree: any): number {
  let n = 0
  const walk = (node: any) => {
    if (node.type === 'heading' && node.depth === 1) n++
    for (const c of node.children ?? []) walk(c)
  }
  walk(tree)
  return n
}

function collect(tree: any, ctx: Ctx) {
  /** 图号 / 表号：按节（1.1）或全文连续（1） */
  const numbered = (n: number) => (ctx.figNumbering === 'section' ? `${Math.max(1, ctx.sectionNo)}.${n}` : String(n))

  const walk = (node: any, inFigure = false) => {
    if (node.type === 'footnoteDefinition') {
      ctx.fnDefs.set(String(node.identifier ?? ''), node)
      return
    }
    if (node.type === 'heading') {
      // 每遇到一个 H1/H2 就进入新的「节」：定理、公式的编号重新起算
      if (node.depth === ctx.sectionDepth) {
        ctx.sectionNo++
        ctx.thmCounters = {}
        ctx.eqInSection = 0
      }
      const text = textOf(node)
      ctx.headingCounter++
      const id = `sec-${ctx.headingCounter}`
      node.data = { ...(node.data ?? {}), mfId: id }
      // 标题自动编号：1 / 1.1 / 1.1.1，遇到深一级就清掉更深的计数
      let no: string | undefined
      if (ctx.headingNumbering) {
        const d = Math.min(6, Math.max(1, node.depth))
        while (ctx.headingNums.length < d) ctx.headingNums.push(0)
        ctx.headingNums[d - 1] = (ctx.headingNums[d - 1] ?? 0) + 1
        ctx.headingNums.length = d
        no = headingNo(ctx.headingNums, d)
        node.data.mfHeadingNo = no
      }
      ctx.headings.push({ id, level: node.depth, text })
      ctx.toc.push({ id, level: node.depth, text, index: ctx.headingCounter, no })
      ctx.refs.push({ kind: 'sec', id, anchor: id, label: text, detail: `第 ${ctx.headingCounter} 个标题 · H${node.depth}` })
      return
    }

    if (node.type === 'containerDirective' && (node.name === 'figure' || node.name === 'table')) {
      const id: string | undefined = node.attributes?.id
      const { title } = directiveTitle(node)
      const isFig = node.name === 'figure'
      if (isFig) ctx.figCounter++
      else ctx.tabCounter++
      const n = isFig ? ctx.figCounter : ctx.tabCounter
      node.data = {
        ...(node.data ?? {}),
        mfCaptionNo: numbered(n),
        mfCaptionTitle: title,
        mfCaptionKind: isFig ? 'fig' : 'tab',
      }
      if (id) {
        const label = `${isFig ? (ctx.lang === 'en' ? 'Figure' : '图') : ctx.lang === 'en' ? 'Table' : '表'} ${numbered(n)}`
        ctx.refs.push({
          kind: isFig ? 'fig' : 'tab',
          id: bareId(id),
          anchor: anchorOf(id),
          label,
          detail: title ? `· ${title}` : '',
        })
      }
      if (node.children) for (const c of node.children) walk(c, isFig || inFigure)
      return
    }

    // 单独成段的图片：`![题注](src)` 直接排成带图号的插图
    if (node.type === 'paragraph' && !inFigure) {
      const kids = (node.children ?? []).filter(
        (c: any) => !(c.type === 'text' && !String(c.value ?? '').trim())
      )
      const img = kids.find((c: any) => c.type === 'image')
      if (img && (img.alt ?? '').trim()) {
        ctx.figCounter++
        const attrText = kids
          .filter((c: any) => c !== img && c.type === 'text')
          .map((c: any) => String(c.value ?? ''))
          .join(' ')
        const id = /#([A-Za-z0-9_\u4e00-\u9fa5:-]+)/.exec(attrText)?.[1]
        node.data = {
          ...(node.data ?? {}),
          mfImageFig: true,
          mfCaptionNo: numbered(ctx.figCounter),
          mfCaptionTitle: String(img.alt ?? '').trim(),
          mfFigId: id,
        }
        if (id) {
          ctx.refs.push({
            kind: 'fig',
            id: bareId(id),
            anchor: anchorOf(id),
            label: `${ctx.lang === 'en' ? 'Figure' : '图'} ${numbered(ctx.figCounter)}`,
            detail: `· ${String(img.alt ?? '').trim()}`,
          })
        }
        return
      }
    }

    if (node.type === 'math') {
      const label = /\\label\s*\{([^{}]*)\}/.exec(node.value ?? '')?.[1]
      ctx.eqCounter++
      ctx.eqInSection++
      const section = Math.max(1, ctx.sectionNo)
      const seq = ctx.numbering.eq === 'section' ? ctx.eqInSection : ctx.eqCounter
      const tag = eqTagText(section, seq, ctx.numbering.eq, ctx.numbering.eqTag)
      const anchor = label ? anchorOf(label) : `eq-${ctx.eqCounter}`
      node.data = {
        ...(node.data ?? {}),
        mfEqNo: ctx.eqCounter,
        mfEqTag: tag,
        mfEqAnchor: anchor,
        mfLabel: label,
      }
      if (label) {
        ctx.eqLabels.set(label, { n: ctx.eqCounter, html: '' })
        ctx.refs.push({
          kind: 'eq',
          id: bareId(label),
          anchor,
          label: `${ctx.lang === 'en' ? 'Eq.' : '式'} ${tag}`,
          detail: truncate(cleanLatex(node.value ?? ''), 48),
        })
      }
      return
    }

    if (node.type === 'containerDirective') {
      const meta = THM_TYPES[node.name]
      const id: string | undefined = node.attributes?.id
      const { title } = directiveTitle(node)
      if (meta) {
        const section = Math.max(1, ctx.sectionNo)
        if (meta.env === 'proof' || meta.env === 'remark') {
          if (id) {
            const label = ctx.lang === 'en' ? meta.en : meta.cn
            ctx.thmMeta.set(id, { label, previewHtml: '' })
            ctx.refs.push({ kind: meta.kind, id: bareId(id), anchor: anchorOf(id), label, detail: title || label })
          }
        } else {
          const key = meta.env
          ctx.thmCounters[key] = (ctx.thmCounters[key] ?? 0) + 1
          const n = ctx.thmCounters[key]
          node.data = { ...(node.data ?? {}), mfThmNo: n, mfThmSection: section }
          if (id) {
            const label = thmLabel(ctx.lang === 'en' ? meta.en : meta.cn, section, n, ctx.numbering.thm)
            ctx.thmMeta.set(id, { label, previewHtml: '' })
            ctx.refs.push({
              kind: meta.kind,
              id: bareId(id),
              anchor: anchorOf(id),
              label,
              detail: title ? `· ${title}` : '',
            })
          }
        }
      }
    }

    if (node.type === 'code' && (node.lang === 'algorithm' || node.lang === 'algpseudocode')) {
      ctx.algCounter++
      // info string 支持三种写法：```algorithm [标题]{#alg:x} / {#alg:x} / [标题]
      const info = parseBlockMeta(node.meta ?? '')
      node.data = {
        ...(node.data ?? {}),
        mfAlgNo: ctx.algCounter,
        mfAlgTitle: info.title,
        mfAlgId: info.id,
      }
      if (info.id) {
        ctx.refs.push({
          kind: 'alg',
          id: bareId(info.id),
          anchor: anchorOf(info.id),
          label: `${ctx.lang === 'en' ? 'Algorithm' : '算法'} ${ctx.algCounter}`,
          detail: info.title ? `· ${info.title}` : '',
        })
      }
    }

    if (node.children) for (const c of node.children) walk(c, inFigure)
  }
  for (const c of tree.children ?? []) walk(c)

  // 章节引用在正文中表现为「§id」形式时给出更友好的展示
  ctx.refs = ctx.refs.map((r) => (r.kind === 'sec' ? { ...r, label: `§${r.id.replace('sec-', '')}` } : r))
}

/* ------------------------------------------------------------------ *
 *  块级渲染
 * ------------------------------------------------------------------ */

function renderChildren(nodes: any[], ctx: Ctx): string {
  return nodes.map((n) => renderBlock(n, ctx)).join('\n')
}

function renderBlock(node: any, ctx: Ctx): string {
  switch (node.type) {
    case 'heading': {
      // 防御：标题正文里如果又带了一层 "#"（例如误写成 "## ## 标题"），
      // 成品里不该出现这个前缀，否则预览会和源码长得一样，失去"排版结果"的意义。
      let children = node.children ?? []
      const first = children[0]
      if (first?.type === 'text' && /^#{1,6}\s+/.test(first.value ?? '')) {
        children = [{ ...first, value: first.value.replace(/^#{1,6}\s+/, '') }, ...children.slice(1)]
      }
      const id = node.data?.mfId ?? `h-${Math.random().toString(36).slice(2, 8)}`
      const tag = `h${Math.min(6, node.depth)}`
      const no = node.data?.mfHeadingNo as string | undefined
      // 编号与标题之间用实心间隔，中文排版里比纯空格稳
      const noHtml = no ? `<span class="mf-h-no">${escapeHtml(no)}</span>` : ''
      return `<${tag} id="${id}" class="mf-heading mf-h${node.depth}">${noHtml}${renderInline(children, ctx)}</${tag}>`
    }
    case 'paragraph':
      if (PAGEBREAK_TEXT_RE.test(textOf(node))) return pageBreakHtml()
      if (node.data?.mfImageFig) {
        const img = (node.children ?? []).find((c: any) => c.type === 'image')
        if (img) return renderImageFigure(node, img, ctx)
      }
      return `<p class="mf-p">${renderInline(node.children ?? [], ctx)}</p>`

    case 'text':
      return `<p class="mf-p">${renderInline(node.children ?? [], ctx)}</p>`

    case 'blockquote':
      return `<blockquote class="mf-quote">${renderChildren(node.children ?? [], ctx)}</blockquote>`

    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul'
      const start = node.ordered && node.start && node.start !== 1 ? ` start="${node.start}"` : ''
      const items = (node.children ?? [])
        .map((li: any) => {
          const inner = (li.children ?? [])
            .map((c: any) => (c.type === 'paragraph' ? renderInline(c.children ?? [], ctx) : renderBlock(c, ctx)))
            .join('')
          const checkbox = li.checked == null ? '' : `<span class="mf-task">${li.checked ? '☑' : '☐'}</span> `
          return `<li>${checkbox}${inner}</li>`
        })
        .join('')
      return `<${tag} class="mf-list"${start}>${items}</${tag}>`
    }

    case 'table':
      return renderTable(node, ctx)

    case 'code': {
      if (node.lang === 'algorithm' || node.lang === 'algpseudocode') {
        const n = node.data?.mfAlgNo
        const title = node.data?.mfAlgTitle as string | undefined
        const id = node.data?.mfAlgId as string | undefined
        return renderAlgorithmHtml(node.value ?? '', {
          macros: ctx.macros,
          number: n,
          title,
          id: id ? anchorOf(id) : undefined,
        })
      }
      const lang = node.lang ? ` language-${node.lang}` : ''
      return `<pre class="mf-code"><code class="mf-code-inner${lang}">${escapeHtml(node.value ?? '')}</code></pre>`
    }

    case 'thematicBreak':
      return `<hr class="mf-hr" />`

    case 'math': {
      const label = node.data?.mfLabel as string | undefined
      const no = node.data?.mfEqNo as number | undefined
      const tagText = node.data?.mfEqTag as string | undefined
      const anchor = (node.data?.mfEqAnchor as string | undefined) ?? (label ? anchorOf(label) : undefined)
      const r = renderMathSafely(node.value ?? '', true, ctx.macros, {
        tag: ctx.autoNumber ? no : undefined,
        tagLabel: ctx.autoNumber ? tagText : undefined,
        tagHref: ctx.autoNumber ? anchor : undefined,
      })
      const idAttr = anchor ? ` id="${anchor}"` : ''
      const labelAttr = label ? ` data-eq-label="${escapeHtml(label)}"` : ''
      if (label) {
        const entry = ctx.refs.find((x) => x.kind === 'eq' && x.id === bareId(label))
        if (entry) entry.previewHtml = r.html
      }
      return `<div class="mf-display"${idAttr}${labelAttr}>${r.html}</div>`
    }

    case 'containerDirective':
      return renderContainer(node, ctx)

    case 'html':
      if (PAGEBREAK_TEXT_RE.test(node.value ?? '')) return pageBreakHtml()
      return rebaseRawHtml(node.value ?? '', ctx)

    case 'definition':
    case 'footnoteDefinition':
      return ''

    default: {
      if (node.children) return renderChildren(node.children, ctx)
      if (typeof node.value === 'string') return `<p class="mf-p">${escapeHtml(node.value)}</p>`
      return ''
    }
  }
}

function cleanLatex(s: string): string {
  return s
    .replace(/\\label\s*\{[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+|[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function slug(s: string): string {
  return s.replace(/[^\w\u4e00-\u9fa5-]/g, '-')
}

/** 引用锚点：eq:lagrange -> eq-lagrange；sec-1 -> sec-1 */
export function anchorOf(id: string): string {
  return id.replace(/:/g, '-')
}

/** 前缀别名：`{#definition:x}` 与 `@def:x` 应当指向同一个目标 */
const KIND_ALIASES = new Set([
  'eq', 'thm', 'lem', 'def', 'prop', 'cor', 'exa', 'prf', 'alg', 'sec', 'fig', 'tab',
  'theorem', 'lemma', 'definition', 'proposition', 'corollary', 'example', 'proof',
  'algorithm', 'remark', 'note', 'equation',
  'exe', 'sol', 'exercise', 'solution',
])

/** 去掉 kind: 前缀，得到裸 id（`def:contraction` -> `contraction`） */
export function bareId(id: string): string {
  const i = id.indexOf(':')
  if (i > 0) {
    const head = id.slice(0, i).toLowerCase()
    if (KIND_ALIASES.has(head)) return id.slice(i + 1)
  }
  return id
}

/**
 * 解析代码块 info string 里的标题与锚点。
 * 支持 ```algorithm [快速排序]{#alg:quick} / ```algorithm {#alg:quick} / ```algorithm [快速排序]
 */
export function parseBlockMeta(meta: string): { title?: string; id?: string } {
  const s = (meta ?? '').trim()
  if (!s) return {}
  const out: { title?: string; id?: string } = {}
  const attr = /\{([^}]*)\}/.exec(s)
  if (attr) out.id = /#([A-Za-z0-9_\u4e00-\u9fa5:-]+)/.exec(attr[1])?.[1]
  const title = /\[([^\]]*)\]/.exec(s)
  if (title) out.title = title[1].trim() || undefined
  else if (!attr) out.title = s
  return out
}

/** 手动分页：屏幕上是虚线分隔，打印时真正换页 */
function pageBreakHtml(): string {
  return '<div class="mf-pagebreak" data-mf-pagebreak="1" role="separator"><span>分页</span></div>'
}

const PAGEBREAK_TEXT_RE = /^\s*(?:\\(?:newpage|pagebreak|clearpage)\b[ \t]*|<!--\s*page-?break\s*-->)\s*$/i

/** 证毕符号插在最后一个段落末尾，保证它落在框内、紧跟着最后一句 */
function appendQed(html: string, symbol: string): string {
  if (!symbol) return html
  const q = `<span class="mf-qed" data-mf-only-last="1" aria-hidden="true">${escapeHtml(symbol)}</span>`
  if (/<\/p>\s*$/.test(html)) return html.replace(/<\/p>\s*$/, `${q}</p>`)
  return `${html}${q}`
}

function renderContainer(node: any, ctx: Ctx): string {
  const name: string = node.name
  if (name === 'pagebreak' || name === 'newpage' || name === 'clearpage') return pageBreakHtml()
  if (name === 'toc' || name === 'contents' || name === 'tableofcontents') return renderToc(ctx)
  if (name === 'figure') return renderFigureBlock(node, ctx)
  if (name === 'table') return renderTableBlock(node, ctx)
  const meta = THM_TYPES[name]
  const id: string | undefined = node.attributes?.id
  const { title, children } = directiveTitle(node)
  const inner = renderChildren(children, ctx)

  if (!meta) {
    return `<div class="mf-box mf-box-generic">${title ? `<div class="mf-box-title">${escapeHtml(title)}</div>` : ''}${inner}</div>`
  }

  // 环境标题与正文固定按中文讲义排：中文标签、正文正体。
  // 早先会按内容语种自动切成「Theorem 1.1 + 斜体正文」——英文段落一多就整段变斜、
  // 标题也跟着变英文，同一篇文档里像混了两套排法，这条路已经去掉。
  if (meta.env === 'proof') {
    if (id) {
      const m = ctx.thmMeta.get(id)
      if (m) m.previewHtml = inner
    }
    // data-mf-splittable：长证明允许跨页（分页器会把正文段落切开、分到两页上）
    return `<div class="mf-thm mf-proof" data-mf-splittable="1"${id ? ` id="${anchorOf(id)}"` : ''}>
      <div class="mf-thm-body" data-mf-flow="1"><span class="mf-proof-q" data-mf-only-first="1">证</span>${
        title ? `<span class="mf-proof-title" data-mf-only-first="1">（${escapeHtml(title)}）</span>` : ''
      }${appendQed(inner, ctx.qed)}</div>
    </div>`
  }

  if (meta.env === 'remark') {
    if (id) {
      const m = ctx.thmMeta.get(id)
      if (m) m.previewHtml = inner
    }
    return `<div class="mf-thm mf-thm-remark"${id ? ` id="${anchorOf(id)}"` : ''}>
      <div class="mf-thm-body"><span class="mf-thm-inline-label">${meta.cn}</span>${inner}</div>
    </div>`
  }

  // 解答：跟着上面的习题走，不编号、不加证毕符号，正文用正文字体
  if (meta.env === 'solution') {
    if (id) {
      const m = ctx.thmMeta.get(id)
      if (m) m.previewHtml = inner
    }
    return `<div class="mf-thm mf-solution" data-mf-splittable="1"${id ? ` id="${anchorOf(id)}"` : ''}>
      <div class="mf-thm-body" data-mf-flow="1"><span class="mf-sol-q" data-mf-only-first="1">解</span>${
        title ? `<span class="mf-proof-title" data-mf-only-first="1">（${escapeHtml(title)}）</span>` : ''
      }${inner}</div>
    </div>`
  }

  const n = node.data?.mfThmNo ?? 1
  const section = node.data?.mfThmSection ?? 1
  const labelText = thmLabel(meta.cn, section, n, ctx.numbering.thm)
  if (id) {
    const m = ctx.thmMeta.get(id)
    if (m) m.previewHtml = inner
  }
  return `<div class="mf-thm mf-thm-${meta.env}"${id ? ` id="${anchorOf(id)}"` : ''}>
    <div class="mf-thm-head"><span class="mf-thm-label">${escapeHtml(labelText)}</span>${
      title ? `<span class="mf-thm-title">（${escapeHtml(title)}）</span>` : ''
    }</div>
    <div class="mf-thm-body">${inner}</div>
  </div>`
}

/* ------------------------------------------------------------------ *
 *  目录 / 插图 / 表格题注 / 脚注
 * ------------------------------------------------------------------ */

function renderToc(ctx: Ctx): string {
  if (!ctx.toc.length) {
    return `<nav class="mf-toc"><div class="mf-toc-title">${ctx.lang === 'en' ? 'Contents' : '目录'}</div><div class="mf-toc-empty">（还没有标题）</div></nav>`
  }
  const items = ctx.toc
    .map((t) => {
      const indent = Math.max(0, Math.min(5, t.level - 1)) * 1.5
      const label = `${t.no ? `${escapeHtml(t.no)}　` : ''}${escapeHtml(t.text || '（无标题）')}`
      return `<li class="mf-toc-row" data-level="${t.level}" style="--mf-toc-indent:${indent}em"><a class="mf-toc-link" href="#${t.id}">${label}</a><span class="mf-toc-dots"></span><span class="mf-toc-page" data-mf-toc-anchor="${t.id}"></span></li>`
    })
    .join('')
  return `<nav class="mf-toc" data-mf-toc="1"><div class="mf-toc-title">${ctx.lang === 'en' ? 'Contents' : '目录'}</div><ol class="mf-toc-list">${items}</ol></nav>`
}

function caption(noHtml: string, title: string | undefined): string {
  return `<span class="mf-caption-no">${noHtml}</span>${title ? `<span class="mf-caption-title">${escapeHtml(title)}</span>` : ''}`
}

function renderFigureBlock(node: any, ctx: Ctx): string {
  const id: string | undefined = node.attributes?.id
  const { title, children } = directiveTitle(node)
  const no = node.data?.mfCaptionNo as string | undefined
  const kind = ctx.lang === 'en' ? 'Figure' : '图'
  return `<figure class="mf-figure"${id ? ` id="${anchorOf(id)}"` : ''}>${renderChildren(children, ctx)}${
    no ? `<figcaption class="mf-caption">${caption(`${kind} ${no}`, title)}</figcaption>` : ''
  }</figure>`
}

function renderTableBlock(node: any, ctx: Ctx): string {
  const id: string | undefined = node.attributes?.id
  const { title, children } = directiveTitle(node)
  const no = node.data?.mfCaptionNo as string | undefined
  const kind = ctx.lang === 'en' ? 'Table' : '表'
  return `<div class="mf-table-block"${id ? ` id="${anchorOf(id)}"` : ''}>${
    no ? `<div class="mf-caption mf-caption-top">${caption(`${kind} ${no}`, title)}</div>` : ''
  }${renderChildren(children, ctx)}</div>`
}

function renderImageFigure(node: any, img: any, ctx: Ctx): string {
  const id = node.data?.mfFigId as string | undefined
  const no = node.data?.mfCaptionNo as string | undefined
  const title = node.data?.mfCaptionTitle as string | undefined
  const kind = ctx.lang === 'en' ? 'Figure' : '图'
  return `<figure class="mf-figure"${id ? ` id="${anchorOf(id)}"` : ''}><img class="mf-img" src="${escapeHtml(
    assetUrl(img.url ?? '', ctx)
  )}" alt="${escapeHtml(img.alt ?? '')}" />${
    no ? `<figcaption class="mf-caption">${caption(`${kind} ${no}`, title)}</figcaption>` : ''
  }</figure>`
}

/** 脚注引用：按首次出现顺序编号，同一脚注多次引用共用一号 */
function renderFootnoteRef(identifier: string, ctx: Ctx): string {
  const key = String(identifier ?? '')
  let n = ctx.fnNumbers.get(key)
  if (!n) {
    n = ctx.fnNumbers.size + 1
    ctx.fnNumbers.set(key, n)
    ctx.fnOrder.push(key)
  }
  return `<sup class="mf-fn-ref" id="fnref-${n}"><a href="#fn-${n}" data-fn="${n}">${n}</a></sup>`
}

function renderFootnotes(ctx: Ctx): string {
  if (!ctx.fnOrder.length) return ''
  const items = ctx.fnOrder
    .map((key, i) => {
      const def = ctx.fnDefs.get(key)
      const inner = def ? renderChildren(def.children ?? [], ctx) : '<p class="mf-p">（脚注内容缺失）</p>'
      return `<li id="fn-${i + 1}" class="mf-fn-item"><span class="mf-fn-no">${i + 1}</span><div class="mf-fn-body">${inner}</div></li>`
    })
    .join('')
  return `<section class="mf-footnotes" data-mf-footnotes="1"><div class="mf-fn-title">${ctx.lang === 'en' ? 'Notes' : '注释'}</div><ol class="mf-fn-list">${items}</ol></section>`
}

function renderTable(node: any, ctx: Ctx): string {
  const rows = node.children ?? []
  const head = rows[0]
  const body = rows.slice(1)
  const aligns = (node.align ?? []) as Array<'left' | 'right' | 'center' | null>
  const alignAttr = (i: number) => (aligns[i] ? ` style="text-align:${aligns[i]}"` : '')
  const thead = head
    ? `<thead><tr>${(head.children ?? [])
        .map((c: any, i: number) => `<th${alignAttr(i)}>${renderInline(c.children ?? [], ctx)}</th>`)
        .join('')}</tr></thead>`
    : ''
  const tbody = `<tbody>${body
    .map(
      (r: any) =>
        `<tr>${(r.children ?? [])
          .map((c: any, i: number) => `<td${alignAttr(i)}>${renderInline(c.children ?? [], ctx)}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody>`
  return `<div class="mf-table-wrap"><table class="mf-table">${thead}${tbody}</table></div>`
}

/* ------------------------------------------------------------------ *
 *  行内渲染
 * ------------------------------------------------------------------ */

function renderInline(nodes: any[], ctx: Ctx): string {
  return nodes.map((n) => renderInlineNode(n, ctx)).join('')
}

function renderInlineNode(node: any, ctx: Ctx): string {
  switch (node.type) {
    case 'text':
      return renderPlainText(node.value ?? '', ctx)
    case 'inlineMath': {
      const r = renderMathSafely(node.value ?? '', false, ctx.macros)
      return `<span class="mf-inline-math">${r.html}</span>`
    }
    case 'strong':
      return `<strong>${renderInline(node.children ?? [], ctx)}</strong>`
    case 'emphasis':
      return `<em>${renderInline(node.children ?? [], ctx)}</em>`
    case 'delete':
      return `<del>${renderInline(node.children ?? [], ctx)}</del>`
    case 'inlineCode':
      return `<code class="mf-inline-code">${escapeHtml(node.value ?? '')}</code>`
    case 'link':
      return `<a class="mf-link" href="${escapeHtml(node.url ?? '#')}" target="_blank" rel="noreferrer">${renderInline(node.children ?? [], ctx)}</a>`
    case 'image':
      return `<img class="mf-img" src="${escapeHtml(assetUrl(node.url ?? '', ctx))}" alt="${escapeHtml(node.alt ?? '')}" />`
    case 'break':
      return '<br />'
    case 'html':
      return rebaseRawHtml(node.value ?? '', ctx)
    case 'footnoteReference':
      return renderFootnoteRef(String(node.identifier ?? node.label ?? ''), ctx)
    default:
      if (node.children) return renderInline(node.children, ctx)
      return escapeHtml(node.value ?? '')
  }
}

const CITE_SRC = /\[@([A-Za-z0-9_\-:.]+(?:\s*[;,]\s*@?[A-Za-z0-9_\-:.]+)*)\]/.source
const REF_SRC = /@(eq|thm|lem|def|prop|cor|exa|prf|alg|sec|fig|tab):([A-Za-z0-9_\-:.]+)/.source
/** LaTeX 风格的 \ref{eq:x} / \eqref{eq:x} */
const TEXREF_SRC = /\\(?:eq|c|auto|page)?ref\*?\{([^{}]+)\}/.source
/** 正文里直接说「由定理 1.1」「见式 (2)」「如图 3.1」——能对上编号就自动变成链接 */
const MENTION_SRC = /(定理|引理|定义|命题|推论|例题|习题|注|算法|式|公式|图|表)[ \t]*[（(]?[ \t]*(\d+(?:[.\-–]\d+)*)[ \t]*[）)]?/.source

/** 标签自带的前缀词，例如「图 3.1」的「图」、「Figure 3.1」的「Figure」 */
const LABEL_PREFIX = /^([^\s\d（(]{1,12})\s*[\d（(]/

/**
 * 正文里已经写了「图」，链接标签又带一遍「图」，会拼成「图 图 3.1」。
 * 发现紧邻前文以同样的前缀词收尾时，把前文里重复的那个词去掉。
 */
function dedupeLabelPrefix(lead: string, label: string | undefined): string {
  if (!label) return lead
  const m = LABEL_PREFIX.exec(label)
  if (!m) return lead
  const word = m[1]
  const trimmed = lead.replace(/[ \t\u00a0]+$/, '')
  if (!trimmed.endsWith(word)) return lead
  return trimmed.slice(0, trimmed.length - word.length)
}

function normMention(s: string): string {
  return s.replace(/[\s\u00a0]/g, '').replace(/（/g, '(').replace(/）/g, ')')
}

/** 把「定理 1.1」这类标签拆成可匹配的几种写法 */
function mentionKeys(label: string): string[] {
  const keys = new Set<string>([normMention(label)])
  const m = /^(.+?)[\s]*[（(]?([\d]+(?:[.\-–][\d]+)*)[）)]?$/.exec(label.trim())
  if (m) {
    const cn = m[1].trim()
    keys.add(`${cn}${m[2]}`)
    keys.add(`${cn}(${m[2]})`)
  }
  return [...keys]
}

function buildMentionIndex(refs: RefEntry[]): Map<string, RefEntry> {
  const map = new Map<string, RefEntry>()
  for (const r of refs) {
    if (r.kind === 'sec' || r.kind === 'cite') continue
    for (const k of mentionKeys(r.label)) if (!map.has(k)) map.set(k, r)
  }
  return map
}

function refLink(entry: RefEntry, text: string, extraClass = ''): string {
  return `<a class="mf-ref${extraClass ? ` ${extraClass}` : ''}" href="#${entry.anchor}" data-ref-kind="${entry.kind}" data-ref-id="${entry.id}" data-ref-title="${escapeHtml(entry.label)}" data-ref-detail="${escapeHtml(entry.detail ?? '')}">${escapeHtml(text)}</a>`
}

function renderPlainText(text: string, ctx: Ctx): string {
  let html = ''
  let last = 0
  const combined = new RegExp([CITE_SRC, REF_SRC, TEXREF_SRC, MENTION_SRC].join('|'), 'g')
  let m: RegExpExecArray | null
  while ((m = combined.exec(text))) {
    const raw = m[0]
    const lead = text.slice(last, m.index)
    if (m[1] !== undefined) {
      html += escapeHtml(lead)
      html += renderCitation(m[1], ctx)
    } else if (m[2] !== undefined) {
      // 「图 @fig:loss」→ 前面那个「图」和标签里的「图」重了，先去掉再拼
      html += escapeHtml(dedupeLabelPrefix(lead, refLabel(m[2], m[3], ctx)))
      html += renderRef(m[2], m[3], ctx)
    } else if (m[4] !== undefined) {
      html += escapeHtml(dedupeLabelPrefix(lead, texRefLabel(m[4], ctx)))
      html += renderTexRef(m[4], raw, ctx)
    } else if (m[5] !== undefined) {
      html += escapeHtml(lead)
      html += renderMention(raw, ctx)
    }
    last = m.index + raw.length
  }
  html += escapeHtml(text.slice(last))
  return html
}

/** 找出 @kind:id 指向的条目（当前文件优先） */
function findRef(kind: string, id: string, ctx: Ctx): RefEntry | undefined {
  const bare = bareId(id)
  return (
    ctx.refs.find((r) => r.id === bare && r.kind === kind) ??
    // 前缀写错（例如把 def 写成 thm）时，只要 id 唯一仍然给链接，避免变成红字
    ctx.refs.find((r) => r.id === bare)
  )
}

/** 当前文件里没有时，去工作区其他文件的引用表里找 */
function findExtRef(kind: string, id: string, ctx: Ctx): RefEntry | undefined {
  const bare = bareId(id)
  return ctx.extRefs.find((r) => r.id === bare && r.kind === kind) ?? ctx.extRefs.find((r) => r.id === bare)
}

function refLabel(kind: string, id: string, ctx: Ctx): string | undefined {
  return (findRef(kind, id, ctx) ?? findExtRef(kind, id, ctx))?.label
}

function texRefLabel(id: string, ctx: Ctx): string | undefined {
  const bare = bareId(id)
  return (
    ctx.refs.find((r) => r.id === bare && (!id.includes(':') || id.startsWith(`${r.kind}:`))) ??
    ctx.refs.find((r) => r.id === bare)
  )?.label
}

/** `\ref{eq:x}`：和 @eq:x 等价，但允许直接写 LaTeX 习惯的写法 */
function renderTexRef(id: string, raw: string, ctx: Ctx): string {
  const bare = bareId(id)
  const entry =
    ctx.refs.find((r) => r.id === bare && (!id.includes(':') || id.startsWith(`${r.kind}:`))) ??
    ctx.refs.find((r) => r.id === bare)
  if (entry) return refLink(entry, entry.label, 'mf-ref-tex')
  return `<span class="mf-ref-broken" title="未找到引用目标 ${escapeHtml(raw)}">${escapeHtml(raw)}?</span>`
}/** 正文里的「定理 1.1」：编号能对上就加链接，对不上就原样保留 */
function renderMention(raw: string, ctx: Ctx): string {
  const core = raw.replace(/[\s\u00a0]+$/, '')
  const tail = raw.slice(core.length)
  const entry = ctx.mentionIndex.get(normMention(core))
  if (!entry) return escapeHtml(raw)
  return refLink(entry, core, 'mf-ref-auto') + escapeHtml(tail)
}

function renderRef(kind: string, id: string, ctx: Ctx): string {
  const entry = findRef(kind, id, ctx)
  if (entry) {
    return refLink(entry, entry.label)
  }

  // 当前文件里没有目标 —— 看看是不是工作区里别的文件定义的
  const ext = findExtRef(kind, id, ctx)
  if (ext?.file) {
    const anchor = ext.anchor.includes('#') ? ext.anchor.slice(ext.anchor.indexOf('#') + 1) : ext.anchor
    // 导出成静态站点时，链接指向同目录下编译好的 .html，浏览器里能直接跳过去
    const href = ctx.externalRefLinks ? `${ext.file.replace(/\.(md|markdown|mdx)$/i, '.html')}#${anchor}` : '#'
    return `<a class="mf-ref mf-ref-xref" href="${escapeHtml(href)}" data-ref-kind="${kind}" data-ref-id="${ext.id}" data-ref-title="${escapeHtml(
      ext.label
    )}" data-ref-detail="${escapeHtml(ext.detail ?? '')}" data-mf-file="${escapeHtml(ext.file)}" data-mf-anchor="${escapeHtml(
      anchor
    )}" title="跳转到 ${escapeHtml(ext.file)}">${escapeHtml(ext.label)}<span class="mf-ref-xfile">${escapeHtml(
      shortFile(ext.file)
    )}</span></a>`
  }

  return `<span class="mf-ref-broken" title="未找到引用目标 @${kind}:${id}">@${kind}:${id}?</span>`
}

/** 跨文件引用后面跟随的小字文件标签，只保留文件名与上一层目录 */
function shortFile(file: string): string {
  const parts = file.split('/')
  return parts.length <= 1 ? parts[0] : parts.slice(-2).join('/')
}

function renderCitation(rawKeys: string, ctx: Ctx): string {
  const keys = rawKeys
    .split(/[;,]/)
    .map((k) => k.trim().replace(/^@/, ''))
    .filter(Boolean)
  const parts: string[] = []
  for (const key of keys) {
    let idx = ctx.citations.indexOf(key)
    if (idx < 0) {
      ctx.citations.push(key)
      idx = ctx.citations.length - 1
    }
    const n = idx + 1
    const entry = ctx.bib.find((b) => b.key === key)
    const label =
      ctx.citationStyle === 'author-year'
        ? `(${shortAuthor(entry?.author ?? key)}, ${entry?.year ?? 'n.d.'})`
        : `[${n}]`
    parts.push(
      `<a class="mf-cite" href="#ref-${slug(key)}" data-ref-kind="cite" data-ref-id="${escapeHtml(key)}" data-ref-title="${escapeHtml(label)}" data-ref-detail="${escapeHtml(entry?.title ?? '未收录的文献条目')}">${escapeHtml(label)}</a>`
    )
  }
  if (ctx.citationStyle === 'author-year') return `<span class="mf-cite-group">${parts.join('；')}</span>`
  return `<sup class="mf-cite-group">${parts.join(',')}</sup>`
}

function shortAuthor(author: string): string {
  const first = author.split(/\s+and\s+/)[0] ?? author
  if (first.includes(',')) return first.split(',')[0].trim()
  return first.split(/\s+/).slice(-1)[0] ?? first
}

const BIB_TYPE_MARK: Record<string, string> = {
  article: '[J]', journal: '[J]',
  book: '[M]', monograph: '[M]',
  inproceedings: '[C]', conference: '[C]', proceedings: '[C]',
  incollection: '[M]',
  phdthesis: '[D]', mastersthesis: '[D]', thesis: '[D]',
  techreport: '[R]', report: '[R]',
  standard: '[S]', patent: '[P]',
  misc: '[EB/OL]', online: '[EB/OL]', webpage: '[EB/OL]',
}

/** GB/T 7714 风格的文献类型标识：作者. 题名[J]. 刊名, 年. */
function bibTypeMark(type: string): string {
  const t = String(type ?? '').trim()
  if (!t) return ''
  if (t.startsWith('[')) return t
  return BIB_TYPE_MARK[t.toLowerCase()] ?? ''
}

function renderBibliography(ctx: Ctx): string {
  if (!ctx.citations.length) return ''
  const items = ctx.citations.map((key, i) => {
    const e = ctx.bib.find((b) => b.key === key)
    if (!e) {
      return `<li id="ref-${slug(key)}" class="mf-bib-item"><span class="mf-bib-index">[${i + 1}]</span><span class="mf-bib-missing">未找到文献条目 <code>${escapeHtml(key)}</code>，请在「参考文献」面板中补充。</span></li>`
    }
    const mark = bibTypeMark(e.type)
    const src = e.journal ? `<span class="mf-bib-src">${escapeHtml(e.journal)}</span>, ` : ''
    // 作者名常以缩写点结尾（Knuth, Donald E.），再补一个句点会变成两个
    const authorDot = /[.．]$/.test(String(e.author ?? '').trim()) ? '' : '.'
    return `<li id="ref-${slug(key)}" class="mf-bib-item"><span class="mf-bib-index">[${i + 1}]</span><span class="mf-bib-text"><span class="mf-bib-author">${escapeHtml(
      e.author
    )}</span>${authorDot} <span class="mf-bib-title">${escapeHtml(e.title)}</span>${mark ? `<span class="mf-bib-type">${escapeHtml(mark)}</span>` : ''}. ${src}${escapeHtml(
      e.year
    )}.</span></li>`
  })
  const title = ctx.lang === 'en' ? 'References' : '参考文献'
  return `<section class="mf-bib"><h2 class="mf-heading mf-h2 mf-bib-heading">${title}</h2><ol class="mf-bib-list">${items.join('')}</ol></section>`
}

/** 把预览内的引用预览数据汇总（供 AcademicPreview 悬停卡片使用） */
export function buildPreviewMap(res: RenderResult): Record<string, { title: string; detail: string; html: string }> {
  const map: Record<string, { title: string; detail: string; html: string }> = {}
  for (const r of res.refs) {
    map[`${r.kind}:${r.id}`] = { title: r.label, detail: r.detail ?? '', html: r.previewHtml ?? '' }
  }
  return map
}
