/**
 * ============================================================================
 *  extraCss.ts —— 论文版面相关的样式（应用内与导出共用同一份）
 * ----------------------------------------------------------------------------
 *  这份字符串同时被两处使用：
 *   1. 应用运行时由 main.tsx 注入 <style>（排在 index.css 之后，可覆盖同名规则）；
 *   2. 导出独立 HTML / CLI 编译时拼在 ACADEMIC_CSS 后面。
 *  这样「屏幕、导出网页、打印 PDF」三处的论文版面不会各自漂移。
 * ============================================================================
 */

export const EXTRA_CSS = `
/* ---------------- 页眉 / 页脚 / 页码 ---------------- */
.mf-sheet{position:relative}
.mf-page-head{position:absolute;left:var(--mf-pad-x,68px);right:var(--mf-pad-x,68px);top:calc(var(--mf-pad-y,76px) * .34);
  font-family:var(--mf-sans);font-size:.8em;color:#5b6472;text-align:center;letter-spacing:.02em}
.mf-page-foot{position:absolute;left:var(--mf-pad-x,68px);right:var(--mf-pad-x,68px);bottom:calc(var(--mf-pad-y,76px) * .3);
  font-family:var(--mf-sans);font-size:.8em;color:#5b6472;text-align:center;line-height:1.4}
.mf-page-foot-text{position:absolute;left:0;top:0}
.mf-page-no{display:block;font-variant-numeric:tabular-nums}

/* ---------------- 标题自动编号 ---------------- */
.mf-h-no{font-family:var(--mf-sans);font-weight:400;margin-right:.55em;color:#000;font-variant-numeric:tabular-nums}

/* ---------------- 目录 ---------------- */
.mf-toc{margin:1.1em 0 1.6em;break-inside:avoid-page}
.mf-toc-title{font-family:var(--mf-sans);font-size:1.15em;text-align:center;letter-spacing:.28em;margin-bottom:.9em;color:#000}
.mf-toc-list{list-style:none;padding:0;margin:0}
.mf-toc-row{display:flex;align-items:baseline;padding-left:var(--mf-toc-indent,0em);margin:.32em 0;font-size:.97em}
.mf-toc-row[data-level='1']{font-weight:500}
.mf-toc-link{color:inherit;text-decoration:none;max-width:86%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mf-toc-dots{flex:1;border-bottom:1px dotted #c3cad6;margin:0 .45em;transform:translateY(-.3em);min-width:1.2em}
.mf-toc-page{font-variant-numeric:tabular-nums;min-width:2.2em;text-align:right;color:#333}
.mf-toc-empty{color:#8a93a2;text-align:center;font-size:.9em}

/* ---------------- 脚注 ---------------- */
.mf-footnotes{margin-top:1.8em;padding-top:.55em;border-top:1px solid #dfe3ea;font-size:.86em;color:#2f3846}
.mf-fn-title{font-family:var(--mf-sans);font-size:.95em;margin-bottom:.35em;color:#000}
.mf-fn-list{list-style:none;padding:0;margin:0}
.mf-fn-item{display:flex;gap:.45em;margin:.3em 0;align-items:flex-start}
.mf-fn-no{flex:none;min-width:1.4em;text-align:right;font-variant-numeric:tabular-nums;color:#5b6472}
.mf-fn-body{flex:1;min-width:0}
.mf-fn-body>.mf-p{margin:.15em 0;text-indent:0}
.mf-fn-ref{font-size:.72em;vertical-align:super;line-height:0}
.mf-fn-ref a{color:inherit;text-decoration:none}

/* ---------------- 插图 / 表格题注 ---------------- */
.mf-figure{margin:1.15em 0;text-align:center;break-inside:avoid}
.mf-figure .mf-img{display:block;margin:0 auto;max-width:100%}
.mf-caption{margin-top:.45em;font-size:.9em;color:#1f2733;text-align:center}
.mf-caption-top{margin:0 0 .35em}
.mf-caption-no{font-family:var(--mf-sans);margin-right:.5em}
.mf-table-block{margin:1.15em 0}
.mf-table-block .mf-table-wrap{overflow-x:auto}

/* ---------------- 习题 / 解答 ---------------- */
.mf-thm-exercise{border-left-color:#d97706;background:#fffaf0}
.mf-thm-exercise .mf-thm-body{font-family:var(--mf-serif)}
.mf-solution{border-left-color:#94a3b8;background:#fbfbfc}
.mf-solution .mf-thm-body{font-family:var(--mf-serif);line-height:1.85}
/* 「解」跟正文同字体、加粗；内容正文保持正文字体 */
.mf-sol-q{float:left;margin-right:.3em;font-family:var(--mf-sol-mark-font,var(--mf-serif));font-weight:700;color:#000;line-height:1.85}
.mf-solution .mf-thm-body>.mf-p:first-child{text-indent:0}

/* ---------------- 可跨页容器被拆开后的接缝 ---------------- */
.mf-frag{border-radius:0}
.mf-frag-start{border-bottom-left-radius:0!important;border-bottom-right-radius:0!important}
.mf-frag-end{border-top-left-radius:0!important;border-top-right-radius:0!important}
.mf-frag:not(.mf-frag-start){border-top:none}
.mf-frag:not(.mf-frag-end){border-bottom:none}

/* ---------------- 参考文献：悬挂缩进 ---------------- */
.mf-bib-list{list-style:none;padding:0;margin:.3em 0 0}
.mf-bib-item{display:flex;gap:.4em;margin:.3em 0;font-size:.94em;line-height:1.7}
.mf-bib-index{flex:none;min-width:2.1em;color:#3c4655;font-variant-numeric:tabular-nums}
.mf-bib-text{flex:1}

/* ---------------- 原生 HTML 元素 ---------------- */
/*  文档里直接写 HTML 时按论文的样子显示；没列到的标签沿用浏览器默认样式。
    这一段与 src/index.css 里同名的一段保持一致。 */
.mf-academic kbd{display:inline-block;min-width:1.5em;padding:0 .38em;border:1px solid #c3cad6;border-bottom-width:2px;
  border-radius:4px;background:#f7f8fa;font-family:var(--mf-mono);font-size:.86em;line-height:1.55;text-align:center;color:#1f2733}
.mf-academic mark{background:#fff2a8;color:inherit;padding:0 .12em;border-radius:2px}
.mf-academic abbr[title],.mf-academic dfn[title]{text-decoration:underline dotted #8a93a2;text-underline-offset:.18em;cursor:help}
.mf-academic ruby{ruby-align:center}
.mf-academic rt{font-size:.55em;color:#5b6472;font-family:var(--mf-sans);letter-spacing:0}
/* 上下标：相对定位代替 vertical-align，不顶开行距；脚注上标自己有定位，不参与 */
.mf-academic sub:not(.mf-fn-ref),.mf-academic sup:not(.mf-fn-ref){font-size:.74em;line-height:0;vertical-align:baseline;position:relative}
.mf-academic sup:not(.mf-fn-ref){top:-.48em}
.mf-academic sub:not(.mf-fn-ref){bottom:-.24em}
.mf-academic small{font-size:.85em}
.mf-academic ins{text-decoration:underline;text-decoration-color:#2a55d4}
.mf-academic s,.mf-academic del{text-decoration-color:#8a93a2}
.mf-academic samp,.mf-academic tt{font-family:var(--mf-mono);font-size:.92em}
.mf-academic details{margin:.9em 0;padding:.1em 0 .1em .9em;border-left:2px solid #e2e6ee}
.mf-academic summary{cursor:pointer;font-family:var(--mf-sans);font-size:.93em;color:#2b3444;margin:.2em 0}
.mf-academic summary::marker{color:#8a93a2}
.mf-academic details[open]>summary{margin-bottom:.35em}
.mf-academic dl{margin:1em 0}
.mf-academic dt{font-family:var(--mf-sans);font-weight:700;margin-top:.5em}
.mf-academic dd{margin:.15em 0 .35em 1.6em}
.mf-academic figure{margin:1.1em 0;text-align:center}
.mf-academic figcaption{margin-top:.45em;font-size:.9em;color:#1f2733;text-align:center}
.mf-academic img{max-width:100%;height:auto}
.mf-academic p>img:only-child,.mf-academic figure img{display:block;margin:0 auto}
.mf-academic svg{max-width:100%;height:auto}
.mf-academic [align='center'],.mf-academic center{text-align:center}
/* 段落的 justify / 首行缩进会盖掉继承来的对齐，容器里的一级子元素要跟着走 */
.mf-academic [align]>*,.mf-academic center>*{text-align:inherit}
.mf-academic [align='center'] .mf-p,.mf-academic center .mf-p{text-indent:0}
.mf-academic [align='right']{text-align:right}
.mf-academic [align='left']{text-align:left}
.mf-academic video,.mf-academic audio{display:block;max-width:100%;margin:.9em auto}
.mf-academic iframe{display:block;width:100%;max-width:100%;aspect-ratio:16/9;border:0;margin:.9em 0;
  border-radius:6px;background:#f1f3f7;break-inside:avoid}
.mf-academic table:not([class]){width:100%;margin:1.05em 0;border-collapse:collapse;
  border-top:2px solid var(--mf-rule,#1f2733);border-bottom:2px solid var(--mf-rule,#1f2733);font-size:.94em;font-family:var(--mf-serif)}
.mf-academic table:not([class]) th{border-bottom:1px solid var(--mf-rule,#1f2733);padding:7px 10px;
  font-family:var(--mf-sans);font-weight:700;font-size:.95em;text-align:left}
.mf-academic table:not([class]) td{padding:6px 10px;vertical-align:middle}
.mf-academic table:not([class]) caption{caption-side:top;text-align:center;font-size:.92em;padding-bottom:.4em}
/* 手写的标题与段落 */
.mf-academic h1:not([class]),.mf-academic h2:not([class]),.mf-academic h3:not([class]),
.mf-academic h4:not([class]),.mf-academic h5:not([class]),.mf-academic h6:not([class]){
  font-family:var(--mf-sans);color:#141a23;font-weight:700;line-height:1.45;margin:1.4em 0 .55em}
.mf-academic h1:not([class]){font-size:1.75em}
.mf-academic h2:not([class]){font-size:1.32em}
.mf-academic h3:not([class]){font-size:1.12em;color:#2f3846}
.mf-academic h4:not([class]),.mf-academic h5:not([class]),.mf-academic h6:not([class]){font-size:1em;color:#414b5c}
/* 手写的 <p> 与自动生成的 .mf-p 排法一致 */
.mf-academic p:not([class]){margin:.75em 0;text-align:justify;text-justify:inter-ideograph}
.mf-academic ul:not([class]),.mf-academic ol:not([class]){margin:.7em 0 .7em 1.6em;padding:0}
/* Tailwind 的 reset 清掉了 list-style，这里补回来 */
.mf-academic ul:not([class]){list-style:disc outside}
.mf-academic ul:not([class]) ul:not([class]){list-style:circle outside}
.mf-academic ol:not([class]){list-style:decimal outside}
.mf-academic ol:not([class]) ol:not([class]){list-style:lower-alpha outside}
.mf-academic li:not([class]){margin:.25em 0}
.mf-academic ul:not([class])>li::marker,.mf-academic ol:not([class])>li::marker{color:#5b6472}
.mf-academic blockquote:not([class]){margin:1em 0;padding:.1em 0 .1em 1em;border-left:3px solid #dfe3ea;color:#2f3846}
.mf-academic hr{border:0;border-top:1px solid #dfe3ea;margin:1.5em 0}
.mf-academic pre{margin:1em 0;padding:.8em 1em;overflow-x:auto;background:#f7f8fa;border:1px solid #e6e9ef;
  border-radius:6px;font-family:var(--mf-mono);font-size:.86em;line-height:1.6}
.mf-academic code:not([class]){font-family:var(--mf-mono);font-size:.9em;background:#f4f5f8;padding:.08em .3em;border-radius:4px}
.mf-academic pre code{background:none;padding:0;font-size:1em}

/* ---------------- 打印：页码与页眉页脚要留在纸上 ---------------- */
@media print{
  .mf-page-head,.mf-page-foot{color:#3c4655}
  .mf-thm.mf-proof,.mf-thm.mf-solution{break-inside:auto}
  /* 折叠块打出来要能看到内容，否则 PDF 里只剩一行「点开看」 */
  .mf-academic details:not([open])>*:not(summary){display:block!important}
  .mf-academic iframe{max-height:60mm}
}
`
