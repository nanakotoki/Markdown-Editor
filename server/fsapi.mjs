import { promises as fs, createReadStream } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

/**
 * ============================================================================
 *  fsapi.mjs —— 工作区文件系统访问层
 * ----------------------------------------------------------------------------
 *  所有磁盘操作的唯一入口。设计原则：
 *   1. 任何相对路径都必须经过 safeJoin() 校验，永远不能逃出工作区根目录；
 *   2. 删除不真删，移入 .mathflow-trash/ 并加时间戳，误删可恢复；
 *   3. 写入用「临时文件 + rename」的原子替换，避免写一半断电导致文档损坏；
 *   4. 目录遍历有深度与条目上限，避免在大仓库上卡死。
 * ============================================================================
 */

/** 可编辑的纯文本后缀 */
export const DOC_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])
/** 树里额外展示、可预览的文件后缀 */
const VISIBLE_EXTENSIONS = new Set([...DOC_EXTENSIONS, '.bib', '.tex', '.txt', '.json', '.yaml', '.yml', '.csv'])

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.vite',
  '.cache',
  '.next',
  '.mathflow-trash',
  '.workbuddy',
  '__pycache__',
])

const MAX_TREE_DEPTH = 10
const MAX_TREE_ENTRIES = 4000
const MAX_FILE_BYTES = 16 * 1024 * 1024
/** 粘贴进来的截图 / 拖进来的资源允许更大一些；base64 后约为原体积的 4/3 */
const MAX_ASSET_BYTES = 40 * 1024 * 1024

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/* ------------------------------------------------------------------ */
/* 路径安全                                                            */
/* ------------------------------------------------------------------ */

/**
 * 把客户端传来的相对路径解析成绝对路径，并断言它落在 root 之内。
 * 同时拒绝 NUL 字节、Windows 保留名与符号链接逃逸。
 */
export function safeJoin(root, rel) {
  const raw = String(rel ?? '')
  if (raw.includes('\u0000')) throw new HttpError(400, '路径包含非法字符')

  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (normalized.split('/').some((seg) => seg === '..')) {
    throw new HttpError(400, '路径不允许包含 ..')
  }

  const absRoot = path.resolve(root)
  const abs = path.resolve(absRoot, normalized)
  if (abs !== absRoot && !abs.startsWith(absRoot + path.sep)) {
    throw new HttpError(403, '路径越界：不允许访问工作区之外的文件')
  }
  return abs
}

/** 相对化，用于返回给前端（始终用 / 分隔） */
export function toRel(root, abs) {
  return path.relative(path.resolve(root), abs).split(path.sep).join('/')
}

/* ------------------------------------------------------------------ */
/* 目录树                                                              */
/* ------------------------------------------------------------------ */

function isVisible(name, isDir) {
  if (name.startsWith('.')) return false
  if (isDir) return !IGNORED_DIRS.has(name)
  return VISIBLE_EXTENSIONS.has(path.extname(name).toLowerCase())
}

/**
 * 递归读取目录树。返回节点：
 * { name, path, type: 'dir'|'file', ext?, size?, mtime?, children? }
 * 目录在前、同类按名称排序，空目录也会保留（用户刚建的空文件夹要能看见）。
 */
export async function readTree(root, rel = '') {
  const absRoot = safeJoin(root, rel)
  const counter = { n: 0 }

  async function walk(absDir, relDir, depth) {
    if (depth > MAX_TREE_DEPTH) return []
    let entries
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true })
    } catch {
      return []
    }

    const dirs = []
    const files = []
    for (const entry of entries) {
      if (counter.n++ > MAX_TREE_ENTRIES) break
      const isDir = entry.isDirectory()
      if (!isVisible(entry.name, isDir)) continue
      // 跳过符号链接，避免递归成环
      if (entry.isSymbolicLink()) continue

      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name
      if (isDir) {
        dirs.push({
          name: entry.name,
          path: childRel,
          type: 'dir',
          children: await walk(path.join(absDir, entry.name), childRel, depth + 1),
        })
      } else {
        let stat = null
        try {
          stat = await fs.stat(path.join(absDir, entry.name))
        } catch {
          /* 文件名在遍历途中消失，忽略 */
        }
        files.push({
          name: entry.name,
          path: childRel,
          type: 'file',
          ext: path.extname(entry.name).toLowerCase(),
          size: stat?.size ?? 0,
          mtime: stat?.mtimeMs ?? 0,
        })
      }
    }

    const byName = (a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
    return [...dirs.sort(byName), ...files.sort(byName)]
  }

  return walk(absRoot, rel, 0)
}

