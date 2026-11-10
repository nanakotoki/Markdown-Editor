已为你将整份需求与架构规范文档全面转为中文，并在原有基础上针对理工科笔记、课程作业与学术论文场景，扩充了 7 个极具杀伤力的硬核功能模块：
1. 公式一键转 Word (MathML) / SVG / 高清 PNG：解决「写完公式还要贴进 Word 报告或 PPT」的痛点，点击公式即可复制为 Word 原生公式（无需任何插件直接粘贴可编辑）或高清透明底图片。
2. 公式内置微计算与一键函数绘图（CAS 轻量联动）：在悬浮窗内支持一键绘制 2D 函数图像（如输入 f(x)=\sin(x)/x 直接弹出交互式坐标系），并支持对矩阵直接计算行列式、逆矩阵、迹与特征多项式。
3. 学术级三线表（booktabs）与真值表自动生成器：支持将普通 Markdown 表格或 Excel 粘贴内容一键渲染/导出为学术标准「三线表」（\toprule / \midrule / \bottomrule）；内置离散数学/数电真值表生成器，输入逻辑表达式（如 (P \land Q) \to R）自动生成完整真值表。
4. 教科书级伪代码算法块（algorithm 扩展）：支持编写带行号、输入输出声明、条件缩进与行内公式的学术伪代码框（三线算法表样式），并可在导出 .tex 时自动编译为 \begin{algorithm}。
5. 手写公式画板 + 截图粘贴 OCR 识别：内置 HTML5 鼠标/触控手写板，并支持直接 Ctrl+V 粘贴教材/论文里的公式截图，通过多模态接口直接转为 LaTeX 源码。
6. 全文公式/定理自动编号与智能交叉引用（@\ref 悬停预览）：输入 @ 自动联想全文所有带标签的公式、定理、图表，正文内点击引用可跳转，鼠标悬停在 (式 3) 上可直接弹窗预览该公式内容，无需上下翻页。
7. 轻量 BibTeX 文献引用与公式收藏夹：支持粘贴 BibTeX 条目并用 [@key] 在正文中引用；支持将高频使用的复杂公式（如雅可比矩阵、傅里叶变换对）收藏到个人「公式片段库」。
你可以直接复制下方完整的中文 Markdown 规范文档，保存为项目根目录的 SPEC.md 喂给 AI Agent：
# 项目技术规范文档 (SPEC.md)：MathFlow ——「Markdown 为主、LaTeX 为辅」的新一代混合学术编辑器

## 1. 项目定位与核心设计哲学
开发一款名为 **MathFlow** 的现代化 Web 端混合学术与技术写作编辑器（支持一键打包为 Electron / Tauri 桌面应用）。
- **核心哲学**：让用户用熟悉的 Markdown 语法完成 80% 的正文结构与流式写作，用「经过现代交互改造的无感 LaTeX」完成 20% 的复杂数学公式、矩阵、算法伪代码、三线表与学术排版。
- **核心体验目标**：
 1. **光标感知的所见即所得（Cursor-Aware Live Preview）**：光标移出即渲染为精美排版，光标移入即展开源码并弹出实时诊断悬浮窗（HUD）。
 2. **容错渲染与中文友好诊断（Fault-Tolerant & Friendly Diagnostics）**：绝不向用户直接抛出晦涩的原生编译报错，未写完的公式自动补全占位预览，报错信息全部翻译为可一键修复的中文提示。
 3. **肌肉记忆级无感输入（Zero-Friction Math Input）**：底层存储 100% 标准 Markdown + LaTeX 源码（确保生态完全兼容），但在输入态通过自动展开（Snippets）、可视化网格构造器、真值表生成器与 AI 转换，让用户几乎感觉不到在手写繁琐的 LaTeX 宏。
 4. **全链路学术导出（Academic Export Pipeline）**：支持一键导出可编译的标准纯 LaTeX（`.tex`）、独立 HTML、A4 学术排版 PDF，以及单公式一键复制进 Microsoft Word / PPT。

---

