/**
 * ============================================================================
 *  workspaceApi.ts —— 运行环境的双形态适配层
 * ----------------------------------------------------------------------------
 *  MathFlow 有两种跑法，前端代码完全一致，靠这里做分流：
 *
 *   1. local    ——  `mathflow` 在本地起了服务，文档是磁盘上的真实文件。
 *                   所有读写走后端 /api，自动保存带并发冲突检测。
 *   2. sandbox  ——  纯静态部署（GitHub Pages / 双击 dist/index.html）。
 *                   没有后端，文档存在 localStorage 里，功能完整但没有落盘。
 *
 *  探测逻辑放在 detectWorkspace()：只有后端返回了合法的 JSON 且 mode=local
 *  才认为是本地模式，避免静态托管把 /api/health 当成 404 页面回个 HTML 就误判。
 * ============================================================================
 */

export type RunMode = 'local' | 'sandbox'

export interface WorkspaceInfo {
  root: string
  name: string
  readonly: boolean
  version: string
  docCount: number
}

export interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  ext?: string
  size?: number
  mtime?: number
  children?: TreeNode[]
}

export interface FileReadResult {
  path: string
  name: string
  content: string
  mtime: number
  hash: string
}

export interface SaveResult {
  ok: boolean
  hash?: string
  mtime?: number
  conflict?: boolean
  disk?: { content: string; hash: string; mtime: number }
}

export interface IndexedLabel {
  file: string
  kind: string
  id: string
  /** 目标文件里的 DOM 锚点（原始 id 把冒号换成短横线） */
  anchor?: string
  label: string
}

export interface IndexedBib {
  key: string
  type: string
  author: string
  title: string
  year: string
  journal: string
  raw: string
  source: string
}

export interface WorkspaceIndex {
  labels: IndexedLabel[]
  bib: IndexedBib[]
}

const API = '/api'
/** 探测超时：本地服务是秒回的，超过这个时间说明根本没有后端 */
const PROBE_TIMEOUT = 1200

/* ------------------------------------------------------------------ */
/* 底层请求                                                            */
/* ------------------------------------------------------------------ */

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: any
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit & { timeout?: number }): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init?.timeout ?? 20000)
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
    })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      throw new ApiError('服务返回的不是 JSON，可能后端没有启动', res.status)
    }
    if (!res.ok) {
      throw new ApiError(data?.message ?? `请求失败（HTTP ${res.status}）`, res.status, data)
    }
    return data as T
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* 模式探测                                                            */
/* ------------------------------------------------------------------ */

let cachedMode: RunMode | null = null

export async function detectWorkspace(): Promise<WorkspaceInfo | null> {
  if (typeof window === 'undefined') return null
  try {
    const data = await request<any>('/health', { timeout: PROBE_TIMEOUT })
    if (!data?.ok || data?.mode !== 'local' || !data?.workspace?.root) {
      cachedMode = 'sandbox'
      return null
    }
    cachedMode = 'local'
    return {
      root: data.workspace.root,
      name: data.workspace.name,
      readonly: !!data.readonly,
      version: data.version ?? '1.0.0',
      docCount: data.summary?.docCount ?? 0,
    }
  } catch {
    cachedMode = 'sandbox'
    return null
  }
}

export function currentMode(): RunMode {
  return cachedMode ?? 'sandbox'
}

/* ------------------------------------------------------------------ */
/* 文件操作                                                            */
/* ------------------------------------------------------------------ */

export async function fetchTree(): Promise<TreeNode[]> {
  const data = await request<{ nodes: TreeNode[] }>('/tree')
  return data.nodes ?? []
}

export async function readFile(path: string): Promise<FileReadResult> {
  return request<FileReadResult>(`/file?path=${encodeURIComponent(path)}`)
}

/**
 * 保存文件。带上 baseHash 时后端会先比对磁盘内容：
 * 如果文件被外部程序改过，返回 conflict 而不是直接覆盖。
 */
