# 方法：不动点与收敛速度

上一章定义了压缩映射（见 @def:contraction），本章给出主定理与其算法实现。

::: theorem [Banach 不动点定理]{#thm:contraction}
设 $X$ 完备，$T$ 是以 $q$ 为常数的压缩映射，则 $T$ 在 $X$ 中存在唯一不动点 $x^{*}$；
并且对任意初值 $x_0$，迭代 $x_{n+1} = T x_n$ 满足

$$
\lVert x_n - x^{*} \rVert \le \frac{q^n}{1-q} \, \lVert x_1 - x_0 \rVert .
\label{eq:fixed-point}
$$
:::

::: proof
由 @eq:contraction 反复放缩可得 $\lVert x_{n+1} - x_n \rVert \le q^n \lVert x_1 - x_0 \rVert$，
于是 $\{x_n\}$ 是 Cauchy 列，完备性给出极限存在。唯一性由
$d(x^{*}, y^{*}) \le q\, d(x^{*}, y^{*})$ 直接得到；把相邻两项的差求和并用等比级数求和，
即得 @eq:fixed-point 中的误差界。
:::

::: corollary [误差控制]{#cor:error}
要让误差不超过 $\varepsilon$，取
$n \ge \log\!\left(\dfrac{\varepsilon(1-q)}{\lVert x_1 - x_0 \rVert}\right) \big/ \log q$ 即可。
:::

## 迭代算法

```algorithm [压缩迭代]{#alg:iterate}
输入: 初值 $x_0$，压缩常数 $q$，容差 $\varepsilon$
输出: 近似不动点 $x$
while $\lVert x - x_0 \rVert \ge \varepsilon$ do
  $x_0 \gets x$
  $x \gets T x_0$
end while
return $x$
```

由 @cor:error 可知所需迭代次数是 $O(\log(1/\varepsilon))$ 量级，
而每步只需一次 $T$ 的求值。

## 一句话总结

压缩性把「存在唯一」与「几何收敛」绑在了一起：@thm:contraction 给结论，@eq:fixed-point 给速度，
@alg:iterate 给实现。

参考文献：@lamport1994 讨论了这类定理的排版惯例，@knuth1984 是底层排版系统的原始文档。