## 2. 严格锁定的技术栈（Agent 严禁擅自更换）
为避免架构摇摆与行高计算 Bug，必须严格使用以下技术栈：
- **前端框架**：Vite + React 18+ + TypeScript
- **UI 与样式**：Tailwind CSS + Lucide React（图标库）+ Radix UI / shadcn-ui 基础组件
- **核心编辑器内核**：**CodeMirror 6** (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/autocomplete`)
 - *强制约束*：**严禁使用 Monaco Editor**（Monaco 不支持可变行高与行内复杂 DOM 替换，会导致数学公式内联渲染时光标错位）。
- **数学渲染引擎**：**KaTeX** (`katex`) + `mhchem` 扩展（支持同步毫秒级渲染、零页面抖动，并支持输出 MathML 以兼容 Word 粘贴）。
- **函数绘图与数值分析**：HTML5 Canvas 自研轻量绘图组件（或 `function-plot`）+ `mathjs`（用于公式内数值求值、矩阵行列式/逆矩阵计算及逻辑真值表生成）。
- **AST 解析与转译管道**：`unified`, `remark-parse`, `remark-math`, `remark-gfm`, `remark-directive` + 自定义 AST 到 LaTeX (`.tex`) 编译器。
- **状态管理与本地持久化**：Zustand + `localStorage` / IndexedDB（自动保存多文档树、自定义宏命令、个人公式收藏夹及 AI 接口配置）。

---

## 3. 九大核心功能模块详细规范

### 模块一：CodeMirror 6 混合编辑内核与光标感知预览
顶部工具栏提供三种视图模式无缝切换：**内联混合模式（Live Hybrid，默认）**、**左右同步分屏模式（Split View）**、**纯源码模式（Source Mode）**。

1. **光标感知行内/块级公式替换（Cursor-Aware Inline Widget）**：
  - 基于 CodeMirror 6 的 `StateField` 与 `Decoration.replace` (`WidgetType`) 实现。
  - 当光标/选区**不在** `` 或 `

` 内部时，直接将该区间的源码原地替换为渲染后的 KaTeX DOM 节点（块级公式居中显示并右侧展示自动编号 `(1)`）。
  - 当用户点击公式或使用方向键将光标**移入**公式边界时，平滑展开为带 LaTeX 语法高亮的源码态。
2. **公式悬浮工作台（Floating Math HUD）**：
  - 当光标处于任意 `` 或 `

` 内部时，在当前公式正上方或正下方弹出一个轻量悬浮窗（HUD），包含四栏内容：
    1. **实时容错预览区**：随着按键毫秒级更新当前公式渲染结果。
    2. **中文友好诊断与一键修复栏**：当存在语法瑕疵时显示中文提示及「一键修复」按钮。
    3. **快捷动作栏**：`[自然语言转公式]`、`[矩阵/分段函数构造器]`、`[函数绘图/矩阵计算]`、`[复制为 Word/图片]`、`[收藏公式]`。
    4. **参数调节（仅针对矩阵/环境）**：当光标位于矩阵环境中时，显示 `[+添加行]`、`[+添加列]`、`[转置矩阵]` 快捷按钮。

### 模块二：KaTeX 容错渲染引擎与中文友好报错翻译器
构建核心安全渲染函数 `renderMathSafely(latex: string, displayMode: boolean, macros: Record<string, string>)`：

1. **未完成公式自动愈合（Auto-Healing Graceful Preview）**：
  - 用户在输入过程中（如刚敲完 `\frac{a+b}{` 或 `\left( x + 1`），原生 KaTeX 会直接崩溃报错。
  - 在送入预览渲染前，对字符串副本执行非破坏性 AST/栈补全预处理：
    - 自动统计未闭合的 `{`，在末尾临时补齐对应数量的 `}`；
    - 检测到悬空的 `\frac{...}`（缺少第二个参数）或空的 `{}` 时，自动填充灰色占位符方块 `\color{#94a3b8}{\square}`；
    - 检测到未闭合的 `\left(`、`\left[`、`\left\{`，自动在末尾补齐 `\right.`；
    - 检测到未闭合的 `\begin{matrix}` 等环境，自动补齐对应的 `\end{...}`。
  - 效果：用户每敲一个字符，悬浮窗都能看到平滑、不中断的视觉反馈。
2. **中文化错误诊断与拼写纠错（Human-Friendly Error Translator）**：
  - 捕获原始 `KaTeX ParseError`，将其转化为中文提示，并在编辑器内用波浪线高亮错误位置：
    - `Expected '}', got 'EOF'`  **「缺少右侧闭合花括号 `}`（预览已为您临时补全）」** + `[一键补全 '}']`
    - `Undefined control sequence: \xxx`  使用编辑距离（Levenshtein Distance）匹配标准 LaTeX 命令库，提示：**「未识别的命令 `\fra`，您是否想输入 `\frac`（分式）？」** + `[替换为 \frac]`
    - `Double superscript` / `Double subscript`  **「检测到连续上下标，请用花括号包裹，例如 `x^{a^b}`」** + `[自动包裹花括号]`
    - `Misplaced &`  **「对齐符 `&` 只能在矩阵（matrix）或多行对齐（aligned/cases）环境中使用」**

### 模块三：肌肉记忆级「无感 LaTeX」输入系统
底层保存纯正的 LaTeX 源码，但在输入态（仅当光标处于 `` 或 `

` 内部时激活）提供极速展开与跳转：

1. **带占位符跳转（Tab-Stops）的自动展开引擎（参考 Obsidian Latex Suite）**：
  - 支持 `2`, `$0` 占位符队列，用户按下 `Tab` 键可在分子、分母、上下限之间丝滑跳转，按 `Shift+Tab` 回退：
  - **智能分式**：
    - 输入 `//`  自动展开为 `\frac{$1}{$2}1`。
    - 输入正则 `([0-9a-zA-Z\)\]]+)/` 后接空格  自动把斜杠前的表达式包入分子，如输入 `(a+b)/` 自动变为 `\frac{a+b}{$1}$0`。
  - **上下标与根式**：
    - `sr`  `^2` | `cb`  `^3` | `inv`  `^{-1}` | `tp`  `^{\top}`
    - `pw`  `^{$1}$0` | `__`  `_{$1}$0` | `sq`  `\sqrt{$1}$0` | `nsq`  `\sqrt[$1]{$2}$0`
    - **自动下标（Auto-Subscript）**：在单字母变量后直接输入数字（如 `x1`, `a2`），自动转为 `x_1`, `a_2`。
  - **微积分、极限与求和**：
    - `sum`  `\sum_{i=$1}^{$2} $0` | `prod`  `\prod_{i=$1}^{$2} $0`
    - `int`  `\int_{$1}^{$2} 0` | `iint`  `\iint_{$1} 0` | `oint`  `\oint_{$1} 0`
    - `lim`  `\lim_{$1 \to $2} $0` | `part`  `\frac{\partial $1}{\partial $2}$0` | `ddx`  `\frac{\mathrm{d}$1}{\mathrm{d}x}$0`
  - **线性代数与装饰符**：
    - `vec`  `\vec{$1}$0` | `hat`  `\hat{$1}$0` | `bar`  `\overline{$1}$0` | `til`  `\tilde{$1}$0`
    - `norm`  `\left\| $1 \right\|$0` | `abs`  `\left| $1 \right|$0` | `inner`  `\langle $1, $2 \rangle$0`
    - `pmat`  2x2 圆括号矩阵骨架 | `bmat`  2x2 方括号矩阵骨架 | `vmat`  2x2 行列式骨架 | `cases`  分段函数骨架
  - **集合、逻辑与关系符**：
    - `->`  `\to ` | `=>`  `\implies ` | `<=>`  `\iff ` | `|->`  `\mapsto `
    - `<=`  `\le ` | `>=`  `\ge ` | `!=`  `\neq ` | `~=`  `\approx ` | `===`  `\equiv `
    - `inn`  `\in ` | `nin`  `\notin ` | `sub`  `\subset ` | `sube`  `\subseteq `
    - `xx`  `\times ` | `..`  `\cdot ` | `...`  `\cdots ` | `inf`  `\infty`
    - `AA`  `\forall ` | `EE`  `\exists ` | `RR`  `\mathbb{R}` | `ZZ`  `\mathbb{Z}` | `NN`  `\mathbb{N}` | `CC`  `\mathbb{C}`
  - **分号前缀希腊字母快输**：
    - `;a`  `\alpha` | `;b`  `\beta` | `;g`  `\gamma` | `;G`  `\Gamma` | `;d`  `\delta` | `;D`  `\Delta`
    - `;e`  `\epsilon` | `;z`  `\zeta` | `;t`  `\theta` | `;T`  `\Theta` | `;l`  `\lambda` | `;L`  `\Lambda`
    - `;m`  `\mu` | `;p`  `\pi` | `;P`  `\Pi` | `;r`  `\rho` | `;s`  `\sigma` | `;S`  `\Sigma`
    - `;f`  `\phi` | `;F`  `\Phi` | `;w`  `\omega` | `;W`  `\Omega` | `;n`  `\nabla`

### 模块四：可视化数学与理工科构造器套件（Visual STEM Builders）
针对手写源码最痛苦的复杂结构，提供图形化交互弹窗：

1. **可视化矩阵与分段函数工作台（Matrix & Cases Builder）**：
  - 支持自由调节行列数（1×1 至 8×8），或通过鼠标拖拽网格快速选定尺寸。
  - 支持一键切换环境类型：`pmatrix` $(\dots)$、`bmatrix` $[\dots]$、`Bmatrix` $\{\dots\}$、`vmatrix` $|\dots|$、`Vmatrix` $\|\dots\|$、`cases`（分段函数，带条件列与“当...时”引导词）、`aligned`（多行等号对齐推导）。
  - **矩阵快捷操作**：内置「一键生成单位矩阵 」、「一键生成对角矩阵」、「一键生成带省略号 $\cdots/\vdots/\ddots$ 的  通用矩阵」、「矩阵一键转置」以及「支持直接粘贴空格/Tab 分隔的数字自动填充网格」。
2. **离散数学/数字逻辑「真值表自动生成器」（Truth Table Generator）**：
  - 用户输入逻辑表达式，例如 `(P \land Q) \to (\neg R \lor P)` 或 `A & B -> C`。
  - 自动解析命题变元与逻辑联结词（），一键计算出所有  行的真值结果。
  - 支持选择输出为 **Markdown 表格** 或 **LaTeX 数学数组/学术三线表** 插入文档。
3. **分类符号面板与个人公式收藏夹（Symbol Palette & Favorites）**：
  - 侧边可折叠抽屉，按学科场景分为 7 大分类：*常用结构*、*高等数学与微积分*、*线性代数与矩阵*、*概率统计*、*离散数学与集合逻辑*、*希腊与花体字母（`\mathcal`/`\mathbb`/`\mathfrak`）*、*物理与化学（`\ce`）*。
  - 支持将自己写好的复杂公式一键存入「我的收藏夹」，支持打标签与快捷键调用。
4. **全局自定义宏管理器（Macro Preamble Drawer）**：
  - 允许用户定义全局 `\newcommand` 宏（预置常用宏如 `\R` 代表 `\mathbb{R}`，`\E` 代表 `\mathbb{E}`，`\Var` 代表 `\mathrm{Var}`，`\argmin` 代表 `\operatorname*{arg\,min}`）。
  - 实时注入 KaTeX 预览，并在导出 `.tex` 时自动写入导言区（Preamble）。

### 模块五：AI 多模态公式助手 + 手写画板 + 本地经典公式库
1. **自然语言转 LaTeX（NL-to-LaTeX）**：
  - 在编辑器内按 `Cmd/Ctrl + K` 或在数学块内输入 `?` 呼出 AI 指令框。
  - 用户输入自然语言描述（如：“写出三维高斯分布的概率密度函数，均值为 ，协方差矩阵为 ” 或 “写出拉格朗日中值定理公式”）。
  - 支持配置 OpenAI 兼容接口 / Gemini API / DeepSeek API，实时流式返回纯 LaTeX 代码并展示渲染预览，按 `Enter` 直接插入。
2. **公式智能重构与推导辅助**：
  - 选中已有公式后，支持一键指令：`[转为多行 aligned 推导格式]`、`[把行内分式改为 \dfrac]`、`[展开为泰勒级数前3项]`、`[解释该公式的物理/数学含义]`。
3. **内置手写公式画板（Handwriting Canvas）与截图 OCR**：
  - 提供一个弹窗手写板（支持鼠标/触控笔书写、笔画撤销、清空），绘制完成后可将 Canvas 导出为 Base64 图像调用多模态 Vision 接口识别为 LaTeX（未配置 API 时提供基于笔画特征的本地演示识别与提示）。
  - 支持在该窗口直接 `Ctrl+V` 粘贴剪贴板中的公式截图进行识别。
4. **零延迟本地离线公式词典（233 条、12 个理工科门类的经典公式库）**：
  - 即使不配置任何 AI Key，内置涵盖**高等数学、线性代数、概率论與数理统计、离散数学、大学物理、模拟电子/信号系统、计算机算法复杂度**的 60+ 条经典公式（如泰勒公式、傅里叶变换、贝叶斯公式、麦克斯韦方程组、香农公式、主定理 Master Theorem、范德蒙德行列式、运放虚短虚断传递函数等），支持中文拼音/首字母/关键词毫秒级检索插入。

### 模块六：公式微计算与内联函数绘图（Interactive Math & Plotter）
当光标位于数学公式块内时，HUD 提供「计算与绘图」能力：
1. **一键绘制 2D 函数图像**：
  - 若当前公式包含单变量函数表达式（如 `y = \sin(x) \cdot e^{-0.2x}` 或 `\frac{1}{1+e^{-x}}`），点击 HUD 上的 `[📈 绘制函数图像]`，即可在公式下方或弹窗中渲染交互式 HTML5 Canvas 函数图像（支持缩放、平移、调整定义域 、鼠标悬停查看坐标与极值点），并支持将函数图一键作为 SVG/图片插入文档。
2. **矩阵与数值表达式即时求值**：
  - 若当前公式是一个数值矩阵（如 `\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}`），HUD 提供一键计算：`[求行列式 det]`、`[求逆矩阵 A⁻¹]`、`[求迹 tr]`、`[求秩 rank]`，点击后自动将计算结果以 `= ...` 追加在原公式后方！

### 模块七：学术增强型 Markdown 语法（定理、伪代码、三线表、交叉引用）
弥补普通 Markdown 无法直接写严谨论文和课程大作业的短板：

1. **学术定理与证明容器（`:::` Directives）**：
  - 支持在 Markdown 中使用简洁容器语法：
    ```markdown
    ::: theorem [拉格朗日中值定理] {#thm:lagrange}
    如果函数  在闭区间  上连续，在开区间  内可导，则至少存在一点 ，使得：
    $$f'(\xi) = \frac{f(b) - f(a)}{b - a} \label{eq:lagrange}$$
    :::
    ::: proof
    构造辅助函数 ，由罗尔定理即证。
    :::
    ```
  - 支持环境：`theorem`（定理）、`lemma`（引理）、`definition`（定义）、`proposition`（命题）、`corollary`（推论）、`example`（例题）、`exercise`（习题）、`solution`（解答）、`proof`（证明，末尾自动右对齐添加证毕符号 $\blacksquare$）。所有环境按章节或全文自动编号（如 **定理 1**、**定义 1**）。环境标题为**黑体加粗**，正文使用正文字体；证明行首的「证」用**楷体加粗**，解答行首的「解」与正文同族加粗。证明与解答允许在段落之间跨页断开，避免整块被推到下一页。
2. **教科书级学术伪代码算法块（` ```algorithm `）**：
  - 当代码块语言标记为 `algorithm` 时，不按普通代码块渲染，而是解析为**学术论文标准三线算法表（`algorithm2e` / `algpseudocode` 风格）**：
    - 支持 `\caption{快速排序算法}`、`Input:` / `输入:`、`Output:` / `输出:`；
    - 自动识别 `Function`, `If`, `ElseIf`, `Else`, `For`, `While`, `Return` 关键字并加粗、生成垂直缩进引导线与行号，同时完整渲染每一行内的 `` 数学公式。
3. **自动编号、智能交叉引用（`@` 补全）与悬停预览**：
  - 全文含 `\label{eq:xxx}` 的块级公式自动按 `(1)`, `(2)` 顺序编号；定理按 `定理 1` 编号。
  - 在正文中输入 `@` 或 `\ref{` 时，自动弹出下拉补全菜单，列出全文所有已定义的公式、定理、算法与章节标题。
  - 渲染态下，`@eq:lagrange` 自动显示为可点击的超链接 `式 (1)`；**鼠标悬停在 `式 (1)` 上时，直接弹出气泡卡片预览该公式或定理的完整内容**，无需滚动页面。
4. **轻量 BibTeX 文献管理与引用**：
  - 侧边栏提供「参考文献（BibTeX）」管理面板，支持直接粘贴 `.bib` 代码或手动添加文献条目。
  - 正文中输入 `[@knuth1984]` 自动联想文献库，渲染为标准上标 `[1]` 或 `(Knuth, 1984)`，并在文末自动生成格式化的「参考文献」列表，条目按 **GB/T 7714** 输出（`[1] 作者. 题名[M]. 出版地: 出版者, 年.`）。
5. **学位论文级版面（可直接交给导师看）**：
  - `\tableofcontents` / `::: toc` 生成目录，页码由分页结果实时回填；`\chapter` `\section` `\subsection` 等指令等价于 Markdown 标题，可开自动编号。
  - `[^note]` 脚注：自动编号、文末汇总。
  - 图与表：`![题名](fig.png){#fig:x}`、`::: table [题名]{#tab:x}`，按章节编号（图 3.1 / 表 3.1），题注居中，表格默认三线表。
  - 页边距（10–40mm）、页眉页脚（支持 `{page}` `{total}` `{title}`）、页码样式（无 / 1 / — 1 — / 1 / 12）均可调。
  - 阅读模式纸面与打印 PDF 使用同一套 mm 尺寸与同一套分页结果（`@page` 零边距 + 纸面内边距），做到「所见即所印」。
6. **原生 HTML 直通（内嵌 Chromium 的完整能力）**：
  - 原始 HTML 块与行内标签原样进入渲染管线，不被转义、不被过滤：`<details>` `<summary>` `<kbd>` `<mark>` `<abbr>` `<ruby>` `<sub>` `<sup>` `<dl>` `<figure>` `<figcaption>` `<svg>` `<iframe>` `<video>` `<style>` 等；
  - 样式上补齐了这些标签在论文里的样子：按键框、荧光笔、点线下划线、注音、三线表化的原生 `<table>`（`<caption>` 居中作表题）、折叠块的缩进线与展开三角；
  - `<div align="center" markdown="1">` 之类的容器加上 `markdown="1"` 后，内部照常解析 Markdown 与公式（在 AST 层提升，行号不错位，点渲染结果仍能跳回源码）；
  - 相对路径的图片 / 视频按**当前文件所在目录**解析，经本地服务的 `/ws/` 路由读磁盘，`![](figs/a.png)` 与 `<img src="figs/a.png">` 都能直接显示；
  - 打印路径：`<details>` 在阅读模式与打印时自动展开（分页按展开后的高度算，导出网页另有 beforeprint 处理），`<iframe>` 限高，`<script>` 在预览中不执行、导出后按浏览器执行。

### 模块八：单公式多格式剪贴板（一键进 Word / PPT）
点击文档或 HUD 中的任意一个数学公式，提供「复制为...」菜单：
1. **复制为 Word 原生公式（MathML）**：利用 KaTeX 的 `output: 'mathml'` 生成标准带命名空间的 `<math xmlns="[http://www.w3.org/1998/Math/MathML](http://www.w3.org/1998/Math/MathML)">...</math>`，用户打开 Microsoft Word 直接 `Ctrl+V` 即可粘贴为 Word 原生可编辑公式，彻底告别乱码与插件。
2. **复制为高清 PNG / 矢量 SVG**：将公式渲染至高分屏 Canvas（3x DPI）并写入系统剪贴板，可直接粘贴到 PPT、飞书、微信或笔记软件中。
3. **复制为纯 LaTeX / 带 `$` 包裹的 Markdown**。

### 模块九：AST 级三路专业导出引擎（`.tex` / `.html` / `.pdf`）
拒绝粗糙的正则替换，基于 `unified / remark` 抽象语法树（AST）构建完整转译管道：

1. **导出为可直接编译的纯 LaTeX 源码（`.tex`）**：
  - 提供 **3 套开箱即用的学术模板**：
    1. **`ctexart` 中文课程作业/实验报告模板**（默认集成 `amsmath, amssymb, amsthm, bm, mathtools, booktabs, algorithm, algpseudocode, geometry, hyperref, listings` 及全部定理环境定义）。
    2. **`article` 英文标准学术论文模板**。
    3. **`IEEEtran` 双栏国际会议论文模板**。
  - **AST 转换规则**：
    - Markdown 标题  `\section{}`, `\subsection{}`, `\subsubsection{}`
    - Markdown 表格  自动转换为带 `\toprule`, `\midrule`, `\bottomrule` 的 **`booktabs` 标准学术三线表**！
    - `::: theorem` 等容器  `\begin{theorem}[...] \label{...} ... \end{theorem}`
    - ` ```algorithm ` 块  `\begin{algorithm}\caption{...}\begin{algorithmic}[1]...\end{algorithmic}\end{algorithm}`
    - 全局自定义宏与 BibTeX 文献  自动注入导言区与 `\begin{thebibliography}`。
  - 提供代码高亮预览窗、一键复制 `.tex` 源码、一键下载 `.tex` 文件、以及「一键在 Overleaf 中打开（通过 Overleaf Snippets Form POST 接口）」按钮。
2. **导出为独立单文件学术网页（`.html`）**：
  - 内嵌完整排版样式（正文中文宋体、西文 Times New Roman，标题黑体；中英混排靠 CSS 逐字回退对齐基线），离线打开即可完美展示所有公式、三线表与算法框。
3. **导出/打印为 A4 学术排版 PDF**：
  - 精心调校 `@media print` 样式表：标准 A4 纸张页边距（与屏幕分页共用同一组毫米值）、衬线学术字体、三线表样式；公式、矩阵、定理框、算法表以 `break-inside: avoid` 保持完整，只有证明与解答按段落跨页。
  - 桌面版走 Electron 的 `webContents.printToPDF`（preload 只暴露 `exportPdf` / `printCurrent`）：**点一次就出文件**——文件名按文档标题起好、直接写到文档所在目录，重名自动加 `(2)`，全程没有保存框、没有系统打印对话框；浏览器版回退到新窗口 `Ctrl+P`。
  - 打印页由本地服务（`/ws/.mathflow-print/`）提供，与插图、KaTeX 字体同源：图片不必内联成 base64 也能进 PDF，字体按 URL 按需加载（HTML 从几 MB 降到几十 KB，这是导出变快的主要原因）。
4. **图片粘贴直通工作区**：
  - 编辑区 `paste` / `drop` 事件先看剪贴板里有没有图片（含 Word / 富文本的 `text/html` 内嵌 data URL），有就不走文本粘贴；
  - 本地模式经 `POST /api/asset`（base64）写入文档同级的 `assets/paste-<时间戳>.png`，并插入相对路径 `![](...)`，导出与搬移目录都不断图；浏览器模式退化为 data URL。

---

## 4. 建议项目目录结构
```text
src/
├── components/
│   ├── Editor/
│   │   ├── MathFlowEditor.tsx         # CodeMirror 6 核心编辑器封装
│   │   ├── cmMathPlugin.ts            # CM6 状态域：光标感知行内/块级 KaTeX 替换与自动编号
│   │   ├── cmSnippetPlugin.ts         # CM6 插件：数学模式自动展开 (//, sr, ;a 等) 与 Tab 占位符跳转
│   │   ├── cmRefCompletion.ts         # CM6 自动补全：\latex 命令补全与 @交叉引用 / [@文献] 联想
│   │   └── FloatingMathHUD.tsx        # 公式悬浮工作台（实时容错预览、中文诊断、一键修复、绘图与求值入口）
│   ├── Builders/
│   │   ├── MatrixBuilderModal.tsx     # 可视化矩阵 / 行列式 / 分段函数 (cases) / 多行对齐 (aligned) 构造器
│   │   ├── TruthTableModal.tsx        # 离散数学 / 数字逻辑真值表自动生成器
│   │   ├── HandwritingModal.tsx       # HTML5 手写公式画板 + 剪贴板截图粘贴 OCR 识别
│   │   ├── FunctionPlotModal.tsx      # 2D 函数图像交互式绘制器与矩阵计算面板
│   │   ├── SymbolPalette.tsx          # 17 组、365 个符号的分类符号面板 + 个人公式收藏夹
│   │   ├── MacroDrawer.tsx            # 全局 \newcommand 宏命令与 BibTeX 文献库管理抽屉
│   │   └── AIAssistantModal.tsx       # 自然语言转 LaTeX + 60+ 经典理工科离线公式检索库
│   ├── Preview/
│   │   ├── AcademicPreview.tsx        # 完整学术预览页（支持定理容器、三线表、伪代码算法块、悬停引用预览）
│   │   └── AlgorithmBlock.tsx         # 教科书级三线伪代码算法块渲染组件
│   └── Layout/
│       ├── HeaderToolbar.tsx          # 顶部导航（视图模式切换、文档切换、快捷插入、工具箱、导出按钮）
│       ├── SidebarDocTree.tsx         # 多文档管理与大纲目录（TOC）导航
│       └── ExportModal.tsx            # LaTeX (.tex) 模板选择与预览、Overleaf 一键投递、HTML/PDF 导出
├── core/
│   ├── katexSafeRender.ts             # 括号/环境自动愈合预处理器 + KaTeX 中文友好错误诊断与修复建议器
│   ├── snippetRules.ts                # 数学模式快捷展开规则字典与正则触发器
│   ├── formulaLibrary.ts              # 60+ 高数/线代/概率/离散/物理/计算机经典公式离线索引库
│   ├── mathEvaluator.ts               # 矩阵求行列式/求逆/求秩、数值计算与真值表布尔代数求值引擎
│   ├── astToLatex.ts                  # Remark AST 转标准 ctexart / article / IEEEtran LaTeX 源码编译器
│   ├── clipboardExport.ts             # 单公式转 Word (MathML)、高清 PNG、SVG 剪贴板工具
│   └── aiService.ts                   # 大模型接口封装（NL-to-LaTeX、公式重构、Vision 手写/图片识别）
├── store/
│   └── useEditorStore.ts              # Zustand 全局状态管理（多篇示例文档、宏、BibTeX、收藏夹、AI 配置）
└── App.tsx

5. Agent 分阶段开发与交付指令（Execution Plan）
请严格按照以下 5 个阶段依次编写代码，禁止留下任何 TODO 占位符或空白未实现组件，确保每个功能均可真实交互：
1. 阶段一：核心安全渲染引擎、数学计算工具与离线公式库
   * 实现 katexSafeRender.ts（必须完整实现未闭合 {}、\frac{}{}、\left\right、\begin\end 的自动愈合补全逻辑，以及不少于 10 类常见 LaTeX 报错的中文翻译与一键修复生成逻辑）。
   * 实现 formulaLibrary.ts（内置至少 50 条涵盖微积分、线性代数、概率统计、离散数学、物理、CS 的经典公式）和 mathEvaluator.ts（支持矩阵求逆/行列式/转置、单变量函数采样点计算、逻辑表达式真值表生成）。
   * 实现 useEditorStore.ts，内置 3 篇高质量预设示例文档（①《高等数学与线性代数混合排版示例》、②《算法设计与离散数学课程报告示例（含伪代码与真值表）》、③《LaTeX 容错诊断与快捷输入交互沙盒》）。
2. 阶段二：CodeMirror 6 混合编辑器内核与无感输入引擎
   * 实现 cmMathPlugin.ts（光标离开时内联渲染 KaTeX，光标进入时展开源码并触发 FloatingMathHUD）。
   * 实现 cmSnippetPlugin.ts 和 snippetRules.ts（支持 // 变分式、a/b 变分式、;a 变希腊字母、上下标/积分/求和展开及 Tab 占位符跳转）。
   * 实现 FloatingMathHUD.tsx（含实时预览、中文报错修复按钮、复制为 Word MathML/PNG 按钮、一键矩阵求值与函数绘图触发器）。
3. 阶段三：学术级全文渲染器（定理环境、三线表、伪代码、交叉引用）
   * 实现 AcademicPreview.tsx 与 AlgorithmBlock.tsx，完整解析并渲染 ::: theorem 等学术容器、```algorithm 三线伪代码框、booktabs 风格三线表、公式自动编号 (1)，以及 @ref 交叉引用点击跳转与鼠标悬停气泡预览。
4. 阶段四：可视化构造器套件、手写画板与 AI 助手
   * 实现 MatrixBuilderModal.tsx、TruthTableModal.tsx、HandwritingModal.tsx（含可涂鸦的 HTML5 Canvas 与图片粘贴区）、FunctionPlotModal.tsx（交互式 Canvas 坐标系函数绘图）、SymbolPalette.tsx、MacroDrawer.tsx 及 AIAssistantModal.tsx。
5. 阶段五：AST 转 LaTeX 编译器与多格式导出工作台
   * 实现 astToLatex.ts 和 ExportModal.tsx，支持将当前 Markdown 文档（含公式、三线表、定理块、算法块、自定义宏、文献引用）一键编译为完整的 ctexart / article / IEEEtran .tex 源码，支持代码对比预览、下载 .tex、导出独立 .html 及调用打印生成 A4 学术 PDF。