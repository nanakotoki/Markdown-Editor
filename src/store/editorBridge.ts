/**
 * 编辑器与 UI（构造器、AI、导出）之间的命令桥。
 * 通过模块级单例暴露命令式 API，避免层层透传 ref。
 */
export interface ActiveMath {
  latex: string
  from: number
  to: number
  type: 'inline' | 'display'
}

export interface EditorBridgeApi {
  insert: (text: string, caretBack?: number) => void
  insertBlock: (text: string) => void
  insertMath: (latex: string, display?: boolean) => void
  replaceActiveMath: (latex: string) => void
  getActiveMath: () => ActiveMath | null
  getSelection: () => string
  focus: () => void
  jumpToLabel: (id: string) => void
  /* ---- 分屏联动 / 预览点击跳转 ---- */
  /** 编辑区的滚动容器，用于监听滚动并与预览做联动 */
  scrollEl: () => HTMLElement | null
  /** 视口顶部当前是哪一行（1 起） */
  lineAtViewportTop: () => number | null
  /** 光标所在行（1 起） */
  lineAtCaret: () => number | null
  /** 某一行在滚动坐标系里的 y；行号越界会自动夹取 */
  topOfLine: (line: number) => number | null
  /** 直接设置滚动位置（联动时用，不做动画避免抖动） */
  scrollToY: (y: number) => void
  /** 把某一行滚到视口中间，可选是否把光标放过去 */
  revealLine: (line: number, putCaret?: boolean) => void
}

export const editorBridge: { current: EditorBridgeApi | null } = { current: null }

export function bridgeInsert(text: string) {
  editorBridge.current?.insert(text)
}

export function bridgeInsertMath(latex: string, display = false) {
  editorBridge.current?.insertMath(latex, display)
}

export function bridgeReplaceMath(latex: string) {
  editorBridge.current?.replaceActiveMath(latex)
}

export function bridgeActiveMath(): ActiveMath | null {
  return editorBridge.current?.getActiveMath() ?? null
}
