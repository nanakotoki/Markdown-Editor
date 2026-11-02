/**
 * ============================================================================
 *  formulaLibrary.ts —— 离线经典公式库（68 条，覆盖 7 大理工科门类）
 * ----------------------------------------------------------------------------
 *  完全离线、零延迟检索：中文名 / 拼音首字母 / 英文关键词均可命中。
 * ============================================================================
 */

export type FormulaCategory =
  | '高等数学'
  | '线性代数'
  | '概率统计'
  | '离散数学'
  | '大学物理'
  | '信号与电路'
  | '计算机算法'

export interface FormulaEntry {
  id: string
  name: string
  category: FormulaCategory
  latex: string
  desc: string
  keywords: string
}

export const FORMULA_CATEGORIES: FormulaCategory[] = [
  '高等数学',
  '线性代数',
  '概率统计',
  '离散数学',
  '大学物理',
  '信号与电路',
  '计算机算法',
]

export const FORMULA_LIBRARY: FormulaEntry[] = [
  /* ------------------------- 高等数学 ------------------------- */
  {
    id: 'taylor',
    name: '泰勒展开（带余项）',
    category: '高等数学',
    latex: 'f(x)=\\sum_{k=0}^{n}\\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k+R_n(x)',
    desc: '用多项式逼近函数，R_n 为拉格朗日余项。',
    keywords: 'tailegongshi tlgz taylor 展开 级数',
  },
  {
    id: 'mclaurin',
    name: '麦克劳林级数 e^x',
    category: '高等数学',
    latex: 'e^x=\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}=1+x+\\frac{x^2}{2!}+\\cdots',
    desc: '指数函数的幂级数展开，收敛半径无穷。',
    keywords: 'maikelin mkl e^x 指数 级数',
  },
  {
    id: 'lagrange-mvt',
    name: '拉格朗日中值定理',
    category: '高等数学',
    latex: "f'(\\xi)=\\frac{f(b)-f(a)}{b-a},\\quad \\xi\\in(a,b)",
    desc: '闭区间连续、开区间可导时，存在一点导数值等于割线斜率。',
    keywords: 'lagelangri lglr lagrange 中值定理',
  },
  {
    id: 'cauchy-mvt',
    name: '柯西中值定理',
    category: '高等数学',
    latex: "\\frac{f'(\\xi)}{g'(\\xi)}=\\frac{f(b)-f(a)}{g(b)-g(a)}",
    desc: '两个函数增量之比等于某点导数之比。',
    keywords: 'kexi kx 中值 cauchy',
  },
  {
    id: 'integration-by-parts',
    name: '分部积分公式',
    category: '高等数学',
    latex: '\\int_a^b u\\,\\mathrm{d}v=uv\\Big|_a^b-\\int_a^b v\\,\\mathrm{d}u',
    desc: '乘积求导法则的积分形式。',
    keywords: 'fenbu jifen fb jf parts',
  },
  {
    id: 'gauss-integral',
    name: '高斯积分',
    category: '高等数学',
    latex: '\\int_{-\\infty}^{\\infty}e^{-x^2}\\,\\mathrm{d}x=\\sqrt{\\pi}',
    desc: '概率论与傅里叶分析中的核心积分。',
    keywords: 'gaosi gs gaussian 积分',
  },
  {
    id: 'stokes',
    name: '斯托克斯公式',
    category: '高等数学',
    latex: '\\oint_{\\partial\\Sigma}\\vec{F}\\cdot\\mathrm{d}\\vec{r}=\\iint_{\\Sigma}(\\nabla\\times\\vec{F})\\cdot\\mathrm{d}\\vec{S}',
    desc: '环量等于旋度通量，广义斯托克斯定理的三维形式。',
    keywords: 'situokesi stks stokes 旋度 环量',
  },
  {
    id: 'green',
    name: '格林公式',
    category: '高等数学',
    latex: '\\oint_{L}P\\,\\mathrm{d}x+Q\\,\\mathrm{d}y=\\iint_{D}\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)\\mathrm{d}x\\,\\mathrm{d}y',
    desc: '平面曲线积分与二重积分的桥梁。',
    keywords: 'gelin gl green 曲线积分',
  },
  {
    id: 'divergence',
    name: '高斯散度定理',
    category: '高等数学',
    latex: '\\oiint_{\\Sigma}\\vec{F}\\cdot\\mathrm{d}\\vec{S}=\\iiint_{V}\\nabla\\cdot\\vec{F}\\,\\mathrm{d}V',
    desc: '通量等于散度的体积分。',
    keywords: 'sandu sd divergence 通量',
  },
  {
    id: 'fourier-series',
    name: '傅里叶级数',
    category: '高等数学',
    latex: 'f(x)=\\frac{a_0}{2}+\\sum_{n=1}^{\\infty}\\left(a_n\\cos nx+b_n\\sin nx\\right)',
    desc: '周期函数的三角级数分解。',
    keywords: 'fuliye fly fourier 级数',
  },
  {
    id: 'fourier-transform',
    name: '傅里叶变换对',
    category: '高等数学',
    latex: 'F(\\omega)=\\int_{-\\infty}^{\\infty}f(t)e^{-\\mathrm{i}\\omega t}\\,\\mathrm{d}t,\\qquad f(t)=\\frac{1}{2\\pi}\\int_{-\\infty}^{\\infty}F(\\omega)e^{\\mathrm{i}\\omega t}\\,\\mathrm{d}\\omega',
    desc: '时域与频域的互逆变换。',
    keywords: 'fuliye fly fourier 变换 频域',
  },
  {
    id: 'laplace-transform',
    name: '拉普拉斯变换',
    category: '高等数学',
    latex: 'F(s)=\\int_{0}^{\\infty}f(t)e^{-st}\\,\\mathrm{d}t',
    desc: '常用于求解线性常微分方程与系统分析。',
    keywords: 'lapulasi lpls laplace 变换',
  },
  {
    id: 'euler-formula',
    name: '欧拉公式',
    category: '高等数学',
    latex: 'e^{\\mathrm{i}\\theta}=\\cos\\theta+\\mathrm{i}\\sin\\theta',
    desc: '复指数与三角函数的桥梁。',
    keywords: 'oula ol euler 复数',
  },
  {
    id: 'lhopital',
    name: '洛必达法则',
    category: '高等数学',
    latex: '\\lim_{x\\to a}\\frac{f(x)}{g(x)}=\\lim_{x\\to a}\\frac{f\'(x)}{g\'(x)}',
    desc: '0/0 或 ∞/∞ 型极限的求解方法。',
    keywords: 'luobida lbd lhopital 极限',
  },
  {
    id: 'implicit-derivative',
    name: '隐函数求导 / 全微分',
    category: '高等数学',
    latex: '\\mathrm{d}z=\\frac{\\partial z}{\\partial x}\\mathrm{d}x+\\frac{\\partial z}{\\partial y}\\mathrm{d}y',
    desc: '多变量函数的一阶全微分。',
    keywords: 'quanweifen qwf 隐函数 偏导',
  },
  {
    id: 'double-integral-polar',
    name: '极坐标二重积分',
    category: '高等数学',
    latex: '\\iint_{D}f(x,y)\\,\\mathrm{d}x\\,\\mathrm{d}y=\\int_{\\alpha}^{\\beta}\\int_{r_1}^{r_2}f(r\\cos\\theta,r\\sin\\theta)\\,r\\,\\mathrm{d}r\\,\\mathrm{d}\\theta',
    desc: '雅可比行列式为 r 的坐标变换。',
    keywords: 'jizuo jz 二重积分 极坐标',
  },
  {
    id: 'gamma-function',
    name: '伽马函数',
    category: '高等数学',
    latex: '\\Gamma(n)=\\int_0^{\\infty}x^{n-1}e^{-x}\\,\\mathrm{d}x=(n-1)!',
    desc: '阶乘在实数域的推广。',
    keywords: 'gama gm gamma 阶乘',
  },
  {
    id: 'beta-function',
    name: '贝塔函数',
    category: '高等数学',
    latex: 'B(p,q)=\\int_0^1 x^{p-1}(1-x)^{q-1}\\,\\mathrm{d}x=\\frac{\\Gamma(p)\\Gamma(q)}{\\Gamma(p+q)}',
    desc: '与伽马函数互为表里。',
    keywords: 'beita bt beta 积分',
  },

  /* ------------------------- 线性代数 ------------------------- */
  {
    id: 'determinant-2x2',
    name: '二阶行列式',
    category: '线性代数',
    latex: '\\begin{vmatrix}a & b\\\\ c & d\\end{vmatrix}=ad-bc',
    desc: '二阶方阵的行列式。',
    keywords: 'hanglieshi hls 行列式 二阶',
  },
  {
    id: 'inverse-2x2',
    name: '二阶矩阵求逆',
    category: '线性代数',
    latex: 'A^{-1}=\\frac{1}{ad-bc}\\begin{pmatrix}d & -b\\\\ -c & a\\end{pmatrix}',
    desc: '伴随矩阵除以行列式。',
    keywords: 'ni juzhen 求逆 nizhen',
  },
  {
    id: 'cramer',
    name: '克莱姆法则',
    category: '线性代数',
    latex: 'x_i=\\frac{\\det A_i}{\\det A}',
    desc: '线性方程组解的行列式表达。',
    keywords: 'kelaipu klm cramer 线性方程组',
  },
  {
    id: 'eigen',
    name: '特征方程',
    category: '线性代数',
    latex: '\\det(\\lambda I-A)=0,\\qquad A\\vec{v}=\\lambda\\vec{v}',
    desc: '特征值与特征向量的定义式。',
    keywords: 'tezheng tz 特征值 特征向量 eigen',
  },
  {
    id: 'vandermonde',
    name: '范德蒙德行列式',
    category: '线性代数',
    latex: 'V_n=\\begin{vmatrix}1 & x_1 & \\cdots & x_1^{n-1}\\\\ \\vdots & \\vdots & \\ddots & \\vdots\\\\ 1 & x_n & \\cdots & x_n^{n-1}\\end{vmatrix}=\\prod_{1\\le i<j\\le n}(x_j-x_i)',
    desc: '插值与多项式拟合的理论基石。',
    keywords: 'fandemengde fdbd vandermonde 行列式',
  },
  {
    id: 'svd',
    name: '奇异值分解 SVD',
    category: '线性代数',
    latex: 'A=U\\Sigma V^{\\top}=\\sum_{i=1}^{r}\\sigma_i u_i v_i^{\\top}',
    desc: '任意矩阵的正交分解，PCA 与推荐系统的基础。',
    keywords: 'qiyizhi qyz svd 分解',
  },
  {
    id: 'gram-schmidt',
    name: '格拉姆-施密特正交化',
    category: '线性代数',
    latex: '\\vec{u}_k=\\vec{v}_k-\\sum_{j=1}^{k-1}\\frac{\\langle \\vec{v}_k,\\vec{u}_j\\rangle}{\\langle \\vec{u}_j,\\vec{u}_j\\rangle}\\vec{u}_j',
    desc: '把线性无关组化为标准正交基。',
    keywords: 'zhengjiaohua zjh schmidt QR',
  },
  {
    id: 'jacobian',
    name: '雅可比矩阵',
    category: '线性代数',
    latex: 'J=\\begin{pmatrix}\\dfrac{\\partial f_1}{\\partial x_1} & \\cdots & \\dfrac{\\partial f_1}{\\partial x_n}\\\\ \\vdots & \\ddots & \\vdots\\\\ \\dfrac{\\partial f_m}{\\partial x_1} & \\cdots & \\dfrac{\\partial f_m}{\\partial x_n}\\end{pmatrix}',
    desc: '多元向量值函数的局部线性近似。',
    keywords: 'yakebi ykb jacobian 偏导',
  },
  {
    id: 'hessian',
    name: '海森矩阵',
    category: '线性代数',
    latex: 'H_{ij}=\\frac{\\partial^2 f}{\\partial x_i\\,\\partial x_j}',
    desc: '二阶偏导构成的对称矩阵，用于判定极值。',
    keywords: 'haisen hs hessian 二阶 极值',
  },
  {
    id: 'rank-nullity',
    name: '秩-零化度定理',
    category: '线性代数',
    latex: '\\dim\\ker A+\\operatorname{rank}A=n',
    desc: '线性映射的维数守恒。',
    keywords: 'zhi linghuadu rank 秩 零空间',
  },
  {
    id: 'trace-property',
    name: '迹的性质',
    category: '线性代数',
    latex: '\\operatorname{tr}(AB)=\\operatorname{tr}(BA),\\quad \\operatorname{tr}(A)=\\sum_i\\lambda_i',
    desc: '迹等于特征值之和。',
    keywords: 'ji zhi trace 特征值',
  },
  {
    id: 'quadratic-form',
    name: '二次型标准形',
    category: '线性代数',
    latex: 'f(x)=x^{\\top}Ax=\\sum_{i=1}^{n}\\lambda_i y_i^2',
    desc: '正交变换把二次型化为平方和。',
    keywords: 'ercixing ecx 二次型 标准形',
  },
  {
    id: 'matrix-norm',
    name: '矩阵范数',
    category: '线性代数',
    latex: '\\|A\\|_2=\\sqrt{\\lambda_{\\max}(A^{\\top}A)}=\\sigma_{\\max}(A)',
    desc: '谱范数等于最大奇异值。',
    keywords: 'fanshu fs 范数 谱',
  },

  /* ------------------------- 概率统计 ------------------------- */
  {
    id: 'bayes',
    name: '贝叶斯公式',
    category: '概率统计',
    latex: 'P(A_i\\mid B)=\\frac{P(B\\mid A_i)P(A_i)}{\\sum_{j}P(B\\mid A_j)P(A_j)}',
    desc: '由先验与似然更新后验概率。',
    keywords: 'beiyesi bys bayes 后验',
  },
  {
    id: 'total-probability',
    name: '全概率公式',
    category: '概率统计',
    latex: 'P(B)=\\sum_{i=1}^{n}P(B\\mid A_i)P(A_i)',
    desc: '完备事件组下的概率分解。',
    keywords: 'quangailv qgl 全概率',
  },
  {
    id: 'normal-pdf',
    name: '一维正态分布密度',
    category: '概率统计',
    latex: 'f(x)=\\frac{1}{\\sqrt{2\\pi}\\,\\sigma}\\exp\\left(-\\frac{(x-\\mu)^2}{2\\sigma^2}\\right)',
    desc: '均值 μ、方差 σ² 的高斯分布。',
    keywords: 'zhengtai zt normal 高斯 密度',
  },
  {
    id: 'multivariate-normal',
    name: '多元高斯分布',
    category: '概率统计',
    latex: 'p(\\mathbf{x})=\\frac{1}{(2\\pi)^{d/2}|\\Sigma|^{1/2}}\\exp\\left(-\\frac{1}{2}(\\mathbf{x}-\\boldsymbol{\\mu})^{\\top}\\Sigma^{-1}(\\mathbf{x}-\\boldsymbol{\\mu})\\right)',
    desc: 'd 维高斯分布，机器学习中的核心分布。',
    keywords: 'duoyuan dy 高斯 协方差',
  },
  {
    id: 'variance-def',
    name: '方差与协方差',
    category: '概率统计',
    latex: '\\operatorname{Var}(X)=\\mathbb{E}[(X-\\mu)^2]=\\mathbb{E}[X^2]-\\mu^2,\\qquad \\operatorname{Cov}(X,Y)=\\mathbb{E}[XY]-\\mathbb{E}[X]\\mathbb{E}[Y]',
    desc: '二阶矩刻画离散程度与线性相关性。',
    keywords: 'fangcha fc 协方差 xfc variance',
  },
  {
    id: 'law-large-numbers',
    name: '大数定律（弱）',
    category: '概率统计',
    latex: '\\lim_{n\\to\\infty}P\\left(\\left|\\frac{1}{n}\\sum_{i=1}^{n}X_i-\\mu\\right|<\\varepsilon\\right)=1',
    desc: '样本均值依概率收敛到期望。',
    keywords: 'dashudinglv dsl 大数定律',
  },
  {
    id: 'clt',
    name: '中心极限定理',
    category: '概率统计',
    latex: '\\frac{\\sum_{i=1}^{n}X_i-n\\mu}{\\sqrt{n}\\,\\sigma}\\xrightarrow{d}\\mathcal{N}(0,1)',
    desc: '独立同分布之和依分布收敛于标准正态。',
    keywords: 'zhongxinjixian zxjx 中心极限 CLT',
  },
  {
    id: 'chebyshev',
    name: '切比雪夫不等式',
    category: '概率统计',
    latex: 'P\\left(|X-\\mu|\\ge\\varepsilon\\right)\\le\\frac{\\sigma^2}{\\varepsilon^2}',
    desc: '不依赖分布形状的概率上界。',
    keywords: 'qiebixuefu qbxf chebyshev 不等式',
  },
  {
    id: 'poisson',
    name: '泊松分布',
    category: '概率统计',
    latex: 'P(X=k)=\\frac{\\lambda^k e^{-\\lambda}}{k!},\\quad k=0,1,2,\\cdots',
    desc: '单位时间内稀有事件计数分布。',
    keywords: 'bosong bs poisson 分布',
  },
  {
    id: 'binomial',
    name: '二项分布',
    category: '概率统计',
    latex: 'P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}',
    desc: 'n 次伯努利试验成功次数分布。',
    keywords: 'erxiang ex binomial 分布',
  },
  {
    id: 'exponential-dist',
    name: '指数分布',
    category: '概率统计',
    latex: 'f(x)=\\lambda e^{-\\lambda x},\\quad x\\ge 0',
    desc: '无记忆性的等待时间分布。',
    keywords: 'zhishu zs exponential 分布',
  },
  {
    id: 'expectation-def',
    name: '数学期望与全期望公式',
    category: '概率统计',
    latex: '\\mathbb{E}[X]=\\int_{-\\infty}^{\\infty}x f(x)\\,\\mathrm{d}x,\\qquad \\mathbb{E}[X]=\\mathbb{E}\\left[\\mathbb{E}[X\\mid Y]\\right]',
    desc: '连续型期望定义与条件期望的迭代。',
    keywords: 'qiwang qw 期望 全期望',
  },
  {
    id: 'mle',
    name: '极大似然估计',
    category: '概率统计',
    latex: '\\hat{\\theta}_{\\mathrm{MLE}}=\\argmax_{\\theta}\\sum_{i=1}^{n}\\ln f(x_i;\\theta)',
    desc: '最大化对数似然得到参数估计。',
    keywords: 'jidasiran jdsr mle 似然 估计',
  },
  {
    id: 'linear-regression',
    name: '最小二乘估计',
    category: '概率统计',
    latex: '\\hat{\\boldsymbol{\\beta}}=(X^{\\top}X)^{-1}X^{\\top}\\mathbf{y}',
    desc: '正规方程给出的闭式解。',
    keywords: 'zuixiaoercheng zxec 最小二乘 回归',
  },

  /* ------------------------- 离散数学 ------------------------- */
  {
    id: 'demorgan',
    name: '德摩根律',
    category: '离散数学',
    latex: '\\neg(P\\land Q)\\iff(\\neg P\\lor\\neg Q),\\qquad \\neg(P\\lor Q)\\iff(\\neg P\\land\\neg Q)',
    desc: '否定穿过合取/析取的转换规则。',
    keywords: 'demogen dmg 德摩根 逻辑',
  },
  {
    id: 'implication-equiv',
    name: '蕴含式的等价改写',
    category: '离散数学',
    latex: 'P\\to Q\\iff \\neg P\\lor Q',
    desc: '把蕴含化为析取，是化简逻辑式的第一步。',
    keywords: 'yunhan yh 蕴含 等价',
  },
  {
    id: 'inclusion-exclusion',
    name: '容斥原理',
    category: '离散数学',
    latex: '\\left|\\bigcup_{i=1}^{n}A_i\\right|=\\sum_{i}|A_i|-\\sum_{i<j}|A_i\\cap A_j|+\\cdots+(-1)^{n-1}\\left|\\bigcap_{i=1}^{n}A_i\\right|',
    desc: '并集计数的一般公式。',
    keywords: 'rongchi rc 容斥 计数',
  },
  {
    id: 'euler-formula-graph',
    name: '欧拉公式（平面图）',
    category: '离散数学',
    latex: 'V-E+F=2',
    desc: '连通平面图的顶点、边、面数关系。',
    keywords: 'oula ol 平面图 图论',
  },
  {
    id: 'handshake',
    name: '握手定理',
    category: '离散数学',
    latex: '\\sum_{v\\in V}\\deg(v)=2|E|',
    desc: '度数之和等于边数的两倍。',
    keywords: 'woshou ws 图论 度数',
  },
  {
    id: 'cayley',
    name: '凯莱公式（生成树计数）',
    category: '离散数学',
    latex: '\\tau(K_n)=n^{n-2}',
    desc: '完全图 K_n 的生成树个数。',
    keywords: 'kailai kl cayley 生成树',
  },
  {
    id: 'master-theorem',
    name: '主定理（Master Theorem）',
    category: '计算机算法',
    latex: 'T(n)=aT\\left(\\frac{n}{b}\\right)+f(n)\\Rightarrow T(n)=\\begin{cases}\\Theta(n^{\\log_b a}) & f(n)=O(n^{\\log_b a-\\varepsilon})\\\\ \\Theta(n^{\\log_b a}\\log n) & f(n)=\\Theta(n^{\\log_b a})\\\\ \\Theta(f(n)) & f(n)=\\Omega(n^{\\log_b a+\\varepsilon})\\end{cases}',
    desc: '分治算法复杂度的三种情形。',
    keywords: 'zhudingli zdl master 分治 复杂度',
  },
  {
    id: 'pigeonhole',
    name: '鸽巢原理',
    category: '离散数学',
    latex: '\\left\\lceil\\frac{n}{m}\\right\\rceil',
    desc: 'n 个物体放入 m 个盒子，至少一个盒子含 ⌈n/m⌉ 个。',
    keywords: 'gechao gc 鸽巢 抽屉',
  },
  {
    id: 'permutation',
    name: '排列与组合',
    category: '离散数学',
    latex: 'P(n,k)=\\frac{n!}{(n-k)!},\\qquad \\binom{n}{k}=\\frac{n!}{k!(n-k)!}',
    desc: '有序排列与无序组合的计数公式。',
    keywords: 'pailie pl 组合 zuhe 计数',
  },
  {
    id: 'binomial-theorem',
    name: '二项式定理',
    category: '离散数学',
    latex: '(x+y)^n=\\sum_{k=0}^{n}\\binom{n}{k}x^{n-k}y^k',
    desc: '多项式展开的系数规律。',
    keywords: 'erxiangshi exs 二项式 定理',
  },

  /* ------------------------- 大学物理 ------------------------- */
  {
    id: 'maxwell',
    name: '麦克斯韦方程组',
    category: '大学物理',
    latex: '\\begin{cases}\\nabla\\cdot\\vec{E}=\\dfrac{\\rho}{\\varepsilon_0} & \\text{高斯定律}\\\\[4pt] \\nabla\\cdot\\vec{B}=0 & \\text{磁场无源}\\\\[4pt] \\nabla\\times\\vec{E}=-\\dfrac{\\partial\\vec{B}}{\\partial t} & \\text{法拉第定律}\\\\[4pt] \\nabla\\times\\vec{B}=\\mu_0\\vec{J}+\\mu_0\\varepsilon_0\\dfrac{\\partial\\vec{E}}{\\partial t} & \\text{安培-麦克斯韦}\\\\ \\end{cases}',
    desc: '经典电动力学的四个基本方程（微分形式）。',
    keywords: 'maikesiwei mksw maxwell 电磁场',
  },
  {
    id: 'newton-gravity',
    name: '万有引力定律',
    category: '大学物理',
    latex: '\\vec{F}=-G\\frac{m_1m_2}{r^2}\\hat{r}',
    desc: '两质点间的引力，方向沿连线。',
    keywords: 'wanyouyinli wyyl 引力 牛顿',
  },
  {
    id: 'schrodinger',
    name: '定态薛定谔方程',
    category: '大学物理',
    latex: '-\\frac{\\hbar^2}{2m}\\nabla^2\\psi+V(\\mathbf{r})\\psi=E\\psi',
    desc: '量子力学的基本方程（定态）。',
    keywords: 'xuedinge xde schrodinger 量子',
  },
  {
    id: 'mass-energy',
    name: '质能方程',
    category: '大学物理',
    latex: 'E=mc^2',
    desc: '质量与能量的等价关系。',
    keywords: 'zhineng zn 质能 爱因斯坦',
  },
  {
    id: 'ideal-gas',
    name: '理想气体状态方程',
    category: '大学物理',
    latex: 'pV=nRT=Nk_BT',
    desc: '压强、体积与温度的约束关系。',
    keywords: 'lixiangqiti lxqt 理想气体 状态方程',
  },
  {
    id: 'thermo-first-law',
    name: '热力学第一定律',
    category: '大学物理',
    latex: '\\mathrm{d}U=\\delta Q-\\delta W',
    desc: '内能变化等于吸热减对外做功。',
    keywords: 'rediyl rdy 热力学 第一定律',
  },
  {
    id: 'entropy',
    name: '熵变（克劳修斯）',
    category: '大学物理',
    latex: '\\mathrm{d}S=\\frac{\\delta Q_{\\mathrm{rev}}}{T}',
    desc: '可逆过程中的熵变定义。',
    keywords: 'shang sb entropy 熵',
  },
  {
    id: 'lorentz-force',
    name: '洛伦兹力',
    category: '大学物理',
    latex: '\\vec{F}=q\\left(\\vec{E}+\\vec{v}\\times\\vec{B}\\right)',
    desc: '带电粒子在电磁场中的受力。',
    keywords: 'luolunzili llzl 洛伦兹 电磁',
  },
  {
    id: 'coulomb',
    name: '库仑定律',
    category: '大学物理',
    latex: 'F=\\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1q_2}{r^2}',
    desc: '点电荷之间的静电力。',
    keywords: 'kulun kl 库仑 静电力',
  },
  {
    id: 'faraday-induction',
    name: '法拉第电磁感应定律',
    category: '大学物理',
    latex: '\\varepsilon=-\\frac{\\mathrm{d}\\Phi_B}{\\mathrm{d}t}',
    desc: '感应电动势正比于磁通量变化率。',
    keywords: 'faladi fld 电磁感应 电动势',
  },
  {
    id: 'harmonic-oscillator',
    name: '简谐振动方程',
    category: '大学物理',
    latex: 'x(t)=A\\cos(\\omega t+\\varphi),\\qquad \\omega=\\sqrt{\\frac{k}{m}}',
    desc: '弹簧振子与单摆的共同模型。',
    keywords: 'jianxiezhendong jxzd 简谐 振动',
  },
  {
    id: 'kinematics',
    name: '匀加速运动学公式',
    category: '大学物理',
    latex: 'v=v_0+at,\\qquad x=x_0+v_0t+\\frac{1}{2}at^2,\\qquad v^2-v_0^2=2a(x-x_0)',
    desc: '一维匀加速运动的三个基本关系。',
    keywords: 'yunjiasu yjs 运动学 加速度',
  },

  /* ------------------------- 信号与电路 ------------------------- */
  {
    id: 'shannon',
    name: '香农信道容量公式',
    category: '信号与电路',
    latex: 'C=B\\log_2\\left(1+\\frac{S}{N}\\right)',
    desc: '带宽 B、信噪比 S/N 下的极限速率。',
    keywords: 'xiangnong xn shannon 信道容量',
  },
  {
    id: 'nyquist',
    name: '奈奎斯特采样定理',
    category: '信号与电路',
    latex: 'f_s>2f_{\\max}',
    desc: '采样频率需大于信号最高频率的两倍。',
    keywords: 'naikuisite nkst nyquist 采样',
  },
  {
    id: 'convolution',
    name: '卷积定义',
    category: '信号与电路',
    latex: '(f*g)(t)=\\int_{-\\infty}^{\\infty}f(\\tau)g(t-\\tau)\\,\\mathrm{d}\\tau',
    desc: '线性时不变系统的输出等于输入与冲激响应卷积。',
    keywords: 'juanji jj convolution',
  },
  {
    id: 'transfer-function',
    name: '传递函数',
    category: '信号与电路',
    latex: 'H(s)=\\frac{Y(s)}{X(s)}=\\frac{\\sum_{k=0}^{m}b_k s^k}{\\sum_{k=0}^{n}a_k s^k}',
    desc: '零初始条件下输出与输入的拉氏比。',
    keywords: 'chuandi chd 传递函数 系统',
  },
  {
    id: 'opamp-ideal',
    name: '运放虚短虚断',
    category: '信号与电路',
    latex: 'v_+=v_-,\\qquad i_+=i_-=0,\\qquad A_v=-\\frac{R_f}{R_1}',
    desc: '理想运放分析的两条基本假设与反相放大增益。',
    keywords: 'yunfang yf 虚短 虚断 运放',
  },
  {
    id: 'rc-charge',
    name: 'RC 充电时间常数',
    category: '信号与电路',
    latex: 'u_C(t)=U\\left(1-e^{-t/\\tau}\\right),\\qquad \\tau=RC',
    desc: '一阶 RC 电路的阶跃响应。',
    keywords: 'chongdian cd 时间常数 RC',
  },
  {
    id: 'thevenin',
    name: '戴维南等效定理',
    category: '信号与电路',
    latex: 'V_{th}=V_{oc},\\qquad R_{th}=\\frac{V_{oc}}{I_{sc}}',
    desc: '线性含源二端网络可等效为电压源串联电阻。',
    keywords: 'daiweinan dwn 戴维南 等效',
  },
  {
    id: 'impedance',
    name: '阻抗与相量形式',
    category: '信号与电路',
    latex: 'Z_R=R,\\quad Z_L=\\mathrm{j}\\omega L,\\quad Z_C=\\frac{1}{\\mathrm{j}\\omega C}',
    desc: '正弦稳态分析中三类元件的阻抗。',
    keywords: 'kanggang zk 阻抗 相量',
  },

  /* ------------------------- 计算机算法 ------------------------- */
  {
    id: 'big-o',
    name: '大 O 记号定义',
    category: '计算机算法',
    latex: 'f(n)=O(g(n))\\iff \\exists c>0,n_0>0:\\ \\forall n\\ge n_0,\\ 0\\le f(n)\\le c\\,g(n)',
    desc: '渐近上界的严格定义。',
    keywords: 'dabiaoji dbj bigO 复杂度 渐近',
  },
  {
    id: 'quicksort-tc',
    name: '快速排序平均复杂度',
    category: '计算机算法',
    latex: 'T(n)=2T\\left(\\frac{n}{2}\\right)+\\Theta(n)=\\Theta(n\\log n)',
    desc: '平均情况下的递推与解。',
    keywords: 'kuaisupaixu kspx 快排 复杂度',
  },
  {
    id: 'merge-sort-tc',
    name: '归并排序复杂度',
    category: '计算机算法',
    latex: 'T(n)=2T\\left(\\frac{n}{2}\\right)+\\Theta(n)\\Rightarrow T(n)=\\Theta(n\\log n)',
    desc: '稳定的分治排序，最坏也为 O(n log n)。',
    keywords: 'guibing gb 归并排序 复杂度',
  },
  {
    id: 'amortized-dp',
    name: '动态规划状态转移',
    category: '计算机算法',
    latex: 'dp[i]=\\max_{j<i}\\left\\{dp[j]+w(j,i)\\right\\}',
    desc: '常见的序列型 DP 转移方程模板。',
    keywords: 'dongtaiguihua dtgh dp 动态规划',
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra 松弛操作',
    category: '计算机算法',
    latex: 'd[v]\\leftarrow\\min\\left(d[v],\\ d[u]+w(u,v)\\right)',
    desc: '单源最短路的贪心松弛（非负权）。',
    keywords: 'zuiduanlu zdl 最短路 dijkstra 松弛',
  },
  {
    id: 'bellman',
    name: 'Bellman 方程',
    category: '计算机算法',
    latex: 'V^{\\pi}(s)=\\sum_{s\'}P(s\'\\mid s,\\pi(s))\\left[R(s,a)+\\gamma V^{\\pi}(s\')\\right]',
    desc: '强化学习中值函数的递推关系。',
    keywords: 'qianghua qh bellman 强化学习 值函数',
  },
  {
    id: 'softmax',
    name: 'Softmax 函数',
    category: '计算机算法',
    latex: '\\sigma(\\mathbf{z})_i=\\frac{e^{z_i}}{\\sum_{j=1}^{K}e^{z_j}}',
    desc: '把实数向量映射为概率分布。',
    keywords: 'softmax 归一化 分类',
  },
  {
    id: 'cross-entropy',
    name: '交叉熵损失',
    category: '计算机算法',
    latex: 'L=-\\sum_{i=1}^{C}y_i\\log\\hat{y}_i',
    desc: '分类任务中最常用的损失函数。',
    keywords: 'jiaochashang jcs 交叉熵 损失',
  },
  {
    id: 'gradient-descent',
    name: '梯度下降更新',
    category: '计算机算法',
    latex: '\\theta_{t+1}=\\theta_t-\\eta\\nabla_{\\theta}L(\\theta_t)',
    desc: '沿负梯度方向迭代优化。',
    keywords: 'tiduxiajiang tdxj 梯度 优化',
  },
  {
    id: 'attention',
    name: '缩放点积注意力',
    category: '计算机算法',
    latex: '\\mathrm{Attention}(Q,K,V)=\\mathrm{softmax}\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right)V',
    desc: 'Transformer 的核心计算单元。',
    keywords: 'zhuyili zyl attention transformer',
  },
]

/** 拼音/关键词模糊检索，返回按相关度排序的结果 */
export function searchFormulas(query: string, limit = 40): FormulaEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return FORMULA_LIBRARY.slice(0, limit)
  const scored: Array<{ e: FormulaEntry; s: number }> = []
  for (const e of FORMULA_LIBRARY) {
    let s = 0
    const name = e.name.toLowerCase()
    const kw = e.keywords.toLowerCase()
    const latex = e.latex.toLowerCase()
    if (name === q) s = 100
    else if (name.startsWith(q)) s = 90
    else if (name.includes(q)) s = 70
    else if (kw.split(/\s+/).some((k) => k === q)) s = 80
    else if (kw.split(/\s+/).some((k) => k.startsWith(q))) s = 60
    else if (kw.includes(q)) s = 45
    else if (latex.includes(q)) s = 30
    else if (e.category.includes(q)) s = 20
    if (s > 0) scored.push({ e, s })
  }
  scored.sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length)
  return scored.slice(0, limit).map((x) => x.e)
}

export function formulasByCategory(cat: FormulaCategory): FormulaEntry[] {
  return FORMULA_LIBRARY.filter((f) => f.category === cat)
}

export const FORMULA_COUNT = FORMULA_LIBRARY.length
