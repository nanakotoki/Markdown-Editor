/**
 * ============================================================================
 *  appearance.ts —— 排版外观（正文/源码字体、字号、行距、字重）
 * ----------------------------------------------------------------------------
 *  只做两件事：
 *   1. 把「用户可选的字体」翻译成真实的 font-family 栈（含平台回退）
 *   2. 把设置写进 :root 的 CSS 变量，样式表统一读变量
 *  这样切换字体不需要重渲染任何组件，也不会有 FOUC。
 * ============================================================================
 */

import type { Settings } from '../store/useEditorStore'

export type PreviewFontKey = Settings['previewFont']
export type EditorFontKey = Settings['editorFont']

export interface FontOption<K extends string> {
  key: K
  label: string
  /** 真实字体栈，按「装了就用」的顺序排 */
  stack: string
  /** 界面上的一句说明 */
  note: string
}

/**
 * 正文（渲染结果）字体。
 * 默认把思源宋体 / Noto Serif 排在宋体前面——同样的字号下笔画更厚，
 * 屏幕上比 SimSun 好看得多；系统没装这两个才退回宋体。
 */
export const PREVIEW_FONTS: Array<FontOption<PreviewFontKey>> = [
  {
    key: 'serif',
    label: '思源宋体',
    stack: "'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', 'STSong', 'SimSun', Georgia, serif",
    note: '笔画比系统宋体厚，推荐',
  },
  {
    key: 'song',
    label: '宋体（细）',
    stack: "'SimSun', 'Songti SC', 'STSong', 'Noto Serif CJK SC', serif",
    note: '传统书刊宋体，笔画最细',
  },
  {
    key: 'kai',
    label: '楷体',
    stack: "'Kaiti SC', 'KaiTi', 'STKaiti', 'Songti SC', serif",
    note: '接近手写，适合讲义',
  },
  {
    key: 'sans',
    label: '黑体',
    stack: "'Source Han Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
    note: '笔画最饱满，投屏最清楚',
  },
]

/** 源码（编辑区）字体。默认沿用原来的衬线，可切成等宽。 */
export const EDITOR_FONTS: Array<FontOption<EditorFontKey>> = [
  {
    key: 'serif',
    label: '衬线',
    stack: "'Latin Modern Roman', 'Songti SC', 'STSong', 'SimSun', Georgia, serif",
    note: '像稿纸，默认外观',
  },
  {
    key: 'mono',
    label: '等宽',
    stack: "'JetBrains Mono', 'Cascadia Code', 'Consolas', 'Menlo', 'Source Han Mono SC', monospace",
    note: '对齐表格与缩进最准',
  },
  {
    key: 'sans',
    label: '无衬线',
    stack: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
    note: '字形最简洁，长文省力',
  },
  {
    key: 'kai',
    label: '霞鹜文楷',
    stack: "'LXGW WenKai', 'LXGW WenKai Screen', 'Kaiti SC', 'KaiTi', 'STKaiti', serif",
    note: '装了才生效，手写感强',
  },
]

export function previewFontStack(key: PreviewFontKey): string {
  return (PREVIEW_FONTS.find((f) => f.key === key) ?? PREVIEW_FONTS[0]).stack
}

export function editorFontStack(key: EditorFontKey): string {
  return (EDITOR_FONTS.find((f) => f.key === key) ?? EDITOR_FONTS[0]).stack
}

/** 把设置写进 :root 变量。样式表只读变量，因此切换即刻生效。 */
export function applyAppearance(s: Settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement.style
  root.setProperty('--mf-serif', previewFontStack(s.previewFont))
  root.setProperty('--mf-academic-size', `${s.previewFontSize}px`)
  root.setProperty('--mf-academic-leading', String(s.previewLineHeight))
  root.setProperty('--mf-academic-weight', String(s.previewWeight))
  root.setProperty('--mf-editor-font', editorFontStack(s.editorFont))
  root.setProperty('--mf-editor-size', `${s.editorFontSize}px`)
}
