import http from 'node:http'
import { promises as fs, watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {
  HttpError,
  readTree,
  readTextFile,
  writeTextFile,
  createTextFile,
  createDirectory,
  movePath,
  trashPath,
  restorePath,
  collectBibliography,
  collectLabels,
  workspaceSummary,
  safeJoin,
  toRel,
  DOC_EXTENSIONS,
} from './fsapi.mjs'

/**
 * ============================================================================
 *  index.mjs —— MathFlow 本地服务
 * ----------------------------------------------------------------------------
 *  Jupyter Lab 式的工作方式：终端里起一个进程，浏览器访问 localhost，
 *  左侧栏就是磁盘上的真实目录，保存即落盘。
 *
 *  同时它也是一台纯粹的静态服务器 —— 如果要把它放在内网给别人用，
 *  加 --host 0.0.0.0 即可（默认只监听 127.0.0.1，避免文件被局域网随意读写）。
 * ============================================================================
 */

/**
 * 打包成单文件 exe（Node SEA）以后没有 import.meta.url，
 * 这里退化成 exe 所在目录，避免模块一加载就抛错。
 */
const HERE = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    return path.dirname(process.execPath)
  }
})()
const PKG_ROOT = path.resolve(HERE, '..')
const DIST_DIR = path.join(PKG_ROOT, 'dist')
const VERSION = '1.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.csv': 'text/csv; charset=utf-8',
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

