/**
 * ============================================================================
 *  academicCss.ts —— 学术排版的共享样式表
 * ----------------------------------------------------------------------------
 *  这份 CSS 同时被两处使用：
 *   1. 浏览器里「导出为独立 HTML」时内联进 <style>；
 *   2. Node 端 `mathflow export` 批量编译时内联进产物。
 *  抽出来的原因是 CLI 通过 esbuild 打包运行，不能 import 带 Vite 特性的模块。
 * ============================================================================
 */

export const ACADEMIC_CSS = `
:root{--mf-serif:'Latin Modern Roman','Songti SC','STSong','Noto Serif CJK SC','SimSun',Georgia,serif;
--mf-sans:'Inter','PingFang SC','Microsoft YaHei',system-ui,sans-serif;
--mf-mono:'JetBrains Mono','Cascadia Code',Consolas,monospace;--mf-rule:#1f2733;--mf-accent:#2a55d4;}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f3f5f8;color:#1f2733}
a{color:var(--mf-accent)}
.mf-page{max-width:880px;margin:0 auto;background:#fff;padding:56px 64px 96px;box-shadow:0 12px 40px -20px rgba(20,26,35,.35)}
.mf-academic{font-family:var(--mf-serif);font-size:16.5px;line-height:1.9}
.mf-heading{font-family:var(--mf-sans);color:#141a23;font-weight:700;line-height:1.45;margin:1.5em 0 .6em}
h1.mf-heading{font-size:1.85em;margin-top:0;padding-bottom:.35em;border-bottom:1px solid #e6e9ef}
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
.mf-display .katex-display{margin:.45em 0}
.mf-eq{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;width:100%;max-width:100%}
.mf-eq-body{min-width:0;overflow-x:auto;overflow-y:hidden;padding:2px 0}
.mf-eq-body>.katex-display{width:fit-content;margin-left:auto;margin-right:auto}
.mf-eq-no{flex:none;padding-left:1.4em;font-family:var(--mf-serif);font-size:.95em;line-height:1;white-space:nowrap;align-self:center}
.mf-eq-body .katex-display>.katex>.katex-html{display:flex;align-items:center;justify-content:center}
.mf-eq-body .katex-display>.katex>.katex-html>.base{flex:none}
.mf-eq-body .katex-display>.katex>.katex-html>.tag{position:static!important;flex:none;margin-left:1.4em}
.mf-table-wrap{margin:1.1em 0;overflow-x:auto}
.mf-table{width:100%;border-collapse:collapse;border-top:2px solid var(--mf-rule);border-bottom:2px solid var(--mf-rule);font-size:.94em}
.mf-table thead th{border-bottom:1px solid var(--mf-rule);padding:7px 10px;font-weight:700;font-family:var(--mf-sans);font-size:.92em}
.mf-table tbody td{padding:6px 10px}
.mf-thm{margin:1.15em 0;padding:10px 16px;border-left:3px solid #c6ccd8;background:#fafbfc;border-radius:0 8px 8px 0;break-inside:avoid}
.mf-thm-head{font-family:var(--mf-sans);font-size:.92em;margin-bottom:.15em}
.mf-thm-label{font-weight:700;color:#223d87}
.mf-thm-title{font-weight:600;color:#2f3846}
.mf-thm-theorem{border-left-color:#3b6ef0;background:#f6f9ff}
.mf-thm-definition{border-left-color:#0ea5e9;background:#f5fbfe}
.mf-thm-lemma,.mf-thm-proposition,.mf-thm-corollary{border-left-color:#8b5cf6;background:#faf8ff}
.mf-thm-example{border-left-color:#10b981;background:#f5fdf9}
.mf-thm-proof{border-left-color:#94a3b8;background:#fbfbfc}
.mf-qed{float:right;margin-left:8px}
.mf-ref{color:var(--mf-accent);text-decoration:none;border-bottom:1px dotted rgba(42,85,212,.5)}
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
  @page{size:A4;margin:20mm 18mm}
  html,body{background:#fff}
  .mf-page{box-shadow:none;padding:0;max-width:none}
  .mf-print-bar{display:none!important}
  .mf-meta{display:none}
  .mf-academic{font-size:11pt;line-height:1.75}
  .mf-display,.mf-thm,.mf-algo,.mf-table-wrap,.mf-bib-item,.mf-code{break-inside:avoid;page-break-inside:avoid}
  .mf-heading{break-after:avoid;page-break-after:avoid}
}
`
