/**
 * ============================================================================
 *  plotParser.ts —— LaTeX 公式 → 可求值表达式
 * ----------------------------------------------------------------------------
 *  绘图能认多少种写法，全靠这一层。原先是用一串正则硬替换，
 *  遇到嵌套花括号、`\sin^2 x`、`\log_2 x`、`x(x+1)` 就散架了。
 *
 *  这里改成一个小的递归下降解析器：
 *   1. 归一化（全角标点、公式外壳、`y =` 前缀）
 *   2. 逐字符扫描，把 \frac、\sqrt[n]、\sin^2、\log_a 等还原成带括号的表达式
 *   3. 修隐式乘法（x(x+1) → x*(x+1)，2x → 2*x，)(→)*(
 *
 *  输出的字符串交给 mathjs 求值，因此这里的函数名一律换成 mathjs 的叫法
 *  （arcsin → asin，ln → log，lg → log10 …）。
 * ============================================================================
 */

/** LaTeX 函数命令 → mathjs 函数名。mathjs 没有 arcsin / arccot 这些写法。 */
const LATEX_FUNCS: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'csc',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  arccot: 'acot',
  arcsec: 'asec',
  arccsc: 'acsc',
  asin: 'asin',
  acos: 'acos',
  atan: 'atan',
  acot: 'acot',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  coth: 'coth',
  sech: 'sech',
  csch: 'csch',
  arsinh: 'asinh',
  arcosh: 'acosh',
  artanh: 'atanh',
  asinh: 'asinh',
  acosh: 'acosh',
  atanh: 'atanh',
  exp: 'exp',
  ln: 'log',
  lg: 'log10',
  log: 'log',
  logtwo: 'log2',
  abs: 'abs',
  floor: 'floor',
  ceil: 'ceil',
  round: 'round',
  sign: 'sign',
  trunc: 'trunc',
  max: 'max',
  min: 'min',
  gcd: 'gcd',
  lcm: 'lcm',
  mod: 'mod',
  gamma: 'gamma',
  erf: 'erf',
  factorial: 'factorial',
}

/** 这些 mathjs 函数名在修隐式乘法时要当成「函数」而不是变量 */
const JS_FUNCS = new Set([
  ...Object.values(LATEX_FUNCS),
  'sqrt',
  'cbrt',
  'nthRoot',
  'log2',
  'log10',
  'exp',
  'atan2',
  'round',
  'abs',
])

/** 常数命令 → 标识符（求值时一并注入） */
const LATEX_CONSTS: Record<string, string> = {
  pi: 'pi',
  tau: 'tau',
  varphi: 'phi',
  phi: 'phi',
  varphi_alt: 'phi',
  infty: 'Infinity',
  infty_alt: 'Infinity',
}

/** 只影响排版、可以直接丢掉的命令 */
const DROP_COMMANDS = new Set([
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'displaystyle',
  'textstyle',
  'scriptstyle',
  'limits',
  'nolimits',
  'quad',
  'qquad',
  ',',
  ';',
  ':',
  '!',
  ' ',
  'enspace',
  'thinspace',
  'medspace',
  'thickspace',
])

/** 全角 → 半角，连同中文标点一起纠正（很多人是在中文输入法下写公式的） */
function normalize(input: string): string {
  let s = input
  // 全角 ASCII 区
  s = s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  s = s
    .replace(/\u3000/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[，、]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/[；]/g, ';')
    .replace(/[：]/g, ':')
    .replace(/[＋]/g, '+')
    .replace(/[－—]/g, '-')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[＝]/g, '=')
    .replace(/[｜]/g, '|')
    // 中文乘方符号
    .replace(/[²]/g, '^2')
    .replace(/[³]/g, '^3')

  // 公式外壳
  s = s
    .replace(/\\\[|\\\]/g, ' ')
    .replace(/\\\(|\\\)/g, ' ')
    .replace(/\$\$?/g, ' ')
    .replace(/\\begin\{[a-zA-Z*]+\}/g, ' ')
    .replace(/\\end\{[a-zA-Z*]+\}/g, ' ')
    .replace(/\\label\{[^{}]*\}/g, ' ')
    .replace(/\\tag\{[^{}]*\}/g, ' ')
    .replace(/\\nonumber|\\notag/g, ' ')
    .replace(/&/g, ' ')
    .replace(/\\\\/g, ' ')

  // 去掉 y = / f(x) = / g(t) = 之类的前缀
  s = s.replace(/^\s*[a-zA-Z]\s*(\(\s*[a-zA-Z]\s*\))?\s*=\s*/, ' ')

  return s
}

