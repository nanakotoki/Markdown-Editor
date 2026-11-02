/**
 * ============================================================================
 *  cliEngine.ts —— CLI 编译引擎的打包入口
 * ----------------------------------------------------------------------------
 *  `mathflow export` 需要在不启动浏览器的情况下把 Markdown 编译成 .tex / .html。
 *  这些能力本来就写在 src/core 里，但它们依赖 Vite 的 ?raw / import.meta.glob，
 *  不能直接被 Node 加载。
 *
 *  解决办法：用 esbuild 以本文件为入口打包出 server/lib/engine.mjs，
 *  只把「纯逻辑」部分（AST 解析、LaTeX 编译、HTML 渲染、CSS 常量）带出来。
 *  任何涉及 DOM / window / import.meta.glob 的模块都不在本文件的依赖链上。
 * ============================================================================
 */

export { compileToLatex, compileBook } from './astToLatex'
export type {
  TexCompileResult,
  TexExportOptions,
  BookChapter,
  BookCompileResult,
  TexStats,
} from './astToLatex'

export { renderMarkdown } from './renderMarkdown'
export type { RenderResult, RefEntry, TocItem } from './renderMarkdown'

export { ACADEMIC_CSS } from './academicCss'

export { labelsToRefEntries } from './workspaceRefs'
export type { LabelLike } from './workspaceRefs'

export { macrosToKatex, parseMacroLine, DEFAULT_MACRO_SOURCE, healLatex, diagnoseLatex } from './katexSafeRender'
export type { MacroDef, MacroMap } from './katexSafeRender'

export { SNIPPET_RULES } from './snippetRules'
export { FORMULA_LIBRARY, searchFormulas } from './formulaLibrary'

/** 与前端「设置」面板默认值保持一致 */
export const DEFAULT_SETTINGS = {
  autoNumberEquations: true,
  citationStyle: 'numeric' as const,
  texTemplate: 'ctexart' as const,
  showLineNumbers: true,
}
