# MathFlow

> **以 Markdown 为主、以 LaTeX 为辅的混合学术编辑器。**
> 像写 Markdown 一样写公式，像写 LaTeX 一样出排版。

MathFlow 把「写作」和「公式」放在同一个光标里：正文用 Markdown，公式用 `$...$` / `$$...$$`，
光标移开时公式原地渲染成排版好的样子，光标移入时自动展开源码并弹出浮动数学工作台（HUD）。
不需要在编辑器和预览窗口之间来回张望，也不需要为了一个矩阵去翻符号表。

它有三种运行形态，**共用同一套代码与同一份数据**：

| 形态 | 启动方式 | 文档存哪 | 适合 |
| --- | --- | --- | --- |
| **桌面客户端**（推荐） | 双击安装包，或直接跑 `MathFlow.exe` | 磁盘上的真实 `.md` 文件，默认 `文档\MathFlow` | 日常写作，像用本地软件一样，不用管浏览器和端口 |
| **本地服务 + 浏览器** | `mathflow ~/论文` | 磁盘上的真实 `.md` 文件 | 习惯浏览器、或想局域网内多设备访问 |
| **网页版** | 直接打开部署好的页面 | 浏览器 `localStorage` | 快速试用、跨设备随手写、无需安装 |

* 三种形态编辑的是**同一批文件**：桌面客户端和命令行服务都直接读写磁盘，
  网页版则存在浏览器里，二者互不干扰，可以随时切换。
* 桌面客户端是 Electron 壳 + 内嵌服务，无地址栏、有原生菜单、单实例、关窗即退；
  命令行方式仍然是**零依赖**的 Node 服务（Jupyter Lab 式的用法）。
* 无 Monaco：编辑器基于 **CodeMirror 6** 从零集成，包体小、启动快。
* 零占位符：所有功能都是真实可交互的实现，没有「即将上线」。

---

## 快速开始

