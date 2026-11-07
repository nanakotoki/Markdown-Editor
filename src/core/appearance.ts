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
import { MM_TO_PX } from './pagination'

export type PreviewFontKey = Settings['previewFont']
export type EditorFontKey = Settings['editorFont']
export type LatinFontKey = Settings['bodyLatin']
export type RoleFontKey = Settings['thmHeadFont']

export interface FontOption<K extends string> {
  key: K
  label: string
  /** 真实字体栈，按「装了就用」的顺序排 */
  stack: string
  /** 界面上的一句说明 */
  note: string
}

/**
 * 中文正文字体（这一层只写中文字体）。
 *
 * 西文单独一层，见 LATIN_FONTS，最终拼成「西文, 中文, serif」。
 * 这不是两套字体文件——CSS 的 font-family 本来就是逐字回退：
 * 拉丁字母先在 Times New Roman 里找字形，中文在 Times 里没有，自然落到后面的宋体。
 * 论文里的「中文宋体 + 西文 Times New Roman」就是这么实现的，
 * 也正因如此，同一段混排文字的基线才会对得齐。
 */
const BODY_CJK: Record<PreviewFontKey, string> = {
  serif: "'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', 'STSong', 'SimSun'",
  song: "'SimSun', 'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC'",
  kai: "'Kaiti SC', 'KaiTi', 'STKaiti', 'LXGW WenKai', 'Songti SC'",
  sans: "'Source Han Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei'",
}

/** 正文西文字体。选「跟随中文」时 stack 为空，只用中文那一层。 */
export const LATIN_FONTS: Array<FontOption<LatinFontKey>> = [
  {
    key: 'times',
    label: 'Times New Roman',
    // 注意：这里不能以通用族 serif 结尾——拼到「西文, 中文, serif」里会变成
    // `… Times, serif, 宋体`，通用族一旦匹配成功，后面的中文字体就永远轮不上了。
    stack: "'Times New Roman', 'Nimbus Roman No9 L', 'Liberation Serif', Times",
    note: '论文标准，与宋体同源',
  },
  {
    key: 'lm',
    label: 'Latin Modern',
    stack: "'Latin Modern Roman', 'CMU Serif', 'Computer Modern Serif', 'Times New Roman'",
    note: 'LaTeX 原生字形',
  },
  {
    key: 'georgia',
    label: 'Georgia',
    stack: "Georgia, 'Times New Roman'",
    note: '字腔更开，屏幕省力',
  },
  {
    key: 'follow',
    label: '跟随中文',
    stack: '',
    note: '不单独指定西文',
  },
]

/** 黑体栈：环境标题默认用它。装了思源黑体最好，Windows 退到微软雅黑，Mac 退到苹方。 */
export const HEI_STACK =
  "'Source Han Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', 'Inter', system-ui, sans-serif"

/** 中文层 + 西文层拼成一条完整的 font-family */
export function bodyStack(cjkKey: PreviewFontKey, latinKey: LatinFontKey = 'times'): string {
  const cjk = BODY_CJK[cjkKey] ?? BODY_CJK.serif
  const latin = LATIN_FONTS.find((f) => f.key === latinKey)?.stack ?? LATIN_FONTS[0].stack
  // 黑体最后落到 sans-serif，其余落到 serif，免得系统连中文都没有时用错字形
  const tail = cjkKey === 'sans' ? 'sans-serif' : 'serif'
  return latin ? `${latin}, ${cjk}, ${tail}` : `${cjk}, ${tail}`
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
    stack: bodyStack('serif'),
    note: '笔画比系统宋体厚，推荐',
  },
  {
    key: 'song',
    label: '宋体（细）',
    stack: bodyStack('song'),
    note: '传统书刊宋体，笔画最细',
  },
  {
    key: 'kai',
    label: '楷体',
    stack: bodyStack('kai'),
    note: '接近手写，适合讲义',
  },
  {
    key: 'sans',
    label: '黑体',
    stack: bodyStack('sans', 'follow'),
    note: '笔画最饱满，投屏最清楚',
  },
]

