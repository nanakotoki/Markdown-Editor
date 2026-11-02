# 算法设计与离散数学课程报告

**课程**：算法设计与分析 &nbsp;·&nbsp; **实验**：分治与逻辑推理 &nbsp;·&nbsp; **日期**：2026-11-01

## 摘要

本报告以快速排序为载体，分析分治算法的递推式与复杂度，并给出离散数学中命题逻辑的形式化推演。所有伪代码采用学术三线算法表排版，真值表由逻辑表达式自动生成。

## 1. 问题定义

给定序列 $A=\langle a_1,a_2,\dots,a_n\rangle$，求其非降序排列 $A'$，使得

$$
a'_1\le a'_2\le\cdots\le a'_n,\qquad \{a'_i\}=\{a_i\}
$$

::: definition [逆序对] {#def:inversion}
若 $i<j$ 且 $a_i>a_j$，则称 $(i,j)$ 为一个逆序对。序列的逆序对数 $\operatorname{inv}(A)$ 是衡量「无序程度」的指标，$\operatorname{inv}(A)=0$ 当且仅当 $A$ 已有序。
:::

## 2. 算法描述

```algorithm
\caption{快速排序 QUICKSORT(A, p, r)}
输入: 数组 $A$，下标区间 $[p, r]$
输出: 原地排序后的 $A[p..r]$
Function QuickSort(A, p, r)
  If p < r
    q = Partition(A, p, r)
    QuickSort(A, p, q - 1)
    QuickSort(A, q + 1, r)
  EndIf
  Return A
EndFunction

Function Partition(A, p, r)
  x = A[r]
  i = p - 1
  For j = p To r - 1
    If A[j] <= x
      i = i + 1
      Swap(A[i], A[j])
    EndIf
  EndFor
  Swap(A[i + 1], A[r])
  Return i + 1
EndFunction
```

::: lemma [Partition 的不变式] {#lem:partition}
在 `Partition` 的每轮循环开始时，$A[p..i]\le x$，$A[i+1..j-1]>x$，且 $A[r]=x$。
:::

::: proof
初始时 $i=p-1$、$j=p$，两段均为空，命题平凡成立。归纳步：若 $A[j]\le x$，则 $i$ 自增后交换 $A[i]$ 与 $A[j]$，新增元素并入左段；否则 $j$ 自增，元素并入右段。循环结束时 $j=r$，交换 $A[i+1]$ 与 $A[r]$ 即把枢轴放到最终位置。
:::

## 3. 复杂度分析

设 $T(n)$ 为对长度为 $n$ 的数组排序的比较次数。最好与平均情形下枢轴近似平分：

$$
T(n)=2T\left(\frac{n}{2}\right)+\Theta(n)\;\Longrightarrow\;T(n)=\Theta(n\log n)
$$

最坏情形（每次枢轴为极值）退化为

$$
T(n)=T(n-1)+\Theta(n)\;\Longrightarrow\;T(n)=\Theta(n^{2})
$$

由**主定理**（Master Theorem）的一般形式

$$
T(n)=aT\left(\frac{n}{b}\right)+f(n),\qquad
T(n)=\begin{cases}
\Theta\left(n^{\log_b a}\right), & f(n)=O\left(n^{\log_b a-\varepsilon}\right)\\[2pt]
\Theta\left(n^{\log_b a}\log n\right), & f(n)=\Theta\left(n^{\log_b a}\right)\\[2pt]
\Theta\left(f(n)\right), & f(n)=\Omega\left(n^{\log_b a+\varepsilon}\right)
\end{cases}
$$

代入 $a=2,b=2,f(n)=\Theta(n)$ 即得 $\Theta(n\log n)$。

## 4. 命题逻辑：真值表自动生成

考虑复合命题 $(P\land Q)\to(\neg R\lor P)$。在工具栏打开「真值表生成器」，输入表达式后自动得到全部 $2^{3}=8$ 行：

| P | Q | R | $(P\land Q)\to(\neg R\lor P)$ |
| --- | --- | --- | --- |
| T | T | T | T |
| T | T | F | T |
| T | F | T | T |
| T | F | F | T |
| F | T | T | T |
| F | T | F | T |
| F | F | T | T |
| F | F | F | T |

::: proposition [重言式] {#prop:tautology}
命题 $(P\land Q)\to(\neg R\lor P)$ 是重言式，且它等价于 $\neg P\lor\neg Q\lor\neg R\lor P\equiv \mathbf{T}$。
:::

::: proof
由蕴含式等价改写 $A\to B\iff\neg A\lor B$，得

$$
\neg(P\land Q)\lor(\neg R\lor P)\iff(\neg P\lor\neg Q\lor\neg R)\lor P\iff\mathbf{T}
$$

即该式对任意真值指派恒为真，故为重言式。
:::

## 5. 实验结果

| 数据规模 $n$ | 随机数据 | 已排序数据 | 逆序数据 |
| --- | --- | --- | --- |
| $10^{3}$ | 0.4 ms | 1.1 ms | 1.2 ms |
| $10^{4}$ | 5.3 ms | 118 ms | 121 ms |
| $10^{5}$ | 63 ms | 11.8 s | 12.1 s |

实验与 @def:inversion 的理论预测一致：随机数据下逆序对约为 $n^{2}/4$，每次划分消去常数比例。

## 6. 结论

分治策略的有效性依赖于划分的均衡性；工程上常用「三数取中 + 小区间插入排序」缓解最坏情形，与 @lem:partition 的不变式并无冲突。相关经典论述见 [@cormen2022]。
