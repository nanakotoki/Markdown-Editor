import { det, inv, matrix, trace, transpose, format, compile, parse } from 'mathjs'
import { latexToExpression, splitCurveSources, freeVariables } from './plotParser'

/**
 * ============================================================================
 *  mathEvaluator.ts —— 公式微计算引擎
 * ----------------------------------------------------------------------------
 *  1) LaTeX 矩阵解析 -> 数值矩阵，支持 det / inv / tr / rank / transpose
 *  2) 单变量函数表达式 -> 采样点（供 Canvas 绘图与极值点标注）
 *  3) 命题逻辑表达式 -> 真值表（递归下降解析，支持 2^n 全枚举）
 * ============================================================================
 */

/* ------------------------------------------------------------------ *
 *  1. 矩阵
 * ------------------------------------------------------------------ */

const MATRIX_ENVS = ['matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'array']

/** 从 LaTeX 中提取矩阵数值；非矩阵返回 null */
export function parseMatrixLatex(latex: string): number[][] | null {
  const trimmed = latex.trim().replace(/\\left|\\right/g, '')
  // 情况 A：\begin{...} ... \end{...}
  const env = /\\begin\{([a-zA-Z*]+)\}([\s\S]*?)\\end\{\1\}/.exec(trimmed)
  if (env && MATRIX_ENVS.includes(env[1]) && !env[1].includes('array')) {
    const body = env[2].replace(/&/g, ' & ')
    const rows = body
      .split(/\\\\/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
    const grid: number[][] = []
    for (const row of rows) {
      const cells = row.split('&').map((c) => c.trim())
      const parsed = cells.map(latexCellToNumber)
      if (parsed.some((v) => v === null)) return null
      grid.push(parsed as number[])
    }
    if (!grid.length) return null
    const width = grid[0].length
    if (grid.some((r) => r.length !== width)) return null
    return grid
  }
  // 情况 B：[[1,2],[3,4]] 或 "1 2; 3 4"
  const arr = /^\s*\[\s*\[/.test(trimmed) ? parseJsArray(trimmed) : null
  if (arr) return arr
  if (/^[\d\s.,;+\-*/()]+$/.test(trimmed) && /;/.test(trimmed)) {
    const grid = trimmed
      .split(';')
      .map((r) => r.split(/[,\s]+/).filter(Boolean).map(Number))
    if (grid.every((r) => r.length === grid[0].length && r.every((n) => Number.isFinite(n)))) return grid
  }
  return null
}

function parseJsArray(s: string): number[][] | null {
  try {
    const v = JSON.parse(s.replace(/'/g, '"'))
    if (Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((n: any) => typeof n === 'number'))) {
      const width = v[0].length
      if (v.every((r: number[]) => r.length === width)) return v as number[][]
    }
  } catch {
    return null
  }
  return null
}

/** 单个单元格：支持 1/2、\frac{1}{2}、-3.5、\pi 等 */
export function latexCellToNumber(cell: string): number | null {
  let s = cell.trim()
  if (!s) return 0
  s = s.replace(/\\dfrac|\\tfrac|\\frac/g, '\\frac')
  // \frac{a}{b}
  const frac = /^\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}$/.exec(s)
  if (frac) {
    const a = latexCellToNumber(frac[1])
    const b = latexCellToNumber(frac[2])
    if (a === null || b === null || b === 0) return null
    return a / b
  }
  s = s
    .replace(/\\pi/g, String(Math.PI))
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, x) => String(Math.sqrt(Number(x))))
    .replace(/\\cdot|\\times/g, '*')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
  if (!/^[-+*/()\d.eE]+$/.test(s)) return null
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${s})`)()
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

export function numberToLatex(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return '\\text{undefined}'
  if (Math.abs(n) < 1e-12) return '0'
  const rounded = Number(n.toFixed(digits))
  const abs = Math.abs(rounded)
  if (abs >= 1e6 || abs < 1e-4) {
    const exp = rounded.toExponential(3)
    const [m, e] = exp.split('e')
    return `${m}\\times 10^{${Number(e)}}`
  }
  return String(rounded)
}

export function matrixToLatex(m: number[][]): string {
  const body = m.map((row) => row.map((v) => numberToLatex(v)).join(' & ')).join(' \\\\ ')
  return `\\begin{pmatrix}${body}\\end{pmatrix}`
}

export interface MatrixAnalysis {
  ok: boolean
  error?: string
  rows: number
  cols: number
  square: boolean
  det?: number
  detLatex?: string
  trace?: number
  rank?: number
  inverseLatex?: string
  transposeLatex?: string
  /** 结论行，直接追加到公式末尾 */
  appendLatex?: string
}

export function analyzeMatrix(latex: string): MatrixAnalysis {
  const grid = parseMatrixLatex(latex)
  if (!grid) {
    return { ok: false, error: '未能从当前公式中解析出数值矩阵（请确认单元格均为数字）', rows: 0, cols: 0, square: false }
  }
  const rows = grid.length
  const cols = grid[0].length
  const square = rows === cols
  const result: MatrixAnalysis = { ok: true, rows, cols, square, rank: matrixRank(grid) }

  try {
    result.transposeLatex = matrixToLatex(transpose(matrix(grid)) as unknown as number[][])
  } catch (e: any) {
    result.error = e?.message
  }

  if (square) {
    try {
      const d = Number(det(matrix(grid)))
      result.det = d
      result.detLatex = numberToLatex(d)
      result.trace = Number(trace(matrix(grid)))
    } catch (e: any) {
      result.error = e?.message
    }
    try {
      if (Math.abs(result.det ?? 0) > 1e-12) {
        const invM = inv(matrix(grid)) as any
        const arr = (invM.toArray ? invM.toArray() : invM) as number[][]
        result.inverseLatex = matrixToLatex(arr)
      }
    } catch {
      /* 奇异矩阵忽略 */
    }
  }
  return result
}

/** 高斯消元求秩（带部分主元） */
export function matrixRank(input: number[][]): number {
  const a = input.map((r) => r.slice())
  const rows = a.length
  const cols = a[0]?.length ?? 0
  let rank = 0
  for (let col = 0; col < cols && rank < rows; col++) {
    let pivot = rank
    for (let r = rank; r < rows; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    }
    if (Math.abs(a[pivot][col]) < 1e-10) continue
    const tmp = a[rank]
    a[rank] = a[pivot]
    a[pivot] = tmp
    for (let r = rank + 1; r < rows; r++) {
      const f = a[r][col] / a[rank][col]
      for (let c = col; c < cols; c++) a[r][c] -= f * a[rank][c]
    }
    rank++
  }
  return rank
}

/* ------------------------------------------------------------------ *
 *  2. 函数表达式 -> 采样点
 * ------------------------------------------------------------------ */

export interface PlotSample {
  x: number
  y: number
}

export interface FunctionPlotResult {
  ok: boolean
  error?: string
  /** 用于显示的标准化表达式 */
  expr: string
  points: PlotSample[]
  extrema: Array<{ x: number; y: number; kind: 'max' | 'min' }>
  yRange: [number, number]
}

/**
 * LaTeX 公式 → mathjs 可解析的表达式。
 * 具体实现搬到 plotParser.ts（递归下降，支持 \frac / \sqrt[n] / \sin^2 x / \log_a 等），
 * 这里保留同名导出，老的调用点不用改。
 */
export { latexToExpression, splitCurveSources } from './plotParser'

/** 采样一组曲线时的结果（一条曲线一个颜色） */
export interface PlotCurve {
  /** 原始输入（LaTeX） */
  source: string
  /** 转换后的表达式，界面上可以核对 */
  expr: string
  points: PlotSample[]
  extrema: Array<{ x: number; y: number; kind: 'max' | 'min' }>
  yRange: [number, number]
  color: string
}

export interface MultiPlotResult {
  ok: boolean
  error?: string
  curves: PlotCurve[]
  /** 部分曲线失败的提示，成功画出的照常显示 */
  notes: string[]
}

const CURVE_COLORS = ['#2a55d4', '#dc2626', '#059669', '#c2410c', '#7c3aed', '#0891b2', '#be185d', '#0f766e']

export function curveColor(i: number): string {
  return CURVE_COLORS[i % CURVE_COLORS.length]
}

function sampleOne(
  latex: string,
  xMin: number,
  xMax: number,
  samples: number
): { ok: boolean; error?: string; expr: string; points: PlotSample[]; extrema: Array<{ x: number; y: number; kind: 'max' | 'min' }>; yRange: [number, number] } {
  const expr = latexToExpression(latex)
  let code: any
  try {
    code = compile(expr)
  } catch (e: any) {
    return {
      ok: false,
      error: `无法解析为函数表达式：${e?.message ?? ''}`,
      expr,
      points: [],
      extrema: [],
      yRange: [-1, 1],
    }
  }
  const points: PlotSample[] = []
  let yMin = Infinity
  let yMax = -Infinity
  let found = false
  const step = (xMax - xMin) / Math.max(1, samples - 1)
  for (let i = 0; i < samples; i++) {
    const x = xMin + i * step
    let y: number
    try {
      y = Number(code.evaluate({ x, e: Math.E, pi: Math.PI, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 }))
    } catch {
      continue
    }
    if (!Number.isFinite(y)) continue
    found = true
    points.push({ x, y })
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  if (!found) {
    // 常见原因其实是「写了 x 以外的字母」，单独给一个说得清的提示
    const fv = freeVariables(expr).filter((v) => v !== 'x')
    return {
      ok: false,
      error: fv.length
        ? `表达式里的 ${fv.join('、')} 没法求值，作图只认自变量 x`
        : '在指定定义域内没有取得有效函数值（可能在定义域外，或存在奇点）',
      expr,
      points: [],
      extrema: [],
      yRange: [-1, 1],
    }
  }
  // 极值点：相邻差分变号
  const extrema: Array<{ x: number; y: number; kind: 'max' | 'min' }> = []
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1].y
    const b = points[i].y
    const c = points[i + 1].y
    if (b > a && b > c) extrema.push({ x: points[i].x, y: b, kind: 'max' })
    else if (b < a && b < c) extrema.push({ x: points[i].x, y: b, kind: 'min' })
  }
  // 去重（相邻两个采样都判定为极值时保留极值最大/最小者）
  const merged: typeof extrema = []
  for (const e of extrema) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.x - e.x) < step * 1.5) {
      if (e.kind === 'max' ? e.y > last.y : e.y < last.y) merged[merged.length - 1] = e
    } else merged.push(e)
  }
  return { ok: true, expr, points, extrema: merged.slice(0, 40), yRange: [yMin, yMax] }
}

/** 单条曲线（旧接口，内部仍被导出 / 打印等地方使用） */
export function sampleFunction(latex: string, xMin: number, xMax: number, samples = 800): FunctionPlotResult {
  const r = sampleOne(latex, xMin, xMax, samples)
  return { ok: r.ok, error: r.error, expr: r.expr, points: r.points, extrema: r.extrema, yRange: r.yRange }
}

/**
 * 多条曲线：用分号分隔，一次画完。
 * 单条失败不影响其它几条，失败原因放在 notes 里。
 */
export function sampleFunctions(source: string, xMin: number, xMax: number, samples = 900): MultiPlotResult {
  const sources = splitCurveSources(source)
  if (!sources.length) {
    return { ok: false, error: '先写一个函数表达式，例如 \\sin(x) 或 x^2-2', curves: [], notes: [] }
  }
  const curves: PlotCurve[] = []
  const notes: string[] = []
  sources.forEach((src, idx) => {
    const r = sampleOne(src, xMin, xMax, samples)
    if (!r.ok) {
      notes.push(`「${src}」没有画出来：${r.error ?? '未知原因'}`)
      return
    }
    curves.push({ ...r, source: src, color: curveColor(idx) })
  })
  if (!curves.length) {
    return { ok: false, error: notes[0] ?? '没有可以绘制的曲线', curves: [], notes }
  }
  return { ok: true, curves, notes }
}

/* ------------------------------------------------------------------ *
 *  3. 真值表
 * ------------------------------------------------------------------ */

export interface TruthTableResult {
  ok: boolean
  error?: string
  variables: string[]
  /** 每一行：变量取值 + 结果 */
  rows: Array<{ values: boolean[]; result: boolean }>
  /** 标准化后的公式显示（LaTeX） */
  displayLatex: string
  tautology: boolean
  contradiction: boolean
}

type Token =
  | { t: 'var'; v: string }
  | { t: 'const'; v: boolean }
  | { t: 'op'; v: 'AND' | 'OR' | 'XOR' | 'NOT' | 'IMP' | 'IFF' }
  | { t: 'lp' }
  | { t: 'rp' }

/** 把各种输入写法归一化为记号 */
export function normalizeLogicInput(input: string): string {
  return input
    .replace(/\\left|\\right|\\,|\\;|\\ /g, ' ')
    .replace(/\\land|\\wedge|∧|&&/g, ' & ')
    .replace(/\\lor|\\vee|∨|\|\|/g, ' | ')
    .replace(/\\neg|\\lnot|¬/g, ' ! ')
    .replace(/\\oplus|⊕|\\veebar/g, ' ^ ')
    .replace(/\\leftrightarrow|\\iff|\\Leftrightarrow|↔|⇔|⟺|iff/g, ' <-> ')
    .replace(/\\to|\\rightarrow|\\Rightarrow|\\implies|⟹|→|⇒/g, ' -> ')
    .replace(/-(?!>)>|→/g, ' -> ')
    .replace(/<->/g, ' IFF ')
    .replace(/->/g, ' IMPL ')
    .replace(/<=\s*>/g, ' IFF ')
    .replace(/⊕/g, ' ^ ')
    .replace(/[三真]/g, ' T ')
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }
    if (src.startsWith('IFF', i)) { tokens.push({ t: 'op', v: 'IFF' }); i += 3; continue }
    if (src.startsWith('IMPL', i)) { tokens.push({ t: 'op', v: 'IMP' }); i += 4; continue }
    if (ch === '&' || ch === '∧') { tokens.push({ t: 'op', v: 'AND' }); i++; continue }
    if (ch === '|' || ch === '∨') { tokens.push({ t: 'op', v: 'OR' }); i++; continue }
    if (ch === '!' || ch === '¬' || ch === '~') { tokens.push({ t: 'op', v: 'NOT' }); i++; continue }
    if (ch === '^' || ch === '⊕') { tokens.push({ t: 'op', v: 'XOR' }); i++; continue }
    if (ch === '(' || ch === '[') { tokens.push({ t: 'lp' }); i++; continue }
    if (ch === ')' || ch === ']') { tokens.push({ t: 'rp' }); i++; continue }
    if (ch === 'T' || ch === '1') { tokens.push({ t: 'const', v: true }); i++; continue }
    if (ch === 'F' || ch === '0') { tokens.push({ t: 'const', v: false }); i++; continue }
    const id = /^[A-Za-z][A-Za-z0-9_']*/.exec(src.slice(i))
    if (id) {
      const name = id[0]
      if (/^(true|TRUE|True)$/.test(name)) tokens.push({ t: 'const', v: true })
      else if (/^(false|FALSE|False)$/.test(name)) tokens.push({ t: 'const', v: false })
      else if (name === 'and') tokens.push({ t: 'op', v: 'AND' })
      else if (name === 'or') tokens.push({ t: 'op', v: 'OR' })
      else if (name === 'not') tokens.push({ t: 'op', v: 'NOT' })
      else if (name === 'xor') tokens.push({ t: 'op', v: 'XOR' })
      else if (name === 'implies') tokens.push({ t: 'op', v: 'IMP' })
      else tokens.push({ t: 'var', v: name })
      i += name.length
      continue
    }
    throw new Error(`无法识别的字符 “${ch}”`)
  }
  return tokens
}

interface Node {
  eval(a: Record<string, boolean>): boolean
}

/** 递归下降：IFF < IMP < OR < XOR < AND < NOT < atom */
class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  parse(): Node {
    const n = this.parseIff()
    if (this.pos < this.tokens.length) throw new Error('多余的符号，请检查括号是否配对')
    return n
  }
  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }
  private parseIff(): Node {
    let left = this.parseImp()
    while (this.peek()?.t === 'op' && (this.peek() as any).v === 'IFF') {
      this.pos++
      const right = this.parseImp()
      const l = left
      left = { eval: (a) => l.eval(a) === right.eval(a) }
    }
    return left
  }
  private parseImp(): Node {
    const left = this.parseOr()
    const next = this.peek()
    if (next?.t === 'op' && (next as any).v === 'IMP') {
      this.pos++
      const right = this.parseImp()
      return { eval: (a) => !left.eval(a) || right.eval(a) }
    }
    return left
  }
  private parseOr(): Node {
    let left = this.parseXor()
    for (;;) {
      const n = this.peek()
      if (n?.t === 'op' && (n as any).v === 'OR') {
        this.pos++
        const right = this.parseXor()
        const l = left
        left = { eval: (a) => l.eval(a) || right.eval(a) }
      } else return left
    }
  }
  private parseXor(): Node {
    let left = this.parseAnd()
    for (;;) {
      const n = this.peek()
      if (n?.t === 'op' && (n as any).v === 'XOR') {
        this.pos++
        const right = this.parseAnd()
        const l = left
        left = { eval: (a) => l.eval(a) !== right.eval(a) }
      } else return left
    }
  }
  private parseAnd(): Node {
    let left = this.parseNot()
    for (;;) {
      const n = this.peek()
      if (n?.t === 'op' && (n as any).v === 'AND') {
        this.pos++
        const right = this.parseNot()
        const l = left
        left = { eval: (a) => l.eval(a) && right.eval(a) }
      } else return left
    }
  }
  private parseNot(): Node {
    const n = this.peek()
    if (n?.t === 'op' && (n as any).v === 'NOT') {
      this.pos++
      const inner = this.parseNot()
      return { eval: (a) => !inner.eval(a) }
    }
    return this.parseAtom()
  }
  private parseAtom(): Node {
    const n = this.peek()
    if (!n) throw new Error('表达式不完整')
    if (n.t === 'lp') {
      this.pos++
      const inner = this.parseIff()
      const close = this.peek()
      if (close?.t !== 'rp') throw new Error('括号未闭合')
      this.pos++
      return inner
    }
    if (n.t === 'const') {
      this.pos++
      const v = n.v
      return { eval: () => v }
    }
    if (n.t === 'var') {
      this.pos++
      const name = n.v
      return { eval: (a) => !!a[name] }
    }
    throw new Error('此处缺少命题变元')
  }
}

export function buildTruthTable(input: string): TruthTableResult {
  const displayLatex = input.trim()
  if (!displayLatex) {
    return { ok: false, error: '请输入逻辑表达式', variables: [], rows: [], displayLatex: '', tautology: false, contradiction: false }
  }
  let tokens: Token[]
  try {
    tokens = tokenize(normalizeLogicInput(input))
  } catch (e: any) {
    return { ok: false, error: e.message, variables: [], rows: [], displayLatex, tautology: false, contradiction: false }
  }
  let ast: Node
  try {
    ast = new Parser(tokens).parse()
  } catch (e: any) {
    return { ok: false, error: e.message, variables: [], rows: [], displayLatex, tautology: false, contradiction: false }
  }
  const vars = Array.from(
    new Set(tokens.filter((t): t is { t: 'var'; v: string } => t.t === 'var').map((t) => t.v))
  ).sort((a, b) => a.localeCompare(b))
  if (vars.length > 8) {
    return { ok: false, error: '命题变元过多（最多 8 个，2^8 = 256 行）', variables: vars, rows: [], displayLatex, tautology: false, contradiction: false }
  }
  const rows: Array<{ values: boolean[]; result: boolean }> = []
  const total = 2 ** vars.length
  for (let i = 0; i < total; i++) {
    const values = vars.map((_, k) => Boolean(i & (1 << (vars.length - 1 - k))))
    const scope: Record<string, boolean> = {}
    vars.forEach((v, k) => (scope[v] = values[k]))
    rows.push({ values, result: ast.eval(scope) })
  }
  return {
    ok: true,
    variables: vars,
    rows,
    displayLatex,
    tautology: rows.every((r) => r.result),
    contradiction: rows.every((r) => !r.result),
  }
}

const T = 'T'
const F = 'F'

/** 输出 Markdown 表格 */
export function truthTableToMarkdown(r: TruthTableResult, exprLabel = '结果'): string {
  if (!r.ok) return ''
  const head = `| ${[...r.variables, exprLabel].join(' | ')} |`
  const sep = `| ${[...r.variables, exprLabel].map(() => '---').join(' | ')} |`
  const body = r.rows.map((row) => `| ${[...row.values.map((v) => (v ? T : F)), row.result ? T : F].join(' | ')} |`)
  return [head, sep, ...body].join('\n')
}

/** 输出 LaTeX array（三线表风格） */
export function truthTableToLatex(r: TruthTableResult, exprLabel = 'R'): string {
  if (!r.ok) return ''
  const cols = [...r.variables, exprLabel]
  const spec = `c${'c'.repeat(cols.length - 1)}`
  const header = cols.join(' & ')
  const body = r.rows.map((row) => [...row.values.map((v) => (v ? 'T' : 'F')), row.result ? 'T' : 'F'].join(' & '))
  return [
    `\\begin{array}{${spec}}`,
    `\\toprule`,
    `${header} \\\\`,
    `\\midrule`,
    ...body.map((b, i) => (i === body.length - 1 ? `${b} \\\\` : `${b} \\\\`)),
    `\\bottomrule`,
    `\\end{array}`,
  ].join('\n')
}

/** 逻辑表达式里用到的变元（供 UI 展示） */
export function extractLogicVariables(input: string): string[] {
  try {
    const tokens = tokenize(normalizeLogicInput(input))
    return Array.from(new Set(tokens.filter((t): t is { t: 'var'; v: string } => t.t === 'var').map((t) => t.v))).sort()
  } catch {
    return []
  }
}
