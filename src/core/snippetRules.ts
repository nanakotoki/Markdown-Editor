/**
 * ============================================================================
 *  snippetRules.ts —— 肌肉记忆级「无感 LaTeX」输入规则
 * ----------------------------------------------------------------------------
 *  规则分为两类触发器：
 *   · immediate —— 输入到最后一个字符时立刻展开（如 `//`、`;a`、`->`）
 *   · space     —— 输入空格 / Tab 时展开（如 `sum`、`pmat`）
 *  insert 字符串中 $1..$9 为占位符，$0 为最终光标落点。
 * ============================================================================
 */

export type SnippetTrigger = 'immediate' | 'space'

export interface SnippetRule {
  id: string
  trigger: SnippetTrigger
  /** 必须以 $ 结尾（对光标前的文本做尾部匹配） */
  re: RegExp
  insert: string
}

const word = (w: string) => new RegExp(`(?<!\\\\)${w}$`)

export const SNIPPET_RULES: SnippetRule[] = [
  /* ---------------- 智能分式 ---------------- */
  { id: '//', trigger: 'immediate', re: /\/\/$/, insert: '\\frac{$1}{$2}$0' },
  { id: 'sr', trigger: 'immediate', re: word('sr'), insert: '^2' },
  { id: 'cb', trigger: 'immediate', re: word('cb'), insert: '^3' },
  { id: 'inv', trigger: 'immediate', re: word('inv'), insert: '^{-1}' },
  { id: 'tp', trigger: 'immediate', re: word('tp'), insert: '^{\\top}' },
  { id: 'pw', trigger: 'immediate', re: word('pw'), insert: '^{$1}$0' },
  { id: '__', trigger: 'immediate', re: /(?<!\\)_$/, insert: '_{$1}$0' },
  { id: 'sq', trigger: 'immediate', re: word('sq'), insert: '\\sqrt{$1}$0' },
  { id: 'nsq', trigger: 'immediate', re: word('nsq'), insert: '\\sqrt[$1]{$2}$0' },

  /* ---------------- 微积分 / 极限 / 求和 ---------------- */
  { id: 'sum', trigger: 'space', re: word('sum'), insert: '\\sum_{i=$1}^{$2} $0' },
  { id: 'prod', trigger: 'space', re: word('prod'), insert: '\\prod_{i=$1}^{$2} $0' },
  { id: 'int', trigger: 'space', re: word('int'), insert: '\\int_{$1}^{$2} $0' },
  { id: 'iint', trigger: 'space', re: word('iint'), insert: '\\iint_{$1} $0' },
  { id: 'oint', trigger: 'space', re: word('oint'), insert: '\\oint_{$1} $0' },
  { id: 'lim', trigger: 'space', re: word('lim'), insert: '\\lim_{$1 \\to $2} $0' },
  { id: 'part', trigger: 'space', re: word('part'), insert: '\\frac{\\partial $1}{\\partial $2}$0' },
  { id: 'ddx', trigger: 'space', re: word('ddx'), insert: '\\frac{\\mathrm{d}$1}{\\mathrm{d}x}$0' },

  /* ---------------- 线性代数 / 装饰 ---------------- */
  { id: 'vec', trigger: 'space', re: word('vec'), insert: '\\vec{$1}$0' },
  { id: 'hat', trigger: 'space', re: word('hat'), insert: '\\hat{$1}$0' },
  { id: 'bar', trigger: 'space', re: word('bar'), insert: '\\overline{$1}$0' },
  { id: 'til', trigger: 'space', re: word('til'), insert: '\\tilde{$1}$0' },
  { id: 'norm', trigger: 'space', re: word('norm'), insert: '\\left\\| $1 \\right\\|$0' },
  { id: 'abs', trigger: 'space', re: word('abs'), insert: '\\left| $1 \\right|$0' },
  { id: 'inner', trigger: 'space', re: word('inner'), insert: '\\langle $1, $2 \\rangle$0' },
  { id: 'pmat', trigger: 'space', re: word('pmat'), insert: '\\begin{pmatrix} $1 & $2 \\\\ $3 & $4 \\end{pmatrix}$0' },
  { id: 'bmat', trigger: 'space', re: word('bmat'), insert: '\\begin{bmatrix} $1 & $2 \\\\ $3 & $4 \\end{bmatrix}$0' },
  { id: 'vmat', trigger: 'space', re: word('vmat'), insert: '\\begin{vmatrix} $1 & $2 \\\\ $3 & $4 \\end{vmatrix}$0' },
  { id: 'cases', trigger: 'space', re: word('cases'), insert: '\\begin{cases} $1, & $2 \\\\ $3, & $4 \\end{cases}$0' },

  /* ---------------- 集合 / 逻辑 / 关系 ---------------- */
  { id: '->', trigger: 'immediate', re: /->$/, insert: '\\to ' },
  { id: '=>', trigger: 'immediate', re: /=>$/, insert: '\\implies ' },
  { id: '<=>', trigger: 'immediate', re: /<=>$/, insert: '\\iff ' },
  { id: '|->', trigger: 'immediate', re: /\|->$/, insert: '\\mapsto ' },
  { id: '<=', trigger: 'immediate', re: /<=$/, insert: '\\le ' },
  { id: '>=', trigger: 'immediate', re: />=$/, insert: '\\ge ' },
  { id: '!=', trigger: 'immediate', re: /!=$/, insert: '\\neq ' },
  { id: '~=', trigger: 'immediate', re: /~=$/, insert: '\\approx ' },
  { id: '===', trigger: 'immediate', re: /===$/, insert: '\\equiv ' },
  { id: '...', trigger: 'immediate', re: /\.\.\.$/, insert: '\\cdots ' },
  { id: '..', trigger: 'immediate', re: /(?<!\.)\.\.$/, insert: '\\cdot ' },
  { id: 'inn', trigger: 'space', re: word('inn'), insert: '\\in ' },
  { id: 'nin', trigger: 'space', re: word('nin'), insert: '\\notin ' },
  { id: 'sub', trigger: 'space', re: word('sub'), insert: '\\subset ' },
  { id: 'sube', trigger: 'space', re: word('sube'), insert: '\\subseteq ' },
  { id: 'xx', trigger: 'immediate', re: word('xx'), insert: '\\times ' },
  { id: 'inf', trigger: 'space', re: word('inf'), insert: '\\infty ' },
  { id: 'AA', trigger: 'immediate', re: word('AA'), insert: '\\forall ' },
  { id: 'EE', trigger: 'immediate', re: word('EE'), insert: '\\exists ' },
  { id: 'RR', trigger: 'immediate', re: word('RR'), insert: '\\mathbb{R}' },
  { id: 'ZZ', trigger: 'immediate', re: word('ZZ'), insert: '\\mathbb{Z}' },
  { id: 'NN', trigger: 'immediate', re: word('NN'), insert: '\\mathbb{N}' },
  { id: 'CC', trigger: 'immediate', re: word('CC'), insert: '\\mathbb{C}' },

  /* ---------------- 自动下标：x1 -> x_{1} ---------------- */
  { id: 'auto-sub', trigger: 'immediate', re: /(?<![\\_^A-Za-z])([A-Za-z])(\d)$/, insert: '$1_{$2}$0' },
]