function readBody(req, limit = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new HttpError(413, '请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new HttpError(400, '请求体不是合法的 JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** 简单全文检索：对每个文档做不区分大小写的匹配，返回上下文片段 */
async function searchWorkspace(root, query, limit = 60) {
  const q = query.trim()
  if (!q) return []
  const hits = []
  const lower = q.toLowerCase()

  async function walk(rel, depth) {
    if (depth > 8 || hits.length >= limit) return
    let entries
    try {
      entries = await fs.readdir(safeJoin(root, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (hits.length >= limit) return
      if (e.isSymbolicLink() || e.name.startsWith('.') || e.name === 'node_modules') continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        await walk(childRel, depth + 1)
        continue
      }
      if (!DOC_EXTENSIONS.has(path.extname(e.name).toLowerCase())) continue
      let text
      try {
        text = await fs.readFile(safeJoin(root, childRel), 'utf8')
      } catch {
        continue
      }
      const hay = text.toLowerCase()
      let idx = hay.indexOf(lower)
      let shown = 0
      while (idx !== -1 && shown < 3) {
        const start = Math.max(0, idx - 40)
        const snippet = text.slice(start, idx + q.length + 60).replace(/\s+/g, ' ')
        const line = text.slice(0, idx).split('\n').length
        hits.push({ file: childRel, line, snippet, offset: idx })
        shown++
        idx = hay.indexOf(lower, idx + q.length)
      }
    }
  }

  await walk('', 0)
  return hits
}

/* ------------------------------------------------------------------ */
/* 静态文件                                                            */
/* ------------------------------------------------------------------ */

async function serveStatic(req, res, distDir, embedded = null) {
  const url = new URL(req.url, 'http://localhost')
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/' || rel === '') rel = '/index.html'

  // 单文件 exe 把前端产物编译进了可执行文件，优先从内存里取
  if (embedded) {
    const hit = embedded[rel] ?? (path.extname(rel) ? null : embedded['/index.html'])
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }
    const data = Buffer.from(hit, 'base64')
    const immutable = /\/assets\//.test(rel)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(rel).toLowerCase()] ?? 'text/html; charset=utf-8',
      'Content-Length': data.length,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(req.method === 'HEAD' ? undefined : data)
    return
  }

  const abs = path.join(distDir, rel)
  if (!abs.startsWith(distDir + path.sep) && abs !== distDir) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const stat = await fs.stat(abs)
    if (stat.isDirectory()) throw new Error('dir')
    const data = await fs.readFile(abs)
    const ext = path.extname(abs).toLowerCase()
    // 带 hash 的构建产物可以长缓存，index.html 必须每次校验
    const immutable = /\/assets\//.test(rel)
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch {
    // SPA 回退
    try {
      const index = await fs.readFile(path.join(distDir, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      res.end(index)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><meta charset="utf-8"><body style="font:15px/1.7 system-ui;padding:48px;color:#2f3846">
         <h2>还没有构建前端产物</h2>
         <p>本地服务已经起来了，但 <code>dist/</code> 不存在。请先执行：</p>
         <pre style="background:#f1f3f7;padding:12px 16px;border-radius:8px">npm install &amp;&amp; npm run build</pre>
         <p>如果是开发模式，请另开一个终端跑 <code>npm run dev</code>，API 会自动被 Vite 代理过去。</p>
         </body>`
      )
    }
  }
}

/* ------------------------------------------------------------------ */
/* 工作区静态资源（/ws/…）                                             */
/* ------------------------------------------------------------------ */

/**
 * 让文档里的相对路径能直接取到工作区里的文件：
 *   `![](figs/a.png)`、`<img src="figs/a.png">`、`<video src="demo.mp4">`
 * 渲染时会被改写成 `/ws/figs/a.png`，由这里读出磁盘上的字节。
 *
 * 只读、只限工作区内（safeJoin 挡 `..` 与越界），不做任何写入。
 * 视频支持 Range 请求，拖动进度条才正常。
 */
async function serveWorkspaceAsset(req, res, root) {
  const url = new URL(req.url, 'http://localhost')
  const rel = decodeURIComponent(url.pathname).replace(/^\/ws\/?/, '')
  if (!rel) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found')
    return
  }

  const abs = safeJoin(root, rel)
  let stat
  try {
    stat = await fs.stat(abs)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found')
    return
  }
  if (!stat.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found')
    return
  }

  const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream'
  const base = {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  }

  // 视频 / 音频拖动进度条时会带 Range，切一段返回 206
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''))
  if (range && stat.size > 0) {
    let start = range[1] === '' ? null : Number(range[1])
    let end = range[2] === '' ? null : Number(range[2])
    if (start === null && end !== null) {
      start = Math.max(0, stat.size - end)
      end = stat.size - 1
    }
    start = start ?? 0
    end = Math.min(end ?? stat.size - 1, stat.size - 1)
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end()
      return
    }
    const data = await fs.readFile(abs)
    const chunk = data.subarray(start, end + 1)
    res.writeHead(206, {
      ...base,
      'Content-Length': chunk.length,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    })
    res.end(req.method === 'HEAD' ? undefined : chunk)
    return
  }

  const data = await fs.readFile(abs)
  res.writeHead(200, { ...base, 'Content-Length': data.length })
  res.end(req.method === 'HEAD' ? undefined : data)
}

/* ------------------------------------------------------------------ */
/* 文件变更推送（SSE）                                                  */
/* ------------------------------------------------------------------ */

function attachWatcher(req, res, root) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(`event: ready\ndata: ${JSON.stringify({ root })}\n\n`)

  const pending = new Set()
  let timer = null
  const flush = () => {
    timer = null
    if (!pending.size) return
    const paths = [...pending]
    pending.clear()
    res.write(`event: change\ndata: ${JSON.stringify({ paths })}\n\n`)
  }

  let watcher = null
  try {
    watcher = watch(root, { recursive: true }, (_event, filename) => {
      if (!filename) return
      const rel = String(filename).split(path.sep).join('/')
      if (rel.startsWith('.mathflow-trash') || rel.includes('node_modules') || rel.includes('.git')) return
      pending.add(rel)
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 240)
    })
  } catch {
    /* 某些文件系统不支持递归 watch，静默降级 */
  }

  const ping = setInterval(() => res.write(': ping\n\n'), 25000)

  const cleanup = () => {
    clearInterval(ping)
    if (timer) clearTimeout(timer)
    try {
      watcher?.close()
    } catch {
      /* ignore */
    }
  }
  req.on('close', cleanup)
  req.on('error', cleanup)
}

/* ------------------------------------------------------------------ */
/* API 路由                                                            */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, root, opts) {
  const url = new URL(req.url, 'http://localhost')
  const route = url.pathname.replace(/^\/api/, '') || '/'
  const q = url.searchParams
  const method = req.method ?? 'GET'

  /* 健康检查：前端靠它判断当前是不是「本地模式」 */
  if (route === '/health' && method === 'GET') {
    const summary = await workspaceSummary(root)
    return json(res, 200, {
      ok: true,
      mode: 'local',
      version: VERSION,
      workspace: { root, name: path.basename(root) },
      readonly: !!opts.readonly,
      summary,
    })
  }

  if (route === '/tree' && method === 'GET') {
    const nodes = await readTree(root, q.get('path') ?? '')
    return json(res, 200, { root, name: path.basename(root), nodes })
  }

  if (route === '/index' && method === 'GET') {
    const [labels, bib] = await Promise.all([collectLabels(root), collectBibliography(root)])
    return json(res, 200, { labels, bib })
  }

  if (route === '/file' && method === 'GET') {
    const rel = q.get('path')
    if (!rel) throw new HttpError(400, '缺少 path 参数')
    return json(res, 200, await readTextFile(root, rel))
  }

  if (route === '/file' && method === 'PUT') {
    assertWritable(opts)
    const rel = q.get('path')
    if (!rel) throw new HttpError(400, '缺少 path 参数')
    const body = await readBody(req)
    // 乐观并发：调用方带上读到的 hash，磁盘内容变了就拒绝，防止覆盖外部编辑
    if (body.baseHash) {
      try {
        const current = await readTextFile(root, rel)
        if (current.hash !== body.baseHash) {
          return json(res, 409, {
            error: 'conflict',
            message: '文件已在外部被修改',
            disk: { hash: current.hash, content: current.content, mtime: current.mtime },
          })
        }
      } catch {
        /* 文件已不存在：当作新建写入 */
      }
    }
    return json(res, 200, await writeTextFile(root, rel, body.content ?? ''))
  }

  if (route === '/file' && method === 'POST') {
    assertWritable(opts)
    const body = await readBody(req)
    if (!body.path) throw new HttpError(400, '缺少 path')
    return json(res, 201, await createTextFile(root, body.path, body.content ?? ''))
  }

  if (route === '/file' && method === 'DELETE') {
    assertWritable(opts)
    const rel = q.get('path')
    if (!rel) throw new HttpError(400, '缺少 path 参数')
    return json(res, 200, await trashPath(root, rel))
  }

  if (route === '/dir' && method === 'POST') {
    assertWritable(opts)
    const body = await readBody(req)
    if (!body.path) throw new HttpError(400, '缺少 path')
    return json(res, 201, await createDirectory(root, body.path))
  }

  if (route === '/move' && method === 'POST') {
    assertWritable(opts)
    const body = await readBody(req)
    if (!body.from || !body.to) throw new HttpError(400, '缺少 from / to')
    return json(res, 200, await movePath(root, body.from, body.to))
  }

  if (route === '/restore' && method === 'POST') {
    assertWritable(opts)
    const body = await readBody(req)
    if (!body.trashedTo || !body.target) throw new HttpError(400, '缺少 trashedTo / target')
    return json(res, 200, await restorePath(root, body.trashedTo, body.target))
  }

  if (route === '/search' && method === 'GET') {
    const hits = await searchWorkspace(root, q.get('q') ?? '')
    return json(res, 200, { hits })
  }

  if (route === '/watch' && method === 'GET') {
    return attachWatcher(req, res, root)
  }

  /* 批量导出：把工作区里的文档按模板编译，返回结果清单 */
  if (route === '/export' && method === 'POST') {
    if (!opts.exportHandler) throw new HttpError(501, '导出引擎未加载')
    const body = await readBody(req)
    const result = await opts.exportHandler({
      root,
      files: body.files,
      to: body.to ?? ['tex', 'html'],
      template: body.template ?? 'ctexart',
      outDir: body.outDir ?? 'export',
      combine: body.combine,
      title: body.title,
    })
    return json(res, 200, result)
  }

  throw new HttpError(404, `未知接口 ${route}`)
}

function assertWritable(opts) {
  if (opts.readonly) throw new HttpError(403, '当前以只读模式启动，禁止写入')
}

/* ------------------------------------------------------------------ */
/* 服务器                                                              */
/* ------------------------------------------------------------------ */

export function createApp({
  root,
  readonly = false,
  distDir = DIST_DIR,
  exportHandler = null,
  embeddedAssets = null,
} = {}) {
  const absRoot = path.resolve(root)
  const opts = { readonly, exportHandler }

  const server = http.createServer(async (req, res) => {
    // 只服务本机：挡掉 DNS rebinding 与跨站写入
    const origin = req.headers.origin
    if (origin) {
      const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)
      if (!allowed) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('只允许来自 localhost 的跨源请求')
        return
      }
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    try {
      if (req.url.startsWith('/api/')) {
        await handleApi(req, res, absRoot, opts)
        return
      }
      if (req.url.startsWith('/ws/')) {
        await serveWorkspaceAsset(req, res, absRoot)
        return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end('Method Not Allowed')
        return
      }
      await serveStatic(req, res, distDir, embeddedAssets)
    } catch (err) {
      if (res.headersSent) {
        try {
          res.end()
        } catch {
          /* ignore */
        }
        return
      }
      const status = err instanceof HttpError ? err.status : 500
      if (status >= 500) console.error('[mathflow]', err)
      json(res, status, { error: err?.code ?? 'error', message: err?.message ?? String(err) })
    }
  })

  server.on('clientError', (_err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  })

  return server
}

/** 端口被占用时自动往后找，最多试 20 个 */
export async function listenWithFallback(server, startPort, host) {
  for (let i = 0; i < 20; i++) {
    const port = startPort + i
    const ok = await new Promise((resolve) => {
      const onError = (err) => {
        server.removeListener('listening', onListening)
        if (err.code === 'EADDRINUSE') resolve(false)
        else resolve(err)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        resolve(true)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, host)
    })
    if (ok === true) return port
    if (ok instanceof Error) throw ok
  }
  throw new Error(`端口 ${startPort}~${startPort + 19} 都被占用，请用 --port 指定其它端口`)
}

export { DIST_DIR, VERSION }
