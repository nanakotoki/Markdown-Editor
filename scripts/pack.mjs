/**
 * ============================================================================
 *  pack.mjs —— 打一个可以直接双击运行的本地发行包
 * ----------------------------------------------------------------------------
 *  产物 release/mathflow-<version>.zip 里包含：
 *    dist/         已构建的前端（相对路径 base，可直接静态托管）
 *    server/       零依赖 Node HTTP 服务
 *    bin/          mathflow 命令行入口
 *    templates/    `mathflow init` 用的模板工作区
 *    start-*.cmd   双击启动脚本（自动建 workspace/ 再开浏览器）
 *  解包后不需要 npm install：运行时只依赖 Node 18+ 内置模块。
 * ============================================================================
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ZipWriter } from './zip.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

const C = { reset: '\u001b[0m', green: '\u001b[32m', gray: '\u001b[90m', red: '\u001b[31m' }
const c = (code, s) => `${code}${s}${C.reset}`
const log = (s) => console.log(`  ${c(C.green, '·')} ${s}`)

const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'))
const VERSION = pkg.version

const DIST_PKG = {
  name: 'mathflow',
  version: VERSION,
  private: true,
  type: 'module',
  description: pkg.description,
  bin: { mathflow: 'bin/mathflow.mjs' },
  engines: { node: '>=18' },
  scripts: { start: 'node bin/mathflow.mjs .' },
}

const START_CMD = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   没有找到 Node.js。请先安装 Node 18 或更高版本：https://nodejs.org/
  echo.
  pause
  exit /b 1
)
if not exist "workspace" (
  node "bin\\mathflow.mjs" init "workspace"
)
node "bin\\mathflow.mjs" "workspace" %*
if errorlevel 1 pause
`

const START_SH = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js，请先安装 Node 18 或更高版本：https://nodejs.org/"
  exit 1
fi
[ -d workspace ] || node bin/mathflow.mjs init workspace
exec node bin/mathflow.mjs workspace "$@"
`

/* ------------------------------------------------------------------ */

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败（退出码 ${r.status}）`)
}

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

/** 递归收集文件，返回 [zip 内路径, 绝对路径] */
async function collect(dir, prefix, out, filter = () => true) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const abs = path.join(dir, e.name)
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) await collect(abs, rel, out, filter)
    else if (filter(rel)) out.push([rel, abs])
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n  MathFlow 打包 v${VERSION}\n`)

  // 1) 前端产物
  if (!(await exists(path.join(ROOT, 'dist/index.html'))) || process.argv.includes('--rebuild')) {
    log('构建前端…')
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { shell: process.platform === 'win32' })
  } else {
    log('复用已有的 dist/（加 --rebuild 可强制重建）')
  }

  // 2) Node 端编译引擎（CLI 批量导出用）
  log('构建编译引擎…')
  run(process.execPath, [path.join(ROOT, 'scripts/build-engine.mjs')])

  // 3) 收集文件
  const files = []
  await collect(path.join(ROOT, 'dist'), 'dist', files)
  await collect(path.join(ROOT, 'server'), 'server', files)
  await collect(path.join(ROOT, 'bin'), 'bin', files)
  await collect(path.join(ROOT, 'templates'), 'templates', files)
  files.push(['README.md', path.join(ROOT, 'README.md')])

  // 4) 写入 zip（发行包统一解到 mathflow-<version>/ 目录下）
  const zip = new ZipWriter()
  const pkgDir = `mathflow-${VERSION}`
  zip.add(`${pkgDir}/package.json`, Buffer.from(JSON.stringify(DIST_PKG, null, 2) + '\n', 'utf8'))
  zip.add(`${pkgDir}/start-windows.cmd`, Buffer.from(START_CMD.replace(/\n/g, '\r\n'), 'utf8'))
  zip.add(`${pkgDir}/start-mac-linux.command`, Buffer.from(START_SH, 'utf8'), { mode: 0o755 })

  let total = 0
  for (const [rel, abs] of files) {
    const data = await fs.readFile(abs)
    total += data.length
    zip.add(`${pkgDir}/${rel}`, data)
  }

  const outDir = path.join(ROOT, 'release')
  await fs.mkdir(outDir, { recursive: true })
  const outFile = path.join(outDir, `mathflow-${VERSION}.zip`)
  await fs.writeFile(outFile, zip.finish())

  const stat = await fs.stat(outFile)
  console.log(`
  ${c(C.green, '✓')} ${path.relative(ROOT, outFile)}
    文件 ${files.length + 3} 个，原始 ${(total / 1024 / 1024).toFixed(1)} MB，压缩后 ${(stat.size / 1024 / 1024).toFixed(1)} MB

  ${c(C.gray, '解包后双击 start-windows.cmd（或 start-mac-linux.command）即可运行，无需 npm install。')}
`)
}

main().catch((e) => {
  console.error(`\n  ${c(C.red, '✗')} ${e.message}\n`)
  process.exit(1)
})