/* ---------------- 分号前缀希腊字母 ---------------- */
export const GREEK_MAP: Record<string, string> = {
  a: '\\alpha', b: '\\beta', g: '\\gamma', G: '\\Gamma', d: '\\delta', D: '\\Delta',
  e: '\\epsilon', z: '\\zeta', t: '\\theta', T: '\\Theta', i: '\\iota', k: '\\kappa',
  l: '\\lambda', L: '\\Lambda', m: '\\mu', n: '\\nabla', x: '\\xi', p: '\\pi', P: '\\Pi',
  r: '\\rho', s: '\\sigma', S: '\\Sigma', u: '\\upsilon', f: '\\phi', F: '\\Phi',
  w: '\\omega', W: '\\Omega', v: '\\varphi', q: '\\psi', Q: '\\Psi',
}

export interface Expansion {
  /** 需要替换的字符数（从光标往前数） */
  length: number
  /** 替换后的文本 */
  insert: string
  /** 占位符在 insert 中的偏移（Tab 顺序），含 $0 终点 */
  stops: number[]
  /** 规则名，用于状态提示 */
  id: string
}

function buildInsert(template: string, groups: string[]): { text: string; stops: number[] } {
  let text = ''
  const stops: number[] = []
  for (let i = 0; i < template.length; i++) {
    const ch = template[i]
    if (ch === '$' && /\d/.test(template[i + 1] ?? '')) {
      const idx = Number(template[i + 1])
      if (idx === 0) {
        stops.push(text.length)
        i++
        continue
      }
      const g = groups[idx - 1] ?? ''
      if (!stops.includes(text.length) || idx > 0) stops.push(text.length)
      text += g
      i++
      continue
    }
    text += ch
  }
  if (!stops.length) stops.push(text.length)
  return { text, stops }
}

