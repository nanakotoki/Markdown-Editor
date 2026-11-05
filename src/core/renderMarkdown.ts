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

export type RefKind = 'eq' | 'thm' | 'lem' | 'def' | 'prop' | 'cor' | 'exa' | 'prf' | 'alg' | 'sec' | 'cite' | 'fig' | 'tab'

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
}

/**
 * 容器内容是不是英文（判据见 numbering.isEnglishText）。
 * 英文文档按 “Theorem 1.1 + 斜体正文 + Proof.” 排，中文按讲义习惯排。
 */

const REF_PREFIX_CN: Record<string, string> = {
  eq: '式', thm: '定理', lem: '引理', def: '定义', prop: '命题',
  cor: '推论', exa: '例题', alg: '算法', sec: '第', fig: '图', tab: '表',
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
  const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm).use(remarkDirective)
  const tree = processor.parse(normalizeDirectives(md))
  promoteSingleMathParagraphs(tree)
  mergeTextDirectives(tree)
  return tree
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
  }

  // 第一遍：为公式/定理/算法/标题分配编号与 id（保证交叉引用可以前向引用）
  collect(tree, ctx)
  ctx.mentionIndex = buildMentionIndex(ctx.refs)

  // 第二遍：渲染
  const body = (tree.children as any[])
    .map((n) => withLineAttr(renderBlock(n, ctx), n.position?.start?.line))
    .join('\n')
  const bibHtml = renderBibliography(ctx)
  return { html: body + bibHtml, toc: ctx.toc, refs: ctx.refs, bibUsed: ctx.citations }
}

/**
 * 给顶层块的第一个标签打上源码行号（`data-mf-line`）。
 * 预览据此实现「点哪儿跳到哪儿」与分屏滚动联动——
 * mdast 的 position 是行号，DOM 这边用它跟编辑器对齐。
 */
function withLineAttr(html: string, line?: number): string {
  if (!line) return html
  const m = /^(\s*)<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/.exec(html)
  if (!m) return html
  const [whole, lead, tag, attrs, selfClose] = m
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
  const walk = (node: any) => {
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
      ctx.headings.push({ id, level: node.depth, text })
      ctx.toc.push({ id, level: node.depth, text, index: ctx.headingCounter })
      ctx.refs.push({ kind: 'sec', id, anchor: id, label: text, detail: `第 ${ctx.headingCounter} 个标题 · H${node.depth}` })
      return
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

    if (node.children) for (const c of node.children) walk(c)
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
      return `<${tag} id="${id}" class="mf-heading mf-h${node.depth}">${renderInline(children, ctx)}</${tag}>`
    }
    case 'paragraph':
      if (PAGEBREAK_TEXT_RE.test(textOf(node))) return pageBreakHtml()
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
      return node.value ?? ''

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
  const q = `<span class="mf-qed" aria-hidden="true">${escapeHtml(symbol)}</span>`
  if (/<\/p>\s*$/.test(html)) return html.replace(/<\/p>\s*$/, `${q}</p>`)
  return `${html}${q}`
}

function renderContainer(node: any, ctx: Ctx): string {
  const name: string = node.name
  if (name === 'pagebreak' || name === 'newpage' || name === 'clearpage') return pageBreakHtml()
  const meta = THM_TYPES[name]
  const id: string | undefined = node.attributes?.id
  const { title, children } = directiveTitle(node)
  const inner = renderChildren(children, ctx)

  if (!meta) {
    return `<div class="mf-box mf-box-generic">${title ? `<div class="mf-box-title">${escapeHtml(title)}</div>` : ''}${inner}</div>`
  }

  // 英文文档：标签用 Theorem / Lemma…，正文斜体，证明用 Proof. + 正体
  const en = isEnglishText(`${title ?? ''} ${inner}`)
  const langClass = en ? ' mf-thm-en' : ''

  if (meta.env === 'proof') {
    if (id) {
      const m = ctx.thmMeta.get(id)
      if (m) m.previewHtml = inner
    }
    return `<div class="mf-thm mf-proof${langClass}"${id ? ` id="${anchorOf(id)}"` : ''}>
      <div class="mf-thm-body"><span class="mf-proof-q">${en ? 'Proof.' : '证'}</span>${
        title
          ? `<span class="mf-proof-title">${en ? ` (${escapeHtml(title)})` : `（${escapeHtml(title)}）`}</span>`
          : ''
      }${appendQed(inner, ctx.qed)}</div>
    </div>`
  }

  if (meta.env === 'remark') {
    if (id) {
      const m = ctx.thmMeta.get(id)
      if (m) m.previewHtml = inner
    }
    return `<div class="mf-thm mf-thm-remark${langClass}"${id ? ` id="${anchorOf(id)}"` : ''}>
      <div class="mf-thm-body"><span class="mf-thm-inline-label">${en ? meta.en : meta.cn}</span>${inner}</div>
    </div>`
  }

  const n = node.data?.mfThmNo ?? 1
  const section = node.data?.mfThmSection ?? 1
  const labelText = thmLabel(en ? meta.en : meta.cn, section, n, ctx.numbering.thm)
  if (id) {
    const m = ctx.thmMeta.get(id)
    if (m) m.previewHtml = inner
  }
  return `<div class="mf-thm mf-thm-${meta.env}${langClass}"${id ? ` id="${anchorOf(id)}"` : ''}>
    <div class="mf-thm-head"><span class="mf-thm-label">${escapeHtml(labelText)}</span>${
      title
        ? `<span class="mf-thm-title">${en ? ` (${escapeHtml(title)})` : `（${escapeHtml(title)}）`}</span>`
        : ''
    }</div>
    <div class="mf-thm-body">${inner}</div>
  </div>`
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
      return `<img class="mf-img" src="${escapeHtml(node.url ?? '')}" alt="${escapeHtml(node.alt ?? '')}" />`
    case 'break':
      return '<br />'
    case 'html':
      return node.value ?? ''
    case 'footnoteReference':
      return ''
    default:
      if (node.children) return renderInline(node.children, ctx)
      return escapeHtml(node.value ?? '')
  }
}

