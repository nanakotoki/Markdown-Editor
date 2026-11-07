/**
 * ============================================================================
 *  academicCss.ts —— 学术排版的共享样式表
 * ----------------------------------------------------------------------------
 *  这份 CSS 同时被两处使用：
 *   1. 浏览器里「导出为独立 HTML」时内联进 <style>；
 *   2. Node 端 `mathflow export` 批量编译时内联进产物。
 *  抽出来的原因是 CLI 通过 esbuild 打包运行，不能 import 带 Vite 特性的模块。
 *
 *  注意：应用内预览走的是 src/index.css，两份样式要一起改——
 *  改这里的话，记得同步 index.css 里同名的那一段。
 * ============================================================================
 */

import { EXTRA_CSS } from './extraCss'

export const ACADEMIC_CSS = `
:root{--mf-serif:'Latin Modern Roman','Songti SC','STSong','Noto Serif CJK SC','SimSun',Georgia,serif;
--mf-sans:'Inter','PingFang SC','Microsoft YaHei',system-ui,sans-serif;
--mf-mono:'JetBrains Mono','Cascadia Code',Consolas,monospace;
--mf-kai:'LXGW WenKai','Kaiti SC','STKaiti','KaiTi','Source Han Serif SC','Noto Serif CJK SC','Songti SC',serif;
--mf-rule:#1f2733;--mf-accent:#2a55d4;}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f3f5f8;color:#1f2733}
a{color:var(--mf-accent)}
.mf-page{max-width:880px;margin:0 auto;background:#fff;padding:56px 64px 96px;box-shadow:0 12px 40px -20px rgba(20,26,35,.35)}
.mf-academic{font-family:var(--mf-serif);font-size:16.5px;line-height:1.9}
.mf-heading{font-family:var(--mf-sans);color:#141a23;font-weight:700;line-height:1.45;margin:1.5em 0 .6em}
h1.mf-heading{font-size:1.85em;margin-top:0;padding-bottom:.1em}
h2.mf-heading{font-size:1.35em;padding-left:10px;border-left:3px solid var(--mf-accent)}
h3.mf-heading{font-size:1.12em}
.mf-p{margin:.75em 0;text-align:justify}
.mf-quote{margin:1em 0;padding:.55em 1em;border-left:3px solid #c6ccd8;background:#f8f9fb;color:#414b5c}
.mf-list{margin:.6em 0;padding-left:1.7em}
.mf-list>li{margin:.28em 0}
.mf-inline-code,.mf-code-inner{font-family:var(--mf-mono);font-size:.86em;background:#f1f3f7;color:#b4491f;padding:.12em .36em;border-radius:4px}
.mf-code{margin:1em 0;padding:12px 14px;background:#f8f9fb;border:1px solid #e6e9ef;border-radius:8px;overflow-x:auto}
.mf-code-inner{background:none;color:#2f3846;padding:0}
.mf-link{color:var(--mf-accent);text-decoration:none;border-bottom:1px solid rgba(42,85,212,.35)}
.mf-img{max-width:100%}
.mf-hr{border:none;border-top:1px solid #e6e9ef;margin:1.8em 0}
.mf-display{margin:.9em 0;overflow-x:auto;overflow-y:hidden}
.mf-display .katex-display{margin:.45em auto}
.mf-eq{display:block;position:relative;width:100%;max-width:100%}
.mf-eq-body{min-width:0;overflow-x:auto;overflow-y:hidden;padding:2px 0}
.mf-eq-body>.katex-display{width:fit-content;max-width:calc(100% - 6.6em);margin-left:auto;margin-right:auto;overflow-x:auto;overflow-y:hidden}
.mf-eq-no{position:absolute;right:0;top:50%;transform:translateY(-50%);padding-left:1.2em;font-family:var(--mf-serif);font-size:1.08em;line-height:1;white-space:nowrap;color:#1f2937}
.mf-eq-tag{color:inherit;text-decoration:none}
.mf-eq-tag:hover{color:var(--mf-accent)}
.mf-eq-body .katex-display>.katex>.katex-html{display:flex;align-items:center;justify-content:center}
.mf-eq-body .katex-display>.katex>.katex-html>.base{flex:none}
.mf-eq-body .katex-display>.katex>.katex-html>.tag{position:static!important;flex:none;margin-left:1.4em}
.mf-table-wrap{margin:1.1em 0;overflow-x:auto}
.mf-table{width:100%;border-collapse:collapse;border-top:2px solid var(--mf-rule);border-bottom:2px solid var(--mf-rule);font-size:.94em}
.mf-table thead th{border-bottom:1px solid var(--mf-rule);padding:7px 10px;font-weight:700;font-family:var(--mf-sans);font-size:.92em}
.mf-table tbody td{padding:6px 10px}

/* ---------- 定理 / 定义 / 证明 ---------- */
.mf-thm{margin:1.15em 0;padding:10px 16px;border-left:3px solid #c6ccd8;background:#fafbfc;border-radius:0 8px 8px 0;
break-inside:avoid;display:flow-root;--mf-thm-tint:#eef4ff;--mf-thm-line:#c6ccd8}
.mf-thm-head{font-family:var(--mf-sans);font-size:1em;font-weight:400;letter-spacing:.01em;margin-bottom:.28em;color:#000}
.mf-thm-label{font-family:var(--mf-sans);font-weight:800;color:inherit}
.mf-thm-title{font-family:var(--mf-sans);font-weight:800;color:#000}
.mf-thm-body{font-family:var(--mf-thm-body-font,var(--mf-kai));font-size:1em;line-height:1.85}
.mf-thm-body>.mf-p:first-child{margin-top:.1em}
.mf-thm-body>.mf-p:last-child{margin-bottom:.1em}
.mf-thm-theorem{--mf-thm-tint:#dbe6ff;--mf-thm-line:#3b6ef0;border-left-color:#3b6ef0;background:#f6f9ff}
.mf-thm-definition{--mf-thm-tint:#d7f0fe;--mf-thm-line:#0ea5e9;border-left-color:#0ea5e9;background:#f5fbfe}
.mf-thm-lemma,.mf-thm-proposition,.mf-thm-corollary{--mf-thm-tint:#ece4ff;--mf-thm-line:#8b5cf6;border-left-color:#8b5cf6;background:#faf8ff}
.mf-thm-example{--mf-thm-tint:#d5f7e8;--mf-thm-line:#10b981;border-left-color:#10b981;background:#f5fdf9}
.mf-thm-remark{--mf-thm-tint:#eceff4;--mf-thm-line:#94a3b8;border-left-color:#94a3b8;background:#fbfbfc}
.mf-thm-inline-label{font-family:var(--mf-sans);font-weight:800;margin-right:.4em;color:#000}
.mf-proof{border-left-color:#94a3b8;background:#fbfbfc}
.mf-proof .mf-thm-body{font-family:var(--mf-serif)}
.mf-proof-q{float:left;margin-right:.3em;font-family:var(--mf-sans);font-weight:500;color:#000;line-height:1.85;text-indent:0}
.mf-proof .mf-thm-body>.mf-p:first-child{text-indent:0}
.mf-proof-title{font-family:var(--mf-sans);font-size:.92em;color:#64748b}
.mf-qed{display:inline-block;margin-left:.45em;color:#000;font-size:.95em;line-height:1;white-space:nowrap}
/* 英文文档：标签与 Proof 粗黑体，定理正文斜体，证明正体 */
.mf-thm-en .mf-thm-body{font-family:var(--mf-serif);font-style:italic}
.mf-thm-en .mf-thm-body .katex,.mf-thm-en .mf-thm-body .katex-display,.mf-thm-en .mf-thm-body .mf-eq{font-style:normal}
.mf-thm-en.mf-proof .mf-thm-body,.mf-thm-en.mf-thm-remark .mf-thm-body{font-style:normal}
.mf-thm-en .mf-proof-q{font-family:var(--mf-serif);font-style:normal;font-weight:800;color:#000}
.mf-thm-en .mf-thm-inline-label{color:#000}
.mf-thm-en .mf-qed{font-style:normal}
.mf-box{margin:1em 0;padding:10px 14px;background:#f8f9fb;border:1px dashed #dfe3ea;border-radius:8px;display:flow-root}
.mf-box-title{font-family:var(--mf-sans);font-weight:700;font-size:.92em;margin-bottom:4px}
:root[data-thm-style='beamer'] .mf-thm{padding:0;border:none;border-radius:10px;background:#fff;
box-shadow:0 1px 2px rgba(20,26,35,.05),0 10px 24px -18px rgba(20,26,35,.45);overflow:hidden}
:root[data-thm-style='beamer'] .mf-thm-head{background:var(--mf-thm-tint);color:#000;padding:7px 15px;margin:0}
:root[data-thm-style='beamer'] .mf-thm-body{padding:8px 15px 12px}
:root[data-thm-style='beamer'] .mf-proof{background:#fff;box-shadow:0 1px 2px rgba(20,26,35,.05)}
:root[data-thm-style='beamer'] .mf-proof .mf-thm-body{padding-top:10px}
:root[data-thm-style='boxed'] .mf-thm{padding:10px 15px;background:#fff;border:1px solid var(--mf-thm-line);border-left-width:1px;border-radius:3px}
:root[data-thm-style='boxed'] .mf-thm-head{border-bottom:1px solid rgba(148,163,184,.35);padding-bottom:4px;margin-bottom:6px}
:root[data-thm-style='plain'] .mf-thm{padding:0;border:none;background:none;border-radius:0;margin:.9em 0}
:root[data-thm-style='plain'] .mf-thm-head{display:inline;margin-right:.3em}
:root[data-thm-style='plain'] .mf-thm-body{display:inline}
:root[data-thm-style='plain'] .mf-thm-body>.mf-p{display:inline}

/* ---------- 数学字形 ---------- */
:root[data-math-style='soft'] .katex{-webkit-text-stroke:.18px currentColor}
:root[data-math-style='bold'] .katex{-webkit-text-stroke:.34px currentColor}

/* ---------- 手动分页 ---------- */
.mf-pagebreak{position:relative;height:0;margin:2em 0 1.6em;border-top:1px dashed #b9c3d3;break-after:page;page-break-after:always}
.mf-pagebreak>span{position:absolute;right:0;top:-.85em;padding:0 7px;background:#fff;font:600 10.5px var(--mf-sans);color:#94a3b8;letter-spacing:.06em}

.mf-ref{color:var(--mf-accent);text-decoration:none;border-bottom:1px dotted rgba(42,85,212,.5);white-space:nowrap}
.mf-ref-xref{border-bottom-style:dashed}
.mf-ref-xfile{margin-left:4px;font-family:var(--mf-sans);font-size:.68em;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:3px;padding:0 3px;vertical-align:.08em;white-space:nowrap}
.mf-ref-broken{color:#dc2626;background:#fef2f2;padding:0 3px;border-radius:3px}
.mf-cite{color:var(--mf-accent);text-decoration:none}
.mf-cite-group{font-size:.8em}
.mf-bib{margin-top:2.2em;border-top:1px solid #e6e9ef;padding-top:1em}
.mf-bib-list{list-style:none;padding:0;margin:0;font-size:.92em}
.mf-bib-item{display:flex;gap:6px;padding:4px 0;line-height:1.7}
.mf-bib-index{color:var(--mf-accent);font-family:var(--mf-sans);min-width:22px}
.mf-bib-title{font-style:italic}
.mf-algo{margin:1.3em 0;break-inside:avoid}
.mf-algo-frame{border-top:2px solid var(--mf-rule);border-bottom:2px solid var(--mf-rule);padding:4px 0 2px}
.mf-algo-caption{display:flex;gap:8px;padding:6px 4px 4px;font-family:var(--mf-sans)}
.mf-algo-caption-label{font-weight:700;font-size:.9em;white-space:nowrap}
.mf-algo-caption-text{font-size:.92em;color:#2f3846}
.mf-algo-inner{padding:0 6px 6px}
.mf-algo-io{display:flex;gap:8px;font-family:var(--mf-mono);font-size:12.5px;line-height:1.75}
.mf-algo-io-label{font-family:var(--mf-sans);font-weight:700;color:#223d87;min-width:34px}
.mf-algo-rule{height:1px;background:#c6ccd8;margin:2px 0 4px}
.mf-algo-table{width:100%;border-collapse:collapse}
.mf-algo-ln{width:24px;text-align:right;padding-right:8px;font-family:var(--mf-mono);font-size:10.5px;color:#b7c0ce;vertical-align:top;padding-top:2px}
.mf-algo-indent{vertical-align:top;width:1%;white-space:nowrap}
.mf-algo-guide{display:inline-block;width:13px;border-left:1px solid #e6e9ef;height:1.75em}
.mf-algo-stmt{font-family:var(--mf-mono);font-size:13px;line-height:1.75;padding:1px 0 1px 6px;word-break:break-word}
.mf-algo-kw{font-weight:700;color:#223d87}
.mf-algo-kw2{color:#7c3aed;font-style:italic}
.mf-algo-row-closing .mf-algo-stmt{color:#5d6779}
.mf-print-bar{position:fixed;right:20px;bottom:20px;display:flex;gap:8px;z-index:9}
.mf-print-bar button{border:1px solid #dfe3ea;background:#fff;border-radius:10px;padding:8px 14px;font:500 13px var(--mf-sans);color:#414b5c;cursor:pointer;box-shadow:0 8px 24px -12px rgba(20,26,35,.3)}
.mf-print-bar button.primary{background:#2a55d4;border-color:#2a55d4;color:#fff}
.mf-meta{font-family:var(--mf-sans);font-size:12px;color:#8e97a8;margin-bottom:26px;display:flex;gap:14px;flex-wrap:wrap}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff}
  /* @page 零边距，边距交给容器：这样屏幕上看到的分栏宽度和打印出来的一致 */
  .mf-page{box-shadow:none;padding:var(--mf-pad-y,20mm) var(--mf-pad-x,18mm);max-width:none}
  .mf-print-bar{display:none!important}
  .mf-meta{display:none}
  .mf-academic{font-size:11pt;line-height:1.75}
  /* 行间公式不该比正文大一圈：KaTeX 默认 1.21em 打印出来偏大 */
  .mf-academic .katex{font-size:1.06em}
  .mf-academic .katex-display>.katex{font-size:1.06em}
  .mf-display,.mf-thm,.mf-algo,.mf-table-wrap,.mf-bib-item,.mf-code{break-inside:avoid;page-break-inside:avoid}
  .mf-heading{break-after:avoid;page-break-after:avoid}
  .mf-pagebreak{border:none;height:0;margin:0;break-after:page;page-break-after:always}
  .mf-pagebreak>span{display:none}
}
${EXTRA_CSS}`
