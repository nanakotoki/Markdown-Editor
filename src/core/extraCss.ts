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
.mf-sol-q{float:left;margin-right:.3em;font-family:var(--mf-sans);font-weight:500;color:#000;line-height:1.85}
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

/* ---------------- 打印：页码与页眉页脚要留在纸上 ---------------- */
@media print{
  .mf-page-head,.mf-page-foot{color:#3c4655}
  .mf-thm.mf-proof,.mf-thm.mf-solution{break-inside:auto}
}
`