const CITE_SRC = /\[@([A-Za-z0-9_\-:.]+(?:\s*[;,]\s*@?[A-Za-z0-9_\-:.]+)*)\]/.source
const REF_SRC = /@(eq|thm|lem|def|prop|cor|exa|prf|alg|sec|fig|tab):([A-Za-z0-9_\-:.]+)/.source
/** LaTeX 风格的 \ref{eq:x} / \eqref{eq:x} */
const TEXREF_SRC = /\\(?:eq|c|auto|page)?ref\*?\{([^{}]+)\}/.source
/** 正文里直接说「由定理 1.1」「见式 (2)」——能对上编号就自动变成链接 */
const MENTION_SRC = /(定理|引理|定义|命题|推论|例题|注|算法|式|公式)[ \t]*[（(]?[ \t]*(\d+(?:[.\-–]\d+)*)[ \t]*[）)]?/.source

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
    html += escapeHtml(text.slice(last, m.index))
    if (m[1] !== undefined) {
      html += renderCitation(m[1], ctx)
    } else if (m[2] !== undefined) {
      html += renderRef(m[2], m[3], ctx)
    } else if (m[4] !== undefined) {
      html += renderTexRef(m[4], raw, ctx)
    } else if (m[5] !== undefined) {
      html += renderMention(raw, ctx)
    }
    last = m.index + raw.length
  }
  html += escapeHtml(text.slice(last))
  return html
}

/** `\ref{eq:x}`：和 @eq:x 等价，但允许直接写 LaTeX 习惯的写法 */
function renderTexRef(id: string, raw: string, ctx: Ctx): string {
  const bare = bareId(id)
  const entry =
    ctx.refs.find((r) => r.id === bare && (!id.includes(':') || id.startsWith(`${r.kind}:`))) ??
    ctx.refs.find((r) => r.id === bare)
  if (entry) return refLink(entry, entry.label, 'mf-ref-tex')
  return `<span class="mf-ref-broken" title="未找到引用目标 ${escapeHtml(raw)}">${escapeHtml(raw)}?</span>`
}

/** 正文里的「定理 1.1」：编号能对上就加链接，对不上就原样保留 */
function renderMention(raw: string, ctx: Ctx): string {
  const core = raw.replace(/[\s\u00a0]+$/, '')
  const tail = raw.slice(core.length)
  const entry = ctx.mentionIndex.get(normMention(core))
  if (!entry) return escapeHtml(raw)
  return refLink(entry, core, 'mf-ref-auto') + escapeHtml(tail)
}

function renderRef(kind: string, id: string, ctx: Ctx): string {
  const bare = bareId(id)
  const entry =
    ctx.refs.find((r) => r.id === bare && r.kind === kind) ??
    // 前缀写错（例如把 def 写成 thm）时，只要 id 唯一仍然给链接，避免变成红字
    ctx.refs.find((r) => r.id === bare)
  if (entry) {
    return refLink(entry, entry.label)
  }

  // 当前文件里没有目标 —— 看看是不是工作区里别的文件定义的
  const ext = ctx.extRefs.find((r) => r.id === bare && r.kind === kind) ?? ctx.extRefs.find((r) => r.id === bare)
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

function renderBibliography(ctx: Ctx): string {
  if (!ctx.citations.length) return ''
  const items = ctx.citations.map((key, i) => {
    const e = ctx.bib.find((b) => b.key === key)
    if (!e) {
      return `<li id="ref-${slug(key)}" class="mf-bib-item"><span class="mf-bib-index">[${i + 1}]</span><span class="mf-bib-missing">未找到文献条目 <code>${escapeHtml(key)}</code>，请在「参考文献」面板中补充。</span></li>`
    }
    const src = e.journal ? `${e.journal}` : ''
    return `<li id="ref-${slug(key)}" class="mf-bib-item"><span class="mf-bib-index">[${i + 1}]</span><span class="mf-bib-author">${escapeHtml(e.author)}</span>. <span class="mf-bib-title">${escapeHtml(e.title)}</span>. <span class="mf-bib-src">${escapeHtml(src)}</span>, ${escapeHtml(e.year)}.</li>`
  })
  return `<section class="mf-bib"><h2 class="mf-heading mf-h2">参考文献</h2><ol class="mf-bib-list">${items.join('')}</ol></section>`
}

/** 把预览内的引用预览数据汇总（供 AcademicPreview 悬停卡片使用） */
export function buildPreviewMap(res: RenderResult): Record<string, { title: string; detail: string; html: string }> {
  const map: Record<string, { title: string; detail: string; html: string }> = {}
  for (const r of res.refs) {
    map[`${r.kind}:${r.id}`] = { title: r.label, detail: r.detail ?? '', html: r.previewHtml ?? '' }
  }
  return map
}
