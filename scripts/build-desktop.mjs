/**
 * ============================================================================
 *  组装 Electron 桌面版
 * ----------------------------------------------------------------------------
 *  electron-builder 在本机会卡在「解压目录改名」这一步（批量文件操作被拦），
 *  所以这里直接手工拼一个标准 Electron 应用目录：
 *
 *    MathFlow/
 *      MathFlow.exe          ← electron.exe 改名
 *      resources/app/        ← 我们自己的代码（dist + server + electron + templates）
 *      *.dll / locales/ …    ← Electron 运行时
 *
 *  再用 scripts/zip.mjs 压成 release/MathFlow-Desktop-<ver>.zip。
 *
 *  用法：npm run desktop:pack
 * ============================================================================
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZipWriter } from './zip.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist')
const OUT_ROOT = path.join(ROOT, 'release', 'MathFlow-App')
const APP_DIR = path.join(OUT_ROOT, 'MathFlow')
const APP_RES = path.join(APP_DIR, 'resources', 'app')
const ZIP_PATH = path.join(ROOT, 'release', 'MathFlow-Desktop-1.0.0.zip')

const VERSION = '1.0.0'

const log = (s) => console.log(`  ${s}`)
const step = (s) => console.log(`\n▸ ${s}`)

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

async function walk(dir, base = dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) await walk(abs, base, out)
    else out.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/') })
  }
  return out
}

async function main() {
  if (!(await exists(ELECTRON_DIST))) {
    throw new Error('node_modules/electron/dist 不存在，请先执行：node node_modules/electron/install.js')
  }
  if (!(await exists(path.join(ROOT, 'dist', 'index.html')))) {
    throw new Error('dist/ 不存在，请先执行 npm run build')
  }
  if (!(await exists(path.join(ROOT, 'server', 'lib', 'engine.mjs')))) {
    throw new Error('缺少 server/lib/engine.mjs，请先执行 node scripts/build-engine.mjs')
  }

  console.log(`\n  MathFlow 桌面版打包  v${VERSION}`)

  // 1. 准备输出目录
  //    不做「删旧目录」：Windows 上刚退出的 exe 句柄会占用一会儿，
  //    直接覆盖更新更省事，旧版本残留的 hashed 静态文件不影响运行。
  if (await exists(APP_DIR)) {
    log('已有产物，就地覆盖更新')
  } else {
    await fs.mkdir(APP_DIR, { recursive: true })
  }

  // 2. 复制 Electron 运行时
  step('复制 Electron 运行时')
  const files = await walk(ELECTRON_DIST)
  for (const f of files) {
    const dest = path.join(APP_DIR, f.rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(f.abs, dest)
  }
  log(`${files.length} 个文件（${(files.reduce((n, f) => n + 0, 0), '')}运行时）`)

  // 3. electron.exe → MathFlow.exe
  const exeSrc = path.join(APP_DIR, 'electron.exe')
  const exeDst = path.join(APP_DIR, 'MathFlow.exe')
  if ((await exists(exeSrc)) && (await exists(exeDst))) {
    // 上一版已经改过名，这次复制回来的 electron.exe 是多余的
    await fs.unlink(exeSrc)
    log('MathFlow.exe 已存在，清理多余的 electron.exe')
  } else if (await exists(exeSrc)) {
    await fs.rename(exeSrc, exeDst)
    log('electron.exe → MathFlow.exe')
  }

  // 4. 放我们自己的代码
  step('组装应用')
  await fs.mkdir(APP_RES, { recursive: true })
  for (const dir of ['dist', 'server', 'templates', 'electron']) {
    await fs.cp(path.join(ROOT, dir), path.join(APP_RES, dir), { recursive: true })
    log(`+ ${dir}/`)
  }
  const pkg = {
    name: 'mathflow',
    productName: 'MathFlow',
    version: VERSION,
    description: 'Markdown 为主、LaTeX 为辅的混合学术编辑器',
    main: 'electron/main.cjs',
    author: 'MathFlow',
  }
  await fs.writeFile(path.join(APP_RES, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8')
  log('+ package.json')

  // 5. 打 zip
  step('压缩')
  const zip = new ZipWriter()
  const all = await walk(APP_DIR)
  let done = 0
  for (const f of all) {
    const data = await fs.readFile(f.abs)
    // 只有已经压过的可执行文件原样存储，其余（.pak/.dll/字体）照常 deflate
    const store = false  // 全量 deflate：electron.exe 能压掉一半多，zip 体积从 290MB 降到 ~100MB
    zip.add(`MathFlow/${f.rel}`, data, { store })
    done++
    if (done % 20 === 0) process.stdout.write(`\r    ${done}/${all.length}`)
  }
  await fs.writeFile(ZIP_PATH, zip.finish())
  process.stdout.write(`\r    ${all.length}/${all.length}\n`)

  const size = (await fs.stat(ZIP_PATH)).size
  log(`release/${path.basename(ZIP_PATH)}  ${(size / 1024 / 1024).toFixed(0)} MB`)

  console.log(`
  ✓ 桌面版就绪

  直接运行：release\\MathFlow-App\\MathFlow\\MathFlow.exe
  分发：把 release\\${path.basename(ZIP_PATH)} 发给别人，解压后双击 MathFlow.exe
`)
}

main().catch((e) => {
  console.error(`\n  ✗ ${e?.message ?? e}\n`)
  if (process.env.MATHFLOW_DEBUG) console.error(e)
  process.exit(1)
})
