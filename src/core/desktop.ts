/**
 * ============================================================================
 *  desktop.ts —— 桌面壳（Electron）能力的类型化入口
 * ----------------------------------------------------------------------------
 *  浏览器里 window.mathflow 不存在，所以每个调用点都要先问一句「有没有」，
 *  没有就走原来的网页路径。这样同一份代码在桌面版与 localhost 里都能用。
 * ============================================================================
 */

export interface PdfResult {
  ok: boolean
  canceled?: boolean
  filePath?: string
  bytes?: number
  /** 主进程计时：从打开打印页到写完文件（毫秒） */
  ms?: number
  error?: string
}

export interface ExportPdfPayload {
  /** 自包含 HTML（KaTeX + 排版 CSS），由 buildStandaloneHtml 生成 */
  html: string
  /** 文件名，一般就是文档标题；同名时自动加 (2) */
  defaultName?: string
  /** 相对工作区根目录的目录，PDF 就写在这里 */
  dirHint?: string
  /** 导出后是否在资源管理器里选中文件，默认 true */
  reveal?: boolean
}

export interface PrintCurrentPayload {
  defaultName?: string
  dirHint?: string
  reveal?: boolean
}

export interface WindowState {
  ok: boolean
  alwaysOnTop: boolean
  maximized: boolean
}

export type MenuCommand = 'toggle-sidebar'

export interface DesktopBridge {
  isDesktop: true
  platform: string
  versions: { electron: string; chrome: string }
  exportPdf(payload: ExportPdfPayload): Promise<PdfResult>
  printCurrent(payload: PrintCurrentPayload): Promise<PdfResult>
  reveal(filePath: string): Promise<{ ok: boolean }>
  setAlwaysOnTop(flag: boolean): Promise<{ ok: boolean; alwaysOnTop: boolean }>
  getWindowState(): Promise<WindowState>
  onCommand(handler: (cmd: MenuCommand) => void): () => void
  onWindowChanged(handler: (state: { alwaysOnTop: boolean }) => void): () => void
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
