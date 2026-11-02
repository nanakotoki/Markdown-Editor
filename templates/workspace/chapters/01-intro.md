# 引言：记号与定义

本章固定记号，并给出后文反复用到的两个定义。

## 基本记号

设 $X$ 是完备度量空间，$T: X \to X$ 是自映射，$d(\cdot,\cdot)$ 为 $X$ 上的度量。
对任意 $x \in X$，记 $T^n x$ 为 $T$ 的 $n$ 次迭代。

::: definition [压缩映射]{#def:contraction}
若存在常数 $0 \le q < 1$，使得对任意 $x, y \in X$ 都有

$$
d(Tx, Ty) \le q \, d(x, y),
\label{eq:contraction}
$$

则称 $T$ 是**压缩映射**，$q$ 称为压缩常数。
:::

压缩性的直观含义是「距离每次都按固定比例缩短」，这正是后面所有收敛性结论的来源。

::: definition [范数]{#def:norm}
向量空间上的范数 $\lVert \cdot \rVert$ 满足正定性、齐次性与三角不等式：

$$
\lVert x \rVert \ge 0,\qquad
\lVert \alpha x \rVert = \lvert \alpha \rvert \lVert x \rVert,\qquad
\lVert x + y \rVert \le \lVert x \rVert + \lVert y \rVert .
\label{eq:norm-axioms}
$$
:::

## 本章小结

压缩性由 @def:contraction 给出，其定量形式就是 @eq:contraction；
范数公理见 @def:norm 与 @eq:norm-axioms。下一章用它们证明主定理。
