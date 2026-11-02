# LaTeX 容错诊断与快捷输入交互沙盒

> 这一篇专门用来「试错」。MathFlow 的核心理念是：**写错公式不应打断思路**。
> 未完成的公式会被自动愈合，真正的错误会被翻译成中文并给出一键修复方案。

## 1. 自动愈合演示

下面三行公式都在末尾「少写了东西」，但预览依然平滑、不报红：

$$
\frac{a+b}{
$$

$$
\left( x + 1
$$

$$
\begin{pmatrix} 1 & 2 \\ 3 & 4
$$

把光标移进任意一行，HUD 的「诊断」栏会告诉你它替你补了什么（灰色 `□` 就是占位符）。

## 2. 中文诊断与一键修复

下面这行故意把 `\frac` 拼成了 `\fra`：

$$
\fra{a}{b} + \sqrt{x}
$$

预期提示：**「未识别的命令 `\fra`，您是否想输入 `\frac`（分式）？」** → 点击「替换为 \frac」即可。

这一行缺少右花括号，且存在连续上标：

$$
x^2^3 + y^{2
$$

预期提示：**「检测到连续上标，请用花括号包裹」** + **「缺少右侧闭合花括号」**。

这一行把对齐符 `&` 用在了普通公式里：

$$
a & b + c
$$

预期提示：**「对齐符 `&` 只能在矩阵或多行对齐环境中使用」** → 一键包裹为 `aligned`。

## 3. 快捷输入速查

在**数学模式内**（光标处于 `$...$` 或 `$$...$$` 之间）输入以下缩写：

| 输入 | 展开 | 输入 | 展开 |
| --- | --- | --- | --- |
| `//` | $\frac{\square}{\square}$ | `(a+b)/` + 空格 | $\frac{a+b}{\square}$ |
| `sr` | $x^{2}$ | `cb` | $x^{3}$ |
| `inv` | $A^{-1}$ | `tp` | $A^{\top}$ |
| `pw` | $x^{\square}$ | `__` | $x_{\square}$ |
| `sq` | $\sqrt{\square}$ | `nsq` | $\sqrt[n]{\square}$ |
| `sum` | $\sum_{i=\square}^{\square}$ | `int` | $\int_{\square}^{\square}$ |
| `lim` | $\lim_{\square\to\square}$ | `ddx` | $\frac{\mathrm{d}y}{\mathrm{d}x}$ |
| `pmat` | 2×2 圆括号矩阵 | `vmat` | 2×2 行列式 |
| `->` | $\to$ | `=>` | $\implies$ |
| `<=` | $\le$ | `!=` | $\neq$ |
| `inn` | $\in$ | `sube` | $\subseteq$ |
| `;a` | $\alpha$ | `;t` | $\theta$ |
| `;l` | $\lambda$ | `;W` | $\Omega$ |

按 `Tab` 在占位符之间跳转，`Shift+Tab` 回退。例如输入 `sum` + 空格后连按三次 `Tab`：

$$
\sum_{i=\square}^{\square}\ \square
$$

## 4. 自动下标

在单字母变量后直接敲数字，会自动变成下标：输入 `x1` 得到 $x_{1}$，输入 `a2` 得到 $a_{2}$。

## 5. 矩阵与分段函数

$$
f(x)=\begin{cases}
\dfrac{\sin x}{x}, & x\neq 0\\[4pt]
1, & x=0
\end{cases}
\qquad
J=\begin{pmatrix}
\dfrac{\partial u}{\partial x} & \dfrac{\partial u}{\partial y}\\[6pt]
\dfrac{\partial v}{\partial x} & \dfrac{\partial v}{\partial y}
\end{pmatrix}
$$

把光标放进矩阵，HUD 会出现 `[+行] [+列] [转置]`，也可以直接点「矩阵构造器」用鼠标画网格。

## 6. 交叉引用

输入 `@` 会弹出全文索引，例如 @thm:lagrange 、@eq:taylor 、@prop:tautology 。
把鼠标悬停在渲染后的「式 (1)」上，会直接浮出公式气泡卡片，不必滚动页面。

## 7. AI 助手

按 `Ctrl/Cmd + K`，用中文描述你想要的公式，例如：

> 写出三维高斯分布的概率密度函数，均值为 μ，协方差矩阵为 Σ

未配置 API Key 时，会退化为本地 68 条经典公式库的语义检索——同样零延迟可用。
