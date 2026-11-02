#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * ============================================================================
 *  mathflow —— 命令行入口
 * ----------------------------------------------------------------------------
 *   mathflow                    在当前目录启动（浏览器自动打开）
 *   mathflow ~/notes            在指定目录启动
 *   mathflow serve . -p 5000    指定端口
 *   mathflow export -o dist/out 批量编译成 .tex / .html
 *   mathflow init my-paper      生成一个带示例与文献库的工作区
 * ============================================================================
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(HERE, '..')
const VERSION = '1.0.0'

const C = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  gray: '\u001b[90m',
}
const tty = process.stdout.isTTY
const c = (code, s) => (tty ? `${code}${s}${C.reset}` : s)

/* ------------------------------------------------------------------ */
/* 参数解析                                                            */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      out._.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) {
        out.flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const key = a.slice(2)
        const next = argv[i + 1]
        // 布尔型开关
        if (!next || next.startsWith('-')) out.flags[key] = true
        else {
          out.flags[key] = next
          i++
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1)
      if (['p', 'o', 't', 'f'].includes(key)) {
        out.flags[key] = argv[++i]
      } else {
        out.flags[key] = true
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

function help() {
  console.log(`
${c(C.bold, 'MathFlow')} ${c(C.gray, 'v' + VERSION)}  ·  Markdown 为主、LaTeX 为辅的本地学术写作台

${c(C.bold, '用法')}
  mathflow ${c(C.gray, '[目录]')}                在当前或指定目录启动服务
  mathflow serve ${c(C.gray, '[目录]')}         同上（显式写法）
  mathflow export ${c(C.gray, '[目录]')}        批量编译成 .tex / .html，并产出合并版 main.tex
  mathflow init ${c(C.gray, '<目录>')}          创建一个带示例与文献库的工作区
  mathflow init ${c(C.gray, '<目录> --serve')}  创建完直接启动

${c(C.bold, '选项')}
  -p, --port <n>        端口，默认 4321（被占用时自动顺延）
  -H, --host <addr>     监听地址，默认 127.0.0.1
                        改成 0.0.0.0 可让局域网内其他设备访问（会要求确认）
  -r, --readonly        只读模式，禁止任何写盘操作
      --no-open         不自动打开浏览器
  -o, --out <目录>      export 的输出目录，默认 export/
  -t, --to <列表>       export 的目标格式，默认 tex,html
      --template <名>   LaTeX 模板：ctexart | ctexbook | article | IEEEtran
      --book            成套书稿：等价于 --template ctexbook，H1 变 \chapter
      --combine         生成合并版 main.tex / main.html（多篇文档时默认开启）
      --no-combine      只逐篇编译，不生成合并版
      --title <标题>    合并版的标题，默认取目录名
      --open            export 结束后打开输出目录
  -f, --files <列表>    export 只处理指定文件（逗号分隔）
      --flat            export 不保留原目录结构
  -h, --help            显示帮助
  -v, --version         显示版本号

${c(C.bold, '示例')}
  ${c(C.gray, 'mathflow ~/Documents/论文')}
  ${c(C.gray, 'mathflow . -p 8080 --no-open')}
  ${c(C.gray, 'mathflow export . --book --title "泛函分析讲义" --open')}
  ${c(C.gray, 'mathflow export . -t tex --template IEEEtran')}
`)
}

/* ------------------------------------------------------------------ */
/* 浏览器                                                              */
/* ------------------------------------------------------------------ */

function openBrowser(url) {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true }).unref()
    } else if (platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
    }
  } catch {
    /* 打不开就算了，URL 已经打印出来 */
  }
}

/* ------------------------------------------------------------------ */
/* serve                                                               */
/* ------------------------------------------------------------------ */

