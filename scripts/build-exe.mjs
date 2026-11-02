/**
 * ============================================================================
 *  打包成单文件 Windows exe
 * ----------------------------------------------------------------------------
 *  思路：Node 官方 SEA（Single Executable Application）
 *    1. 把 dist/ 前端产物、templates/ 模板、KaTeX 样式全部 base64 内联；
 *    2. esbuild 把 server/ + 编译引擎打成一份 CJS；
 *    3. node --experimental-sea-config 生成 blob；
 *    4. 复制 node.exe，用 postject 把 blob 注入进去。
 *
 *  产物：release/MathFlow.exe，双击即用，目标机器不需要装 Node。
 *  只能在 Windows 上构建 Windows exe（SEA 用的是宿主机的 node 二进制）。
 *
 *  用法：npm run exe
 * ============================================================================
 */
import { promises as fs, copyFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// esbuild 由 vite 带进来，可能没装全，给一句人话而不是堆栈
let esbuild
try {
  esbuild = await import('esbuild')
} catch {
  console.error('\n  ✗ 缺少 esbuild，请先在项目根目录执行 npm install\n')
  process.exit(1)
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DIST = path.join(ROOT, 'dist')
const TEMPLATES = path.join(ROOT, 'templates', 'workspace')
const GENERATED = path.join(ROOT, 'server', 'generated')
const BUILD = path.join(ROOT, 'build')
const RELEASE = path.join(ROOT, 'release')
const OUT_EXE = path.join(RELEASE, 'MathFlow.exe')

const SENTINEL = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

const log = (s) => console.log(`  ${s}`)
const step = (s) => console.log(`\n▸ ${s}`)

async function walkFiles(dir, base = dir) {
  const out = []
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkFiles(abs, base)))
    else out.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/') })
  }
  return out
}

async function requireInputs() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/ 不存在，请先执行 npm run build')
  }
  for (const f of ['engine.mjs', 'katex-inline.css']) {
    const p = path.join(ROOT, 'server', 'lib', f)
    if (!existsSync(p)) throw new Error(`缺少 server/lib/${f}，请先执行 node scripts/build-engine.mjs`)
  }
}

/** dist 与模板 → 一份内联的 JS 模块 */
async function generateAssets() {
  step('内联静态资源与模板')
  await fs.mkdir(GENERATED, { recursive: true })

  const assets = {}
  for (const f of await walkFiles(DIST)) {
    const buf = await fs.readFile(f.abs)
    assets['/' + f.rel] = buf.toString('base64')
  }

  const templates = {}
  for (const f of await walkFiles(TEMPLATES)) {
    templates[f.rel] = await fs.readFile(f.abs, 'utf8')
  }

  const katexCss = await fs.readFile(path.join(ROOT, 'server', 'lib', 'katex-inline.css'), 'utf8')

  const totalRaw = Object.values(assets).reduce((n, b) => n + b.length, 0)
  const code = `/* 由 scripts/build-exe.mjs 生成，请勿手改 */
export const assets = ${JSON.stringify(assets)}
export const templates = ${JSON.stringify(templates)}
export const katexCss = ${JSON.stringify(katexCss)}
`
  await fs.writeFile(path.join(GENERATED, 'assets.generated.mjs'), code, 'utf8')

  log(`${Object.keys(assets).length} 个前端文件（内联后 ${(totalRaw / 1024 / 1024).toFixed(1)} MB base64）`)
  log(`${Object.keys(templates).length} 个模板文件`)
  return code.length
}

/** 服务端 + 引擎 → 单份 CJS */
async function bundleServer() {
  step('编译服务端')
  mkdirSync(BUILD, { recursive: true })
  const outfile = path.join(BUILD, 'sea-bundle.cjs')
  const res = await esbuild.build({
    entryPoints: [path.join(ROOT, 'bin', 'desktop.mjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile,
    legalComments: 'none',
    logLevel: 'silent',
    banner: { js: '/* MathFlow desktop bundle (generated) */' },
  })
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.text).join('\n'))
  const kb = (statSync(outfile).size / 1024 / 1024).toFixed(1)
  log(`sea-bundle.cjs  ${kb} MB`)
  return outfile
}

/** 生成 SEA blob */
function buildBlob(bundle) {
  step('生成 SEA blob')
  const configPath = path.join(BUILD, 'sea-config.json')
  const blobPath = path.join(BUILD, 'sea-prep.blob')
  const config = {
    main: bundle,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' })
  log(`sea-prep.blob  ${(statSync(blobPath).size / 1024 / 1024).toFixed(1)} MB`)
  return blobPath
}

/** 复制 node.exe 并注入 blob */
function inject(blob) {
  step('注入到 exe')
  mkdirSync(RELEASE, { recursive: true })
  copyFileSync(process.execPath, OUT_EXE)
  log(`已复制 ${path.basename(process.execPath)}（Node ${process.versions.node}）`)

  // postject 是官方推荐的 SEA 注入工具，首次运行会临时下载
  execFileSync('npx', ['--yes', 'postject@1.0.0-alpha.6', OUT_EXE, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', SENTINEL], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  const mb = (statSync(OUT_EXE).size / 1024 / 1024).toFixed(0)
  log(`已将 blob 写入 exe`)
  return mb
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('\n  ⚠ 这个脚本用宿主机的 node 二进制当底座，只能在 Windows 上产出 exe。')
    console.log('    在 macOS / Linux 上请用 start-mac-linux.command 或 bin/mathflow.mjs。\n')
    process.exit(1)
  }

  console.log('\n  MathFlow 单文件打包')

  await requireInputs()
  await generateAssets()
  const bundle = await bundleServer()
  const blob = buildBlob(bundle)
  const mb = inject(blob)

  console.log(`
  ✓ 完成：release\\MathFlow.exe（${mb} MB）

  双击即可运行；首次会在 exe 同目录生成 workspace\\ 并打开浏览器。
  把这个 exe 单独拷到任何 Windows 电脑都能用，不需要装 Node。
`)
}

main().catch((e) => {
  console.error(`\n  ✗ ${e?.message ?? e}\n`)
  if (process.env.MATHFLOW_DEBUG) console.error(e)
  process.exit(1)
})