> **只想直接用，不想碰命令行？**
> 到 [Releases](https://github.com/nanakotoki/Markdown-Editor/releases/latest) 下载
> `MathFlow-Setup-x.y.z.exe`，双击、下一步、完成。装完桌面就有图标，文稿存在 `文档\MathFlow`。

### 方式一：安装版（Windows，推荐；要发给别人就发这个）

```
release\installer\MathFlow-Setup-1.0.1.exe      （约 109 MB）
```

双击 → 一路「下一步」→ 桌面和开始菜单出现 MathFlow 图标，双击即用。

* **装到当前用户目录**（默认 `%LOCALAPPDATA%\Programs\MathFlow`），不弹 UAC，
  公司/学校电脑没有管理员权限也能装
* 首次启动自动在 `文档\MathFlow` 建一个带示例的工作区
* 菜单 **文件 → 打开工作区文件夹**（`Ctrl+O`）换成自己的论文目录，会被记住
* **文件 → 导出整本**（`Ctrl+Shift+E`）一键编译 `.tex` / `.html`
* 卸载走「设置 → 应用」或开始菜单里的「卸载 MathFlow」，**文稿不会被删**

> 安装包没有代码签名，Windows 可能提示「已保护你的电脑」——
> 点「更多信息 → 仍要运行」即可，只需处理一次。这是没买签名证书的正常提示，不是病毒。

### 方式二：便携版（Windows，免安装）

```
release\portable\MathFlow-Portable-1.0.1.exe      （约 109 MB）
```

单文件，双击即用，不写注册表、不进「应用」列表，适合放 U 盘或没有安装权限的电脑。

**文稿保存在这个 exe 旁边的 `workspace\` 文件夹**，把 exe 和文件夹一起拷走就等于带走全部内容。
代价是每次启动要先解压，首次启动约 5–10 秒（安装版是秒开）。

### 把软件交给别人

`release\发给别人\` 是一个可以直接打包发送的文件夹：

```
发给别人/
├── MathFlow-Setup-1.0.1.exe     安装版
├── MathFlow-Portable-1.0.1.exe     便携版
├── 使用说明.txt                  给非技术用户的一页说明（含 SmartScreen 处理办法）
└── SHA256.txt                    校验值，对方可自行核对
```

对方只需要做一件事：双击 `MathFlow-Setup-1.0.1.exe`，下一步、下一步、完成。

重新生成这套产物（会依次做前端构建 → 图标 → 打包 → 归档）：

```bash
npm run dist                 # 安装版 + 便携版 + 说明 + 校验值
npm run dist:setup           # 只出安装版
npm run dist:portable        # 只出便携版
npm run dist -- --skip-build # dist/ 已是最新时跳过前端构建
```

打包配置在 `electron-builder.yml`，图标由 `npm run icon` 生成
（`electron/resources/icon.ico`，纯代码绘制的 7 个尺寸，不依赖设计软件）。

### 方式三：单文件 exe（Windows，轻量命令行版）

`release/MathFlow.exe` 是一个 89 MB 的可执行文件，把 Node 运行时、前端产物、LaTeX 编译引擎全部打包在里面，
**拷到任何 Windows 电脑都能直接双击，目标机器不需要装 Node**。

和桌面客户端的区别：它没有原生窗口与菜单，双击后起的是「内嵌服务 + 系统浏览器」，
适合只想快速用一下、或者机器上不方便装 Electron 的场景。

1. 双击 `MathFlow.exe`
2. 首次运行会在 exe 同目录自动创建 `workspace\`（含三篇示例文档），并打开浏览器
3. 关掉弹出的命令行窗口即停止服务；文档已经写进磁盘，不会丢

想让它直接编辑自己的论文目录，把 exe 放进那个目录旁边、或者建个快捷方式带上参数：

```bat
MathFlow.exe "D:\论文"                                  :: 用指定目录当工作区
MathFlow.exe export "D:\论文" --book --title "泛函分析讲义" --open
MathFlow.exe --help                                     :: 全部参数
```

> 未做代码签名，首次运行 Windows 可能提示「已保护你的电脑」，
> 点「更多信息 → 仍要运行」即可。这个 exe 自带控制台窗口，关掉窗口就等于退出程序。

自己从源码打包：`npm run exe`（Windows + Node ≥ 20，产出 `release/MathFlow.exe`）。

### 方式四：双击启动（仓库里就有，需要已装 Node）

仓库根目录已经放了启动器，双击即可，不用敲任何命令：

* Windows：`start-windows.cmd`
* macOS / Linux：`start-mac-linux.command`（首次可能需要 `chmod +x`）

首次运行会自动创建 `workspace/`（不覆盖已有文件）并打开浏览器；关掉那个黑窗口就停止服务。
想换工作区，编辑启动器里的 `workspace` 那一行为你的目录即可。

### 方式五：下载发行包（不需要装依赖，仅需 Node 运行时）

1. 解压 `mathflow-<版本>.zip`（`npm run pack` 的产物，版本号随 `package.json`；要求已安装 Node ≥ 18）
2. 双击 `start-windows.cmd`（macOS / Linux 用 `start-mac-linux.command`）
3. 首次运行会自动在包内生成 `workspace/` 目录并写入示例文档，接着弹出浏览器

也可以直接命令行：

```bash
node bin/mathflow.mjs init ~/我的论文      # 生成一个带章节、文献库的工作区
node bin/mathflow.mjs ~/我的论文           # 在该目录启动（自动开浏览器）
node bin/mathflow.mjs export ~/我的论文    # 逐篇 + 整本编译（main.tex / main.html）
node bin/mathflow.mjs --help               # 全部参数
```

想在任何目录直接用 `mathflow` 这条命令，跑一次 `npm link` 即可（`package.json` 已声明 `bin`）：

```bash
npm link
mathflow init ~/我的论文 --serve    # 建好工作区并直接打开浏览器
```

### 方式六：从源码运行

```bash
npm install
npm run dev        # 开发模式，默认 http://localhost:5183
npm run start      # 本地工作区模式（等价于 mathflow .）
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run pack       # 打出发行包 release/mathflow-<version>.zip
```

> `npm run dev` 走 Vite 开发服务器，没有 `/api`，因此是纯网页模式；
> 想在本机读写文件时要跑 `npm run start`（或先 `npm run build` 再跑）。

首次以网页模式打开会自带三篇示例文档：

| 文档 | 内容 |
| --- | --- |
| 高等数学与线性代数混合排版示例 | 极限、微分中值定理、泰勒展开、矩阵与行列式、三线表 |
| 算法设计与离散数学课程报告 | 伪代码算法块、复杂度分析、真值表、定理/引理/证明链 |
| LaTeX 容错诊断与快捷输入沙盒 | 故意写错的公式，用来体验自愈、中文报错与一键修复 |

---

## 命令行

`bin/mathflow.mjs` 是唯一入口，所有子命令都只依赖 Node 内置模块。

| 命令 | 作用 |
| --- | --- |
| `mathflow [目录]` | 在指定目录（默认当前目录）启动服务，端口自动顺延 |
| `mathflow init <目录>` | 生成模板工作区：`00-welcome.md` + `chapters/` + `references.bib` |
| `mathflow init <目录> --serve` | 建好工作区后直接启动（少敲一条命令） |
| `mathflow export [目录]` | 逐篇编译成 `.tex` / `.html`，并生成合并版 `main.tex` / `main.html` |
| `mathflow serve` | 同第一项，显式写法 |

常用参数：

```bash
mathflow . -p 8080 --no-open            # 指定端口、不自动开浏览器
mathflow . -r                           # 只读模式，禁止任何写盘
mathflow . -H 0.0.0.0                   # 允许局域网访问（会提示风险）
mathflow export . --open                # 编译完直接打开输出目录
mathflow export . --book --title "泛函分析讲义"
                                        # 成书模式：ctexbook，H1 → \chapter
mathflow export . --no-combine           # 只要逐篇产物，不生成 main.tex
mathflow export . -o build -t tex       # 只输出 .tex 到 build/
mathflow export . --template IEEEtran   # 换 LaTeX 模板
mathflow export . -f a.md,b.md --flat   # 只编译指定文件、不保留目录层级
```

`export` 会在输出目录写一份 `manifest.json`（编译清单 + 告警），方便挂到 CI 里。
导出的 HTML 是**完全自包含**的：KaTeX 样式、字体、学术排版 CSS 全部内联，断网双击也能正确显示公式。

### 整本导出（合并编译）

多篇文档时，`export` 默认多做两件事：

```
export/
├── main.tex          ← 合并入口：导言区 + 标题页 + 目录 + \input 各章
├── sections/
│   ├── sec-01.tex    ← 00-welcome.md    的正文片段
│   ├── sec-02.tex    ← chapters/01-intro.md
│   └── sec-03.tex    ← chapters/02-methods.md
├── main.html         ← 整本阅读版：一份网页读全书，可直接打印成 PDF
├── chapters/…        ← 逐篇产物照旧（可单独分发）
└── manifest.json
```

* **交叉引用真正成立**：`@thm:` / `@eq:` 引用的 `\label` 与 `\ref` 落在同一份文档里，编号也统一；逐篇 `.tex` 里那几个「指向其它文件」的引用不再是未定义引用。
* **章节顺序按文件名自然排序**（`01-` < `2-` < `10-`），所以要控制顺序就给文件加数字前缀；`00-welcome.md` 因此排在第一章。
* **标题标签自动去重**：`\label{sec-2-3}` 里带章号，避免每章都有 `sec-1`。
* 编译：`cd export && xelatex main.tex` **跑两遍**（第一遍写 `.aux`，第二遍目录与交叉引用才对得上）。
* `main.html` 里每篇文档的锚点都加了文件前缀（`#f2-def-norm`），所以两篇都有 `#thm-main` 也不会串；章与章之间 `break-before: page`，打印出来是分页的。
* 只想逐篇、不做合并：加 `--no-combine`。


---

## 界面导览

```
┌──────────────────────────────────────────────────────────────┐
│ 工具栏：视图切换 · 插入 · 工具 · 设置 · 导出                  │
├──────────────────────────────────────────────────────────────┤
│ 文件标签：welcome │ 02-methods │ +            （本地模式）     │
├──────────┬───────────────────────────┬───────────────────────┤
│ 侧栏      │ 编辑器（CodeMirror 6）     │ 学术预览               │
│ 文件树    │ 光标感知的内联公式渲染      │ 定理框 · 三线表 · 算法 │
│ 大纲/收藏 │ 触发即用的 HUD             │ 交叉引用 · 参考文献     │
└──────────┴───────────────────────────┴───────────────────────┘
```

**三种视图**（可记忆，也可用 URL 参数 `?view=hybrid|split|source` 直达）：

| 视图 | 说明 |
| --- | --- |
| 内联混合 | 单栏，Markdown 标记被隐藏，公式就地渲染，最接近「所见即所得」 |
| 左右分屏 | 左栏是**原样源码**（`#`、`|`、`$` 全都在，不隐藏不渲染），右栏是学术排版预览 |
| 纯源码 | 关闭所有内联渲染，只保留语法高亮，适合精修与大段粘贴；分屏的左栏用的是同一套纯源码视图 |

**语法与使用手册（F1）** —— 工具栏最右侧的问号按钮，或任何时候按 `F1`：

* 九个分类、约 60 条语法：快速上手 / Markdown / 表格 / 公式 / 定理证明算法 / 交叉引用与文献 / 代码与其它 / 快捷键 / 使用建议
* 顶部输入框同时搜语法、说明与建议，比如搜「矩阵」「表格」「引用」
* 每条带「插入」按钮，点一下就把对应语法写进光标处，插完直接看右栏效果
* 「使用建议」页是踩坑总结：标题空格、标签命名、表格对齐、公式里的中文标点等

---

## 本地工作区

启动本地服务后，侧栏展示的是磁盘上的真实目录，不是虚拟文档列表。

**文件操作**——新建、重命名、删除都直接作用于磁盘：

* 新建：侧栏「+ 新建文档」，同名自动加序号，不会覆盖已有文件
* 重命名：双击文件，或右键 → 重命名（实际执行的是文件移动）
* 删除：**右键 → 移到回收站**，移入 `.mathflow-trash/<时间戳>/`（保留原目录结构，可恢复），而不是直接 `rm`
* 右键菜单还能「在此新建文档」「复制相对路径」；删除整个文件夹会先弹确认
* 文件树按真实层级缩进，单击展开目录，双击文件改名

**多文件标签页**——同时开着几篇文档，各自保留内容与未保存状态：

* 标签右侧的圆点表示「有未保存修改」，保存中转成浅色，冲突时变红
* 右键标签可「关闭其他 / 关闭全部」
* 切换标签不会丢失内容，编辑器状态按文件保留

**自动保存**——停止输入 800ms 后写盘：

* 写盘前带上文件内容哈希做乐观并发检测：如果文件在编辑器之外被改过，会提示冲突而不是静默覆盖你的内容
* 关闭页面前会把所有未保存内容抢救性地写一次
* 外部程序改了文件，后端通过文件监听推送变更，编辑中（dirty）的文件不会被自动覆盖

**跨文件引用**——这是本地模式最有用的部分：

* `@thm:` `@eq:` 补全会扫描**整个工作区**的 `.md`，不只是当前文件
* 当前文件里找不到目标时，预览会渲染成带文件名徽标的链接：
  `见 定理「Banach 不动点定理」 chapters/02-methods.md`
* 点一下自动切到目标文件并滚动定位到该定理/公式
* 文献补全同样合并工作区里所有 `.bib` 文件
* 预览里指向其它 `.md` 的相对链接（如 `[引言](chapters/01-intro.md)`）点击即可打开

**断网可用**——服务只监听 `127.0.0.1`，除了可选的 AI 能力外不发任何外部请求。

---

## 核心能力

### 1. 光标感知的内联公式渲染

* 光标不在公式内 → `Decoration.replace` 把 `$...$` 原地替换成 KaTeX 渲染结果，块级公式居中并自动编号。
* 光标进入公式 → 立刻还原源码，叠加 LaTeX 语法高亮（命令紫、数字橙、花括号灰），并弹出浮动 HUD。
* 块级公式只在**整行**都是公式时按块渲染，行内混排自动降级为行内渲染，不会破坏段落。
* 代码块与行内代码里的 `$` 不会被误判为公式定界符。

### 2. 浮动数学工作台（HUD）

点公式即可唤出，右上角常驻入口按钮。包含：

* 实时预览（支持文档中定义的宏）
* 自愈提示：「已自动补全 1 个右括号」
* 中文诊断 + **一键修复**（改写源码，而不只是给提示）
* 矩阵快捷操作：`+行`、`+列`、转置
* 单公式导出：复制为 **Word（MathML）**、PNG、SVG、LaTeX 源码

### 3. KaTeX 容错自愈 + 中文报错

写错公式不会满屏爆红，先尝试修复再报错：

| 你写的 | MathFlow 的处理 |
| --- | --- |
| `\frac{a}{b` | 补齐右括号 |
| `\frac{a+b}` | 缺失参数补 `□` 占位（灰色） |
| `\left( x` | 自动补 `\right.` |
| `\begin{matrix} ...` | 自动补 `\end{matrix}` |
| `x^2^3` | 提示「连续上标」并一键包裹为 `x^{2^3}` |
| `\fra` | 编辑距离纠错 →「您是否想输入 `\frac`（分式）？」 |
| `a & b` | 「对齐符 `&` 只能用于矩阵/多行对齐环境」→ 一键包裹 `aligned` |

诊断覆盖 ≥ 10 类常见错误，全部中文描述并附带修复动作。

### 4. 肌肉记忆级 Snippet 输入

在公式里连续敲两个字符，比点符号表快一个数量级：

| 输入 | 展开 |
| --- | --- |
| `//` | `\frac{□}{□}` |
| `(a+b)/` + 空格 | `\frac{a+b}{□}` |
| `sr` `cb` `inv` `tp` | `^2` `^3` `^{-1}` `^{\top}` |
| `sq` `nsq` | `\sqrt{□}` `\sqrt[n]{□}` |
| `sum` `int` `lim` `ddx` `part` | `\sum_{i=□}^{□}`、`\int_{□}^{□}`、`\lim_{□\to□}` 等 |
| `pmat` `bmat` `vmat` `cases` | 矩阵 / 分段函数骨架 |
| `->` `=>` `<=>` `!=` `xx` `RR` `AA` | `→` `⟹` `⇔` `≠` `×` `ℝ` `∀` |
| `;a` `;b` `;g` `;t` … | 希腊字母 α β γ τ |

展开后 `Tab` / `Shift-Tab` 在占位符之间跳转，像写代码片段一样写公式。

### 5. 可视化构造器

* **矩阵构造器**：8×8 网格、7 种环境（pmatrix / bmatrix / Bmatrix / vmatrix / Vmatrix / matrix / array）、单位阵、对角阵、转置、从剪贴板粘贴表格自动填充。
* **真值表**：输入 `(p ∧ q) → r` 这类命题逻辑式，自动生成真值表，可导出 Markdown 表格或 LaTeX `tabular`。
* **符号面板**：7 大类常用符号，支持收藏；收藏项进入侧栏「收藏」页签。
* **宏管理**：`\newcommand` 形式的宏定义实时应用于编辑器与预览；内置一套学术常用宏（`\R` `\N` `\E` `\Var` 等）。
* **函数绘图**：输入 `f(x)=x^2-3x+1` 绘制曲线，Canvas 支持缩放/平移/悬停读数，自动标注极值点。
* **矩阵求值**：`\begin{pmatrix}...\end{pmatrix}` 直接算出行列式、逆矩阵、迹、秩、转置。
* **手写画板**：鼠标/触控板手写公式，或 `Ctrl+V` 直接粘贴截图，识别后插入（离线时使用内置演示数据）。
* **AI 助手**：自然语言 → LaTeX、公式重构、公式解释；未配置 API Key 时自动回退到 86 条离线经典公式库（支持中文 / 拼音 / 关键词检索）。

### 6. 学术增强 Markdown

````markdown
::: theorem [拉格朗日中值定理] {#thm:lagrange}
如果函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，在开区间 $(a,b)$ 内可导，则……
:::

::: proof
构造辅助函数 $F(x) = f(x) - f(a) - \dfrac{f(b)-f(a)}{b-a}(x-a)$……
:::

由 @thm:lagrange 可直接推出 @eq:derivative。
````

* 容器类型：`theorem` `definition` `lemma` `proposition` `corollary` `example` `proof` `remark`（自动编号、证明结束符 ∎）。
* 交叉引用：`@kind:id`，支持 `thm` `eq` `fig` `tab` `alg` `sec` `def` `lem` `cor` `prop` `ex`；输入 `@` 触发补全，悬停显示内容卡片，点击跳转并高亮闪烁。
* 公式编号：块级公式自动编号，`\label{eq:xxx}` 建立锚点，编号与 `@eq:xxx` 引用联动。
* 文献：`[@key]` 引用 + BibTeX 条目（`@article{...}`），文末自动生成参考文献列表，缺失条目标红提示。
* 表格：GFM 表格自动渲染为**三线表**（booktabs 风格）。
* 算法块：围栏代码块 ` ```algorithm ` 渲染为带行号、缩进引导线、关键字加粗的伪代码三线表。

````markdown
```algorithm [快速排序]{#alg:quicksort}
输入: 数组 $A$，下标区间 $[p, r]$
输出: 原地排序后的 $A[p..r]$
if $p < r$ then
  $q \gets \textsc{Partition}(A, p, r)$
  $\textsc{QuickSort}(A, p, q-1)$
end if
return $A$
```
````

### 7. 导出

| 格式 | 说明 |
| --- | --- |
| **LaTeX** | AST → `.tex`，四套模板：`ctexart`（中文报告）、`ctexbook`（成书/学位论文）、`article`（英文论文）、`IEEEtran`（双栏会议）。定理→`theorem` 环境、表格→booktabs、算法→`algorithmic`、引用→`\ref` / `\cite`，可直接 POST 到 Overleaf。 |
| **LaTeX（整本）** | `mathflow export` 额外产出 `main.tex` + `sections/*.tex`，跨文件引用与统一编号成立。 |
| **HTML** | 独立单文件：内联 KaTeX CSS 与字体、学术排版样式、`@media print` A4 分页规则。双击即看，不依赖网络。 |
| **HTML（整本）** | `main.html` 把全书拼成一份可滚动/可打印的阅读版，带目录，章节之间自动分页。 |
| **HTML（批量）** | `mathflow export` 把整个目录编译成互相链接的静态站点，跨文件引用直接可点。 |
| **PDF** | 通过浏览器打印导出 HTML（A4、页边距、定理框不断页）；或 `xelatex main.tex` 两遍。 |
| **单公式** | Word（MathML 剪贴板）、PNG（3 倍图）、SVG（字体内联）、LaTeX 源码。 |

导出弹窗里多了第三个页签 **「整本工程（写盘）」**（仅本地模式可见）：填书名、选模板、勾输出格式，
点一下就写进工作区的 `export/`，左边栏立刻能看到 `main.tex` / `main.html`，还能直接打开阅读版。

> 公式编号使用网格布局（公式列可横向滚动、编号列恒定可见），
> 所以再宽的公式也不会让编号压住内容。

---

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `Tab` / `Shift-Tab` | Snippet 占位符跳转；无占位符时缩进 |
| `Mod-K` | 对光标所在公式唤起 AI 助手 |
| `@` | 触发交叉引用 / 文献 / 宏补全 |
| `;` + 字母 | 希腊字母 |
| `Mod-Z` / `Mod-Shift-Z` | 撤销 / 重做 |
| `Mod-F` | 查找替换 |
| `Mod-S` | 立即写盘（平时是自动保存） |
| `F1` | 打开语法与使用手册 |

> `Mod` = macOS 上的 `⌘`，Windows / Linux 上的 `Ctrl`。

---

## 技术栈

* **构建**：Vite 5 + React 18 + TypeScript（`strict`）
* **编辑器**：CodeMirror 6（基于 `StateField` 的装饰体系，块级装饰由 StateField 提供 —— 这是 CM6 的硬性约束）
* **公式**：KaTeX 0.16 + `mhchem`
* **Markdown**：unified / remark-parse / remark-math / remark-gfm / remark-directive
* **样式**：Tailwind CSS 3 + 一套学术排版 CSS
* **状态**：Zustand（`persist` 到 localStorage；本地模式下只存界面偏好）
* **数值**：mathjs（矩阵、采样）；命题逻辑真值表为手写递归下降解析
* **本地服务**：纯 `node:http` + `node:fs`，无 Express、无数据库

```
src/
├── core/                    # 与 UI 无关的纯逻辑
│   ├── katexSafeRender.ts   # 自愈、诊断、宏、扫描、编号
│   ├── snippetRules.ts      # 输入规则
│   ├── renderMarkdown.ts    # AST → 学术 HTML
│   ├── astToLatex.ts        # AST → .tex
│   ├── htmlExport.ts        # 独立 HTML
│   ├── academicCss.ts       # 导出与预览共用的学术排版样式
│   ├── clipboardExport.ts   # MathML / PNG / SVG
│   ├── mathEvaluator.ts     # 矩阵、函数采样、真值表
│   ├── formulaLibrary.ts    # 86 条离线公式
│   ├── workspaceApi.ts      # 本地服务的客户端封装 + 运行模式探测
│   ├── workspaceRefs.ts     # 跨文件标签索引 → RefEntry
│   ├── cliEngine.ts         # Node 端编译引擎的打包入口
│   └── aiService.ts         # LLM 接口（可离线回退）
├── components/
│   ├── Editor/              # CodeMirror 集成、HUD、Snippet、补全
│   ├── Preview/             # 学术预览、算法块
│   ├── Builders/            # 矩阵 / 真值表 / 绘图 / 手写 / 符号 / 宏 / AI
│   └── Layout/              # 工具栏、文件标签、文件树、导出
├── store/                   # Zustand 状态与编辑器命令桥
└── samples/                 # 三篇示例文档（网页模式用）

server/
├── index.mjs                # HTTP 服务、静态托管、API 路由、SSE 文件监听
├── fsapi.mjs                # 路径越界防护、读写、回收站、标签与文献索引
├── exportBatch.mjs          # 批量编译
└── lib/engine.mjs           # esbuild 打出的 Node 端引擎（构建产物）

bin/mathflow.mjs             # CLI 入口
scripts/build-engine.mjs     # 打包 core → server/lib/engine.mjs
scripts/pack.mjs             # 生成发行包
templates/workspace/         # `mathflow init` 的模板工作区
```

---

## 发布

**静态站点（GitHub Pages）**：仓库已带 `.github/workflows/pages.yml`，
推送到 `main` 后自动 `npm ci → typecheck → build → deploy`。
构建用相对路径 `base: './'`，因此放在任何子路径下都能正常加载。

**桌面客户端（Electron）**：

```bash
npm run dist            # 一条命令：前端构建 → 图标 → 安装包 + 便携版 → 归档到 release/发给别人/
npm run dist -- --skip-build   # dist/ 已是最新时跳过 vite 构建，约 5 分钟
npm run desktop         # 开发模式直接开窗口（不打包）
npm run icon            # 只重新生成 electron/resources/icon.{png,ico}
```

打包用 `electron-builder` + NSIS，配置在 `electron-builder.yml`：

| 项 | 值 | 说明 |
| --- | --- | --- |
| 安装位置 | `%LOCALAPPDATA%\Programs\MathFlow` | `perMachine: false`，不触发 UAC，普通账号可装 |
| 快捷方式 | 桌面 + 开始菜单 | `createDesktopShortcut: always`，卸载时一并移除 |
| 卸载器 | `Uninstall MathFlow.exe` | 写入「设置 → 应用」，`deleteAppDataOnUninstall: false` 保住文稿 |
| 图标 | `electron/resources/icon.ico` | 7 个尺寸（16→256），由 `scripts/build-icon.mjs` 纯代码绘制 |
| asar | 关闭 | 内嵌服务要用 ESM 动态 import 读 `server/` 与 `dist/` |

主进程入口在 `electron/main.cjs`：起内嵌服务 → 建窗口 → 加载 `http://127.0.0.1:<port>/`，
菜单里的「打开工作区文件夹」会切换服务根目录，「导出整本」直接调用同一套 `exportBatch`。
便携版通过 `PORTABLE_EXECUTABLE_DIR` 判断，把工作区建在 exe 旁边的 `workspace/`。

`scripts/build-installer.mjs` 还会生成两样给非技术用户的东西：`使用说明.txt`（含 SmartScreen
处理步骤、文稿位置、快捷键）和 `SHA256.txt`。两者和两个 exe 一起放进 `release/发给别人/`，
压缩后直接发过去即可。

**单文件 exe（Windows）**：

```bash
npm run exe       # → release/MathFlow.exe（约 89 MB，内含 Node 运行时）
```

用 Node 官方 SEA（Single Executable Application）打包：前端产物、模板、KaTeX 样式全部 base64 内联，
服务端用 esbuild 打成一份 CJS，再注入到 `node.exe` 副本里。产物不依赖 `dist/`、`node_modules` 或本机 Node。
构建脚本见 `scripts/build-exe.mjs`，入口是 `bin/desktop.mjs`。

**发行包**：

```bash
npm run pack      # → release/mathflow-<版本>.zip（约 2 MB）
```

包内包含已构建的 `dist/`、`server/`、`bin/`、`templates/` 和双击启动脚本，
**解压即用，不需要 `npm install`**：运行时不依赖任何第三方包（remark / KaTeX 已打进 `server/lib/engine.mjs`）。

---

## AI 配置（可选）

「工具 → AI 助手 → 设置」中填写：

| 项 | 默认值 |
| --- | --- |
| Provider | `deepseek` |
| Base URL | `https://api.deepseek.com/v1` |
| Model | `deepseek-chat` |
| API Key | 空（留空即全程离线） |

任何 OpenAI 兼容端点都可以用。**不配置也能正常使用**：自然语言转公式会检索离线公式库，手写识别会使用内置演示笔迹。

---

## 已知限制

* 网页模式的数据在浏览器 `localStorage`（键名 `mathflow-workspace-v1`），换浏览器或清缓存会丢失；**长期写作请用本地模式**。
* 本地模式一次只服务一个工作区目录（一个进程一个根），多目录请起多个实例或换端口。
* 单文件 exe 未做代码签名，首次运行会被 SmartScreen 提示；exe 有控制台窗口，关掉窗口即退出。
  exe 只能在 Windows 上构建（SEA 需要把 blob 注入同平台的 `node` 二进制）。
* 安装包与便携版同样**没有代码签名**：首次运行会看到「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」即可。
  想彻底消除提示需要购买 OV/EV 代码签名证书（约每年千元级），个人分发通常不做。
* 便携版每次启动要先把 109 MB 解压到临时目录，首次约 5–10 秒；追求启动速度请用安装版。
* NSIS 安装包目前只出 x64；ARM64 Windows 会以 x64 兼容模式运行。
* `--no-combine` 时仍是逐文件独立编译：跨文件引用在 HTML 里可跳转，但单文件 `.tex` 里的 `\ref` 需要你 `\input` 进主文件才能解析。默认的合并版没有这个问题。
* 合并版依赖系统里的 LaTeX 发行版（中文模板要 XeLaTeX）；MathFlow 只负责生成工程，本机没装 TeX 也能导出 `main.html` 走浏览器打印。
* PDF 走浏览器打印管线，建议在 Chrome / Edge 下导出。
* 超长块级公式提供横向滚动，不自动缩放字号。
* AI 相关能力依赖外部服务，离线时降级为本地规则。