/* ------------------------------------------------------------------ */
/* 单文件读写                                                          */
/* ------------------------------------------------------------------ */

export async function readTextFile(root, rel) {
  const abs = safeJoin(root, rel)
  let stat
  try {
    stat = await fs.stat(abs)
  } catch {
    throw new HttpError(404, `文件不存在：${rel}`)
  }
  if (stat.isDirectory()) throw new HttpError(400, '这是一个目录，不能作为文件打开')
  if (stat.size > MAX_FILE_BYTES) throw new HttpError(413, '文件超过 16MB，无法在编辑器中打开')

  const content = await fs.readFile(abs, 'utf8')
  return {
    path: toRel(root, abs),
    name: path.basename(abs),
    content,
    size: stat.size,
    mtime: stat.mtimeMs,
    hash: createHash('sha1').update(content).digest('hex').slice(0, 12),
  }
}

/** 原子写入：先写同目录下的 .tmp，再 rename 覆盖 */
export async function writeTextFile(root, rel, content) {
  const abs = safeJoin(root, rel)
  if (typeof content !== 'string') throw new HttpError(400, 'content 必须是字符串')
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new HttpError(413, '内容超过 16MB，已拒绝写入')

  await fs.mkdir(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.mf-tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, content, 'utf8')
  try {
    await fs.rename(tmp, abs)
  } catch (e) {
    // Windows 上目标被其他程序占用时 rename 会失败，退化为直接写
    await fs.rm(tmp, { force: true })
    await fs.writeFile(abs, content, 'utf8')
    if (e?.code !== 'EPERM' && e?.code !== 'EACCES' && e?.code !== 'EBUSY') throw e
  }
  const stat = await fs.stat(abs)
  return {
    path: toRel(root, abs),
    mtime: stat.mtimeMs,
    size: stat.size,
    hash: createHash('sha1').update(content).digest('hex').slice(0, 12),
  }
}

/**
 * 二进制写入：粘贴的截图走这里。base64 进，字节落盘。
 * 同样先写临时文件再 rename，避免写一半留下坏图。
 */
export async function writeBinaryFile(root, rel, base64) {
  const abs = safeJoin(root, rel)
  if (typeof base64 !== 'string' || !base64.trim()) throw new HttpError(400, '图片内容为空')
  const buf = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!buf.length) throw new HttpError(400, '图片内容为空')
  if (buf.length > MAX_ASSET_BYTES) throw new HttpError(413, '图片超过 40MB，请先压缩')

  await fs.mkdir(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.mf-tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, buf)
  try {
    await fs.rename(tmp, abs)
  } catch (e) {
    await fs.rm(tmp, { force: true })
    await fs.writeFile(abs, buf)
    if (e?.code !== 'EPERM' && e?.code !== 'EACCES' && e?.code !== 'EBUSY') throw e
  }
  const stat = await fs.stat(abs)
  return { path: toRel(root, abs), size: stat.size, mtime: stat.mtimeMs }
}

/** 新建文件；已存在则报 409，避免覆盖用户内容 */
export async function createTextFile(root, rel, content = '') {
  const abs = safeJoin(root, rel)
  if (!rel.trim()) throw new HttpError(400, '文件名不能为空')
  try {
    await fs.access(abs)
    throw new HttpError(409, `已存在同名文件：${rel}`)
  } catch (e) {
    if (e instanceof HttpError) throw e
  }
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, { encoding: 'utf8', flag: 'wx' })
  const stat = await fs.stat(abs)
  return { path: toRel(root, abs), mtime: stat.mtimeMs, size: stat.size }
}

export async function createDirectory(root, rel) {
  const abs = safeJoin(root, rel)
  if (!rel.trim()) throw new HttpError(400, '目录名不能为空')
  await fs.mkdir(abs, { recursive: true })
  return { path: toRel(root, abs) }
}

/** 移动/重命名；目标已存在时拒绝，防止静默覆盖 */
export async function movePath(root, from, to) {
  const absFrom = safeJoin(root, from)
  const absTo = safeJoin(root, to)
  if (absFrom === absTo) return { path: toRel(root, absTo) }
  try {
    await fs.access(absTo)
    throw new HttpError(409, `目标已存在：${to}`)
  } catch (e) {
    if (e instanceof HttpError) throw e
  }
  await fs.mkdir(path.dirname(absTo), { recursive: true })
  await fs.rename(absFrom, absTo)
  return { path: toRel(root, absTo), from: toRel(root, absFrom) }
}

