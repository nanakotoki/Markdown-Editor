import { writeAsset } from './workspaceApi'

/**
 * ============================================================================
 *  pasteImage.ts —— 把剪贴板里的图片变成工作区里的文件
 * ----------------------------------------------------------------------------
 *  · 截屏（Win+Shift+S）、截图工具、从网页右键「复制图片」都会落在剪贴板里，
 *    以前只能先存成文件再手写 ![](...)，这里直接把字节写进文档旁边的 assets/；
 *  · 文件名带时间戳，连续粘贴不会互相覆盖；
 *  · 返回的路径相对当前文档所在目录，导出、搬走整个文件夹都不会断图。
 * ============================================================================
 */

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

function extOf(type: string): string {
  return EXT_BY_TYPE[type.toLowerCase()] ?? 'png'
}

/** 从剪贴板里挑出第一张图片；没有就返回 null */
export function clipboardImage(dt: DataTransfer | null): File | null {
  if (!dt) return null
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) return f
    }
  }
  const fromFiles = Array.from(dt.files ?? []).find((f) => f.type.startsWith('image/'))
  return fromFiles ?? null
}

/**
 * 有些程序（Word、浏览器里的富文本）复制图片只给 HTML，图片是 data: URL。
 * 这种情况下从 text/html 里把第一张内嵌图捞出来。
 */
export function clipboardHtmlImage(dt: DataTransfer | null): File | null {
  if (!dt || clipboardImage(dt)) return null
  const html = dt.getData('text/html')
  if (!html) return null
  const m = /<img[^>]+src=["'](data:image\/([a-z0-9.+-]+);base64,[^"']+)["']/i.exec(html)
  if (!m) return null
  try {
    const bin = atob(m[3])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const type = `image/${m[2].toLowerCase()}`
    return new File([bytes], `clipboard.${extOf(type)}`, { type })
  } catch {
    return null
  }
}

/** 拖进来的文件里挑图片 */
export function droppedImages(dt: DataTransfer | null): File[] {
  if (!dt) return []
  return Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'))
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('读取图片失败'))
    r.onload = () => {
      const s = String(r.result ?? '')
      resolve(s.slice(s.indexOf(',') + 1))
    }
    r.readAsDataURL(blob)
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('读取图片失败'))
    r.onload = () => resolve(String(r.result ?? ''))
    r.readAsDataURL(blob)
  })
}

export interface SavedAsset {
  /** 写进 Markdown 的相对路径，如 `assets/paste-20261110-201045.png` */
  markdownPath: string
  /** 工作区相对路径，用于提示 */
  workspacePath: string
  size: number
}

/**
 * 把图片存到「当前文档同级的 assets/」下。
 * docPath 是工作区相对路径（`chapters/01.md`）；没有路径时落在工作区根目录的 assets/。
 */
export async function savePastedImage(blob: Blob, docPath?: string): Promise<SavedAsset> {
  const ext = extOf(blob.type)
  const name = `paste-${stamp()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  const dir = (docPath ?? '').split('/').slice(0, -1).filter(Boolean).join('/')
  const workspacePath = [dir, 'assets', name].filter(Boolean).join('/')
  const base64 = await blobToBase64(blob)
  await writeAsset(workspacePath, base64)
  return { markdownPath: `assets/${name}`, workspacePath, size: blob.size }
}
