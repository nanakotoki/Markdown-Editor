import katexCss from 'katex/dist/katex.min.css?raw'
import { renderMathML, renderMathSafely, type MacroMap } from './katexSafeRender'

/**
 * ============================================================================
 *  clipboardExport.ts —— 单公式多格式剪贴板
 * ----------------------------------------------------------------------------
 *  · Word 原生公式（MathML）· 高清 PNG（3x DPI）· 矢量 SVG · 纯 LaTeX
 * ============================================================================
 */

const KATEX_VERSION = '0.16.47'
const CDN = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`

/** 由 Vite 静态收集全部 woff2 字体，供离线导出内联为 base64 */
const fontUrls = import.meta.glob('/node_modules/katex/dist/fonts/*.woff2', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

let inlinedCssCache: string | null = null

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** 把 KaTeX CSS 中的字体路径替换成 base64，得到可离线、可进 SVG 的样式 */
export async function getInlinedKatexCss(): Promise<string> {
  if (inlinedCssCache) return inlinedCssCache
  let css = katexCss
  const entries = Object.entries(fontUrls)
  if (!entries.length) {
    css = css.replace(/fonts\//g, `${CDN}/fonts/`)
    inlinedCssCache = css
    return css
  }
  for (const [path, url] of entries) {
    const name = path.split('/').pop()
    if (!name) continue
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const dataUrl = await blobToDataUrl(blob)
      css = css.split(`fonts/${name}`).join(dataUrl)
    } catch {
      css = css.split(`fonts/${name}`).join(`${CDN}/fonts/${name}`)
    }
  }
  inlinedCssCache = css
  return css
}

/* ------------------------------------------------------------------ *
 *  测量 & SVG
 * ------------------------------------------------------------------ */

function measureHtml(html: string, display: boolean): { width: number; height: number } {
  const host = document.createElement('div')
  host.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    'visibility:hidden',
    'padding:8px',
    display ? 'display:block' : 'display:inline-block',
    display ? 'font-size:1.15em' : 'font-size:1.2em',
    'line-height:1.2',
  ].join(';')
  host.innerHTML = html
  document.body.appendChild(host)
  const rect = host.getBoundingClientRect()
  const size = { width: Math.max(8, Math.ceil(rect.width)), height: Math.max(8, Math.ceil(rect.height)) }
  document.body.removeChild(host)
  return size
}

/** 用 foreignObject 包装 KaTeX HTML，得到矢量 SVG 源码 */
export async function formulaToSvg(
  latex: string,
  display = false,
  macros: MacroMap = {},
  color = '#111827'
): Promise<{ svg: string; width: number; height: number }> {
  const r = renderMathSafely(latex, display, macros)
  const { width, height } = measureHtml(r.html, display)
  const css = await getInlinedKatexCss()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><style type="text/css"><![CDATA[
${css}
.mf-svg-root{color:${color};font-size:${display ? '19px' : '20px'};line-height:1.2;padding:4px;}
]]></style></defs>
<foreignObject x="0" y="0" width="${width}" height="${height}">
<div xmlns="http://www.w3.org/1999/xhtml" class="mf-svg-root">${r.html}</div>
</foreignObject>
</svg>`
  return { svg, width, height }
}

async function svgToPngBlob(svg: string, width: number, height: number, scale = 3): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG 光栅化失败'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 Canvas 上下文')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG 编码失败')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* ------------------------------------------------------------------ *
 *  复制
 * ------------------------------------------------------------------ */

export async function copyPlainText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return fallbackCopy(text)
  }
}

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** 复制为 Word 原生公式：写 text/html + MathML */
export async function copyAsMathML(latex: string, display = false, macros: MacroMap = {}): Promise<boolean> {
  const mathml = renderMathML(latex, display, macros)
  if (!mathml) return false
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body><!--StartFragment-->${mathml}<!--EndFragment--></body></html>`
  try {
    const item: Record<string, Blob> = {
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([latex], { type: 'text/plain' }),
    }
    await navigator.clipboard.write([new ClipboardItem(item)])
    return true
  } catch {
    return fallbackCopy(latex)
  }
}

/** 复制为高清 PNG（3x DPI 透明/白底） */
export async function copyAsPng(
  latex: string,
  display = false,
  macros: MacroMap = {},
  color = '#111827'
): Promise<{ ok: boolean; blob?: Blob; reason?: string }> {
  try {
    const { svg, width, height } = await formulaToSvg(latex, display, macros, color)
    const blob = await svgToPngBlob(svg, width, height, 3)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return { ok: true, blob }
    } catch (e: any) {
      return { ok: false, blob, reason: '当前环境不允许写入图片剪贴板，已改为下载文件' }
    }
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? '生成图片失败' }
  }
}

export async function copyAsSvg(latex: string, display = false, macros: MacroMap = {}, color = '#111827'): Promise<boolean> {
  try {
    const { svg } = await formulaToSvg(latex, display, macros, color)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([svg], { type: 'text/html' }),
          'text/plain': new Blob([svg], { type: 'text/plain' }),
        }),
      ])
      return true
    } catch {
      return fallbackCopy(svg)
    }
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ *
 *  下载
 * ------------------------------------------------------------------ */

export function downloadFile(filename: string, content: string | Blob, mime = 'text/plain;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function downloadFormulaPng(
  latex: string,
  filename = 'formula.png',
  display = false,
  macros: MacroMap = {}
): Promise<boolean> {
  try {
    const { svg, width, height } = await formulaToSvg(latex, display, macros)
    const blob = await svgToPngBlob(svg, width, height, 3)
    downloadFile(filename, blob, 'image/png')
    return true
  } catch {
    return false
  }
}

export async function downloadFormulaSvg(
  latex: string,
  filename = 'formula.svg',
  display = false,
  macros: MacroMap = {}
): Promise<boolean> {
  try {
    const { svg } = await formulaToSvg(latex, display, macros)
    downloadFile(filename, svg, 'image/svg+xml;charset=utf-8')
    return true
  } catch {
    return false
  }
}

/** 生成可用于插入文档的 <img> 数据 URI（函数图 / 公式图） */
export async function svgToDataUri(svg: string): Promise<string> {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
