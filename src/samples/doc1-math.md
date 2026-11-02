# 高等数学与线性代数混合排版示例

> **MathFlow 演示文档**：正文用 Markdown，公式用「无感 LaTeX」。
> 把光标移出公式即可看到渲染结果，移入公式会展开源码并弹出悬浮工作台（HUD）。
> 试试在公式里输入 `//`、`sr`、`pmat `、`;a`、`->`，或在正文里输入 `@` 触发交叉引用。

## 1. 极限与连续

设 $f(x)=\dfrac{\sin x}{x}$，当 $x\to 0$ 时分子分母同时趋于零，由洛必达法则得

$$
\lim_{x\to 0}\frac{\sin x}{x}=\lim_{x\to 0}\frac{\cos x}{1}=1
$$

若把 $f$ 在 $x=0$ 处补充定义 $f(0)=1$，则 $f$ 在 $\mathbb{R}$ 上连续。这解释了重要的等价无穷小

$$
\sin x \sim x,\quad \tan x \sim x,\quad 1-\cos x \sim \frac{x^{2}}{2}\qquad (x\to 0)
$$

## 2. 微分中值定理

::: theorem [拉格朗日中值定理] {#thm:lagrange}
如果函数 $f(x)$ 在闭区间 $[a,b]$ 上连续，在开区间 $(a,b)$ 内可导，则至少存在一点 $\xi\in(a,b)$，使得

$$f'(\xi)=\frac{f(b)-f(a)}{b-a} \label{eq:lagrange}$$
:::

::: proof
构造辅助函数

$$
F(x)=f(x)-f(a)-\frac{f(b)-f(a)}{b-a}(x-a)
$$

则 $F(a)=F(b)=0$，且 $F$ 在 $[a,b]$ 上连续、在 $(a,b)$ 内可导。由罗尔定理，存在 $\xi\in(a,b)$ 使 $F'(\xi)=0$，展开即得 @eq:lagrange 。
:::

::: corollary [导数为零则函数为常数]
若对任意 $x\in(a,b)$ 都有 $f'(x)=0$，则 $f$ 在 $(a,b)$ 上恒为常数。
:::

由 @thm:lagrange 可直接推出：$f'(x)>0$ 是 $f$ 严格单调递增的充分条件。

### 2.1 泰勒展开

::: theorem [带拉格朗日余项的泰勒公式] {#thm:taylor}
若 $f$ 在含 $x_0$ 的区间上有 $n+1$ 阶导数，则

$$
f(x)=\sum_{k=0}^{n}\frac{f^{(k)}(x_0)}{k!}(x-x_0)^{k}+R_n(x),\qquad
R_n(x)=\frac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1} \label{eq:taylor}
$$
:::

取 $x_0=0$ 即得麦克劳林公式 $e^{x}=\sum_{k\ge 0}\dfrac{x^{k}}{k!}$，这是 @eq:taylor 的特例。

## 3. 线性代数：矩阵与行列式

设二阶方阵

$$
A=\begin{pmatrix} 2 & 1 \\ 1 & 3 \end{pmatrix},\qquad
A^{-1}=\frac{1}{\det A}\begin{pmatrix} 3 & -1 \\ -1 & 2 \end{pmatrix}
$$

其特征多项式与特征值为

$$
\det(\lambda I-A)=\lambda^{2}-5\lambda+5=0
\;\Longrightarrow\;
\lambda_{1,2}=\frac{5\pm\sqrt{5}}{2}
$$

> 提示：把光标放进上面的矩阵里，HUD 会提供「求行列式 / 求逆 / 求迹 / 求秩」按钮，点击后自动把结果以 `= ...` 追加到公式后面。

### 3.1 常用矩阵对照表

| 矩阵 | LaTeX 环境 | 外形 | 典型用途 |
| --- | --- | --- | --- |
| `matrix` | `\begin{matrix}` | 无括号 | 纯网格排布 |
| `pmatrix` | `\begin{pmatrix}` | $(\;\cdot\;)$ | 线性变换、向量组 |
| `bmatrix` | `\begin{bmatrix}` | $[\;\cdot\;]$ | 数据矩阵、协方差 |
| `vmatrix` | `\begin{vmatrix}` | $|\;\cdot\;|$ | 行列式 |

## 4. 分布与概率

::: definition [正态分布] {#def:normal}
若随机变量 $X$ 的密度函数为

$$
f(x)=\frac{1}{\sqrt{2\pi}\,\sigma}\exp\left(-\frac{(x-\mu)^{2}}{2\sigma^{2}}\right)
$$

则称 $X$ 服从正态分布 $X\sim\mathcal{N}(\mu,\sigma^{2})$。
:::

由 @def:normal 可得 $\mathbb{E}[X]=\mu$、$\operatorname{Var}(X)=\sigma^{2}$；二维情形需用协方差矩阵

$$
\Sigma=\begin{pmatrix}\sigma_{1}^{2} & \rho\sigma_{1}\sigma_{2}\\ \rho\sigma_{1}\sigma_{2} & \sigma_{2}^{2}\end{pmatrix}
$$

## 5. 参考文献与引用

混合编辑器最早的实践可追溯到 Knuth 的文学化编程思想 [@knuth1984]；关于排版质量与数学可读性的讨论见 [@bringhurst2004]。

::: example [用引用与公式编号串联全文]
本文的核心结论是 @thm:lagrange ，其证明依赖 @thm:taylor 的余项估计；符号定义见 @def:normal 。
:::

## 6. 结语

至此，我们用纯 Markdown + LaTeX 源码完成了标题、列表、引用块、三线表、定理/证明容器、公式编号与交叉引用——而所有源码依旧是**标准的 Markdown**，可以被任何工具链读取。
