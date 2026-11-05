/**
 * ============================================================================
 *  manual.ts —— 语法手册 / 使用建议的单一数据源
 * ----------------------------------------------------------------------------
 *  这里的内容会被 ManualModal 渲染成「点开就能查」的手册。约定：
 *   · syntax 是给人看的代码片段，原样显示；
 *   · insert 是可插入编辑器的内容，缺省等于 syntax；
 *   · block=true 时走 insertBlock（前后自动补空行），否则走 insert（光标原位）；
 *   · caretBack 表示插入后光标回退几个字符（比如插 `**粗体**` 要停在中间）。
 *
 *  写新条目时尽量「一条只讲一个语法」，标题短、例子能直接跑。
 * ============================================================================
 */

const F = '```'
const j = (...lines: string[]) => lines.join('\n')

export interface ManualEntry {
  /** 条目标题，例如「二级标题」 */
  title: string
  /** 展示用的语法片段 */
  syntax?: string
  /** 一句话说明：什么时候用、有什么坑 */
  note?: string
  /** 插入编辑器的内容，缺省用 syntax */
  insert?: string
  /** 以块级方式插入（前后补空行） */
  block?: boolean
  /** 插入后光标回退的字符数 */
  caretBack?: number
  /** 右下角小标签 */
  tag?: string
}