class LatexExprParser {
  private i = 0
  constructor(private readonly s: string) {}

  parse(): string {
    const out = this.parseSeq(() => false)
    return out
  }

  private get ch(): string | undefined {
    return this.s[this.i]
  }

  private skipWs() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++
  }

  /** 顺序读到结尾；stop 返回 true 时停（用于花括号组内部的边界） */
  private parseSeq(stop: () => boolean): string {
    let out = ''
    for (;;) {
      this.skipWs()
      if (this.i >= this.s.length || stop()) break
      const c = this.s[this.i]
      if (c === '\\') {
        out = this.append(out, this.parseCommand())
        continue
      }
      if (c === '{') {
        const body = this.readGroup()
        out = this.append(out, `(${body})`)
        continue
      }
      if (c === '|') {
        out = this.append(out, this.parseAbs())
        continue
      }
      if (c === '^') {
        out = this.append(out, this.parseSuperscript())
        continue
      }
      if (c === '_') {
        out = this.append(out, this.parseSubscript())
        continue
      }
      // 连续字母当成一个词读，否则 `floor(x)` 会被拆成 f*l*o*o*r
      if (/[a-zA-Z]/.test(c)) {
        out = this.append(out, this.readIdent())
        continue
      }
      out = this.append(out, c)
      this.i++
    }
    return out
  }

  /**
   * 拼接时补隐式乘号。
   * 关键场景：`\pi x` 解析出 "pi" + "x"，直接拼会变成变量 "pix"，
   * 必须在两个标识符类片段之间插一个 `*`。
   * 但数字与数字之间不能插（否则 10 会变成 1*0）。
   */
  private append(out: string, piece: string): string {
    if (!piece) return out
    const prev = out.trimEnd().slice(-1)
    const next = piece.trimStart()[0]
    if (!prev || !next) return out + piece
    const prevWord = /[a-zA-Z_]/.test(prev)
    const prevDigit = /[0-9]/.test(prev)
    const nextWord = /[a-zA-Z_]/.test(next)
    const nextDigit = /[0-9]/.test(next)
    const needMul = (prevWord && (nextWord || nextDigit)) || (prevDigit && nextWord)
    return needMul ? `${out}*${piece}` : out + piece
  }

  /** 读一个 {…} 组，返回内部已转换的表达式（不含花括号） */
  private readGroup(): string {
    if (this.ch !== '{') return ''
    this.i++
    let depth = 1
    const start = this.i
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (c === '\\') {
        this.i += 2
        continue
      }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) break
      }
      this.i++
    }
    const body = this.s.slice(start, this.i)
    if (this.s[this.i] === '}') this.i++
    return new LatexExprParser(normalize(body)).parse()
  }

  /** 读取 ( … )，返回不含外括号的内容 */
  private readParen(): string {
    if (this.ch !== '(') return ''
    this.i++
    let depth = 1
    const start = this.i
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (c === '\\') {
        this.i += 2
        continue
      }
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
      this.i++
    }
    const body = this.s.slice(start, this.i)
    if (this.s[this.i] === ')') this.i++
    return new LatexExprParser(normalize(body)).parse()
  }

  /** | … | 绝对值 */
  private parseAbs(): string {
    if (this.ch !== '|') return ''
    this.i++
    const start = this.i
    while (this.i < this.s.length && this.s[this.i] !== '|') {
      if (this.s[this.i] === '\\') this.i++
      this.i++
    }
    const body = this.s.slice(start, this.i)
    if (this.ch === '|') this.i++
    return `abs(${new LatexExprParser(normalize(body)).parse()})`
  }

  private readNumber(): string {
    const start = this.i
    let seenDot = false
    while (this.i < this.s.length) {
      const c = this.s[this.i]
      if (/\d/.test(c)) {
        this.i++
        continue
      }
      if (c === '.' && !seenDot) {
        seenDot = true
        this.i++
        continue
      }
      break
    }
    // 科学计数法 1e-3
    if (/[eE]/.test(this.s[this.i] ?? '') && /[\d+-]/.test(this.s[this.i + 1] ?? '')) {
      this.i++
      if (/[+-]/.test(this.s[this.i] ?? '')) this.i++
      while (/\d/.test(this.s[this.i] ?? '')) this.i++
    }
    return this.s.slice(start, this.i)
  }

  private readIdent(): string {
    const start = this.i
    while (this.i < this.s.length && /[a-zA-Z]/.test(this.s[this.i])) this.i++
    return this.s.slice(start, this.i)
  }

  /** 上标：^{…} 或 ^2 */
  private parseSuperscript(): string {
    this.i++ // 吃掉 ^
    this.skipWs()
    if (this.ch === '{') {
      const body = this.readGroup()
      return `^(${body})`
    }
    if (this.ch === '\\') {
      const cmd = this.parseCommand()
      return `^(${cmd})`
    }
    if (/[\d.]/.test(this.ch ?? '')) {
      const n = this.readNumber()
      return `^(${n})`
    }
    if (this.ch === '(') {
      const p = this.readParen()
      return `^(${p})`
    }
    const id = this.readIdent()
    return id ? `^(${id})` : ''
  }

  /** 下标：x_{n} 之类。绘图里基本用不到，拼成标识符即可 */
  private parseSubscript(): string {
    this.i++
    this.skipWs()
    if (this.ch === '{') {
      const body = this.readGroup()
      return `_${body}`
    }
    const id = this.readIdent() || this.readNumber()
    return `_${id}`
  }

  /** \command */
  private parseCommand(): string {
    this.i++ // 吃掉反斜杠
    if (this.i >= this.s.length) return ''
    const c = this.s[this.i]

    // \, \; \! \  这类间距命令
    if (!/[a-zA-Z]/.test(c)) {
      this.i++
      if (DROP_COMMANDS.has(c)) return ''
      if (c === '|') {
        // \| 当绝对值边界处理
        this.i--
        return this.parseAbs()
      }
      if (c === '\\') return ','
      if (c === '(' || c === ')') return ''
      if (c === '{' || c === '}') return ''
      return c
    }

    const name = this.readIdent()

    /* ---- 绝对值 ---- */
    if (name === 'left' || name === 'right') {
      this.skipWs()
      if (this.ch === '|') return this.parseAbs()
      if (this.ch === '.') {
        this.i++
        return ''
      }
      if (this.ch === '\\') {
        // \left( \right) 之类交给下一次循环
        return ''
      }
      return ''
    }
    if (name === 'lvert' || name === 'vert' || name === 'lVert') return this.parseAbs()

    /* ---- 取整记号 \lfloor … \rfloor ---- */
    if (name === 'lfloor') return 'floor('
    if (name === 'lceil') return 'ceil('
    if (name === 'rfloor' || name === 'rceil') return ')'

    /* ---- 分式 ---- */
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
      const a = this.readArg()
      const b = this.readArg()
      return `((${a})/(${b || '1'}))`
    }

    /* ---- 根号 ---- */
    if (name === 'sqrt') {
      this.skipWs()
      if (this.ch === '[') {
        const start = ++this.i
        while (this.i < this.s.length && this.s[this.i] !== ']') this.i++
        const n = this.s.slice(start, this.i)
        if (this.s[this.i] === ']') this.i++
        const body = this.readArg()
        return `((${body})^(1/(${n || '2'})))`
      }
      const body = this.readArg()
      return `sqrt(${body})`
    }
    if (name === 'cbrt') {
      const body = this.readArg()
      return `cbrt(${body})`
    }

    /* ---- 常数 ---- */
    if (name === 'pi' || name === 'tau' || name === 'varphi' || name === 'phi') {
      return LATEX_CONSTS[name] ?? name
    }
    if (name === 'infty') return 'Infinity'

    /* ---- 文本 / 重音 / 包围 ---- */
    if (name === 'text' || name === 'textrm' || name === 'mbox' || name === 'label' || name === 'tag') {
      if (this.ch === '{') this.readGroup()
      return ''
    }
    if (name === 'mathrm' || name === 'mathit' || name === 'mathbf' || name === 'mathsf' || name === 'operatorname' || name === 'boldsymbol') {
      const body = this.ch === '{' ? this.readGroup() : ''
      const plain = body.replace(/[^a-zA-Z0-9_]/g, '')
      // \operatorname{tr} 之类当函数名，图标里认不出就原样返回
      if (LATEX_FUNCS[plain]) return LATEX_FUNCS[plain]
      return plain
    }
    if (DROP_COMMANDS.has(name)) return ''

    /* ---- 运算符与关系 ---- */
    if (name === 'cdot' || name === 'times' || name === 'ast') return '*'
    if (name === 'div') return '/'
    if (name === 'pm') return '+'
    if (name === 'mp') return '-'
    if (name === 'le' || name === 'leq') return '<='
    if (name === 'ge' || name === 'geq') return '>='
    if (name === 'ne' || name === 'neq') return '!='

    /* ---- 函数 ---- */
    const jsName = LATEX_FUNCS[name]
    if (!jsName) {
      // 未知命令（希腊字母等）：整体丢掉，避免污染表达式
      if (this.ch === '{') this.readGroup()
      return ''
    }

    /* 三角函数 / 反三角函数可能带幂：\sin^2 x、\sin^{-1} x */
    let power: string | null = null
    this.skipWs()
    if (this.ch === '^') {
      const save = this.i
      const sup = this.parseSuperscript() // 形如 ^(2)
      const inner = sup.replace(/^\^\((.*)\)$/s, '$1').trim()
      power = inner
      this.skipWs()
      // 只有紧接着还有参数时才当成函数幂；否则（如 \sin^2 单独出现）回退
      if (!this.hasArgAhead()) {
        this.i = save
        power = null
      }
    }

    /* 对数底数：\log_{2} x → log(2, x)；\ln 不受影响 */
    this.skipWs()
    if (this.ch === '_' && (jsName === 'log' || jsName === 'log10' || jsName === 'log2')) {
      this.i++
      this.skipWs()
      const base = this.s[this.i] === '{' ? this.readGroup() : this.readNumber() || this.readIdent()
      const body = this.readArg()
      // mathjs 的写法是 log(真数, 底数)
      return `log(${body}, ${base})`
    }

    const arg = this.readArg()

    /* \sin^{-1} x 习惯上表示反正弦 */
    if (power === '-1' && (jsName === 'sin' || jsName === 'cos' || jsName === 'tan')) {
      const inv = jsName === 'sin' ? 'asin' : jsName === 'cos' ? 'acos' : 'atan'
      return `${inv}(${arg})`
    }

    const call = `${jsName}(${arg})`
    return power != null ? `(${call})^(${power})` : call
  }

  /** 后面还有没有「参数」可读（用于判断 ^2 是函数幂还是整个式子的幂） */
  private hasArgAhead(): boolean {
    this.skipWs()
    const c = this.ch
    if (c == null) return false
    return c === '{' || c === '(' || c === '\\' || c === '|' || /[0-9a-zA-Z.]/.test(c)
  }

  /**
   * 读一个「参数单元」：
   *  {…} 整组 / (…) 整组 / 数字（含 2x 这种连写）/ 单个标识符 / 嵌套命令
   */
  private readArg(): string {
    this.skipWs()
    const c = this.ch
    if (c == null) return ''
    if (c === '{') return this.readGroup()
    if (c === '(') return this.readParen()
    if (c === '|') return this.parseAbs()
    if (c === '\\') return this.parseCommand()
    if (c === '-') {
      this.i++
      return `(-${this.readArg()})`
    }
    if (c === '+') {
      this.i++
      return this.readArg()
    }
    if (/[0-9.]/.test(c)) {
      let out = this.readNumber()
      // 连写：2x、2\pi、2x^2、2(x+1)
      for (;;) {
        this.skipWs()
        const n = this.ch
        if (n == null) break
        if (n === '(') {
          out += `*${this.readParen()}`
          continue
        }
        if (n === '\\') {
          const save = this.i
          this.i++
          const cmdName = /[a-zA-Z]/.test(this.ch ?? '') ? this.readIdent() : ''
          this.i = save
          // 是函数命令就停（属于下一项），是常数/分式则吸收
          if (LATEX_FUNCS[cmdName] && !['exp', 'ln', 'lg', 'log'].includes(cmdName)) break
          out += `*${this.parseCommand()}`
          continue
        }
        if (/[a-zA-Z]/.test(n)) {
          const save = this.i
          const id = this.readIdent()
          if (JS_FUNCS.has(id)) {
            this.i = save
            break
          }
          out += `*${id}`
          this.skipWs()
          if (this.ch === '^') out += this.parseSuperscript()
          continue
        }
        break
      }
      return out
    }
    if (/[a-zA-Z]/.test(c)) {
      const id = this.readIdent()
      // 单个变量后面可能带上下标：x^2、x_1
      let out = id
      this.skipWs()
      if (this.ch === '^') out += this.parseSuperscript()
      else if (this.ch === '_') out += this.parseSubscript()
      return out
    }
    this.i++
    return c
  }
}

