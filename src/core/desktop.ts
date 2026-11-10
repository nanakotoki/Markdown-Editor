/**
 * ============================================================================
 *  desktop.ts —— 桌面壳（Electron）能力的类型化入口
 * ----------------------------------------------------------------------------
 *  浏览器里 window.mathflow 不存在，所以每个调用点都要先问一句「有没有」，
 *  没有就走原来的网页打印路径。这样同一份代码在桌面版与 localhost 里都能用。
 * ============================================================================
 */

export interface PdfResult {
  ok: boolean
  canceled?: boolean
  filePath?: string
  bytes?: number
  error?: string
}

export interface ExportPdfPayload {
  /** 自包含 HTML（内联 KaTeX 与字体），由 buildStandaloneHtml 生成 */
  html: string
  /** 保存框里预填的文件名，一般就是文档标题 */
  defaultName?: string
  /** 相对工作区根目录的目录，保存框默认打开这里 */
  dirHint?: string
}

export interface PrintCurrentPayload {
  defaultName?: string
  dirHint?: string
}

export interface DesktopBridge {
  isDesktop: true
  platform: string
  versions: { electron: string; chrome: string }
  exportPdf(payload: ExportPdfPayload): Promise<PdfResult>
  printCurrent(payload: PrintCurrentPayload): Promise<PdfResult>
}

declare global {
  interface Window {
    mathflow?: DesktopBridge
  }
}

export function desktop(): DesktopBridge | null {
  if (typeof window === 'undefined') return null
  return window.mathflow ?? null
}
