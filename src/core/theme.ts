/**
 * ============================================================================
 *  theme.ts —— 界面深浅色的唯一开关
 * ----------------------------------------------------------------------------
 *  只做三件事：把 `dark` 类挂到 <html> 上、跟随系统、记住用户的选择。
 *  配色本身全在 src/index.css 的 CSS 变量里（见文件顶部那一大段注释），
 *  所以这里不碰任何组件，也不需要给每个元素写 dark: 变体。
 *
 *  纸面（阅读模式的 A4、导出与打印）不吃这套变量：纸永远是白的，
 *  否则屏幕上排好的版和打印出来对不上，学术排版里这是硬要求。
 * ============================================================================
 */
import type { ThemeMode } from '../store/useEditorStore'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** 当前实际生效的是不是深色（system 时看系统） */
export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(DARK_QUERY).matches
}

/** 把主题落到 DOM 上；返回实际是否为深色 */
export function applyTheme(mode: ThemeMode): boolean {
  if (typeof document === 'undefined') return false
  const dark = resolveDark(mode)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.theme = dark ? 'dark' : 'light'
  // 让系统自带的滚动条、输入框、选中色跟着变（html.dark 里也有 color-scheme，
  // 这里再同步一次是因为用户可能从深色切回浅色，需要显式改回来）
  root.style.colorScheme = dark ? 'dark' : 'light'
  return dark
}

/** 监听系统主题变化；返回取消函数。mode 不是 system 时什么都不做 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(DARK_QUERY)
  const handler = () => onChange()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