/**
 * 删除 = 移入 .mathflow-trash/<时间戳>/，保留相对目录结构。
 * 绝不调用 rm -rf 直接销毁用户内容。
 */
export async function trashPath(root, rel) {
  const abs = safeJoin(root, rel)
  const relSafe = toRel(root, abs)
  if (!relSafe) throw new HttpError(400, '不能删除工作区根目录')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const trashRoot = path.join(path.resolve(root), '.mathflow-trash', stamp)
  const dest = path.join(trashRoot, relSafe)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.rename(abs, dest)
  return { trashedTo: toRel(root, dest) }
}

/** 恢复回收站中的条目（用于「撤销删除」） */
export async function restorePath(root, trashedRel, targetRel) {
  const absSrc = safeJoin(root, trashedRel)
  const absDest = safeJoin(root, targetRel)
  try {
    await fs.access(absDest)
    throw new HttpError(409, `目标位置已有同名文件：${targetRel}`)
  } catch (e) {
    if (e instanceof HttpError) throw e
  }
  await fs.mkdir(path.dirname(absDest), { recursive: true })
  await fs.rename(absSrc, absDest)
  return { path: toRel(root, absDest) }
}

/* ------------------------------------------------------------------ */
/* BibTeX 解析与工作区索引                                              */
/* ------------------------------------------------------------------ */

/** 极简 BibTeX 解析：@type{key, field = {value} | "value" | 123} */
export function parseBibtex(source) {
  const out = []
  const re = /@([a-zA-Z]+)\s*\{\s*([^,\s}]+)\s*,([\s\S]*?)\n?\s*\}\s*(?=@|$)/g
  let m
  while ((m = re.exec(source))) {
    const type = m[1].toLowerCase()
    if (type === 'comment' || type === 'preamble' || type === 'string') continue
    const key = m[2].trim()
    const body = m[3]
    const fields = {}
    const fieldRe = /([a-zA-Z]+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,\n]+)/g
    let f
    while ((f = fieldRe.exec(body))) {
      const name = f[1].toLowerCase()
      let value = f[2].trim()
      if (value.startsWith('{') && value.endsWith('}')) value = value.slice(1, -1)
      else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      fields[name] = value.replace(/\s+/g, ' ').replace(/[{}]/g, '').trim()
    }
    out.push({ key, type, ...fields, raw: m[0] })
  }
  return out
}

/** 收集工作区所有 .bib 文件并解析，同名 key 以先出现者为准 */
export async function collectBibliography(root) {
  const files = await listFilesByExt(root, new Set(['.bib']))
  const entries = []
  const seen = new Set()
  for (const rel of files) {
    let text = ''
    try {
      text = await fs.readFile(safeJoin(root, rel), 'utf8')
    } catch {
      continue
    }
    for (const e of parseBibtex(text)) {
      if (seen.has(e.key)) continue
      seen.add(e.key)
      entries.push({
        key: e.key,
        type: e.type,
        author: e.author ?? '',
        title: e.title ?? '',
        year: e.year ?? '',
        journal: e.journal ?? e.booktitle ?? e.publisher ?? '',
        raw: e.raw,
        source: rel,
      })
    }
  }
  return entries
}

/** 递归列出指定后缀的文件（相对路径） */
async function listFilesByExt(root, exts, rel = '', depth = 0) {  if (depth > MAX_TREE_DEPTH) return []
  const absDir = safeJoin(root, rel)
  let entries
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }
  const found = []
  for (const e of entries) {
    if (e.isSymbolicLink()) continue
    const childRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (!isVisible(e.name, true)) continue
      found.push(...(await listFilesByExt(root, exts, childRel, depth + 1)))
    } else if (exts.has(path.extname(e.name).toLowerCase())) {
      if (e.name.startsWith('.')) continue
      found.push(childRel)
    }
  }
  return found
}

/**
 * 扫描工作区内所有文档的「可被引用锚点」。
 * 这里的正则刻意比 renderMarkdown 的正则宽松一点：
 * 补全只需要「知道有哪些 id 存在」，精确解析留给渲染管线。
 */