/** 隐式乘法：x(x+1) → x*(x+1)，2x → 2*x，)( → )*( */
function fixImplicitMultiplication(expr: string): string {
  let out = ''
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    // 数字
    if (/[0-9]/.test(c)) {
      const start = i
      while (i < expr.length && /[0-9.]/.test(expr[i])) i++
      if (/[eE]/.test(expr[i] ?? '') && /[0-9+-]/.test(expr[i + 1] ?? '')) {
        i++
        if (/[+-]/.test(expr[i] ?? '')) i++
        while (/[0-9]/.test(expr[i] ?? '')) i++
      }
      out += expr.slice(start, i)
      const next = expr.slice(i).trimStart()[0]
      if (next && /[a-zA-Z_(]/.test(next)) out += '*'
      continue
    }
    // 标识符
    if (/[a-zA-Z_]/.test(c)) {
      const start = i
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) i++
      const word = expr.slice(start, i)
      out += word
      const rest = expr.slice(i).trimStart()
      const next = rest[0]
      if (!next) continue
      if (JS_FUNCS.has(word)) {
        // 函数名后面必须是 (；不是的话补一个（例如 sinx 这种手误就不管了）
        continue
      }
      if (/[a-zA-Z_(]/.test(next)) out += '*'
      continue
    }
    // 右括号后接东西
    if (c === ')') {
      out += ')'
      i++
      const next = expr.slice(i).trimStart()[0]
      if (next && /[a-zA-Z_0-9(]/.test(next)) out += '*'
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * LaTeX 公式 → mathjs 可解析的表达式。
 * 这是绘图、极值标注、图像导出共用的入口。
 */
export function latexToExpression(input: string): string {
  const normalized = normalize(input)
  const parsed = new LatexExprParser(normalized).parse()
  let out = fixImplicitMultiplication(parsed)
  // 收尾清理：连续运算符、空括号、多余空格
  out = out
    .replace(/\*\s*\*/g, '*')
    .replace(/\+\s*\+/g, '+')
    .replace(/\+\s*-/g, '-')
    .replace(/-\s*-/g, '+')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[+*]+/, '')
  return out
}

/**
 * 把输入拆成多条曲线。
 * 支持 `;` 或换行分隔，`y=` / `f(x)=` 前缀会被去掉。
 */
export function splitCurveSources(input: string): string[] {
  return input
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^#{1,6}\s/.test(s))
}

/** 表达式里用到的自由变量（用于提示「只认 x」） */
export function freeVariables(expr: string): string[] {
  const known = new Set([
    ...JS_FUNCS,
    'e',
    'pi',
    'tau',
    'phi',
    'x',
    'Infinity',
  ])
  const found = new Set<string>()
  const re = /[a-zA-Z_][a-zA-Z0-9_]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(expr))) {
    const w = m[0]
    if (!known.has(w)) found.add(w)
  }
  return [...found]
}

/** 给界面用：一句话说明这个表达式认什么 */
export const PLOT_SUPPORT_NOTE =
  '支持 sin cos tan cot sec csc、arcsin/arccos/arctan、sinh 系列、exp ln lg log_2、sqrt、frac、abs、floor ceil round sign、max min、gamma erf、阶乘，' +
  '也认 \\sin^2 x、x(x+1)、2x、|x|、e^{-x^2} 这些写法；多条曲线用分号隔开。'
