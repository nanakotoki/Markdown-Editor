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