export async function writeFile(path: string, content: string, baseHash?: string): Promise<SaveResult> {
  try {
    const data = await request<{ hash: string; mtime: number }>(`/file?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content, baseHash }),
    })
    return { ok: true, hash: data.hash, mtime: data.mtime }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return {
        ok: false,
        conflict: true,
        hash: e.payload?.disk?.hash,
        mtime: e.payload?.disk?.mtime,
        disk: e.payload?.disk,
      }
    }
    throw e
  }
}

export async function createFile(path: string, content = ''): Promise<{ path: string }> {
  return request<{ path: string }>('/file', { method: 'POST', body: JSON.stringify({ path, content }) })
}

export async function createFolder(path: string): Promise<{ path: string }> {
  return request<{ path: string }>('/dir', { method: 'POST', body: JSON.stringify({ path }) })
}

export async function deleteFile(path: string): Promise<{ trashedTo: string }> {
  return request<{ trashedTo: string }>(`/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

export async function moveFile(from: string, to: string): Promise<{ path: string }> {
  return request<{ path: string }>('/move', { method: 'POST', body: JSON.stringify({ from, to }) })
}

export async function restoreFile(trashedTo: string, target: string): Promise<{ path: string }> {
  return request<{ path: string }>('/restore', { method: 'POST', body: JSON.stringify({ trashedTo, target }) })
}

export async function fetchIndex(): Promise<WorkspaceIndex> {
  const data = await request<WorkspaceIndex>('/index')
  return { labels: data.labels ?? [], bib: data.bib ?? [] }
}

export async function searchWorkspace(q: string): Promise<Array<{ file: string; line: number; snippet: string }>> {
  if (!q.trim()) return []
  const data = await request<{ hits: any[] }>(`/search?q=${encodeURIComponent(q)}`)
  return data.hits ?? []
}

/* ------------------------------------------------------------------ */
/* 批量导出                                                            */
/* ------------------------------------------------------------------ */

export interface ExportItem {
  src: string
  title: string
  tex?: string
  html?: string
}

export interface ExportResult {
  outputs: ExportItem[]
  warnings: string[]
  outDir: string
  combined?: {
    mainTex?: string
    mainHtml?: string
    chapters?: number
    stats?: { sections: number; equations: number; theorems: number; algorithms: number; tables: number }
  }
}

export async function runExport(payload: {
  to?: Array<'tex' | 'html'>
  template?: string
  outDir?: string
  combine?: boolean
  title?: string
  files?: string[]
}): Promise<ExportResult> {
  // 整本导出要逐篇渲染 + 内联 KaTeX 字体，给足超时
  return request<ExportResult>('/export', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeout: 180000,
  })
}

/* ------------------------------------------------------------------ */
/* 文件变更订阅                                                        */
/* ------------------------------------------------------------------ */

/**
 * 订阅工作区的文件变更（SSE）。返回取消函数。
 * 后端不支持 SSE 时静默失败，不影响编辑器主流程。
 */
export function watchWorkspace(onChange: (paths: string[]) => void): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {}
  let es: EventSource | null = null
  try {
    es = new EventSource(`${API}/watch`)
    es.addEventListener('change', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data)
        if (Array.isArray(data.paths)) onChange(data.paths)
      } catch {
        /* 忽略畸形消息 */
      }
    })
    es.onerror = () => {
      // 服务重启或断网：关掉，避免浏览器无限重连刷屏
      es?.close()
      es = null
    }
  } catch {
    return () => {}
  }
  return () => {
    es?.close()
    es = null
  }
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

/** 把文件路径转成稳定的 doc id（本地模式下 id 与路径一一对应） */
export function pathToDocId(path: string): string {
  return `file:${path}`
}

/** 从路径里取出去掉后缀的文件名，用作标签页标题 */
export function baseName(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.replace(/\.(md|markdown|mdx)$/i, '')
}

export function parentDir(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name
}

export { ApiError }