export async function collectLabels(root) {
  const files = await listFilesByExt(root, DOC_EXTENSIONS)
  const labels = []
  const push = (file, kind, id, label, anchor) => {
    if (!id) return
    labels.push({
      file,
      kind,
      id,
      // 目标文件里的 DOM 锚点：原始 id 把冒号换成短横线（与 renderMarkdown.anchorOf 一致）
      anchor: anchor || id.replace(/:/g, '-'),
      label: (label || id).trim().slice(0, 80),
    })
  }

  // 与前端 RefEntry 对齐：id 一律拆成「kind + 裸 id」
  const KIND_PREFIX = { eq: 'eq', thm: 'thm', lem: 'lem', def: 'def', prop: 'prop', cor: 'cor', exa: 'exa', prf: 'prf', alg: 'alg', sec: 'sec', fig: 'fig', tab: 'tab' }
  const splitId = (raw, fallbackKind) => {
    if (!raw) return null
    const m = /^(eq|thm|lem|def|prop|cor|exa|prf|alg|sec|fig|tab):(.+)$/.exec(raw)
    if (m && KIND_PREFIX[m[1]]) return { kind: m[1], id: m[2] }
    return { kind: fallbackKind, id: raw }
  }
  // id 里允许出现冒号（写作者常写 thm:lagrange）
  const ID_CHARS = '[A-Za-z0-9_\\u4e00-\\u9fa5:-]+'

  for (const rel of files) {
    let text = ''
    try {
      text = await fs.readFile(safeJoin(root, rel), 'utf8')
    } catch {
      continue
    }

    // 1) ::: theorem [标题]{#id}  及各类定理型容器
    const dirRe = /^:::+\s*([a-zA-Z]+)\s*(\[[^\]]*\])?\s*\{([^}]*)\}/gm
    let m
    while ((m = dirRe.exec(text))) {
      const kindMap = {
        theorem: 'thm',
        lemma: 'lem',
        definition: 'def',
        proposition: 'prop',
        corollary: 'cor',
        example: 'exa',
        proof: 'prf',
        algorithm: 'alg',
        figure: 'fig',
        table: 'tab',
      }
      const kind = kindMap[m[1].toLowerCase()]
      if (!kind) continue
      const rawId = new RegExp(`#(${ID_CHARS})`).exec(m[3] ?? '')?.[1]
      const split = splitId(rawId, kind)
      if (!split) continue
      const title = (m[2] ?? '').replace(/^\[|\]$/g, '')
      push(rel, split.kind, split.id, title, rawId.replace(/:/g, '-'))
    }

    // 2) 块级公式里的 \label{eq:x}
    const eqRe = /\$\$([\s\S]*?)\$\$/g
    while ((m = eqRe.exec(text))) {
      const rawId = /\\label\s*\{([^{}]+)\}/.exec(m[1])?.[1]
      const split = splitId(rawId, 'eq')
      if (split) push(rel, split.kind, split.id, split.id, rawId.replace(/:/g, '-'))
    }

    // 3) 代码块 info string 里的 ```algorithm [标题]{#alg:x}
    const codeRe = /^```(?:algorithm|algpseudocode)\s+([^\n]*)$/gm
    while ((m = codeRe.exec(text))) {
      const rawId = new RegExp(`#(${ID_CHARS})`).exec(m[1])?.[1]
      const split = splitId(rawId, 'alg')
      if (!split) continue
      const title = /\[([^\]]*)\]/.exec(m[1])?.[1] ?? ''
      push(rel, split.kind, split.id, title, rawId.replace(/:/g, '-'))
    }

    // 4) 标题 —— 用 slug 化的标题文本对齐 renderMarkdown 的 anchor 规则
    const headRe = /^(#{1,6})\s+(.+)$/gm
    let headingIndex = 0
    while ((m = headRe.exec(text))) {
      headingIndex++
      const title = m[2].replace(/[`*_~]/g, '').trim()
      const explicit = /\{#([A-Za-z0-9_\u4e00-\u9fa5-]+)\}\s*$/.exec(title)?.[1]
      push(rel, 'sec', explicit || `sec-${headingIndex}`, title.replace(/\{#.*\}\s*$/, ''), explicit || `sec-${headingIndex}`)
    }
  }
  return labels
}

/** 列出工作区内所有文档（供批量导出使用） */
export async function listDocFiles(root, rel = '') {
  return listFilesByExt(root, DOC_EXTENSIONS, rel)
}

/* ------------------------------------------------------------------ */
/* 目录统计                                                            */
/* ------------------------------------------------------------------ */

export async function workspaceSummary(root) {
  const docs = await listFilesByExt(root, DOC_EXTENSIONS)
  let totalBytes = 0
  let latest = 0
  for (const rel of docs) {
    try {
      const st = await fs.stat(safeJoin(root, rel))
      totalBytes += st.size
      latest = Math.max(latest, st.mtimeMs)
    } catch {
      /* ignore */
    }
  }
  return { docCount: docs.length, totalBytes, latestMtime: latest }
}

export { createReadStream }