export interface ManualSection {
  id: string
  title: string
  summary: string
  entries: ManualEntry[]
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'start',
    title: '快速上手',
    summary: '五分钟能上手的最小集合：写、看、存、导出。',
    entries: [
      {
        title: '四种视图怎么选',
        note: '顶部中间的「内联混合 / 左右分屏 / 纯源码 / 阅读」四选一，选择会被记住。刚上手用内联混合；要精修排版用左右分屏（左边是原样源码，右边是排版结果）；大段粘贴或核对符号用纯源码；想确认「打印出来是什么样」用阅读模式——它按 A4 纸面分页，看到的换页位置就是 PDF 的换页位置。',
        tag: '必读',
      },
      {
        title: '文稿存在哪',
        note: '桌面安装版在「文档\\MathFlow」，便携版在 exe 旁边的 workspace\\。左侧文件树就是磁盘上的真实目录，在这里新建/重命名/删除，资源管理器里立刻能看到同样的变化。',
      },
      {
        title: '保存',
        syntax: 'Ctrl + S',
        note: '默认自动保存：停笔约 0.8 秒后落盘，标签上的小圆点表示还没写入磁盘。想自己掌握节奏，就去「工具 → 字体与外观 → 保存」切成「手动保存」——之后只有按 Ctrl+S 或点标签栏右侧的「保存」按钮才写盘，关掉未保存的标签前会先问一句。',
        tag: '快捷键',
      },
      {
        title: '换字体（源码 / 正文 / 导出）',
        syntax: '工具 → 字体与外观',
        note: '源码区、渲染结果、导出的 PDF 可以各自设字体。预设不够用时，在「自定义」里直接填系统里已装的字体名（例如 霞鹜文楷、JetBrains Mono），点「检测」能确认到底有没有装；导出字体留空就跟随预览字体。',
        tag: '外观',
      },
      {
        title: '导出整本',
        syntax: 'Ctrl + Shift + E',
        note: '把整个工作区合并编译成 main.tex / main.html。也可以只导出当前这一篇。',
        tag: '快捷键',
      },
      {
        title: '打开别的工作区',
        syntax: 'Ctrl + O',
        note: '选一个已有的论文目录，之后会记住。文件和子目录会被原样读取，不会改动你的目录结构。',
        tag: '快捷键',
      },
      {
        title: '阅读模式 · 分页预览',
        syntax: '\\newpage',
        note: '顶部「阅读」按 A4 纸面排版，每页底部有页码，虚线的位置就是分页处。想强制换页，在源码里单独一行写 \\newpage（也认 \\pagebreak、<!-- pagebreak -->、::: pagebreak）；不写也会按内容自动分页，定理框、公式、表格不会被切开。阅读区右上角的「打印 / 存为 PDF」按当前分页打印，打出来和屏幕上看到的一样。',
        block: true,
        tag: '排版',
      },
      {
        title: '编辑器里就能看到会从哪一页断开',
        note: '内联混合、纯源码、左右分屏三种模式里，编辑区会画一条很淡的虚线，右侧标着「第 N 页」——这就是导出 PDF 时的换页位置，不用再切到阅读模式去看。停笔约 0.6 秒后重算（按 A4 版心和当前字号量），所以改完排版参数会自己更新。它只是提示，不是内容：光标碰不到、导出时也不会出现。想真的换页仍要自己写 \\newpage。',
        tag: '排版',
      },
      {
        title: '随时叫出这本手册',
        syntax: 'F1',
        note: '任何输入框里按 F1 都能打开；也可以走「工具 → 语法与使用手册」。',
        tag: '快捷键',
      },
    ],
  },
  {
    id: 'markdown',
    title: 'Markdown 基础',
    summary: '标题、列表、强调、链接——日常写作的九成。',
    entries: [
      {
        title: '一级标题',
        syntax: '# 绪论',
        note: '`#` 与文字之间必须有空格。导出成书（ctexbook）时，一级标题会被当作「章」。',
        block: true,
      },
      {
        title: '二 / 三级标题',
        syntax: j('## 研究背景', '### 国内外现状'),
        note: '`##` 是节，`###` 是小节。连续按 `#` 不会叠成 `## ##`——编辑器会把光标处已有的标题级别加一。',
        block: true,
      },
      {
        title: '段落与空行',
        syntax: j('第一段。', '', '第二段。'),
        note: '空一行才是新段落；只换行不空行，渲染后会接在同一段里。',
        block: true,
      },
      {
        title: '强制换行',
        syntax: '第一行  \n第二行',
        note: '行尾敲两个空格再回车，才能在段内换行。',
        block: true,
      },
      {
        title: '无序 / 有序列表',
        syntax: j('- 第一点', '- 第二点', '', '1. 第一步', '2. 第二步'),
        note: '嵌套就在下一行多缩进两个空格。',
        block: true,
      },
      {
        title: '任务列表',
        syntax: j('- [x] 已经做完的', '- [ ] 还没做的'),
        note: '导出 PDF 时会渲染成方框。',
        block: true,
      },
      {
        title: '引用块',
        syntax: j('> 一段被引用的文字。', '> 可以连着写多行。'),
        block: true,
      },
      {
        title: '分隔线',
        syntax: '---',
        note: '单独一行三个减号。紧跟在文字下面会被当成二级标题的下划线，记得前后空行。',
        block: true,
      },
      {
        title: '加粗 / 斜体 / 删除线',
        syntax: j('**加粗**  *斜体*  ***加粗斜体***  ~~删除线~~'),
        note: '星号要紧贴文字；中文里也照样生效。',
        block: true,
      },
      {
        title: '行内代码',
        syntax: '`const x = 1`',
        note: '反引号包住的内容不参与 Markdown 解析，写路径、变量名很合适。',
        block: true,
      },
      {
        title: '链接',
        syntax: '[显示的文字](https://example.com)',
        note: '站内相对链接也可以：`[下一章](chapters/02-methods.md)`，导出时会自动改写成可跳转的锚点。',
        block: true,
      },
      {
        title: '图片',
        syntax: '![图注文字](chapters/figs/flow.png)',
        note: '路径相对当前 md 文件。建议把图片统一放在工作区的 `figs/` 里，避免换电脑或挪目录后路径失效。',
        block: true,
      },
      {
        title: '转义字符',
        syntax: '\\*这不是斜体\\*',
        note: '想显示星号、下划线本身，就在前面加反斜杠。',
        block: true,
      },
    ],
  },
  {
    id: 'table',
    title: '表格',
    summary: '本书统一用三线表，列对齐用冒号控制。',
    entries: [
      {
        title: '三线表',
        syntax: j('| 符号 | 含义 | 取值 |', '| --- | --- | --- |', '| $\\alpha$ | 学习率 | $10^{-3}$ |', '| $n$ | 样本数 | 500 |'),
        note: '第二行是分隔行，必须有。列数要对齐，多一列少一列都会渲染错。',
        block: true,
        tag: '常用',
      },
      {
        title: '列对齐',
        syntax: j('| 左对齐 | 居中 | 右对齐 |', '| :--- | :---: | ---: |', '| a | b | c |'),
        note: '`:` 在左边是左对齐，两边都有是居中，只在右边是右对齐。数字列建议右对齐。',
        block: true,
      },
      {
        title: '表里放公式',
        syntax: j('| 名称 | 表达式 |', '| --- | --- |', '| 高斯积分 | $\\int_{-\\infty}^{\\infty} e^{-x^2}dx=\\sqrt{\\pi}$ |'),
        note: '单元格里的 `$…$` 正常渲染；表格里有竖线时，公式里别直接写 `|`（绝对值请用 `\\vert`）。',
        block: true,
      },
    ],
  },
  {
    id: 'math',
    title: '公式',
    summary: '行内 `$…$`、块级 `$$…$$`，编号与引用。',
    entries: [
      {
        title: '行内公式',
        syntax: '设 $f(x)=x^2$，则 $f\'(x)=2x$。',
        note: '写在句子里，跟随文字基线。美元符号内侧不要加空格，否则部分解析器不认。',
        block: true,
        tag: '常用',
      },
      {
        title: '块级公式（居中、独立占行）',
        syntax: j('$$', 'E = mc^2', '$$'),
        note: '单独成段、居中、可自动编号。块级公式前后最好空一行。',
        block: true,
        tag: '常用',
      },
      {
        title: '带标签的公式（可被引用）',
        syntax: j('$$', 'a^2 + b^2 = c^2 \\label{eq:pythagoras}', '$$'),
        note: '`\\label{eq:xxx}` 里的 `eq:` 前缀不能省，后面引用时写 `@eq:pythagoras`。',
        block: true,
      },
      {
        title: '公式编号的写法',
        syntax: '(1)   或   1-1   或   1.1',
        note: '「排印细节 → 公式编号」里选：连续编号是 (1)(2)(3)；按节编号配合三种写法可以做成 (1.1)、1-1、1.1。编号本身可以点击，会定位到那条公式；正文里写 @eq:标签 或「式 (1.1)」也能跳回来。',
        tag: '引用',
      },
      {
        title: '多行对齐',
        syntax: j('$$', '\\begin{aligned}', 'f(x) &= (x+1)^2 \\\\', '&= x^2 + 2x + 1', '\\end{aligned}', '$$'),
        note: '用 `&` 对齐等号、`\\\\` 换行。KaTeX 不支持 `align` 环境，必须写 `aligned`。',
        block: true,
      },
      {
        title: '分段函数',
        syntax: j('$$', 'f(x) = \\begin{cases}', 'x^2, & x \\ge 0 \\\\', '-x, & x < 0', '\\end{cases}', '$$'),
        block: true,
      },
      {
        title: '矩阵',
        syntax: j('$$', 'A = \\begin{pmatrix}', 'a_{11} & a_{12} \\\\', 'a_{21} & a_{22}', '\\end{pmatrix}', '$$'),
        note: '`pmatrix` 圆括号、`bmatrix` 方括号、`vmatrix` 行列式。懒得手打可以用「插入 → 矩阵构造器」。',
        block: true,
      },
      {
        title: '常用符号',
        syntax: '\\alpha \\beta \\gamma \\sum_{i=1}^{n} \\int_0^1 \\lim_{x\\to 0} \\frac{a}{b} \\sqrt[3]{x} \\mathbb{R} \\mathcal{L} \\operatorname{argmax}',
        block: true,
      },
      {
        title: '数学模式快捷输入',
        syntax: j('//  → \\frac{}{}', ';a  → \\alpha      ;b → \\beta      ;p → \\pi', 'sum + 空格 → \\sum_{i=}^{}   int + 空格 → \\int_{}^{}', '=>  → \\implies      -> → \\to      != → \\neq', 'sr → ^2   inv → ^{-1}   vec/hat/bar/norm/abs + 空格', 'pmat / bmat / vmat / cases + 空格 → 对应矩阵与分段函数'),
        note: '只在 `$…$` 或 `$$…$$` 内部生效；`Tab` 在占位符之间跳。完整列表见「工具 → 快捷输入速查」。',
        block: true,
        tag: '提速',
      },
      {
        title: '自定义宏',
        syntax: '\\newcommand{\\R}{\\mathbb{R}}',
        note: '在「工具 → 宏命令与文献」里统一维护，正文直接写 `\\R` 即可，预览、导出都会展开。',
        block: true,
      },
    ],
  },
  {
    id: 'academic',
    title: '定理 / 证明 / 算法',
    summary: '学术写作的核心块，自动编号、可交叉引用。',
    entries: [
      {
        title: '定理',
        syntax: j('::: theorem [压缩映射] {#thm:contraction}', '设 $T$ 是完备度量空间上的压缩映射，则 $T$ 有唯一不动点。', ':::'),
        note: '`[标题]` 可省略；`{#thm:名字}` 是引用用的标签。编号（定理 1.2）由系统自动加，不要手写。',
        block: true,
        tag: '常用',
      },
      {
        title: '六种同类容器',
        syntax: j('::: lemma [引理名] {#lem:x}', '…', ':::', '', '::: definition [定义名] {#def:x}', '…', ':::', '', '::: proposition {#prop:x}', '…', ':::', '', '::: corollary {#cor:x}', '…', ':::', '', '::: example {#exa:x}', '…', ':::', '', '::: remark', '…', ':::'),
        note: '可用：`theorem` 定理、`lemma` 引理、`definition` 定义、`proposition` 命题、`corollary` 推论、`example` 例题、`remark` 注。前缀和标签一一对应（thm / lem / def / prop / cor / exa）。',
        block: true,
      },
      {
        title: '证明',
        syntax: j('::: proof', '由压缩映射原理，迭代序列 $x_{n+1}=T(x_n)$ 收敛。', ':::'),
        note: '证明不编号，结尾会自动加证毕符号。',
        block: true,
      },
      {
        title: '容器外观与证毕符号',
        note: '「工具 → 字体与外观 → 排印细节」里可以切换四套容器：经典（左侧色条）、色块（类似 beamer 的圆角块）、方框（整圈边框）、纯文（标题并进正文）。证明的结尾符号可选 ∎ □ ■ ▪ Q.E.D. 或自己填，符号永远落在框内；不想要就选「不要」。',
        tag: '外观',
      },
      {
        title: '定理编号：定义 1.1 还是定义 1',
        syntax: '定义 1.1',
        note: '默认按节编号：文档只有一个 H1 时，H1 当标题、按 H2 分节；有两个以上 H1 时按 H1 分节。想要全文连续编号，在「排印细节 → 定理编号」里切一下即可。LaTeX 导出用 \\newtheorem{...}[section]，编号与预览一致。',
        tag: '编号',
      },
      {
        title: '英文文档：Theorem 1.1 + 斜体正文',
        note: '容器里主要用英文写时，排版自动切成国际惯例：标签用 Theorem / Lemma / Definition / Proposition / Corollary / Example，标题是粗黑体；定理正文**斜体**；证明以粗体的 Proof. 开头、正文正体。中文文档不受影响（仍是黑体标签 + 楷体正文）。判定按整篇的语言，中英混排时以中文为准。',
        tag: '外观',
      },
      {
        title: '行间公式居中',
        note: '带编号的式子按**版心**居中（不是偏在一侧），编号单独靠右。公式太宽、放不下时，这条式子自己横向滚动，不会压到编号上。',
        tag: '排版',
      },
      {
        title: '伪代码算法块',
        syntax: j(F + 'algorithm [二分查找]{#alg:binary}', '输入: 有序数组 A，目标值 t', '输出: 下标或 -1', 'While low <= high', '  mid <- (low + high) / 2', '  If A[mid] = t', '    Return mid', '  EndIf', 'EndWhile', 'Return -1', F),
        note: '用 ```algorithm 开头的代码块，关键字 `If / Else / For / While / Return / Function / EndIf …` 会排版成伪代码。',
        block: true,
      },
    ],
  },
  {
    id: 'ref',
    title: '交叉引用与文献',
    summary: '`@eq:` `@thm:` 引用前文，`[@key]` 引用文献。',
    entries: [
      {
        title: '引用公式 / 定理 / 章节',
        syntax: '由 @thm:contraction 可知，结合 @eq:pythagoras 得到……',
        note: '支持的前缀：eq 式、thm 定理、lem 引理、def 定义、prop 命题、cor 推论、exa 例题、alg 算法、sec 节、fig 图、tab 表。引用文字会自动变成可点击的「定理 1.2」。',
        block: true,
        tag: '常用',
      },
      {
        title: '直接说「由定理 1.1」也会自动变成链接',
        syntax: '由定理 1.1 可知，结合式 (2) 即得结论。',
        note: '系统会按当前编号做匹配：只要这句里的「定理 1.1」「定义 1.2」「式 (2)」确实存在，就会自动加上可点击的链接与悬停预览。编号改了（比如从按节换成连续），链接会跟着变，不用手改正文。对不上编号的文字保持原样。',
        block: true,
        tag: '省事',
      },
      {
        title: 'LaTeX 写法 \\ref{} / \\eqref{}',
        syntax: '由 \\ref{eq:lagrange} 与 \\eqref{thm:lagrange} 可得……',
        note: '和 @eq:lagrange 等价，习惯写 LaTeX 的可以直接用；大括号里写带前缀的标签即可。',
        block: true,
      },
      {
        title: '文献引用',
        syntax: '该方法最早见于 [@knuth1984]。',
        note: '`[@key]` 对应 BibTeX 里的条目 key；多条写成 `[@a; @b]`。文末参考文献表自动生成，按引用顺序编号。',
        block: true,
      },
      {
        title: '引用样式',
        syntax: '[1]  或  (Knuth, 1984)',
        note: '右上角齿轮菜单里切换「数字引用 / 作者-年份」，全文一起变。',
      },
      {
        title: 'BibTeX 条目从哪来',
        syntax: j('@article{knuth1984,', '  author  = {Knuth, Donald E.},', '  title   = {Literate Programming},', '  journal = {The Computer Journal},', '  year    = {1984}', '}'),
        note: '工作区里的 `*.bib` 会被自动扫描；也可以在「工具 → 宏命令与文献」里粘贴条目。',
        block: true,
      },
    ],
  },
  {
    id: 'code',
    title: '代码与其它',
    summary: '代码块、函数绘图、矩阵计算、真值表。',
    entries: [
      {
        title: '代码块',
        syntax: j(F + 'python', 'def grad(x):', '    return 2 * x', F),
        note: '语言名写在三个反引号后面，用于语法高亮；不写就是纯文本。',
        block: true,
      },
      {
        title: '函数绘图',
        note: '走「工具 → 函数绘图 / 矩阵计算」，输入表达式（如 `x^2`、`\\sin x`）即可。插入的是一张 SVG 图片，形如 `![函数图像](data:image/svg+xml;…)`，不依赖网络。',
      },
      {
        title: '绘图能认的写法',
        note: '函数：sin cos tan cot sec csc、arcsin/arccos/arctan、sinh 系列、exp ln lg log_2、sqrt、frac、abs、floor/ceil/round/sign、max/min、gamma、erf、阶乘。写法上认 \\sin^2 x、\\sin^{-1} x、\\log_{2} x、\\sqrt[3]{x}、x(x+1)、2x、|x|、\\lfloor x \\rfloor、e^{-x^2}。多条曲线用分号隔开，例如 `\\sin x; \\cos x; x/3`，每条一个颜色，图例里能看到转换后的表达式。自变量统一用 x。',
      },
      {
        title: '矩阵计算',
        note: '同一个窗口的「矩阵」页：粘贴或填一个矩阵，可算行列式、逆、迹、秩，结果能直接以 LaTeX 插入正文。',
      },
      {
        title: '真值表',
        note: '「工具 → 真值表生成器」输入逻辑式（如 `p -> q`），生成真值表，可插入为 Markdown 三线表或 LaTeX。',
      },
      {
        title: '公式悬浮窗能干的事',
        note: '把光标移进任意公式，右侧浮出小面板：复制为 Word 公式（MathML）/ PNG / SVG / LaTeX，矩阵还能一键加行、加列、转置，或收藏进公式库。',
      },
    ],
  },
  {
    id: 'shortcut',
    title: '快捷键',
    summary: '记住这几个就够用了。',
    entries: [
      { title: '保存到磁盘', syntax: 'Ctrl + S', tag: '快捷键' },
      { title: '打开工作区文件夹', syntax: 'Ctrl + O', tag: '快捷键' },
      { title: '导出整本', syntax: 'Ctrl + Shift + E', tag: '快捷键' },
      { title: 'AI 公式助手', syntax: 'Ctrl + K', note: '光标在公式里时会把当前 LaTeX 一起带过去。', tag: '快捷键' },
      { title: '打开这本手册', syntax: 'F1', tag: '快捷键' },
      {
        title: '折叠 / 展开公式工作台',
        syntax: 'Ctrl + Shift + M',
        note: '工作台停靠在编辑区底部、不覆盖正文；折叠后只剩一行，把高度还给代码。',
        tag: '快捷键',
      },
      { title: '搜索 / 替换', syntax: 'Ctrl + F', tag: '快捷键' },
      { title: '缩进 / 反缩进', syntax: 'Tab  /  Shift + Tab', note: '多选几行可以整块缩进；公式占位符之间也用它跳转。', tag: '快捷键' },
      { title: '界面缩放', syntax: 'Ctrl + =  /  Ctrl + -  /  Ctrl + 0', note: '桌面客户端菜单里也有「视图 → 放大 / 缩小 / 重置」。', tag: '快捷键' },
    ],
  },
]

