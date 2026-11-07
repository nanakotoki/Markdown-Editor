/**
 * ============================================================================
 *  numbering.ts —— 编号规则（预览、编辑器内联渲染、导出共用同一套算法）
 * ----------------------------------------------------------------------------
 *  · 定理类：按节编号（定义 1.1、定理 2.1）或全文连续（定义 1）
 *  · 公式类：全文连续（(1)）或按节（(1.1) / 1-1 / 1.1 三种写法）
 *  这里只做纯函数，不碰 DOM，方便 Node 端导出复用。
 * ============================================================================
 */

export type EqTagStyle = 'paren' | 'dash' | 'dot'
export type ThmNumbering = 'section' | 'global'
export type EqNumbering = 'global' | 'section'

export interface NumberingConfig {
  /** 定理：按节编号 */
  thm: ThmNumbering
  /** 公式：按节编号 */
  eq: EqNumbering
  /** 公式编号写法 */
  eqTag: EqTagStyle
}

export const DEFAULT_NUMBERING: NumberingConfig = { thm: 'section', eq: 'global', eqTag: 'paren' }

/** 定理/定义/引理等标签，如「定义 1.1」 */
export function thmLabel(cn: string, section: number, n: number, mode: ThmNumbering = 'section'): string {
  const body = mode === 'section' ? `${section}.${n}` : String(n)
  return `${cn} ${body}`
}

/** 编号本体，不含括号：1 / 1.1 / 1-1 */
export function eqNumberBody(
  section: number,
  n: number,
  mode: EqNumbering = 'global',
  style: EqTagStyle = 'paren'
): string {
  if (mode === 'global') return String(n)
  return style === 'dash' ? `${section}-${n}` : `${section}.${n}`
}

/** 公式标签完整文本：(1) / (1.1) / 1-1 / 1.1 */
export function eqTagText(
  section: number,
  n: number,
  mode: EqNumbering = 'global',
  style: EqTagStyle = 'paren'
): string {
  const body = eqNumberBody(section, n, mode, style)
  return style === 'paren' ? `(${body})` : body
}

/**
 * 哪一级标题算「节」：
 *  · 只有 0~1 个 H1 时，H1 当文档标题，H2 才是节（最常见的笔记结构）；
 *  · 有两个以上 H1 时，说明作者用 H1 分章，H1 就是节。
 */