async function commandServe(dirArg, flags) {
  const { createApp, listenWithFallback } = await import('../server/index.mjs')

  const root = path.resolve(dirArg || process.cwd())
  try {
    const st = await fs.stat(root)
    if (!st.isDirectory()) throw new Error('不是一个目录')
  } catch (e) {
    console.error(`${c(C.red, '✗')} 目录不可用：${root}\n  ${e.message}`)
    process.exit(1)
  }

  const host = String(flags.host ?? flags.H ?? '127.0.0.1')
  const port = Number(flags.port ?? flags.p ?? 4321)
  const readonly = Boolean(flags.readonly ?? flags.r)
  const shouldOpen = !(flags['no-open'] || flags.open === false)

  if (!/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
    console.log(
      `${c(C.yellow, '⚠')} 正在监听 ${c(C.bold, host)}，局域网内任何设备都能读写 ${root}\n` +
        `  ${c(C.dim, '如果不希望别人访问，按 Ctrl+C 后去掉 --host 重试')}\n`
    )
  }

  // 导出能力按需加载：只在真正调用 /api/export 时才去解包编译器
  let exportHandler = null
  const server = createApp({
    root,
    readonly,
    distDir: path.join(PKG_ROOT, 'dist'),
    exportHandler: async (payload) => {
      if (!exportHandler) {
        const mod = await import('../server/exportBatch.mjs')
        exportHandler = mod.exportWorkspace
      }
      return exportHandler({ ...payload, root })
    },
  })

  const actualPort = await listenWithFallback(server, port, host)
  const shownHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host
  const url = `http://${shownHost}:${actualPort}/`

  const docCount = await countDocs(root)

  console.log(`
  ${c(C.bold, 'MathFlow')} ${c(C.gray, 'v' + VERSION)}   ${readonly ? c(C.yellow, '只读模式') : c(C.green, '可编辑')}
  ${c(C.gray, '工作区')}  ${root}
  ${c(C.gray, '文档数')}  ${docCount} 篇 Markdown
  ${c(C.gray, '服务')}    ${c(C.cyan, url)}
  ${c(C.gray, '停止')}    Ctrl + C
`)
  if (actualPort !== port) {
    console.log(`  ${c(C.dim, `端口 ${port} 被占用，已自动改用 ${actualPort}`)}\n`)
  }

  if (shouldOpen) openBrowser(url)

  const shutdown = () => {
    console.log(`\n  ${c(C.gray, '已停止。祝写作顺利。')}\n`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 600)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function countDocs(root) {
  let n = 0
  async function walk(dir, depth) {
    if (depth > 6) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      if (e.isDirectory()) await walk(path.join(dir, e.name), depth + 1)
      else if (/\.(md|markdown|mdx)$/i.test(e.name)) n++
    }
  }
  await walk(root, 0)
  return n
}

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

async function commandExport(dirArg, flags) {
  const root = path.resolve(dirArg || process.cwd())
  const { exportWorkspace } = await import('../server/exportBatch.mjs')

  const to = String(flags.to ?? flags.t ?? 'tex,html')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s === 'tex' || s === 'html')
  if (!to.length) {
    console.error(`${c(C.red, '✗')} --to 只支持 tex 与 html`)
    process.exit(1)
  }

  const template = String(flags.template ?? (flags.book || flags.b ? 'ctexbook' : 'ctexart'))
  if (!['ctexart', 'ctexbook', 'article', 'IEEEtran'].includes(template)) {
    console.error(`${c(C.red, '✗')} --template 只能是 ctexart / ctexbook / article / IEEEtran`)
    process.exit(1)
  }

  // 合并版默认在多篇文档时开启；--no-combine 可以关掉
  const combine = Boolean(flags.combine) || (flags['no-combine'] ? false : undefined)

  const files = flags.files ?? flags.f
    ? String(flags.files ?? flags.f).split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  console.log(`
  ${c(C.bold, 'MathFlow 批量编译')}
  ${c(C.gray, '工作区')}  ${root}
  ${c(C.gray, '目标')}    ${to.join(' + ')}   模板 ${template}
`)

  const started = Date.now()
  let done = 0
  const res = await exportWorkspace({
    root,
    files,
    to,
    template,
    outDir: String(flags.out ?? flags.o ?? 'export'),
    keepTree: !flags.flat,
    combine,
    title: flags.title ? String(flags.title) : undefined,
    onProgress: (r) => {
      done++
      const bits = []
      if (r.tex) bits.push(c(C.cyan, 'tex'))
      if (r.html) bits.push(c(C.green, 'html'))
      console.log(`  ${c(C.gray, String(done).padStart(3))}  ${r.src}  ${c(C.dim, '→ ' + bits.join(' + '))}`)
    },
  })

  const elapsed = ((Date.now() - started) / 1000).toFixed(2)
  const totalBytes = res.outputs.reduce((n, r) => n + (r.texBytes ?? 0) + (r.htmlBytes ?? 0), 0)
  const outAbs = path.join(root, res.outDir ?? 'export')

  console.log(`
  ${c(C.green, '✓')} ${res.outputs.length} 篇文档编译完成，共 ${(totalBytes / 1024).toFixed(0)} KB，耗时 ${elapsed}s
  ${c(C.gray, '输出目录')}  ${outAbs}
`)

  if (res.combined?.mainTex || res.combined?.mainHtml) {
    const bits = []
    if (res.combined.mainTex) bits.push(`${c(C.bold, 'main.tex')}（${res.combined.chapters} 章合并，交叉引用与统一编号）`)
    if (res.combined.mainHtml) bits.push(`${c(C.bold, 'main.html')}（整本阅读版，可直接打印成 PDF）`)
    console.log(`  ${c(C.green, '✓')} 合并版已生成：`)
    for (const b of bits) console.log(`    ${c(C.gray, '·')} ${b}`)
    if (res.combined.mainTex) {
      console.log(`
  ${c(C.gray, '编译成 PDF：')}
    cd "${outAbs}" && xelatex main.tex && xelatex main.tex
  ${c(C.dim, '（跑两遍：第一遍写 .aux，第二遍目录和交叉引用才对得上）')}
`)
    } else {
      console.log()
    }
  }

  if (res.warnings.length) {
    console.log(`  ${c(C.yellow, '⚠ ' + res.warnings.length + ' 条提示')}`)
    for (const w of res.warnings.slice(0, 20)) console.log(`    ${c(C.gray, '·')} ${w}`)
    console.log()
  }

  if (flags.open) await openPath(outAbs)
}

