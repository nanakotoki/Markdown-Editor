/**
 * ============================================================================
 *  MathFlow 桌面入口（打包成单文件 exe 时使用）
 * ----------------------------------------------------------------------------
 *  与 bin/mathflow.mjs 的区别：
 *    · 前端产物、模板、编译引擎、KaTeX 样式全部内联在可执行文件里，
 *      运行时不依赖 dist/ 与 node_modules；
 *    · 双击（不带参数）时，工作区固定为 exe 同目录的 workspace/，
 *      不存在就自动生成一份示例，避免把文件写到 System32。
 *
 *  这个文件本身不直接运行，由 scripts/build-exe.mjs 打包。
 * ============================================================================
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { createApp, listenWithFallback } from '../server/index.mjs'
import { configureExport, exportWorkspace } from '../server/exportBatch.mjs'
import * as engineModule from '../server/lib/engine.mjs'
import { assets, templates, katexCss } from '../server/generated/assets.generated.mjs'

const VERSION = '1.0.0'
const EXE_DIR = path.dirname(process.execPath)

// 内联进来的编译引擎与样式，交给批量导出使用
configureExport({ engine: engineModule, katexCss })

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
/* 参数                                                                */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) {
        out.flags[a.slice(2, eq)] = a.slice(eq + 1)
        continue
      }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('-')) out.flags[key] = true
      else {
        out.flags[key] = next
        i++
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1)
      if (['p', 'o', 't', 'H'].includes(key)) out.flags[key] = argv[++i]
      else out.flags[key] = true
    } else {
      out._.push(a)
    }
  }
  return out
}

function help() {
  console.log(`
${c(C.bold, 'MathFlow')} ${c(C.gray, 'v' + VERSION)}  单文件版

${c(C.bold, '用法')}
  MathFlow.exe                   用同目录的 workspace\\ 启动，没有就自动建一个
  MathFlow.exe <目录>            用指定目录作为工作区
  MathFlow.exe export <目录>     批量编译成 .tex / .html
  MathFlow.exe init <目录>       只创建工作区，不启动服务

${c(C.bold, '选项')}
  -p, --port <n>     端口，默认 4321（被占用时自动顺延）
  -r, --readonly     只读模式，禁止任何写盘操作
      --no-open      不自动打开浏览器
  -o, --out <目录>   export 的输出目录，默认 export
  -t, --to <列表>    export 的目标格式，默认 tex,html
      --book         export 按成书处理（ctexbook，H1 变 \\chapter）
      --title <名>   export 的书名
      --no-combine   export 只逐篇编译
      --open         export 结束后打开输出目录
  -h, --help         显示帮助
  -v, --version      显示版本号

${c(C.bold, '示例')}
  ${c(C.gray, 'MathFlow.exe')}
  ${c(C.gray, 'MathFlow.exe "D:\\论文"')}
  ${c(C.gray, 'MathFlow.exe export "D:\\论文" --book --title "泛函分析讲义" --open')}
`)
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

/** 相对路径按 exe 所在目录解析：双击运行时 cwd 往往是 System32 */
function resolveDir(input) {
  if (!input) return path.join(EXE_DIR, 'workspace')
  return path.isAbsolute(input) ? input : path.join(EXE_DIR, input)
}

async function seedWorkspace(root) {
  const written = []
  const skipped = []
  for (const [rel, text] of Object.entries(templates)) {
    const dest = path.join(root, rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    try {
      await fs.writeFile(dest, text, { encoding: 'utf8', flag: 'wx' })
      written.push(rel)
    } catch (e) {
      if (e.code === 'EEXIST') skipped.push(rel)
      else throw e
    }
  }
  return { written, skipped }
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], {
        stdio: 'ignore',
        detached: true,
        windowsVerbatimArguments: true,
      }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
    }
  } catch {
    /* 打不开就把地址打印出来 */
  }
}

function openPath(dir) {
  const cmd =
    process.platform === 'win32'
      ? ['explorer', [dir]]
      : process.platform === 'darwin'
        ? ['open', [dir]]
        : ['xdg-open', [dir]]
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref()
  } catch {
    /* ignore */
  }
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
/* serve                                                               */
/* ------------------------------------------------------------------ */