export function sectionDepthOf(text: string): 1 | 2 {
  const h1 = (text.match(/^#\s/gm) ?? []).length
  return h1 >= 2 ? 1 : 2
}

/** 给定一段源码的第 line 行，它属于第几节（从 1 开始） */
export function sectionNumberAtLine(text: string, line: number): number {
  const depth = sectionDepthOf(text)
  const re = depth === 1 ? /^#\s/ : /^#{2}\s/
  let section = 0
  const lines = text.split('\n')
  const end = Math.min(lines.length, Math.max(0, line - 1))
  for (let i = 0; i < end; i++) {
    if (re.test(lines[i])) section++
  }
  return Math.max(1, section)
}

/** 编辑器内联渲染用：把「第几条块级公式」映射成该显示什么标签 */
export function eqTagsForText(
  text: string,
  cfg: Pick<NumberingConfig, 'eq' | 'eqTag'> = { eq: 'global', eqTag: 'paren' }
): Map<number, string> {
  const out = new Map<number, string>()
  const lines = text.split('\n')
  const perSection = new Map<number, number>()
  const depth = sectionDepthOf(text)
  const sectionRe = depth === 1 ? /^#\s/ : /^#{2}\s/
  let section = 0
  let total = 0
  let inMath = false
  for (const raw of lines) {
    if (!inMath && sectionRe.test(raw)) section++
    // `$$` 单独成行时用它判断块级公式的起止；单行 `$$…$$` 也算一条
    const fences = (raw.match(/\$\$/g) ?? []).length
    if (!inMath && fences > 0) {
      total++
      const sec = Math.max(1, section)
      const n = (perSection.get(sec) ?? 0) + 1
      perSection.set(sec, n)
      const seq = cfg.eq === 'global' ? total : n
      out.set(total, eqTagText(sec, seq, cfg.eq, cfg.eqTag))
      if (fences % 2 === 1) inMath = true
    } else if (inMath && fences % 2 === 1) {
      inMath = false
    }
  }
  return out
}

/** `::: theorem` 这类容器名对应的中文标签（渲染与内联预览共用） */
export const DIRECTIVE_CN: Record<string, string> = {
  theorem: '定理',
  lemma: '引理',
  definition: '定义',
  proposition: '命题',
  corollary: '推论',
  example: '例题',
  remark: '注',
  proof: '证明',
  algorithm: '算法',
  exercise: '习题',
  solution: '解',
}

/** 英文文档里的标签（Theorem 1.1 / Definition 1.1 …） */
export const DIRECTIVE_EN: Record<string, string> = {
  theorem: 'Theorem',
  lemma: 'Lemma',
  definition: 'Definition',
  proposition: 'Proposition',
  corollary: 'Corollary',
  example: 'Example',
  remark: 'Remark',
  proof: 'Proof',
  algorithm: 'Algorithm',
  exercise: 'Exercise',
  solution: 'Solution',
}

/**
 * 判断一段正文是不是英文写的。
 * 判据刻意宽松：没有 CJK 字符、拉丁字母够多就算英文；
 * 中文讲义里夹 the / if 这类词不会误判（CJK 占比仍高）。
 */
export function isEnglishText(raw: string): boolean {
  const text = raw.replace(/<[^>]*>/g, ' ')
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  if (cjk === 0 && latin > 0) return true
  return latin > 12 && latin > cjk * 8
}

/** 容器名 → 引用前缀（def / thm / ...），与 renderMarkdown 的 RefKind 对齐 */
export const DIRECTIVE_KIND: Record<string, string> = {
  theorem: 'thm',
  lemma: 'lem',
  definition: 'def',
  proposition: 'prop',
  corollary: 'cor',
  example: 'exa',
  remark: 'prf',
  proof: 'prf',
  algorithm: 'alg',
  exercise: 'exe',
  solution: 'sol',
}

export interface RefIndex {
  /** `thm:banach` / `eq:bound` → 显示文本，如「定理 1.1」「式 1-2」 */
  refs: Map<string, string>
  /** 容器开头那一行的字符偏移 → 「定义 1.1」 */
  containers: Map<number, string>
}

/**
 * 扫一遍源码，得到「标签 → 该显示什么」。
 * 内联预览要靠它在不跑完整渲染管线的情况下，把 \ref{} / @eq: 换成可读的编号。
 */
export function buildRefIndex(
  text: string,
  cfg: NumberingConfig = DEFAULT_NUMBERING
): RefIndex {
  const refs = new Map<string, string>()
  const containers = new Map<number, string>()
  const depth = sectionDepthOf(text)
  // 整篇是英文的话，内联预览里的标签与引用也跟着换英文，别一边 Theorem 一边「定理」
  const EN = isEnglishText(text)
  const eqPrefix = EN ? 'Eq.' : '式'
  const sectionRe = depth === 1 ? /^#\s/ : /^#{2}\s/
  const thmCounters = new Map<string, number>()
  const eqPerSection = new Map<number, number>()

  let offset = 0
  let section = 0
  let eqTotal = 0
  let inMath = false
  let mathLabel: string | null = null
  let mathSection = 1
  let mathSeq = 0

  const flushMath = () => {
    if (mathLabel) {
      refs.set(`eq:${mathLabel}`, `${eqPrefix} ${eqTagText(mathSection, mathSeq, cfg.eq, cfg.eqTag)}`)
      refs.set(mathLabel, `${eqPrefix} ${eqTagText(mathSection, mathSeq, cfg.eq, cfg.eqTag)}`)
    }
    mathLabel = null
  }

  for (const raw of text.split('\n')) {
    const lineStart = offset
    offset += raw.length + 1

    if (!inMath && sectionRe.test(raw)) {
      section++
      thmCounters.clear()
    }
    const sec = Math.max(1, section)

    // 块级公式
    const fences = (raw.match(/\$\$/g) ?? []).length
    if (!inMath && fences > 0) {
      eqTotal++
      const n = (eqPerSection.get(sec) ?? 0) + 1
      eqPerSection.set(sec, n)
      mathSection = sec
      mathSeq = cfg.eq === 'global' ? eqTotal : n
      mathLabel = null
      const lab = /\\label\s*\{([^{}]*)\}/.exec(raw)?.[1]
      if (lab) mathLabel = lab.trim()
      if (fences % 2 === 1) inMath = true
      else flushMath()
      continue
    }
    if (inMath) {
      const lab = /\\label\s*\{([^{}]*)\}/.exec(raw)?.[1]
      if (lab) mathLabel = lab.trim()
      if (fences % 2 === 1) {
        inMath = false
        flushMath()
      }
      continue
    }

    // ::: 容器
    const open = /^:::\s*([A-Za-z][\w-]*)\s*(?:\[([^\]\n]*)\])?\s*\{?#?([\w:.-]*)\}?\s*$/.exec(raw)
    if (open) {
      const name = open[1].toLowerCase()
      const cn = DIRECTIVE_CN[name]
      const kind = DIRECTIVE_KIND[name]
      if (cn && name !== 'proof' && name !== 'remark') {
        const n = (thmCounters.get(name) ?? 0) + 1
        thmCounters.set(name, n)
        const label = thmLabel(EN ? DIRECTIVE_EN[name] ?? cn : cn, sec, n, cfg.thm)
        containers.set(lineStart, label)
        const id = (open[3] || '').trim()
        if (id) {
          refs.set(id.includes(':') ? id : `${kind}:${id}`, label)
          refs.set(id.replace(/^[a-z]+:/, ''), label)
        }
      } else if (cn) {
        const label = EN ? DIRECTIVE_EN[name] ?? cn : cn
        containers.set(lineStart, label)
        const id = (open[3] || '').trim()
        if (id) refs.set(id.includes(':') ? id : `${kind}:${id}`, label)
      }
    }
  }
  return { refs, containers }
}