async function openPath(dir) {
  const cmd = process.platform === 'win32' ? ['explorer', [dir]] : process.platform === 'darwin' ? ['open', [dir]] : ['xdg-open', [dir]]
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref()
  } catch {
    /* 打不开就算了，路径已经打印出来 */
  }
}

/* ------------------------------------------------------------------ */
/* init                                                                */
/* ------------------------------------------------------------------ */

/**
 * 模板工作区放在 templates/workspace 下，用真实文件而不是内嵌字符串：
 * 这样模板本身就是一篇能跑的文档，改起来也不会被转义符绊住。
 */
const TEMPLATE_DIR = path.join(PKG_ROOT, 'templates', 'workspace')

/** 内置兜底：打包时若漏了 templates/，至少还能生成一篇能用的示例 */
const FALLBACK_DOC = `# 欢迎使用 MathFlow

左边栏是磁盘上的真实目录，保存即落盘。

## 一个定理

::: theorem [切比雪夫不等式]{#thm:chebyshev}
设随机变量 $X$ 的期望为 $\\mu$、方差为 $\\sigma^2$，则对任意 $k > 0$ 有

$$
P\\left(|X - \\mu| \\geq k\\sigma\\right) \\leq \\frac{1}{k^2}
\\label{eq:cheb}
$$
:::

由 @thm:chebyshev 与 @eq:cheb 可以直接得到「偏离超过 $3\\sigma$ 的概率不超过 $1/9$」。
`

const FALLBACK_BIB = `@book{knuth1984,
  author    = {Knuth, Donald E.},
  title     = {The {\\TeX}book},
  year      = {1984},
  publisher = {Addison-Wesley}
}
`

async function commandInit(dirArg, flags = {}) {
  if (!dirArg) {
    console.error(`${c(C.red, '✗')} 请指定要创建的目录，例如：${c(C.gray, 'mathflow init my-paper')}`)
    process.exit(1)
  }
  const root = path.resolve(dirArg)
  await fs.mkdir(root, { recursive: true })

  const written = []
  const skipped = []

  if (await exists(TEMPLATE_DIR)) {
    await copyTree(TEMPLATE_DIR, root, written, skipped)
  } else {
    for (const [file, content] of [
      [path.join(root, '00-welcome.md'), FALLBACK_DOC],
      [path.join(root, 'references.bib'), FALLBACK_BIB],
    ]) {
      if (await writeNew(file, content)) written.push(file)
      else skipped.push(file)
    }
  }

  for (const f of written) console.log(`  ${c(C.green, '✓')} ${path.relative(process.cwd(), f)}`)
  for (const f of skipped) console.log(`  ${c(C.yellow, '·')} ${path.relative(process.cwd(), f)} 已存在，跳过`)

  console.log(`
  工作区已就绪：${root}
  下一步：${c(C.cyan, `mathflow "${dirArg}"`)}
`)

  // 生成完直接开工，省一次回车
  if (flags.serve || flags.s) return commandServe(root, flags)
}

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

/** 只在目标不存在时写入，绝不覆盖用户已有的文件 */
async function writeNew(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  try {
    await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' })
    return true
  } catch (e) {
    if (e.code === 'EEXIST') return false
    throw e
  }
}

async function copyTree(src, dest, written, skipped) {
  const entries = await fs.readdir(src, { withFileTypes: true })
  await fs.mkdir(dest, { recursive: true })
  for (const e of entries) {
    const s = path.join(src, e.name)
    const d = path.join(dest, e.name)
    if (e.isDirectory()) {
      await copyTree(s, d, written, skipped)
    } else {
      const text = await fs.readFile(s, 'utf8')
      if (await writeNew(d, text)) written.push(d)
      else skipped.push(d)
    }
  }
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length) return commandServe(undefined, {})

  const { _, flags } = parseArgs(argv)

  if (flags.help || flags.h || _[0] === 'help') return help()
  if (flags.version || flags.v || _[0] === '--version') {
    console.log(VERSION)
    return
  }

  const [cmd, ...rest] = _
  switch (cmd) {
    case 'serve':
    case 'start':
    case 'dev':
      return commandServe(rest[0], flags)
    case 'export':
    case 'build':
    case 'compile':
      return commandExport(rest[0], flags)
    case 'init':
      return commandInit(rest[0], flags)
    default:
      // 第一个参数不是子命令，就当作目录
      return commandServe(cmd, flags)
  }
}

main().catch((e) => {
  console.error(`\n${c(C.red, '✗')} ${e?.message ?? e}\n`)
  if (process.env.MATHFLOW_DEBUG) console.error(e)
  process.exit(1)
})