async function commandServe(dirArg, flags) {
  const root = resolveDir(dirArg)

  if (!(await exists(root))) {
    console.log(`\n  ${c(C.gray, '首次运行，正在创建示例工作区…')}`)
    const { written } = await seedWorkspace(root)
    for (const f of written) console.log(`  ${c(C.green, '✓')} ${f}`)
    console.log(`  ${c(C.dim, '这些是磁盘上的真实文件，可以直接用 VSCode / Typora 打开')}\n`)
  } else {
    const st = await fs.stat(root).catch(() => null)
    if (!st || !st.isDirectory()) {
      console.error(`${c(C.red, '✗')} 不是目录：${root}`)
      process.exit(1)
    }
  }

  const host = '127.0.0.1'
  const port = Number(flags.port ?? flags.p ?? 4321)
  const readonly = Boolean(flags.readonly ?? flags.r)
  const shouldOpen = !flags['no-open']

  const server = createApp({
    root,
    readonly,
    embeddedAssets: assets,
    exportHandler: async (payload) => exportWorkspace({ ...payload, root }),
  })

  const actualPort = await listenWithFallback(server, port, host)
  const url = `http://${host}:${actualPort}/`
  const docCount = await countDocs(root)

  console.log(`
  ${c(C.bold, 'MathFlow')} ${c(C.gray, 'v' + VERSION)}   ${readonly ? c(C.yellow, '只读模式') : c(C.green, '可编辑')}
  ${c(C.gray, '工作区')}  ${root}
  ${c(C.gray, '文档数')}  ${docCount} 篇 Markdown
  ${c(C.gray, '服务')}    ${c(C.cyan, url)}
  ${c(C.gray, '停止')}    关闭这个窗口
`)
  if (actualPort !== port) {
    console.log(`  ${c(C.dim, `端口 ${port} 被占用，已自动改用 ${actualPort}`)}\n`)
  }
  console.log(`  ${c(C.dim, '如果浏览器没有自动打开，把上面的地址复制到浏览器即可')}\n`)

  if (shouldOpen) openBrowser(url)

  const shutdown = () => {
    console.log(`\n  ${c(C.gray, '已停止。文档都已保存到磁盘。')}\n`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 600)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

async function commandExport(dirArg, flags) {
  const root = resolveDir(dirArg)
  if (!(await exists(root))) {
    console.error(`${c(C.red, '✗')} 目录不存在：${root}`)
    process.exit(1)
  }

  const to = String(flags.to ?? flags.t ?? 'tex,html')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s === 'tex' || s === 'html')
  if (!to.length) {
    console.error(`${c(C.red, '✗')} --to 只支持 tex 与 html`)
    process.exit(1)
  }

  const template = String(flags.template ?? (flags.book ? 'ctexbook' : 'ctexart'))
  const combine = Boolean(flags.combine) || (flags['no-combine'] ? false : undefined)
  const outDir = String(flags.out ?? flags.o ?? 'export')

  console.log(`
  ${c(C.bold, 'MathFlow 批量编译')}
  ${c(C.gray, '工作区')}  ${root}
  ${c(C.gray, '目标')}    ${to.join(' + ')}   模板 ${template}
`)

  const started = Date.now()
  let done = 0
  const res = await exportWorkspace({
    root,
    to,
    template,
    combine,
    title: flags.title ? String(flags.title) : undefined,
    outDir,
    keepTree: !flags.flat,
    onProgress: (r) => {
      done++
      const bits = []
      if (r.tex) bits.push('tex')
      if (r.html) bits.push('html')
      console.log(`  ${c(C.gray, String(done).padStart(3))}  ${r.src}  ${c(C.dim, '→ ' + bits.join(' + '))}`)
    },
  })

  const elapsed = ((Date.now() - started) / 1000).toFixed(2)
  const outAbs = path.join(root, outDir)
  console.log(`
  ${c(C.green, '✓')} ${res.outputs.length} 篇文档编译完成，耗时 ${elapsed}s
  ${c(C.gray, '输出目录')}  ${outAbs}
`)
  if (res.combined?.mainTex) console.log(`  ${c(C.gray, '·')} main.tex（整本合并，交叉引用成立）`)
  if (res.combined?.mainHtml) console.log(`  ${c(C.gray, '·')} main.html（整本阅读版，可直接打印）`)
  if (res.warnings.length) {
    console.log(`  ${c(C.yellow, '⚠ ' + res.warnings.length + ' 条提示')}`)
    for (const w of res.warnings.slice(0, 10)) console.log(`    ${c(C.gray, '·')} ${w}`)
  }
  console.log()

  if (flags.open) openPath(outAbs)
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function commandInit(dirArg) {
  if (!dirArg) {
    console.error(`${c(C.red, '✗')} 请指定目录，例如：MathFlow.exe init "D:\\论文"`)
    process.exit(1)
  }
  const root = resolveDir(dirArg)
  await fs.mkdir(root, { recursive: true })
  const { written, skipped } = await seedWorkspace(root)
  for (const f of written) console.log(`  ${c(C.green, '✓')} ${f}`)
  for (const f of skipped) console.log(`  ${c(C.yellow, '·')} ${f} 已存在，跳过`)
  console.log(`\n  工作区已就绪：${root}\n  启动：${c(C.cyan, `MathFlow.exe "${dirArg}"`)}\n`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length) return commandServe(undefined, {})

  const { _, flags } = parseArgs(argv)
  if (flags.help || flags.h || _[0] === 'help') return help()
  if (flags.version || flags.v) {
    console.log(VERSION)
    return
  }

  const [cmd, ...rest] = _
  switch (cmd) {
    case 'serve':
    case 'start':
      return commandServe(rest[0], flags)
    case 'export':
    case 'build':
      return commandExport(rest[0], flags)
    case 'init':
      return commandInit(rest[0])
    default:
      return commandServe(cmd, flags)
  }
}

main().catch((e) => {
  console.error(`\n${c(C.red, '✗')} ${e?.message ?? e}\n`)
  if (process.env.MATHFLOW_DEBUG) console.error(e)
  // 双击启动时窗口会瞬间关闭，停一下让用户看清错误
  if (!tty) setTimeout(() => process.exit(1), 100)
  else process.exit(1)
})
