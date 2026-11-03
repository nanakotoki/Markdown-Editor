import katex from 'katex'
import 'katex/contrib/mhchem'

/**
 * ============================================================================
 *  katexSafeRender.ts  —— 容错渲染引擎 + 中文友好诊断器
 * ----------------------------------------------------------------------------
 *  1) healLatex()            非破坏性语法自愈（输入态每个字符都不崩）
 *  2) renderMathSafely()     安全渲染（永远返回可用 HTML）
 *  3) diagnoseLatex()        KaTeX ParseError -> 中文提示 + 一键修复
 *  4) parseMacros()          用户 \newcommand 文本 -> KaTeX macros 字典
 * ============================================================================
 */

export const PLACEHOLDER_LATEX = '{\\color{#94a3b8}{\\square}}'

export interface HealResult {
  latex: string
  /** 自愈动作的中文描述，用于 HUD 展示 */
  applied: string[]
}

export interface Diagnosis {
  kind: string
  /** 中文一句话结论 */
  title: string
  /** 补充说明 / 正确写法示例 */
  detail: string
  /** 一键修复按钮文案 */
  fixLabel?: string
  /** 修复后的完整源码 */
  fixed?: string
}

export interface RenderResult {
  html: string
  ok: boolean
  /** 原始 KaTeX 报错信息（英文），仅调试用 */
  rawError: string | null
  healed: HealResult
  diagnosis: Diagnosis | null
}

/* ------------------------------------------------------------------ *
 *  1. 语法自愈
 * ------------------------------------------------------------------ */

const ARG_COUNT: Record<string, number> = {
  frac: 2, dfrac: 2, tfrac: 2, cfrac: 2, binom: 2, dbinom: 2, tbinom: 2,
  sqrt: 1, overline: 1, underline: 1, vec: 1, hat: 1, bar: 1, tilde: 1,
  widehat: 1, widetilde: 1, mathbf: 1, mathbb: 1, mathcal: 1, mathfrak: 1,
  mathrm: 1, mathit: 1, mathsf: 1, mathtt: 1, operatorname: 1, text: 1,
  textbf: 1, textit: 1, boxed: 1, overset: 2, underset: 2, stackrel: 2,
  color: 1, cancel: 1, not: 1, mathring: 1, overrightarrow: 1,
  overleftarrow: 1, xrightarrow: 1, xleftarrow: 1, phantom: 1, hphantom: 1,
  ensuremath: 1, mathop: 1, mathbin: 1, mathrel: 1, mathord: 1,
}

function skipWsBackward(s: string, i: number): number {
  let k = i
  while (k > 0 && /\s/.test(s[k - 1])) k--
  return k
}

