#!/usr/bin/env node
/**
 * 一条命令产出「可以发给别人」的东西。
 *
 *   npm run dist             # 安装版 + 便携版
 *   npm run dist -- --only=setup      # 只出安装包
 *   npm run dist -- --only=portable   # 只出便携版
 *   npm run dist -- --skip-build      # 跳过前端构建（dist/ 已是最新时）
 *
 * 产出：
 *   release/installer/MathFlow-Setup-<ver>.exe     安装版（桌面 + 开始菜单 + 卸载器）
 *   release/portable/MathFlow-Portable-<ver>.exe     便携版（单文件，工作区在 exe 旁）
 *   release/发给别人/                               上述文件 + 使用说明 + 校验值
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'))
const VERSION = pkg.version

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const only = opt('only', 'all')
const targets = only === 'setup' ? ['nsis'] : only === 'portable' ? ['portable'] : ['nsis', 'portable']

const BUILD_DIR = path.join(ROOT, 'release', 'build')
const OUT_SETUP = path.join(ROOT, 'release', 'installer')
const OUT_PORTABLE = path.join(ROOT, 'release', 'portable')
const KIT_DIR = path.join(ROOT, 'release', '发给别人')

const log = (m) => console.log(`  ${m}`)
const c = { green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` }

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      // 外部注入的 --require 钩子会拦截构建时的目录清理，构建过程不需要它
      env: { ...process.env, NODE_OPTIONS: '', ...opts.env },
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`))))
    child.on('error', reject)
  })
}

async function exists(p) {
  return fs.access(p).then(() => true, () => false)
}

async function sha256(file) {
  const buf = await fs.readFile(file)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(0)} MB`

// ---------------------------------------------------------------- 预检
console.log(`\n${c.bold('MathFlow 打包')}  v${VERSION}\n`)

if (!flag('--skip-build')) {
  log('构建前端产物…')
  await run('npm', ['run', 'build'])
} else if (!(await exists(path.join(ROOT, 'dist', 'index.html')))) {
  throw new Error('dist/index.html 不存在，去掉 --skip-build 重新构建')
}

if (!(await exists(path.join(ROOT, 'server', 'lib', 'engine.mjs')))) {
  log('编译 Node 端 LaTeX 引擎…')
  await run('node', ['scripts/build-engine.mjs'])
}

if (!(await exists(path.join(ROOT, 'electron', 'resources', 'icon.ico')))) {
  log('生成图标…')
  await run('node', ['scripts/build-icon.mjs'])
}

// ---------------------------------------------------------------- 打包
await fs.mkdir(BUILD_DIR, { recursive: true })
log(`electron-builder → ${path.relative(ROOT, BUILD_DIR)}  [${targets.join(' + ')}]`)

await run(
  'npx',
  [
    'electron-builder',
    '--win',
    ...targets,
    '--config',
    'electron-builder.yml',
    `-c.directories.output=${path.relative(ROOT, BUILD_DIR)}`,
  ],
  { env: { ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/' } },
)

// ---------------------------------------------------------------- 归档
const produced = (await fs.readdir(BUILD_DIR)).filter((f) => f.toLowerCase().endsWith('.exe'))
const setup = produced.find((f) => /^MathFlow-Setup-/.test(f))
const portable = produced.find((f) => /Portable/i.test(f))

await fs.mkdir(OUT_SETUP, { recursive: true })
await fs.mkdir(OUT_PORTABLE, { recursive: true })
await fs.mkdir(KIT_DIR, { recursive: true })

const kit = []
if (setup) {
  const dest = path.join(OUT_SETUP, setup)
  await fs.copyFile(path.join(BUILD_DIR, setup), dest)
  kit.push([dest, '安装版（推荐）'])
}

if (portable) {
  const dest = path.join(OUT_PORTABLE, portable)
  await fs.copyFile(path.join(BUILD_DIR, portable), dest)
  kit.push([dest, '便携版（免安装）'])
}

for (const [file] of kit) await fs.copyFile(file, path.join(KIT_DIR, path.basename(file)))

// ---------------------------------------------------------------- 说明与校验
const readme = `MathFlow 学术编辑器 v${VERSION}
=====================================

MathFlow 是一个本地学术写作工具：正文写 Markdown，公式用 $...$，
光标移开时公式原地排版；能导出 LaTeX（可直接丢进 Overleaf）和自包含网页（可打印成 PDF）。
不联网、不要账号，文稿全部保存在你自己的电脑上。

-------------------------------------
该运行哪个？
-------------------------------------

【MathFlow-Setup-${VERSION}.exe】  安装版，推荐给绝大多数人
  双击 → 下一步 → 完成。会出现在桌面和开始菜单，随时可卸载。

【MathFlow-Portable-${VERSION}.exe】 免安装
  双击即用，适合放 U 盘、或者没有安装权限的电脑。
  文稿会保存在这个 exe 旁边的 workspace 文件夹里，整个文件夹拷走就带走了全部内容。
  缺点：每次启动要解压，第一次启动约 5-10 秒。

-------------------------------------
第一次打开要注意
-------------------------------------

Windows 可能弹出蓝色的「Windows 已保护你的电脑」。
这是因为我没买代码签名证书，属于正常提示，不是病毒。处理方法：

  1. 点提示框里的「更多信息」
  2. 点「仍要运行」

只需处理一次，之后不再提示。

-------------------------------------
文稿在哪
-------------------------------------

  安装版：C:\\Users\\<你的用户名>\\Documents\\MathFlow
  便携版：便携版 exe 旁边的 workspace 文件夹

里面是普通的 .md 文本文件，可以用 VSCode、Typora、记事本打开，也可以用 git 管理。
卸载软件不会删除这些文稿。

想写自己的论文：菜单「文件 → 打开工作区文件夹」，选你的目录即可，下次自动记住。

-------------------------------------
常用操作
-------------------------------------

  Ctrl+O          打开别的文件夹
  Ctrl+Shift+E    导出整本（生成 main.tex + main.html + 各章节）
  Ctrl+S          立即保存（平时不用按，停止输入 0.8 秒会自动保存）

  输入 @          补全交叉引用 / 文献
  输入 ;a         插入希腊字母 α（;b → β，;l → λ ……）
  输入 //         插入分式

三种视图：内联混合（推荐，边写边看排版）、左右分屏、纯源码。

-------------------------------------
卸载
-------------------------------------

  设置 → 应用 → 已安装的应用 → MathFlow 学术编辑器 → 卸载
  或：开始菜单 → MathFlow → 卸载

卸载会删掉程序，但保留 Documents\\MathFlow 里的文稿。

-------------------------------------
文件校验（可选）
-------------------------------------

如果担心下载过程出错，可以在 PowerShell 里核对 SHA256：

  Get-FileHash .\\MathFlow-Setup-${VERSION}.exe -Algorithm SHA256

应与 SHA256.txt 里的一致。
`

await fs.writeFile(path.join(KIT_DIR, '使用说明.txt'), readme, 'utf8')

const lines = []
for (const [file] of kit) {
  const st = await fs.stat(file)
  lines.push(`${await sha256(file)}  ${path.basename(file)}  (${mb(st.size)})`)
}
await fs.writeFile(path.join(KIT_DIR, 'SHA256.txt'), lines.join('\n') + '\n', 'utf8')

// ---------------------------------------------------------------- 汇总
console.log(`\n${c.green('✓')} 打包完成\n`)
for (const [file, label] of kit) {
  const st = await fs.stat(file)
  console.log(`  ${c.bold(label.padEnd(16))} ${path.relative(ROOT, file)}  ${c.dim(mb(st.size))}`)
}
console.log(`\n  发给别人：把 ${c.bold(path.relative(ROOT, KIT_DIR))} 整个文件夹压缩后发过去`)
console.log(`  ${c.dim('（含使用说明与 SHA256 校验值）')}\n`)