/** 「使用建议」页签：不是语法，是踩过坑之后总结的做法 */
export const MANUAL_TIPS: Array<{ title: string; body: string }> = [
  {
    title: '标题的 # 后面一定要有空格',
    body: '`##标题` 不会被识别成标题，只会当成普通文字。如果发现某一行预览里没变成标题，先看这里。另外不用怕多按 `#`：光标紧跟在标题符号后面时，再按一次是把级别加一，不会变成 `## ## 标题`。',
  },
  {
    title: '分屏时左栏是源码，右栏是排版',
    body: '左右分屏不是两份预览：左栏老老实实显示 `#`、表格竖线、`$`，右栏才是排版结果。想核对「为什么这句话没生效」就切分屏，一眼能看出是语法写错了还是渲染的问题。',
  },
  {
    title: '分屏可以点着走，也能一起滚',
    body: '工具栏的「同步」按钮控制两边是否一起滚（默认开）。另外**点右栏任意一段，左栏光标会跳到它的源码位置**；在左栏点一下，右栏也会滚到对应段落并闪一下。改长文时按这个顺序核对最快：右栏看到问题 → 点它 → 左栏已经停在那一行。',
  },
  {
    title: '字太小或太细，去「工具 → 字体与外观」',
    body: '渲染结果和源码可以分开设置字体、字号、行距、字重。嫌宋体发细：换「黑体」或把字重调到「加粗」；装了思源宋体（Source Han Serif）就会自动用上，笔画比系统宋体厚。设置会记住，重启不用重调。',
  },
  {
    title: '先给标签，再引用',
    body: '公式、定理、算法都先写 `\\label{eq:xxx}` 或 `{#thm:xxx}`，正文里再用 `@eq:xxx` / `@thm:xxx`。引用不用担心编号——编号是自动算的，改章节顺序也不用回头改数字。反过来，标签名字定了就别乱改，否则引用会变成「未定义」。',
  },
  {
    title: '编号交给系统，别手写',
    body: '开了「公式自动编号」之后，公式右侧的 (1)(2) 是自动生成的。手写 `\\tag{1}` 会和自动编号打架，导出时序号也可能错位。',
  },
  {
    title: '长文档拆成多篇，别写成一个 8000 行文件',
    body: '一个文件一个章节，放在 chapters/ 下面，用「导出整本」合并。这样 Git diff 干净、打开快、也不会两个人同时改一个文件打架。文件名前面的数字（01-intro.md）决定合并顺序。',
  },
  {
    title: '删除不是真删，误删能救回来',
    body: '文件树里右键「移到回收站」其实是在工作区建了 `.mathflow-trash/<时间戳>/` 再把文件挪进去，目录结构、内容都还在。真删错了，去那个文件夹把文件拖回原位即可。',
  },
  {
    title: '表格列数一定要对齐',
    body: '三线表最容易犯的错是某一行少写一个竖线，渲染出来整张表会错位。写完扫一眼每行的竖线个数。单元格里要写绝对值，用 `\\vert` 而不是 `|`。',
  },
  {
    title: '公式里不要用中文标点',
    body: '`（` `）` `，` 这些在 KaTeX 里不是合法字符，会直接报红。中文说明放在公式外面写，或者用 `\\text{中文}` 包起来。',
  },
  {
    title: '导出前先切到分屏或预览扫一遍',
    body: '导出的 PDF/HTML 用的是同一套渲染器，预览里对的样子导出后也对。导出前重点看三处：公式编号连续、参考文献都解析出来（没有 `?`）、跨文件链接能跳。',
  },
  {
    title: '别把图片、PDF 塞进 .mathflow-trash 之外的地方',
    body: '工作区里除了 `.md` 和 `figs/` 之类的资源目录，不要放巨大的中间文件——导出整本时会被一起扫描。真要放大文件，放到工作区外面用绝对路径引用。',
  },
  {
    title: '拿不准语法时，按 F1',
    body: '这本手册里每一条都能点「插入」直接试，插进去看右栏的渲染效果，比翻文档快。',
  },
]

/** 供搜索：把所有条目摊平，附带所属章节名 */
export function flattenManual() {
  return MANUAL_SECTIONS.flatMap((s) =>
    s.entries.map((e) => ({ ...e, sectionId: s.id, sectionTitle: s.title }))
  )
}