/** 给定 `}` 的结束下标 end（不含），返回与之配对的 `{` 下标；失败返回 -1 */
function matchBackGroup(s: string, end: number): number {
  let depth = 0
  for (let i = end - 1; i >= 0; i--) {
    const ch = s[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function braceBalance(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') { i++; continue }
    if (ch === '{') depth++
    else if (ch === '}') depth = Math.max(0, depth - 1)
  }
  return depth
}

/** 补齐结尾处「参数不足」的命令，如 \frac{a} -> \frac{a}{□} */
function fillDanglingArgs(input: string): { latex: string; changed: boolean } {
  let s = input
  let changed = false
  for (let iter = 0; iter < 5; iter++) {
    let end = skipWsBackward(s, s.length)
    let cur = end
    let count = 0
    while (cur > 0 && s[cur - 1] === '}') {
      const start = matchBackGroup(s, cur)
      if (start < 0) break
      count++
      cur = skipWsBackward(s, start)
    }
    const head = s.slice(0, cur)
    const m = /\\([a-zA-Z]+)$/.exec(head)
    if (!m) break
    const need = ARG_COUNT[m[1]]
    if (!need || count >= need) break
    s = s + PLACEHOLDER_LATEX
    changed = true
  }
  // 结尾直接是命令（无任何参数），如 "x = \frac"
  const tailCmd = /\\([a-zA-Z]+)$/.exec(s)
  if (tailCmd && ARG_COUNT[tailCmd[1]]) {
    const need = ARG_COUNT[tailCmd[1]]
    // sqrt 允许可选参数，这里统一补必要参数
    s = s + PLACEHOLDER_LATEX.repeat(need)
    changed = true
  }
  return { latex: s, changed }
}

/** 结尾悬空的操作符 ^ _ 等 */
function fillTrailingOperator(input: string): { latex: string; changed: boolean } {
  let s = input
  let changed = false
  const tail = skipWsBackward(s, s.length)
  const ch = s[tail - 1]
  if (ch === '^' || ch === '_') {
    s = s + PLACEHOLDER_LATEX
    changed = true
  } else if (/\\left$|\\bigl?$|\\Bigl?$/.test(s.slice(0, tail))) {
    s = s + '\\right.'
    changed = true
  }
  return { latex: s, changed }
}

/** 未闭合环境补齐 \end{...} */
function healEnvironments(input: string): { latex: string; changed: boolean } {
  const stack: string[] = []
  const re = /\\(begin|end)\s*\{([a-zA-Z*]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) {
    const kind = m[1]
    const name = m[2]
    if (kind === 'begin') stack.push(name)
    else {
      const idx = stack.lastIndexOf(name)
      if (idx >= 0) stack.splice(idx, 1)
    }
  }
  if (!stack.length) return { latex: input, changed: false }
  const closing = stack.reverse().map((n) => `\\end{${n}}`).join('')
  return { latex: input + closing, changed: true }
}

/** \left 与 \right 配对 */
function healLeftRight(input: string): { latex: string; changed: boolean } {
  const left = (input.match(/\\left(?![a-zA-Z])/g) || []).length
  const right = (input.match(/\\right(?![a-zA-Z])/g) || []).length
  if (left > right) return { latex: input + '\\right.'.repeat(left - right), changed: true }
  return { latex: input, changed: false }
}

/** 一次完整自愈（幂等地跑两轮，保证环境/括号互相暴露的问题也能收敛） */
export function healLatex(latex: string): HealResult {
  const applied: string[] = []
  let s = latex.replace(/\s+$/, '')
  if (!s.trim()) return { latex: s, applied }

  for (let round = 0; round < 2; round++) {
    const before = s
    // a. 参数补齐
    const a = fillDanglingArgs(s)
    if (a.changed) { s = a.latex; pushOnce(applied, '补齐命令缺失的参数（以灰色 □ 占位）') }
    // b. 结尾悬空 {  -> 占位符
    if (/\{\s*$/.test(s)) {
      s = s.replace(/\{\s*$/, '{' + PLACEHOLDER_LATEX + '}')
      pushOnce(applied, '补全未写完的花括号内容（以灰色 □ 占位）')
    }
    // c. 悬空操作符
    const b = fillTrailingOperator(s)
    if (b.changed) { s = b.latex; pushOnce(applied, '补全上下标/定界符缺少的操作数') }
    // d. 括号闭合
    const bal = braceBalance(s)
    if (bal > 0) {
      s += '}'.repeat(bal)
      pushOnce(applied, `自动闭合 ${bal} 个未闭合的 {`)
    }
    // e. \left / \right
    const c = healLeftRight(s)
    if (c.changed) { s = c.latex; pushOnce(applied, '为未闭合的 \\left 补上 \\right.') }
    // f. 环境闭合
    const d = healEnvironments(s)
    if (d.changed) {
      s = d.latex
      pushOnce(applied, '自动闭合未结束的 \\begin{...} 环境')
    }
    if (s === before) break
  }
  return { latex: s, applied }
}

function pushOnce(arr: string[], v: string) {
  if (!arr.includes(v)) arr.push(v)
}

/* ------------------------------------------------------------------ *
 *  2. LaTeX 命令库（用于编辑距离纠错 + 自动补全 + 符号面板）
 * ------------------------------------------------------------------ */

export interface LatexCommand {
  cmd: string
  desc: string
  category: string
}

export const LATEX_COMMANDS: LatexCommand[] = [
  // 分式与结构
  { cmd: 'frac', desc: '分式', category: '结构' },
  { cmd: 'dfrac', desc: '行间大分式', category: '结构' },
  { cmd: 'tfrac', desc: '行内小分式', category: '结构' },
  { cmd: 'cfrac', desc: '连分式', category: '结构' },
  { cmd: 'sqrt', desc: '根号', category: '结构' },
  { cmd: 'sum', desc: '求和', category: '结构' },
  { cmd: 'prod', desc: '连乘', category: '结构' },
  { cmd: 'int', desc: '积分', category: '结构' },
  { cmd: 'iint', desc: '二重积分', category: '结构' },
  { cmd: 'iiint', desc: '三重积分', category: '结构' },
  { cmd: 'oint', desc: '环路积分', category: '结构' },
  { cmd: 'lim', desc: '极限', category: '结构' },
  { cmd: 'binom', desc: '组合数', category: '结构' },
  { cmd: 'begin', desc: '开始环境', category: '结构' },
  { cmd: 'end', desc: '结束环境', category: '结构' },
  { cmd: 'left', desc: '自动伸缩左定界符', category: '结构' },
  { cmd: 'right', desc: '自动伸缩右定界符', category: '结构' },
  { cmd: 'overline', desc: '上划线', category: '结构' },
  { cmd: 'underline', desc: '下划线', category: '结构' },
  { cmd: 'overbrace', desc: '上大括号', category: '结构' },
  { cmd: 'underbrace', desc: '下大括号', category: '结构' },
  { cmd: 'boxed', desc: '方框着重', category: '结构' },
  { cmd: 'overset', desc: '上方叠字', category: '结构' },
  { cmd: 'underset', desc: '下方叠字', category: '结构' },
  { cmd: 'stackrel', desc: '上方叠符号', category: '结构' },
  { cmd: 'substack', desc: '多行下标', category: '结构' },
  { cmd: 'displaystyle', desc: '强制行间样式', category: '结构' },
  { cmd: 'quad', desc: '大空格', category: '结构' },
  { cmd: 'qquad', desc: '特大空格', category: '结构' },
  { cmd: 'text', desc: '正文文字', category: '结构' },
  { cmd: 'textbf', desc: '粗体文字', category: '结构' },
  { cmd: 'mathrm', desc: '直立体', category: '结构' },
  { cmd: 'operatorname', desc: '自定义算子名', category: '结构' },
  { cmd: 'tag', desc: '公式编号', category: '结构' },
  { cmd: 'label', desc: '交叉引用标签', category: '结构' },
  { cmd: 'nonumber', desc: '取消编号', category: '结构' },
  { cmd: 'hline', desc: '表格横线', category: '结构' },
  // 希腊
  { cmd: 'alpha', desc: 'α', category: '希腊' },
  { cmd: 'beta', desc: 'β', category: '希腊' },
  { cmd: 'gamma', desc: 'γ', category: '希腊' },
  { cmd: 'Gamma', desc: 'Γ', category: '希腊' },
  { cmd: 'delta', desc: 'δ', category: '希腊' },
  { cmd: 'Delta', desc: 'Δ', category: '希腊' },
  { cmd: 'epsilon', desc: 'ε', category: '希腊' },
  { cmd: 'varepsilon', desc: 'ε 变体', category: '希腊' },
  { cmd: 'zeta', desc: 'ζ', category: '希腊' },
  { cmd: 'eta', desc: 'η', category: '希腊' },
  { cmd: 'theta', desc: 'θ', category: '希腊' },
  { cmd: 'Theta', desc: 'Θ', category: '希腊' },
  { cmd: 'iota', desc: 'ι', category: '希腊' },
  { cmd: 'kappa', desc: 'κ', category: '希腊' },
  { cmd: 'lambda', desc: 'λ', category: '希腊' },
  { cmd: 'Lambda', desc: 'Λ', category: '希腊' },
  { cmd: 'mu', desc: 'μ', category: '希腊' },
  { cmd: 'nu', desc: 'ν', category: '希腊' },
  { cmd: 'xi', desc: 'ξ', category: '希腊' },
  { cmd: 'pi', desc: 'π', category: '希腊' },
  { cmd: 'Pi', desc: 'Π', category: '希腊' },
  { cmd: 'rho', desc: 'ρ', category: '希腊' },
  { cmd: 'sigma', desc: 'σ', category: '希腊' },
  { cmd: 'Sigma', desc: 'Σ', category: '希腊' },
  { cmd: 'tau', desc: 'τ', category: '希腊' },
  { cmd: 'phi', desc: 'φ', category: '希腊' },
  { cmd: 'varphi', desc: 'φ 变体', category: '希腊' },
  { cmd: 'Phi', desc: 'Φ', category: '希腊' },
  { cmd: 'chi', desc: 'χ', category: '希腊' },
  { cmd: 'psi', desc: 'ψ', category: '希腊' },
  { cmd: 'Psi', desc: 'Ψ', category: '希腊' },
  { cmd: 'omega', desc: 'ω', category: '希腊' },
  { cmd: 'Omega', desc: 'Ω', category: '希腊' },
  // 关系与运算
  { cmd: 'to', desc: '→', category: '关系' },
  { cmd: 'rightarrow', desc: '→', category: '关系' },
  { cmd: 'leftarrow', desc: '←', category: '关系' },
  { cmd: 'Rightarrow', desc: '⇒', category: '关系' },
  { cmd: 'Leftarrow', desc: '⇐', category: '关系' },
  { cmd: 'iff', desc: '⇔', category: '关系' },
  { cmd: 'implies', desc: '⟹', category: '关系' },
  { cmd: 'mapsto', desc: '↦', category: '关系' },
  { cmd: 'le', desc: '≤', category: '关系' },
  { cmd: 'ge', desc: '≥', category: '关系' },
  { cmd: 'leq', desc: '≤', category: '关系' },
  { cmd: 'geq', desc: '≥', category: '关系' },
  { cmd: 'neq', desc: '≠', category: '关系' },
  { cmd: 'approx', desc: '≈', category: '关系' },
  { cmd: 'equiv', desc: '≡', category: '关系' },
  { cmd: 'sim', desc: '∼', category: '关系' },
  { cmd: 'propto', desc: '∝', category: '关系' },
  { cmd: 'in', desc: '∈', category: '关系' },
  { cmd: 'notin', desc: '∉', category: '关系' },
  { cmd: 'subset', desc: '⊂', category: '关系' },
  { cmd: 'subseteq', desc: '⊆', category: '关系' },
  { cmd: 'supset', desc: '⊃', category: '关系' },
  { cmd: 'cup', desc: '∪', category: '关系' },
  { cmd: 'cap', desc: '∩', category: '关系' },
  { cmd: 'emptyset', desc: '∅', category: '关系' },
  { cmd: 'varnothing', desc: '∅', category: '关系' },
  { cmd: 'forall', desc: '∀', category: '关系' },
  { cmd: 'exists', desc: '∃', category: '关系' },
  { cmd: 'neg', desc: '¬', category: '关系' },
  { cmd: 'land', desc: '∧', category: '关系' },
  { cmd: 'lor', desc: '∨', category: '关系' },
  { cmd: 'oplus', desc: '⊕', category: '关系' },
  { cmd: 'otimes', desc: '⊗', category: '关系' },
  { cmd: 'times', desc: '×', category: '关系' },
  { cmd: 'div', desc: '÷', category: '关系' },
  { cmd: 'cdot', desc: '·', category: '关系' },
  { cmd: 'pm', desc: '±', category: '关系' },
  { cmd: 'mp', desc: '∓', category: '关系' },
  { cmd: 'ast', desc: '∗', category: '关系' },
  { cmd: 'star', desc: '⋆', category: '关系' },
  { cmd: 'circ', desc: '∘', category: '关系' },
  { cmd: 'infty', desc: '∞', category: '关系' },
  { cmd: 'partial', desc: '∂', category: '关系' },
  { cmd: 'nabla', desc: '∇', category: '关系' },
  { cmd: 'cdots', desc: '⋯', category: '关系' },
  { cmd: 'ldots', desc: '…', category: '关系' },
  { cmd: 'vdots', desc: '⋮', category: '关系' },
  { cmd: 'ddots', desc: '⋱', category: '关系' },
  { cmd: 'degree', desc: '°', category: '关系' },
  { cmd: 'prime', desc: '′', category: '关系' },
  { cmd: 'ell', desc: 'ℓ', category: '关系' },
  { cmd: 'hbar', desc: 'ℏ', category: '关系' },
  // 函数
  { cmd: 'sin', desc: 'sin', category: '函数' },
  { cmd: 'cos', desc: 'cos', category: '函数' },
  { cmd: 'tan', desc: 'tan', category: '函数' },
  { cmd: 'cot', desc: 'cot', category: '函数' },
  { cmd: 'sec', desc: 'sec', category: '函数' },
  { cmd: 'csc', desc: 'csc', category: '函数' },
  { cmd: 'arcsin', desc: 'arcsin', category: '函数' },
  { cmd: 'arccos', desc: 'arccos', category: '函数' },
  { cmd: 'arctan', desc: 'arctan', category: '函数' },
  { cmd: 'sinh', desc: 'sinh', category: '函数' },
  { cmd: 'cosh', desc: 'cosh', category: '函数' },
  { cmd: 'tanh', desc: 'tanh', category: '函数' },
  { cmd: 'ln', desc: 'ln', category: '函数' },
  { cmd: 'log', desc: 'log', category: '函数' },
  { cmd: 'lg', desc: 'lg', category: '函数' },
  { cmd: 'exp', desc: 'exp', category: '函数' },
  { cmd: 'det', desc: 'det', category: '函数' },
  { cmd: 'dim', desc: 'dim', category: '函数' },
  { cmd: 'ker', desc: 'ker', category: '函数' },
  { cmd: 'deg', desc: 'deg', category: '函数' },
  { cmd: 'gcd', desc: 'gcd', category: '函数' },
  { cmd: 'max', desc: 'max', category: '函数' },
  { cmd: 'min', desc: 'min', category: '函数' },
  { cmd: 'arg', desc: 'arg', category: '函数' },
  { cmd: 'sup', desc: 'sup', category: '函数' },
  { cmd: 'inf', desc: 'inf', category: '函数' },
  // 装饰
  { cmd: 'vec', desc: '向量箭头', category: '装饰' },
  { cmd: 'hat', desc: '帽子', category: '装饰' },
  { cmd: 'bar', desc: '平均值横线', category: '装饰' },
  { cmd: 'tilde', desc: '波浪号', category: '装饰' },
  { cmd: 'dot', desc: '单点', category: '装饰' },
  { cmd: 'ddot', desc: '双点', category: '装饰' },
  // 字体
  { cmd: 'mathbb', desc: '黑板体（ℝ 等）', category: '字体' },
  { cmd: 'mathcal', desc: '花体', category: '字体' },
  { cmd: 'mathfrak', desc: '哥特体', category: '字体' },
  { cmd: 'boldsymbol', desc: '粗斜体', category: '字体' },
  { cmd: 'bm', desc: '粗体（bm 宏）', category: '字体' },
  // 环境
  { cmd: 'begin{matrix}', desc: '无括号矩阵', category: '环境' },
  { cmd: 'begin{pmatrix}', desc: '圆括号矩阵', category: '环境' },
  { cmd: 'begin{bmatrix}', desc: '方括号矩阵', category: '环境' },
  { cmd: 'begin{vmatrix}', desc: '行列式', category: '环境' },
  { cmd: 'begin{cases}', desc: '分段函数', category: '环境' },
  { cmd: 'begin{aligned}', desc: '多行对齐', category: '环境' },
  { cmd: 'begin{array}', desc: '自定义表格', category: '环境' },
  { cmd: 'begin{align}', desc: '对齐公式组', category: '环境' },
  { cmd: 'ce', desc: '化学式（mhchem）', category: '环境' },
]

export const LATEX_COMMAND_NAMES = LATEX_COMMANDS.map((c) => c.cmd.replace(/^begin\{|\}$/g, ''))

/* ------------------------------------------------------------------ *
 *  3. 编辑距离
 * ------------------------------------------------------------------ */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[n]
}

export interface CommandSuggestion {
  name: string
  desc: string
  distance: number
}

/** 在命令库中寻找最相近的命令 */
export function suggestCommand(name: string, pool: string[] = LATEX_COMMAND_NAMES): CommandSuggestion[] {
  const lower = name.toLowerCase()
  const scored: CommandSuggestion[] = []
  for (const cand of pool) {
    const d = levenshtein(lower, cand.toLowerCase())
    const meta = LATEX_COMMANDS.find((c) => c.cmd === cand || c.cmd === `begin{${cand}}`)
    scored.push({ name: cand, desc: meta?.desc ?? '', distance: d })
  }
  scored.sort((a, b) => a.distance - b.distance || a.name.length - b.name.length)
  return scored.filter((s) => s.distance <= Math.max(2, Math.ceil(name.length * 0.5))).slice(0, 3)
}

/* ------------------------------------------------------------------ *
 *  4. 中文诊断
 * ------------------------------------------------------------------ */

function wrapBrace(arg: string): string {
  const inner = arg.replace(/^\{|\}$/g, '')
  return `{${inner}}`
}

/** 把 a^b^c 这类连续上下标合并为 a^{b^c} */
const SUP_RE = /(\\?[A-Za-z0-9]|\\[a-zA-Z]+|\\})?\^(\{[^{}]*\}|\\?[A-Za-z0-9])\^(\{[^{}]*\}|\\?[A-Za-z0-9])/

export function diagnoseLatex(latex: string, rawMessage: string): Diagnosis {
  const msg = rawMessage || ''

  // --- 花括号 ---
  if (/Expected '}', got 'EOF'|Expected '}', got '\\end'/i.test(msg)) {
    const bal = braceBalance(latex)
    return {
      kind: 'unclosed-brace',
      title: '缺少右侧闭合花括号 `}`（预览已为您临时补全）',
      detail: bal > 0 ? `当前还有 ${bal} 个 \`{\` 没有闭合。` : '检查是否有花括号只写了左半边。',
      fixLabel: "一键补全 '}'",
      fixed: latex + '}'.repeat(Math.max(1, braceBalance(latex))),
    }
  }
  if (/Expected '}', got '/i.test(msg)) {
    const m = /got '(.+?)'/.exec(msg)
    return {
      kind: 'brace-mismatch',
      title: `花括号不匹配：该处应为 \`}\`，却遇到了 \`${m?.[1] ?? '?'}\``,
      detail: '常见于 `\\frac{a}{b` 或 `x^{2` 少写了右括号。',
      fixLabel: '一键补全花括号',
      fixed: healLatex(latex).latex,
    }
  }

  // --- 对齐符（KaTeX 报 Expected 'EOF', got '&'） ---
  if (/got '&'|Misplaced &|alignment tab|Unexpected alignment/i.test(msg)) {
    const inEnv = /\\begin\{(aligned|align|cases|array|matrix|pmatrix|bmatrix|vmatrix)\}/.test(latex)
    return {
      kind: 'misplaced-amp',
      title: '对齐符 `&` 只能在矩阵（matrix）或多行对齐（aligned / cases / align）环境中使用',
      detail: inEnv
        ? '当前已在环境中，请检查是不是多写了一个 `&`，或该行缺少 `\\` 换行。'
        : '普通公式里请用 `\\quad` 或 `\\;` 分隔；需要多行对齐请包进 `\\begin{aligned} ... \\end{aligned}`。',
      fixLabel: inEnv ? undefined : '包裹为 aligned 环境',
      fixed: inEnv ? undefined : `\\begin{aligned}\n${latex}\n\\end{aligned}`,
    }
  }

  // --- 未定义命令 ---
  const undef = /Undefined control sequence:?\s*\\([a-zA-Z]+)/i.exec(msg)
  if (undef) {
    const name = undef[1]
    const sugg = suggestCommand(name)
    if (sugg.length) {
      const best = sugg[0]
      return {
        kind: 'undefined-command',
        title: `未识别的命令 \`\\${name}\`，您是否想输入 \`\\${best.name}\`（${best.desc || '相近命令'}）？`,
        detail:
          sugg.length > 1
            ? `其它可能：${sugg.slice(1).map((s) => `\\${s.name}`).join('、')}。`
            : '也可能是命令拼写多/少了一个字母。',
        fixLabel: `替换为 \\${best.name}`,
        fixed: latex.replace(new RegExp(`\\\\${name}(?![a-zA-Z])`, 'g'), `\\${best.name} `),
      }
    }
    return {
      kind: 'undefined-command',
      title: `未识别的命令 \`\\${name}\``,
      detail: '请检查拼写；若这是自定义宏，请在「宏命令」抽屉中先定义它。',
    }
  }

  // --- 上下标 ---
  if (/Double superscript/i.test(msg)) {
    return {
      kind: 'double-superscript',
      title: '检测到连续上标，请用花括号包裹，例如 `x^{a^b}`',
      detail: 'LaTeX 只允许一个 `^` 作用于同一个基，多个上标需嵌套。',
      fixLabel: '自动包裹花括号',
      fixed: mergeScripts(healLatex(latex).latex, '^'),
    }
  }
  if (/Double subscript/i.test(msg)) {
    return {
      kind: 'double-subscript',
      title: '检测到连续下标，请用花括号包裹，例如 `x_{a_b}`',
      detail: '同理，多个 `_` 需要嵌套花括号。',
      fixLabel: '自动包裹花括号',
      fixed: mergeScripts(healLatex(latex).latex, '_'),
    }
  }
  if (/Expected group after '\^'|Expected group after '_'/i.test(msg)) {
    const op = msg.includes("'^'") ? '^' : '_'
    const idx = latex.lastIndexOf(op)
    return {
      kind: 'missing-group',
      title: `\`${op}\` 后面缺少内容，请补上花括号，例如 \`x${op}{2}\``,
      detail: '上下标必须紧跟一个字符或一组花括号。',
      fixLabel: `补全 ${op}{}`,
      fixed: idx >= 0 ? latex.slice(0, idx + 1) + '{}' + latex.slice(idx + 1) : latex + `${op}{}`,
    }
  }

  // --- 对齐符 ---
  if (/Misplaced &|Expected &/i.test(msg)) {
    return {
      kind: 'misplaced-amp',
      title: '对齐符 `&` 只能在矩阵（matrix）或多行对齐（aligned / cases / align）环境中使用',
      detail: '普通公式里请用 `\\quad` 或 `\\;` 分隔，需要多行对齐请用 `\\begin{aligned} ... \\end{aligned}`。',
      fixLabel: '包裹为 aligned 环境',
      fixed: `\\begin{aligned}\n${latex}\n\\end{aligned}`,
    }
  }

  // --- 定界符 ---
  if (/Missing \\right|Expected '\\right'|Expected \\right/i.test(msg)) {
    return {
      kind: 'missing-right',
      title: '`\\left` 缺少配对的 `\\right`',
      detail: '成对使用：`\\left( ... \\right)`；若只想左侧缩放，可写 `\\right.`。',
      fixLabel: '补上 \\right.',
      fixed: latex + '\\right.',
    }
  }
  if (/Extra \\right|Unexpected \\right/i.test(msg)) {
    return {
      kind: 'extra-right',
      title: '出现多余的 `\\right`',
      detail: '`\\right` 前必须有对应的 `\\left`（或删除该 `\\right`）。',
      fixLabel: '删除多余的 \\right',
      fixed: latex.replace(/\\right(?![a-zA-Z])/, ''),
    }
  }

  // --- 环境 ---
  const unknownEnv = /Unknown environment '([^']+)'|No such environment:?\s*'?([A-Za-z*]+)'?/i.exec(msg)
  if (unknownEnv) {
    const name = unknownEnv[1] || unknownEnv[2] || ''
    const envs = ['matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'aligned', 'align', 'array', 'gathered', 'split', 'smallmatrix']
    const best = envs
      .map((e) => ({ e, d: levenshtein(name.toLowerCase(), e.toLowerCase()) }))
      .sort((a, b) => a.d - b.d)[0]
    return {
      kind: 'unknown-environment',
      title: `未识别的环境 \`${name}\`${best && best.d <= 3 ? `，您是否想输入 \`${best.e}\`？` : ''}`,
      detail: `可用环境：${envs.slice(0, 8).join('、')} 等。`,
      fixLabel: best ? `替换为 ${best.e}` : undefined,
      fixed: best ? latex.replace(`\\begin{${name}}`, `\\begin{${best.e}}`).replace(`\\end{${name}}`, `\\end{${best.e}}`) : undefined,
    }
  }
  if (/Expected 'EOF', got '\\end'|Unexpected \\end/i.test(msg)) {
    return {
      kind: 'unexpected-end',
      title: '遇到了多余的 `\\end{...}`',
      detail: '检查 `\\begin` 与 `\\end` 是否成对、环境名是否一致。',
      fixLabel: '尝试自动修复',
      fixed: healLatex(latex).latex,
    }
  }

  // --- 位置/环境参数 ---
  if (/Expected '\]'|Expected '\)'|Expected '\\right\]'/i.test(msg)) {
    return {
      kind: 'delimiter',
      title: '定界符没有正确闭合',
      detail: '`\\left[` 要用 `\\right]`，`\\left(` 要用 `\\right)`。',
    }
  }
  if (/Illegal unit|Invalid size|Expected size/i.test(msg)) {
    return {
      kind: 'invalid-size',
      title: '尺寸参数不合法',
      detail: '例如 `\\rule{2em}{0.4pt}` 中的 `2em`、`\\kern1em` 需要合法单位。',
    }
  }
  if (/Unrecognized Unicode character|Unicode text character/i.test(msg)) {
    const m = /"([^"]+)"/.exec(msg)
    return {
      kind: 'unicode',
      title: `无法直接排版字符 ${m?.[1] ? `“${m[1]}”` : ''}（中文/特殊符号需包进 \\text{}）`,
      detail: '正确写法：`\\text{当且仅当}`；或在导言区配置中文支持。',
      fixLabel: '用 \\text{} 包裹',
      fixed: latex.replace(/([\u4e00-\u9fa5]+)/g, '\\text{$1}'),
    }
  }
  if (/Can't use function|Unsupported command|Invalid delimiter/i.test(msg)) {
    return {
      kind: 'unsupported',
      title: '该命令在当前上下文中不支持',
      detail: '请确认命令是否只适用于特定环境（如 `&` 只能用于对齐环境）。',
    }
  }
  if (/Unexpected end of input|Unexpected token/i.test(msg)) {
    return {
      kind: 'unexpected-eof',
      title: '公式没有写完（输入意外结束）',
      detail: '常见于只写了 `\\left(`、`\\frac{`、`\\begin{` 等开头。',
      fixLabel: '自动补全',
      fixed: healLatex(latex).latex,
    }
  }

  // --- 兜底 ---
  const pos = /at position (\d+)/.exec(msg)
  return {
    kind: 'other',
    title: '公式存在语法问题，暂时无法完整渲染',
    detail: `${msg.replace(/^KaTeX parse error:\s*/i, '').slice(0, 160)}${pos ? `（位置 ${pos[1]}）` : ''}。预览已展示可渲染的部分。`,
    fixLabel: '尝试自动修复',
    fixed: healLatex(latex).latex !== latex ? healLatex(latex).latex : undefined,
  }
}

function mergeScripts(latex: string, op: '^' | '_'): string {
  if (op === '^') {
    return latex.replace(SUP_RE, (_all, base, a, b) => `${base ?? ''}${op}{${a.replace(/^\{|\}$/g, '')}^{${b.replace(/^\{|\}$/g, '')}}}`)
  }
  const re = /(\\?[A-Za-z0-9]|\\[a-zA-Z]+)?_(\{[^{}]*\}|\\?[A-Za-z0-9])_(\{[^{}]*\}|\\?[A-Za-z0-9])/
  return latex.replace(re, (_all, base, a, b) => `${base ?? ''}${op}{${a.replace(/^\{|\}$/g, '')}_{${b.replace(/^\{|\}$/g, '')}}}`)
}

/* ------------------------------------------------------------------ *
 *  5. 宏解析 & 渲染
 * ------------------------------------------------------------------ */

export type MacroMap = Record<string, string>

export interface MacroDef {
  id: string
  name: string
  /** 参数个数（0 表示无参） */
  args: number
  body: string
  builtin?: boolean
}

/** `\newcommand{\R}{\mathbb{R}}` 或 `\R` 单行定义 */
export function parseMacroLine(line: string): MacroDef | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('%')) return null
  const re = /^\\(?:newcommand|renewcommand|def)\*?\s*\{?\\([a-zA-Z]+)\}?\s*(?:\[(\d)\])?\s*\{([\s\S]*)\}\s*$/
  const m = re.exec(trimmed)
  if (!m) return null
  return {
    id: `m_${m[1]}`,
    name: `\\${m[1]}`,
    args: m[2] ? Number(m[2]) : 0,
    body: m[3],
  }
}

export function macrosToKatex(defs: MacroDef[]): MacroMap {
  const map: MacroMap = {
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\C': '\\mathbb{C}',
    '\\E': '\\mathbb{E}',
    '\\Var': '\\mathrm{Var}',
    '\\Cov': '\\mathrm{Cov}',
    '\\argmin': '\\operatorname*{arg\\,min}',
    '\\argmax': '\\operatorname*{arg\\,max}',
    '\\dd': '\\mathrm{d}',
    '\\norm': '\\left\\|#1\\right\\|',
    '\\abs': '\\left|#1\\right|',
  }
  for (const d of defs) {
    const key = d.name.startsWith('\\') ? d.name : `\\${d.name}`
    map[key] = d.args ? `[${d.args}]${d.body}` : d.body
  }
  return map
}

export function macrosToPreamble(defs: MacroDef[]): string {
  return defs
    .map((d) => {
      const argc = d.args ? `[${d.args}]` : ''
      return `\\newcommand{${d.name}}${argc}{${d.body}}`
    })
    .join('\n')
}

export const DEFAULT_MACRO_SOURCE = `\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\N}{\\mathbb{N}}
\\newcommand{\\Z}{\\mathbb{Z}}
\\newcommand{\\C}{\\mathbb{C}}
\\newcommand{\\E}{\\mathbb{E}}
\\newcommand{\\Var}{\\mathrm{Var}}
\\newcommand{\\Cov}{\\mathrm{Cov}}
\\newcommand{\\argmin}{\\operatorname*{arg\\,min}}
\\newcommand{\\argmax}{\\operatorname*{arg\\,max}}`

/* ------------------------------------------------------------------ *
 *  6. 安全渲染
 * ------------------------------------------------------------------ */

export interface RenderOptions {
  macros?: MacroMap
  /** 附加编号，如 (3) */
  tag?: number
  /** 编号的完整文本（优先于 tag），如 (1.1) / 1-1 */
  tagLabel?: string
  /** 编号点击后跳转的锚点 id */
  tagHref?: string
  trust?: boolean
  strict?: boolean | 'ignore' | 'warn' | 'error'
}

/**
 * 公式编号独立成列。
 * KaTeX 自带的 `\tag` 是绝对定位到容器右端：公式一旦比容器宽，编号就会压住公式。
 * 这里改为「公式列 + 编号列」的网格布局，公式自身可横向滚动，编号永远可见。
 */
function wrapEquationNumber(
  html: string,
  tag?: number,
  displayMode?: boolean,
  tagLabel?: string,
  tagHref?: string
): string {
  const text = tagLabel ?? (tag == null ? '' : `(${tag})`)
  if (!text || !displayMode) return html
  const inner = tagHref
    ? `<a class="mf-eq-tag" href="#${escapeHtml(tagHref)}" title="点击定位到这条公式">${escapeHtml(text)}</a>`
    : escapeHtml(text)
  return (
    `<span class="mf-eq"><span class="mf-eq-body">${html}</span>` +
    `<span class="mf-eq-no">${inner}</span></span>`
  )
}

export function renderMathSafely(
  latex: string,
  displayMode = false,
  macros: MacroMap = {},
  opts: RenderOptions = {}
): RenderResult {
  const source = (latex ?? '').replace(/\u00a0/g, ' ')
  const healed = healLatex(source)

  if (!source.trim()) {
    return {
      html: `<span class="mf-empty-math">${displayMode ? '空公式' : ''}</span>`,
      ok: true,
      rawError: null,
      healed,
      diagnosis: null,
    }
  }

  let body = healed.latex
  // 去掉行内 \label（KaTeX 不支持），编号用 \tag 承担
  body = body.replace(/\\label\s*\{[^{}]*\}/g, '')

  const attempts: string[] = [body]

  let lastError: string | null = null
  for (const candidate of attempts) {
    try {
      const html = katex.renderToString(candidate, {
        displayMode,
        throwOnError: true,
        errorColor: '#dc2626',
        output: 'htmlAndMathml',
        macros: { ...macros },
        trust: opts.trust ?? true,
        strict: (opts.strict ?? 'ignore') as any,
      })
      return {
        html: wrapEquationNumber(html, opts.tag, displayMode, opts.tagLabel, opts.tagHref),
        ok: true,
        rawError: null,
        healed,
        diagnosis: null,
      }
    } catch (e: any) {
      lastError = e?.message ?? String(e)
    }
  }

  // 两次都失败：给出中文诊断 + 降级渲染（strict 模式关掉 throwOnError，始终有视觉反馈）
  const diagnosis = diagnoseLatex(source, lastError ?? '')
  let html = ''
  try {
    html = katex.renderToString(healed.latex.replace(/\\label\s*\{[^{}]*\}/g, ''), {
      displayMode,
      throwOnError: false,
      errorColor: '#dc2626',
      output: 'htmlAndMathml',
      macros: { ...macros },
      trust: true,
      strict: 'ignore',
    })
  } catch {
    html = `<span class="mf-math-error">${escapeHtml(source)}</span>`
  }
  return { html: wrapEquationNumber(html, opts.tag, displayMode, opts.tagLabel, opts.tagHref), ok: false, rawError: lastError, healed, diagnosis }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 仅用于 Word 粘贴：输出带命名空间的 MathML */
export function renderMathML(latex: string, displayMode = false, macros: MacroMap = {}): string | null {
  try {
    const html = katex.renderToString(latex.replace(/\\label\s*\{[^{}]*\}/g, ''), {
      displayMode,
      output: 'mathml',
      throwOnError: false,
      macros: { ...macros },
      strict: 'ignore',
    })
    return html
  } catch {
    return null
  }
}

/** 用于统计/检测：给定光标位置是否位于数学区间内 */
export interface MathRange {
  from: number
  to: number
  type: 'inline' | 'display'
  latex: string
  /** 全文编号（display 才有） */
  number?: number
  label?: string
}

const DISPLAY_RE = /\$\$([\s\S]+?)\$\$/g

/**
 * 代码区间（围栏代码块 + 行内代码）。
 * 代码里的 `$` 是字面量，不应该被当成公式定界符 ——
 * 例如文档里写「输入 `$$ ... $$`」时不能真的渲染成公式。
 */
function codeRanges(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let m: RegExpExecArray | null
  const fence = /^(```+|~~~+)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm
  while ((m = fence.exec(text))) out.push([m.index, m.index + m[0].length])
  const inline = /`[^`\n]+`/g
  while ((m = inline.exec(text))) {
    const start = m.index
    if (out.some(([a, b]) => start >= a && start < b)) continue
    out.push([start, start + m[0].length])
  }
  return out
}

function inRanges(pos: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => pos >= a && pos < b)
}

/** 从整篇文本中扫描数学区间（供编辑器插件、编号、预览共用） */
export function scanMath(text: string): MathRange[] {
  const out: MathRange[] = []
  const covered: Array<[number, number]> = []
  const code = codeRanges(text)
  let counter = 0

  DISPLAY_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DISPLAY_RE.exec(text))) {
    const start = m.index
    const end = start + m[0].length
    if (inRanges(start, code)) continue
    const label = /\\label\s*\{([^{}]*)\}/.exec(m[1])?.[1]
    counter++
    out.push({ from: start, to: end, type: 'display', latex: m[1], number: counter, label })
    covered.push([start, end])
  }

  // 行内 $...$（跳过已被 $$ 覆盖的区域，且不跨行）
  const inlineRe = /(?<![\\$])\$(?!\$)([^\n$]+?)(?<![\\$])\$(?!\$)/g
  while ((m = inlineRe.exec(text))) {
    const start = m.index
    const end = start + m[0].length
    if (inRanges(start, code)) continue
    if (covered.some(([a, b]) => start >= a && start < b)) continue
    if (text.slice(start, start + 2) === '$$') continue
    out.push({ from: start, to: end, type: 'inline', latex: m[1] })
  }
  out.sort((a, b) => a.from - b.from)
  return out
}

/** 找到包含 pos 的数学区间（含边界 ±1 容错） */
export function mathRangeAt(text: string, pos: number): MathRange | null {
  for (const r of scanMath(text)) {
    if (pos >= r.from && pos <= r.to) return r
  }
  return null
}