/**
 * 在「光标前文本」的尾部匹配规则并生成展开结果。
 * @param before 光标前最多 60 个字符
 * @param mode   触发模式
 */
export function expandSnippet(before: string, mode: SnippetTrigger): Expansion | null {
  // 希腊字母优先
  const gk = /;([a-zA-Z])$/.exec(before)
  if (gk && GREEK_MAP[gk[1]]) {
    return { length: 2, insert: GREEK_MAP[gk[1]] + ' ', stops: [GREEK_MAP[gk[1]].length + 1], id: `;${gk[1]}` }
  }

  for (const rule of SNIPPET_RULES) {
    if (rule.trigger !== mode) continue
    const m = rule.re.exec(before)
    if (!m) continue
    const groups = Array.from(m).slice(1).filter((g) => g !== undefined) as string[]
    const built = buildInsert(rule.insert, groups)
    if (built.text === m[0]) continue
    return { length: m[0].length, insert: built.text, stops: built.stops, id: rule.id }
  }
  return null
}

/** 单斜杠 + 空格：`(a+b)/ ` -> `\frac{a+b}{□}` */
export function expandFractionWrap(before: string): Expansion | null {
  const m = /([0-9A-Za-z\)\]\}]+)\/\s?$/.exec(before)
  if (!m) return null
  let expr = m[1]
  // 去掉包裹的外层圆括号："(a+b)" -> "a+b"
  if (expr.startsWith('(') && expr.endsWith(')')) {
    let depth = 0
    let ok = true
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++
      else if (expr[i] === ')') {
        depth--
        if (depth === 0 && i !== expr.length - 1) { ok = false; break }
      }
    }
    if (ok) expr = expr.slice(1, -1)
  }
  const insert = `\\frac{${expr}}{$1}$0`
  const built = buildInsert(insert, [])
  return { length: m[0].length, insert: built.text, stops: built.stops, id: 'fraction-wrap' }
}

export const SNIPPET_CHEATSHEET: Array<{ group: string; items: Array<[string, string]> }> = [
  {
    group: '分式与结构',
    items: [
      ['//', '\\frac{□}{□}'],
      ['(a+b)/ 空格', '\\frac{a+b}{□}'],
      ['pw', '^{□}'],
      ['__', '_{□}'],
      ['sq / nsq', '\\sqrt{□} / \\sqrt[n]{□}'],
      ['sr / cb / inv / tp', '^2 / ^3 / ^{-1} / ^{\\top}'],
      ['pmat / bmat / vmat', '2×2 矩阵骨架'],
      ['cases', '分段函数骨架'],
    ],
  },
  {
    group: '微积分',
    items: [
      ['sum / prod', '\\sum_{i=□}^{□}'],
      ['int / iint / oint', '\\int_{□}^{□}'],
      ['lim', '\\lim_{□ \\to □}'],
      ['part / ddx', '偏导 / 全导'],
    ],
  },
  {
    group: '符号',
    items: [
      ['-> => <=> |->', '→ ⟹ ⇔ ↦'],
      ['<= >= != ~= ===', '≤ ≥ ≠ ≈ ≡'],
      ['xx .. ... inf', '× · ⋯ ∞'],
      ['inn nin sub sube', '∈ ∉ ⊂ ⊆'],
      ['AA EE RR ZZ NN CC', '∀ ∃ ℝ ℤ ℕ ℂ'],
      [';a ;b ;g ;t ;l ...', '希腊字母'],
    ],
  },
]