/**
 * 三套预设搭配。
 *
 * 「论文」是默认值，理由见设置面板里那段说明：
 *   · 正文中文宋体 + 西文 Times New Roman —— 两套字脚高度接近，混排基线不跳；
 *   · 环境标题黑体加粗 —— 黑体笔画粗、结构方，和宋体正文形成清楚的层次；
 *   · 证明的「证」用楷体加粗 —— 楷体是传统批注体，加粗后在宋体正文前不显弱；
 *   · 解答的「解」直接用正文字体加粗 —— 与题干同族，读者一眼知道是一组。
 * 用户点任一预设就是一次性把这几项写成固定搭配；之后单独改某一项，
 * fontPairing 会变成 custom，表示「不再跟随预设」。
 */
export const FONT_PAIRINGS: Array<{
  key: 'paper' | 'lecture' | 'clean'
  label: string
  note: string
  sample: string
  patch: Partial<Settings>
}> = [
  {
    key: 'paper',
    label: '论文',
    note: '宋体 + Times，标题黑体',
    sample: bodyStack('serif', 'times'),
    patch: {
      fontPairing: 'paper',
      previewFont: 'serif',
      bodyLatin: 'times',
      previewWeight: 500,
      thmHeadFont: 'sans',
      proofMarkFont: 'kai',
      solMarkFont: 'serif',
      thmBodyKai: false,
    },
  },
  {
    key: 'lecture',
    label: '讲义',
    note: '楷体 + Times，定理正文楷体',
    sample: bodyStack('kai', 'times'),
    patch: {
      fontPairing: 'lecture',
      previewFont: 'kai',
      bodyLatin: 'times',
      previewWeight: 400,
      thmHeadFont: 'sans',
      proofMarkFont: 'kai',
      solMarkFont: 'serif',
      thmBodyKai: true,
    },
  },
  {
    key: 'clean',
    label: '简洁',
    note: '黑体 + 无衬线，投屏清楚',
    sample: bodyStack('sans', 'follow'),
    patch: {
      fontPairing: 'clean',
      previewFont: 'sans',
      bodyLatin: 'follow',
      previewWeight: 500,
      thmHeadFont: 'sans',
      proofMarkFont: 'sans',
      solMarkFont: 'sans',
      thmBodyKai: false,
    },
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

/**
 * 把用户手填的字体名并入字体栈。
 * 允许写成「霞鹜文楷」「LXGW WenKai」或带引号的 `"LXGW WenKai"`，
 * 系统里没装时自动落到 fallback，不会出现方框。
 */
export function customFontStack(custom: string | undefined, fallback: string): string {
  const clean = (custom ?? '').trim().replace(/^["']+|["']+$/g, '')
  if (!clean) return fallback
  return `'${clean}', ${fallback}`
}

/** 预览 / 阅读 / 屏幕上的正文最终字体栈：西文一层 + 中文一层 */
export function resolvePreviewStack(
  s: Pick<Settings, 'previewFont' | 'previewFontCustom' | 'bodyLatin' | 'bodyLatinCustom'>
): string {
  const cjk = customFontStack(s.previewFontCustom, BODY_CJK[s.previewFont] ?? BODY_CJK.serif)
  const latin =
    s.bodyLatin === 'custom'
      ? customFontStack(s.bodyLatinCustom, LATIN_FONTS[0].stack)
      : (LATIN_FONTS.find((f) => f.key === s.bodyLatin) ?? LATIN_FONTS[0]).stack
  const tail = s.previewFont === 'sans' ? 'sans-serif' : 'serif'
  return latin ? `${latin}, ${cjk}, ${tail}` : `${cjk}, ${tail}`
}

/** 源码编辑区最终字体栈 */
export function resolveEditorStack(s: Pick<Settings, 'editorFont' | 'editorFontCustom'>): string {
  return customFontStack(s.editorFontCustom, editorFontStack(s.editorFont))
}

/** 导出（HTML / PDF）字体：单独填了就用自己的，否则跟随预览 */
export function resolveExportStack(
  s: Pick<Settings, 'previewFont' | 'previewFontCustom' | 'exportFontCustom' | 'bodyLatin' | 'bodyLatinCustom'>
): string {
  return customFontStack(s.exportFontCustom, resolvePreviewStack(s))
}

/**
 * 单个「字体角色」的最终栈。
 * 用 CSS 变量而不是具体字体名，是为了让「跟随正文」这类选择链接到同一份设置：
 * 用户改了正文，标题 / 「证」/「解」会跟着动，不需要重新算一遍。
 */
export function roleFontStack(
  role: RoleFontKey | undefined,
  custom: string | undefined,
  fallback: RoleFontKey
): string {
  switch (role ?? fallback) {
    case 'custom':
      return customFontStack(custom, 'var(--mf-serif)')
    case 'kai':
      return 'var(--mf-kai)'
    case 'sans':
      return HEI_STACK
    default:
      // serif 与 follow 都落到正文字体
      return 'var(--mf-serif)'
  }
}

/**
 * 检测系统里到底有没有这个字体。
 * 原理：同一段文字分别用「目标字体, monospace」与「monospace」量宽度，
 * 宽度不同说明目标字体真的被用上了（比 document.fonts.check 可靠，后者对未装字体也常返 true）。
 */
export function isFontAvailable(name: string): boolean {
  const clean = name.trim().replace(/^["']+|["']+$/g, '')
  if (!clean || typeof document === 'undefined') return false
  const probe = 'mmmmmmmmmmlli1MW@#中文字形'
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return false
  const measure = (font: string) => {
    ctx.font = `40px ${font}`
    return ctx.measureText(probe).width
  }
  const baseMono = measure('monospace')
  const baseSerif = measure('serif')
  return measure(`'${clean}', monospace`) !== baseMono || measure(`'${clean}', serif`) !== baseSerif
}

/** 楷体栈：定理正文与证明的「证」字用它，装不到就退到宋体，不会出方框 */
export const KAI_STACK =
  "'LXGW WenKai', 'Kaiti SC', 'STKaiti', 'KaiTi', 'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', serif"

/** 把设置写进 :root 变量。样式表只读变量，因此切换即刻生效。 */
export function applyAppearance(s: Settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement.style
  const preview = resolvePreviewStack(s)
  root.setProperty('--mf-serif', preview)
  root.setProperty('--mf-academic-size', `${s.previewFontSize}px`)
  root.setProperty('--mf-academic-leading', String(s.previewLineHeight))
  root.setProperty('--mf-academic-weight', String(s.previewWeight))
  root.setProperty('--mf-editor-font', resolveEditorStack(s))
  root.setProperty('--mf-editor-size', `${s.editorFontSize}px`)
  root.setProperty('--mf-kai', KAI_STACK)
  // 定理/证明正文：默认楷体（中文讲义惯例），也可以跟着正文字体走
  root.setProperty('--mf-thm-body-font', s.thmBodyKai ? KAI_STACK : preview)
  // 三个「字体角色」：环境标题、证明的「证」、解答的「解」。
  // 默认分别是 黑体 / 楷体 / 正文，但都能在设置里单独换。
  root.setProperty('--mf-thm-head-font', roleFontStack(s.thmHeadFont, s.thmHeadFontCustom, 'sans'))
  root.setProperty('--mf-proof-mark-font', roleFontStack(s.proofMarkFont, s.proofMarkFontCustom, 'kai'))
  root.setProperty('--mf-sol-mark-font', roleFontStack(s.solMarkFont, s.solMarkFontCustom, 'serif'))
  // 页边距：改成 px 写进变量，纸面 padding 与分页引擎读的是同一个值
  root.setProperty('--mf-pad-x', `${(s.pageMarginX ?? 18) * MM_TO_PX}px`)
  root.setProperty('--mf-pad-y', `${(s.pageMarginY ?? 20) * MM_TO_PX}px`)
  // 这两项靠属性选择器切换样式，比逐个改 class 稳
  document.documentElement.dataset.mathStyle = s.mathStyle
  document.documentElement.dataset.thmStyle = s.thmStyle
}
