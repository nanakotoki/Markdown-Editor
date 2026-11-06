/**
 * ============================================================================
 *  formulaLibrary.ts —— 离线经典公式库（覆盖 12 个理工科门类）
 * ----------------------------------------------------------------------------
 *  完全离线、零延迟检索：中文名 / 拼音首字母 / 英文关键词 / LaTeX 片段均可命中。
 *
 *  条目写成「一行一表」的紧凑形式（Row），而不是一整段对象字面量：
 *  200 多条公式用对象写法将近 1500 行，改一条要在 7 行里找位置，很容易改错。
 *  id 由「分类序号 + 组内序号」生成，仅用于列表 key，不参与持久化。
 * ============================================================================
 */

export type FormulaCategory =
  | '高等数学'
  | '线性代数'
  | '概率统计'
  | '离散数学'
  | '常微分方程'
  | '复变与积分变换'
  | '数值分析'
  | '大学物理'
  | '信号与电路'
  | '计算机算法'
  | '机器学习'
  | '数学物理与几何'

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
  '常微分方程',
  '复变与积分变换',
  '数值分析',
  '大学物理',
  '信号与电路',
  '计算机算法',
  '机器学习',
  '数学物理与几何',
]

/** [名称, LaTeX, 说明, 检索关键词（拼音首字母 + 英文）] */
type Row = [name: string, latex: string, desc: string, keywords: string]

const LIB: Record<FormulaCategory, Row[]> = {
  /* ------------------------------------------------------------------ 高等数学 */
  高等数学: [
    ['泰勒展开（带余项）', 'f(x)=\\sum_{k=0}^{n}\\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k+R_n(x)', '用多项式逼近函数，R_n 为拉格朗日余项。', 'tailegongshi tlgz taylor 展开 级数'],
    ['麦克劳林级数 e^x', 'e^x=\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}=1+x+\\frac{x^2}{2!}+\\cdots', '指数函数的幂级数展开，收敛半径无穷。', 'maikelin mkl e^x 指数 级数'],
    ['拉格朗日中值定理', "f'(\\xi)=\\frac{f(b)-f(a)}{b-a},\\quad \\xi\\in(a,b)", '闭区间连续、开区间可导时，存在一点导数值等于割线斜率。', 'lagelangri lglr lagrange 中值定理'],
    ['柯西中值定理', "\\frac{f'(\\xi)}{g'(\\xi)}=\\frac{f(b)-f(a)}{g(b)-g(a)}", '两个函数增量之比等于某点导数之比。', 'kexi kx 中值 cauchy'],
    ['罗尔定理', "f(a)=f(b)\\ \\Rightarrow\\ \\exists\\,\\xi\\in(a,b),\\ f'(\\xi)=0", '两端函数值相等时，内部必有水平切线。', 'luoer le rolle 中值 定理'],
    ['莱布尼茨高阶导公式', "(uv)^{(n)}=\\sum_{k=0}^{n}\\binom{n}{k}u^{(k)}v^{(n-k)}", '乘积高阶导的展开，形式同二项式定理。', 'laibunici lbnz leibniz 高阶导 乘积'],
    ['分部积分公式', '\\int_a^b u\\,\\mathrm{d}v=uv\\Big|_a^b-\\int_a^b v\\,\\mathrm{d}u', '乘积求导法则的积分形式。', 'fenbu jifen fb jf parts'],
    ['定积分中值定理', '\\int_a^b f(x)\\,\\mathrm{d}x=f(\\xi)(b-a),\\quad \\xi\\in[a,b]', '连续函数的平均值可由某点函数值取到。', 'dingjifen zhongzhi djjfzz 积分 中值'],
    ['高斯积分', '\\int_{-\\infty}^{\\infty}e^{-x^2}\\,\\mathrm{d}x=\\sqrt{\\pi}', '概率论与傅里叶分析中的核心积分。', 'gaosi gs gaussian 积分'],
    ['沃利斯公式', '\\int_0^{\\pi/2}\\sin^n x\\,\\mathrm{d}x=\\frac{n-1}{n}\\int_0^{\\pi/2}\\sin^{n-2}x\\,\\mathrm{d}x', '正弦幂积分递推，双阶乘闭式解由此得到。', 'wolisi wls wallis 积分 递推'],
    ['弧长公式', "s=\\int_a^b\\sqrt{1+\\left(y'\\right)^2}\\,\\mathrm{d}x", '直角坐标下的曲线弧长。', 'huchang hc arc 弧长'],
    ['旋转体体积', 'V=\\pi\\int_a^b y^2\\,\\mathrm{d}x', '绕 x 轴旋转所得的旋转体体积。', 'xuanzhuan xzt volume 体积'],
    ['比值判别法', '\\lim_{n\\to\\infty}\\left|\\frac{a_{n+1}}{a_n}\\right|=\\rho', 'ρ<1 收敛、ρ>1 发散，ρ=1 需另判。', 'bizhi bz ratio 判别 级数'],
    ['幂级数收敛半径', 'R=\\frac{1}{\\limsup_{n\\to\\infty}\\sqrt[n]{|a_n|}}', '柯西-阿达马公式，收敛区间为 (x₀−R, x₀+R)。', 'mijishu mjs 收敛半径 幂级数'],
    ['傅里叶系数', 'a_n=\\frac{1}{\\pi}\\int_{-\\pi}^{\\pi}f(x)\\cos nx\\,\\mathrm{d}x,\\quad b_n=\\frac{1}{\\pi}\\int_{-\\pi}^{\\pi}f(x)\\sin nx\\,\\mathrm{d}x', '把周期函数投影到三角基上得到的系数。', 'fuliye xishu flyxs fourier 系数'],
    ['傅里叶级数', 'f(x)=\\frac{a_0}{2}+\\sum_{n=1}^{\\infty}\\left(a_n\\cos nx+b_n\\sin nx\\right)', '周期函数的三角级数分解。', 'fuliye fly fourier 级数'],
    ['傅里叶变换对', 'F(\\omega)=\\int_{-\\infty}^{\\infty}f(t)e^{-\\mathrm{i}\\omega t}\\,\\mathrm{d}t,\\qquad f(t)=\\frac{1}{2\\pi}\\int_{-\\infty}^{\\infty}F(\\omega)e^{\\mathrm{i}\\omega t}\\,\\mathrm{d}\\omega', '时域与频域的互逆变换。', 'fuliye fly fourier 变换 频域'],
    ['拉普拉斯变换', 'F(s)=\\int_{0}^{\\infty}f(t)e^{-st}\\,\\mathrm{d}t', '常用于求解线性常微分方程与系统分析。', 'lapulasi lpls laplace 变换'],
    ['欧拉公式', 'e^{\\mathrm{i}\\theta}=\\cos\\theta+\\mathrm{i}\\sin\\theta', '复指数与三角函数的桥梁。', 'oula ol euler 复数'],
    ['洛必达法则', "\\lim_{x\\to a}\\frac{f(x)}{g(x)}=\\lim_{x\\to a}\\frac{f'(x)}{g'(x)}", '0/0 或 ∞/∞ 型极限的求解方法。', 'luobida lbd lhopital 极限'],
    ['无穷小等价替换', '\\sin x\\sim x,\\quad \\tan x\\sim x,\\quad \\ln(1+x)\\sim x,\\quad 1-\\cos x\\sim\\frac{x^2}{2}', '求极限时用来快速化简的高频替换表。', 'wuxiaoqiong wqx 等价 替换 极限'],
    ['隐函数求导 / 全微分', '\\mathrm{d}z=\\frac{\\partial z}{\\partial x}\\mathrm{d}x+\\frac{\\partial z}{\\partial y}\\mathrm{d}y', '多变量函数的一阶全微分。', 'quanweifen qwf 隐函数 偏导'],
    ['方向导数与梯度', '\\frac{\\partial f}{\\partial\\vec{l}}=\\nabla f\\cdot\\vec{e}_l', '方向导数等于梯度在该方向上的投影。', 'fangxiangdaoshu fxds 梯度 方向'],
    ['拉格朗日乘数法', '\\nabla f=\\lambda\\,\\nabla g', '带等式约束的极值必要条件。', 'lagelangri chengshu lglrcs 条件极值'],
    ['极坐标二重积分', '\\iint_{D}f(x,y)\\,\\mathrm{d}x\\,\\mathrm{d}y=\\int_{\\alpha}^{\\beta}\\int_{r_1}^{r_2}f(r\\cos\\theta,r\\sin\\theta)\\,r\\,\\mathrm{d}r\\,\\mathrm{d}\\theta', '雅可比行列式为 r 的坐标变换。', 'jizuo jz 二重积分 极坐标'],
    ['二重积分换元', '\\iint_{D}f(x,y)\\,\\mathrm{d}x\\,\\mathrm{d}y=\\iint_{D\'}f\\big(x(u,v),y(u,v)\\big)\\,|J|\\,\\mathrm{d}u\\,\\mathrm{d}v', 'J 为变换的雅可比行列式。', 'huanyuan hy 雅可比 二重积分'],
    ['柱坐标三重积分', '\\iiint_{\\Omega}f\\,\\mathrm{d}V=\\iiint_{\\Omega\'}f(r\\cos\\theta,r\\sin\\theta,z)\\,r\\,\\mathrm{d}r\\,\\mathrm{d}\\theta\\,\\mathrm{d}z', '旋转对称区域的首选坐标系。', 'zhuzuobiao zzb 三重积分 柱坐标'],
    ['格林公式', '\\oint_{L}P\\,\\mathrm{d}x+Q\\,\\mathrm{d}y=\\iint_{D}\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)\\mathrm{d}x\\,\\mathrm{d}y', '平面曲线积分与二重积分的桥梁。', 'gelin gl green 曲线积分'],
    ['高斯散度定理', '\\oiint_{\\Sigma}\\vec{F}\\cdot\\mathrm{d}\\vec{S}=\\iiint_{V}\\nabla\\cdot\\vec{F}\\,\\mathrm{d}V', '通量等于散度的体积分。', 'sandu sd divergence 通量'],
    ['斯托克斯公式', '\\oint_{\\partial\\Sigma}\\vec{F}\\cdot\\mathrm{d}\\vec{r}=\\iint_{\\Sigma}(\\nabla\\times\\vec{F})\\cdot\\mathrm{d}\\vec{S}', '环量等于旋度通量，广义斯托克斯定理的三维形式。', 'situokesi stks stokes 旋度 环量'],
    ['数列极限定义', '\\forall\\varepsilon>0,\\ \\exists N,\\ \\forall n>N:\\ |a_n-A|<\\varepsilon', 'ε-N 语言，极限的严格定义。', 'shulie jixian sljx epsilon N 定义'],
    ['斯特林公式', 'n!\\sim\\sqrt{2\\pi n}\\left(\\frac{n}{e}\\right)^n', '阶乘的渐近估计，组合复杂度分析常用。', 'sitelin stl stirling 阶乘 渐近'],
    ['伽马函数', '\\Gamma(n)=\\int_0^{\\infty}x^{n-1}e^{-x}\\,\\mathrm{d}x=(n-1)!', '阶乘在实数域的推广。', 'gama gm gamma 阶乘'],
    ['贝塔函数', 'B(p,q)=\\int_0^1 x^{p-1}(1-x)^{q-1}\\,\\mathrm{d}x=\\frac{\\Gamma(p)\\Gamma(q)}{\\Gamma(p+q)}', '与伽马函数互为表里。', 'beita bt beta 积分'],
  ],

  /* ------------------------------------------------------------------ 线性代数 */
  线性代数: [
    ['矩阵乘法', '(AB)_{ij}=\\sum_{k=1}^{n}a_{ik}b_{kj}', '行乘列的求和定义。', 'juzhen chengfa jzcf matrix 乘法'],
    ['二阶行列式', '\\begin{vmatrix}a & b\\\\ c & d\\end{vmatrix}=ad-bc', '二阶方阵的行列式。', 'hanglieshi hls 行列式 二阶'],
    ['行列式按行展开', '|A|=\\sum_{j=1}^{n}(-1)^{i+j}a_{ij}M_{ij}', '代数余子式展开，递归计算行列式的基础。', 'hanglieshi zhankai hlszk 余子式'],
    ['二阶矩阵求逆', 'A^{-1}=\\frac{1}{ad-bc}\\begin{pmatrix}d & -b\\\\ -c & a\\end{pmatrix}', '伴随矩阵除以行列式。', 'ni juzhen 求逆 nizhen'],
    ['伴随矩阵求逆', 'A^{-1}=\\frac{1}{|A|}A^{*},\\qquad A^{*}_{ij}=(-1)^{i+j}M_{ji}', '任意可逆矩阵的求逆公式。', 'bansui bs adjugate 求逆'],
    ['克莱姆法则', 'x_i=\\frac{\\det A_i}{\\det A}', '线性方程组解的行列式表达。', 'kelaipu klm cramer 线性方程组'],
    ['特征方程', '\\det(\\lambda I-A)=0,\\qquad A\\vec{v}=\\lambda\\vec{v}', '特征值与特征向量的定义式。', 'tezheng tz 特征值 特征向量 eigen'],
    ['特征值分解', 'A=Q\\Lambda Q^{\\top},\\qquad \\Lambda=\\mathrm{diag}(\\lambda_1,\\dots,\\lambda_n)', '实对称矩阵可正交对角化。', 'tezheng fenjie tzfj 对角化 谱分解'],
    ['正交矩阵', 'A^{\\top}A=AA^{\\top}=I,\\qquad A^{-1}=A^{\\top}', '保内积的线性变换，行列式为 ±1。', 'zhengjiao zj orthogonal 正交矩阵'],
    ['投影矩阵', 'P=A\\left(A^{\\top}A\\right)^{-1}A^{\\top},\\qquad P^2=P', '把向量正交投影到 A 的列空间，最小二乘的核心。', 'touying ty projection 投影 最小二乘'],
    ['相似变换 / 基变换', 'B=P^{-1}AP', '同一线性映射在不同基下的矩阵表示。', 'xiangsi xb 相似 基变换'],
    ['LU 分解', 'A=LU', '下三角与上三角之积，高斯消元的矩阵形式。', 'lu fenjie 分解 消元'],
    ['Sherman-Morrison 公式', '\\left(A+uv^{\\top}\\right)^{-1}=A^{-1}-\\frac{A^{-1}uv^{\\top}A^{-1}}{1+v^{\\top}A^{-1}u}', '秩一更新的求逆，避免重算整个逆矩阵。', 'zhisan gengxin sm 秩一 更新 求逆'],
    ['矩阵指数', 'e^{At}=\\sum_{k=0}^{\\infty}\\frac{(At)^k}{k!}', '线性常微分方程组的解算子。', 'juzhen zhishu jzzs matrix exponential'],
    ['正定性判据（Sylvester）', 'A\\succ0\\iff \\Delta_1>0,\\ \\Delta_2>0,\\ \\dots,\\ \\Delta_n>0', '各阶顺序主子式全正即正定。', 'zhengding zd sylvester 顺序主子式'],
    ['范德蒙德行列式', 'V_n=\\begin{vmatrix}1 & x_1 & \\cdots & x_1^{n-1}\\\\ \\vdots & \\vdots & \\ddots & \\vdots\\\\ 1 & x_n & \\cdots & x_n^{n-1}\\end{vmatrix}=\\prod_{1\\le i<j\\le n}(x_j-x_i)', '插值与多项式拟合的理论基石。', 'fandemengde fdbd vandermonde 行列式'],
    ['奇异值分解 SVD', 'A=U\\Sigma V^{\\top}=\\sum_{i=1}^{r}\\sigma_i u_i v_i^{\\top}', '任意矩阵的正交分解，PCA 与推荐系统的基础。', 'qiyizhi qyz svd 分解'],
    ['格拉姆-施密特正交化', '\\vec{u}_k=\\vec{v}_k-\\sum_{j=1}^{k-1}\\frac{\\langle \\vec{v}_k,\\vec{u}_j\\rangle}{\\langle \\vec{u}_j,\\vec{u}_j\\rangle}\\vec{u}_j', '把线性无关组化为标准正交基。', 'zhengjiaohua zjh schmidt QR'],
    ['雅可比矩阵', 'J=\\begin{pmatrix}\\dfrac{\\partial f_1}{\\partial x_1} & \\cdots & \\dfrac{\\partial f_1}{\\partial x_n}\\\\ \\vdots & \\ddots & \\vdots\\\\ \\dfrac{\\partial f_m}{\\partial x_1} & \\cdots & \\dfrac{\\partial f_m}{\\partial x_n}\\end{pmatrix}', '多元向量值函数的局部线性近似。', 'yakebi ykb jacobian 偏导'],
    ['海森矩阵', 'H_{ij}=\\frac{\\partial^2 f}{\\partial x_i\\,\\partial x_j}', '二阶偏导构成的对称矩阵，用于判定极值。', 'haisen hs hessian 二阶 极值'],
    ['秩-零化度定理', '\\dim\\ker A+\\operatorname{rank}A=n', '线性映射的维数守恒。', 'zhi linghuadu rank 秩 零空间'],
    ['迹的性质', '\\operatorname{tr}(AB)=\\operatorname{tr}(BA),\\quad \\operatorname{tr}(A)=\\sum_i\\lambda_i', '迹等于特征值之和。', 'ji zhi trace 特征值'],
    ['二次型标准形', 'f(x)=x^{\\top}Ax=\\sum_{i=1}^{n}\\lambda_i y_i^2', '正交变换把二次型化为平方和。', 'ercixing ecx 二次型 标准形'],
    ['矩阵范数', '\\|A\\|_2=\\sqrt{\\lambda_{\\max}(A^{\\top}A)}=\\sigma_{\\max}(A)', '谱范数等于最大奇异值。', 'fanshu fs 范数 谱'],
    ['余弦相似度', '\\cos\\theta=\\frac{u\\cdot v}{\\|u\\|\\,\\|v\\|}', '向量夹角的余弦，检索与嵌入向量常用。', 'yuxian yx cosine 相似度 夹角'],
  ],

  /* ------------------------------------------------------------------ 概率统计 */
  概率统计: [
    ['贝叶斯公式', 'P(A_i\\mid B)=\\frac{P(B\\mid A_i)P(A_i)}{\\sum_{j}P(B\\mid A_j)P(A_j)}', '由先验与似然更新后验概率。', 'beiyesi bys bayes 后验'],
    ['全概率公式', 'P(B)=\\sum_{i=1}^{n}P(B\\mid A_i)P(A_i)', '完备事件组下的概率分解。', 'quangailv qgl 全概率'],
    ['一维正态分布密度', 'f(x)=\\frac{1}{\\sqrt{2\\pi}\\,\\sigma}\\exp\\left(-\\frac{(x-\\mu)^2}{2\\sigma^2}\\right)', '均值 μ、方差 σ² 的高斯分布。', 'zhengtai zt normal 高斯 密度'],
    ['多元高斯分布', 'p(\\mathbf{x})=\\frac{1}{(2\\pi)^{d/2}|\\Sigma|^{1/2}}\\exp\\left(-\\frac{1}{2}(\\mathbf{x}-\\boldsymbol{\\mu})^{\\top}\\Sigma^{-1}(\\mathbf{x}-\\boldsymbol{\\mu})\\right)', 'd 维高斯分布，机器学习中的核心分布。', 'duoyuan dy 高斯 协方差'],
    ['均匀分布', 'f(x)=\\frac{1}{b-a},\\quad a\\le x\\le b', '区间内等可能，期望 (a+b)/2。', 'junyun jy uniform 均匀分布'],
    ['指数分布', 'f(x)=\\lambda e^{-\\lambda x},\\quad x\\ge 0', '无记忆性的等待时间分布。', 'zhishu zs exponential 分布'],
    ['伽马分布', 'f(x)=\\frac{\\beta^{\\alpha}}{\\Gamma(\\alpha)}x^{\\alpha-1}e^{-\\beta x},\\quad x>0', '等待 α 个事件的到达时间，指数分布的推广。', 'gama gm gamma 分布'],
    ['卡方分布', 'f(x)=\\frac{1}{2^{k/2}\\Gamma(k/2)}x^{k/2-1}e^{-x/2},\\quad x>0', 'k 个标准正态平方和，拟合优度检验的基础。', 'kafang kf chisq 卡方 分布'],
    ['t 分布', 'f(t)=\\frac{\\Gamma\\!\\left(\\frac{\\nu+1}{2}\\right)}{\\sqrt{\\nu\\pi}\\,\\Gamma\\!\\left(\\frac{\\nu}{2}\\right)}\\left(1+\\frac{t^2}{\\nu}\\right)^{-\\frac{\\nu+1}{2}}', '小样本均值检验，方差未知时代替正态。', 't fenbu t分布 student 小样本'],
    ['F 分布', 'F=\\frac{S_1^2/\\nu_1}{S_2^2/\\nu_2}\\sim F(\\nu_1,\\nu_2)', '两个卡方变量之比，方差齐性检验。', 'f fenbu 方差分析 anova'],
    ['泊松分布', 'P(X=k)=\\frac{\\lambda^k e^{-\\lambda}}{k!},\\quad k=0,1,2,\\cdots', '单位时间内稀有事件计数分布。', 'bosong bs poisson 分布'],
    ['二项分布', 'P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}', 'n 次伯努利试验成功次数分布。', 'erxiang ex binomial 分布'],
    ['几何分布', 'P(X=k)=(1-p)^{k-1}p,\\quad k=1,2,\\cdots', '首次成功所需试验次数，同样无记忆。', 'jihe jh geometric 分布'],
    ['期望与全期望公式', '\\mathbb{E}[X]=\\int_{-\\infty}^{\\infty}x f(x)\\,\\mathrm{d}x,\\qquad \\mathbb{E}[X]=\\mathbb{E}\\left[\\mathbb{E}[X\\mid Y]\\right]', '连续型期望定义与条件期望的迭代。', 'qiwang qw 期望 全期望'],
    ['方差与协方差', '\\operatorname{Var}(X)=\\mathbb{E}[(X-\\mu)^2]=\\mathbb{E}[X^2]-\\mu^2,\\qquad \\operatorname{Cov}(X,Y)=\\mathbb{E}[XY]-\\mathbb{E}[X]\\mathbb{E}[Y]', '二阶矩刻画离散程度与线性相关性。', 'fangcha fc 协方差 xfc variance'],
    ['全方差公式', '\\operatorname{Var}(X)=\\mathbb{E}\\left[\\operatorname{Var}(X\\mid Y)\\right]+\\operatorname{Var}\\left(\\mathbb{E}[X\\mid Y]\\right)', '方差分解为组内与组间两部分。', 'quanfangcha qfc 方差分解 条件'],
    ['相关系数', '\\rho_{XY}=\\frac{\\operatorname{Cov}(X,Y)}{\\sigma_X\\sigma_Y}\\in[-1,1]', '线性相关程度的无量纲度量。', 'xiangguanxs xgxs correlation 相关'],
    ['矩母函数', 'M_X(t)=\\mathbb{E}\\left[e^{tX}\\right],\\qquad \\mathbb{E}[X^n]=M_X^{(n)}(0)', '各阶矩由原点处导数给出。', 'mumuhanshu mmhs mgf 矩 母函数'],
    ['样本均值与样本方差', '\\bar{X}=\\frac{1}{n}\\sum_{i=1}^{n}X_i,\\qquad S^2=\\frac{1}{n-1}\\sum_{i=1}^{n}(X_i-\\bar{X})^2', '除以 n−1 才是总体方差的无偏估计。', 'yangben yb 均值 方差 无偏'],
    ['均值置信区间（σ 已知）', '\\bar{X}\\pm z_{1-\\alpha/2}\\frac{\\sigma}{\\sqrt{n}}', '双侧 1−α 置信区间。', 'zhixinqujian zxqj 置信区间 区间估计'],
    ['z 检验统计量', 'z=\\frac{\\bar{X}-\\mu_0}{\\sigma/\\sqrt{n}}', '均值检验，|z| 超临界值则拒绝原假设。', 'zjianyan jianyan 假设检验 统计量'],
    ['卡方拟合优度统计量', '\\chi^2=\\sum_{i=1}^{k}\\frac{(O_i-E_i)^2}{E_i}', '观测频数与期望频数的偏离程度。', 'kafang nihe kfnh 拟合优度 检验'],
    ['马尔可夫不等式', 'P(X\\ge a)\\le\\frac{\\mathbb{E}[X]}{a},\\quad a>0', '只用一阶矩给出的概率上界。', 'maerkeffu mkf markov 不等式'],
    ['切比雪夫不等式', 'P\\left(|X-\\mu|\\ge\\varepsilon\\right)\\le\\frac{\\sigma^2}{\\varepsilon^2}', '不依赖分布形状的概率上界。', 'qiebixuefu qbxf chebyshev 不等式'],
    ['詹森不等式', '\\varphi\\left(\\mathbb{E}[X]\\right)\\le\\mathbb{E}\\left[\\varphi(X)\\right]', '凸函数下期望与函数可交换方向，EM 算法的理论依据。', 'zhansen zs jensen 不等式 凸'],
    ['大数定律（弱）', '\\lim_{n\\to\\infty}P\\left(\\left|\\frac{1}{n}\\sum_{i=1}^{n}X_i-\\mu\\right|<\\varepsilon\\right)=1', '样本均值依概率收敛到期望。', 'dashudinglv dsl 大数定律'],
    ['中心极限定理', '\\frac{\\sum_{i=1}^{n}X_i-n\\mu}{\\sqrt{n}\\,\\sigma}\\xrightarrow{d}\\mathcal{N}(0,1)', '独立同分布之和依分布收敛于标准正态。', 'zhongxinjixian zxjx 中心极限 CLT'],
    ['极大似然估计', '\\hat{\\theta}_{\\mathrm{MLE}}=\\arg\\max_{\\theta}\\sum_{i=1}^{n}\\ln f(x_i;\\theta)', '最大化对数似然得到参数估计。', 'jidasiran jdsr mle 似然 估计'],
    ['最小二乘估计', '\\hat{\\boldsymbol{\\beta}}=(X^{\\top}X)^{-1}X^{\\top}\\mathbf{y}', '正规方程给出的闭式解。', 'zuixiaoercheng zxec 最小二乘 回归'],
    ['信息熵', 'H(X)=-\\sum_{x}p(x)\\log p(x)', '不确定性的度量，单位由对数底决定。', 'xinxishang xxs entropy 熵'],
    ['KL 散度', 'D_{\\mathrm{KL}}(p\\,\\|\\,q)=\\sum_{x}p(x)\\log\\frac{p(x)}{q(x)}\\ge0', '两个分布的差异，不对称且非负。', 'kl sandu kl 散度 相对熵'],
    ['互信息', 'I(X;Y)=\\sum_{x,y}p(x,y)\\log\\frac{p(x,y)}{p(x)p(y)}', '知道 Y 之后 X 的不确定性减少量。', 'huxinxi hxx mutual 互信息'],
  ],

  /* ------------------------------------------------------------------ 离散数学 */
  离散数学: [
    ['德摩根律', '\\neg(P\\land Q)\\iff(\\neg P\\lor\\neg Q),\\qquad \\neg(P\\lor Q)\\iff(\\neg P\\land\\neg Q)', '否定穿过合取/析取的转换规则。', 'demogen dmg 德摩根 逻辑'],
    ['蕴含式的等价改写', 'P\\to Q\\iff \\neg P\\lor Q', '把蕴含化为析取，是化简逻辑式的第一步。', 'yunhan yh 蕴含 等价'],
    ['容斥原理', '\\left|\\bigcup_{i=1}^{n}A_i\\right|=\\sum_{i}|A_i|-\\sum_{i<j}|A_i\\cap A_j|+\\cdots+(-1)^{n-1}\\left|\\bigcap_{i=1}^{n}A_i\\right|', '并集计数的一般公式。', 'rongchi rc 容斥 计数'],
    ['幂集大小', '\\left|\\mathcal{P}(S)\\right|=2^{|S|}', '每个元素选或不选，共 2^n 个子集。', 'miji mj 幂集 子集'],
    ['欧拉公式（平面图）', 'V-E+F=2', '连通平面图的顶点、边、面数关系。', 'oula ol 平面图 图论'],
    ['握手定理', '\\sum_{v\\in V}\\deg(v)=2|E|', '度数之和等于边数的两倍。', 'woshou ws 图论 度数'],
    ['凯莱公式（生成树计数）', '\\tau(K_n)=n^{n-2}', '完全图 K_n 的生成树个数。', 'kailai kl cayley 生成树'],
    ['鸽巢原理', '\\left\\lceil\\frac{n}{m}\\right\\rceil', 'n 个物体放入 m 个盒子，至少一个盒子含 ⌈n/m⌉ 个。', 'gechao gc 鸽巢 抽屉'],
    ['排列与组合', 'P(n,k)=\\frac{n!}{(n-k)!},\\qquad \\binom{n}{k}=\\frac{n!}{k!(n-k)!}', '有序排列与无序组合的计数公式。', 'pailie pl 组合 zuhe 计数'],
    ['二项式定理', '(x+y)^n=\\sum_{k=0}^{n}\\binom{n}{k}x^{n-k}y^k', '多项式展开的系数规律。', 'erxiangshi exs 二项式 定理'],
    ['常系数递推的特征方程', 'a_n=c_1a_{n-1}+c_2a_{n-2}\\ \\Rightarrow\\ r^2=c_1r+c_2', '线性递推的通项由特征根决定。', 'ditui tex 递推 特征方程'],
    ['比内公式（斐波那契）', 'F_n=\\frac{1}{\\sqrt5}\\left[\\left(\\frac{1+\\sqrt5}{2}\\right)^n-\\left(\\frac{1-\\sqrt5}{2}\\right)^n\\right]', '斐波那契数列的通项闭式。', 'binei fibonacci 斐波那契 通项'],
    ['卡特兰数', 'C_n=\\frac{1}{n+1}\\binom{2n}{n}', '括号匹配、二叉树形态等计数问题的答案。', 'katelan ktl catalan 计数'],
    ['欧拉函数', '\\varphi(n)=n\\prod_{p\\mid n}\\left(1-\\frac{1}{p}\\right)', '不超过 n 且与 n 互素的整数个数。', 'oulahanshu olhs euler phi 互素'],
    ['莫比乌斯反演', 'g(n)=\\sum_{d\\mid n}f(d)\\iff f(n)=\\sum_{d\\mid n}\\mu(d)\\,g\\!\\left(\\frac{n}{d}\\right)', '数论中处理整除和式的标准手段。', 'mobius fanyan mbfy 数论 反演'],
    ['中国剩余定理', 'x\\equiv a_i\\pmod{m_i},\\quad i=1,\\dots,k', '模两两互素时同余方程组有唯一解（模 ∏m_i）。', 'zhongguo shengyu zgsy crt 同余'],
    ['费马小定理', 'a^{p-1}\\equiv1\\pmod p,\\quad p\\nmid a', '素数模下的幂周期性，RSA 的理论基础。', 'feima xiaodingli fmxdl fermat 素数'],
    ['生成函数（几何级数）', '\\sum_{n\\ge0}x^n=\\frac{1}{1-x},\\qquad |x|<1', '把计数问题转成幂级数系数的桥梁。', 'shengcheng hanshu schs 生成函数 级数'],
  ],

  /* ------------------------------------------------------------------ 常微分方程 */
  常微分方程: [
    ['一阶线性方程通解', "y'+P(x)y=Q(x)\\ \\Rightarrow\\ y=e^{-\\int P\\,\\mathrm{d}x}\\left(\\int Q\\,e^{\\int P\\,\\mathrm{d}x}\\,\\mathrm{d}x+C\\right)", '积分因子 e^{∫P dx} 乘过去即可化为全微分。', 'yijie xianxing yjxx 通解 积分因子'],
    ['分离变量法', '\\frac{\\mathrm{d}y}{g(y)}=f(x)\\,\\mathrm{d}x', '两边各自积分，最基础的可解类型。', 'fenli bianliang flbl 可分离'],
    ['齐次方程（y/x 替换）', "y'=f\\!\\left(\\frac{y}{x}\\right),\\qquad u=\\frac{y}{x}", '换元后化为可分离方程。', 'qici huan yuan y/x 齐次'],
    ['伯努利方程', "y'+P(x)y=Q(x)y^{n},\\qquad z=y^{1-n}", '换元 z 后化为线性方程。', 'bonuli bnl bernoulli 方程'],
    ['恰当方程判据', 'M\\,\\mathrm{d}x+N\\,\\mathrm{d}y=0,\\qquad \\frac{\\partial M}{\\partial y}=\\frac{\\partial N}{\\partial x}', '满足判据时存在势函数 u(x,y)，解为 u=C。', 'qiadang qd exact 恰当 全微分'],
    ['二阶常系数齐次方程', "y''+py'+qy=0\\ \\Rightarrow\\ r^2+pr+q=0", '解由特征根的重数、虚实决定。', 'erjie changxishu ejcxs 特征根 齐次'],
    ['共轭复根解', 'y=e^{\\alpha x}\\left(C_1\\cos\\beta x+C_2\\sin\\beta x\\right)', '特征根 α±iβ 时的通解形式。', 'gonge fugan gefg 复根 振荡'],
    ['非齐次方程特解（待定系数）', "y''+py'+qy=f(x)", 'f 为多项式/指数/三角时按同型设特解。', 'tejie daidingxishu tjddxs 非齐次 特解'],
    ['常数变易法', 'y_p=u_1(x)y_1(x)+u_2(x)y_2(x)', '用齐次解构造非齐次特解的一般方法。', 'changshu bianyi csby 变易 特解'],
    ['欧拉方程（柯西-欧拉）', "x^2y''+axy'+by=0,\\qquad x=e^{t}", '换元后化为常系数方程。', 'oula fangcheng olfc cauchy euler'],
    ['一阶线性系统', '\\dot{\\mathbf{x}}=A\\mathbf{x}\\ \\Rightarrow\\ \\mathbf{x}(t)=e^{At}\\mathbf{x}_0', '矩阵指数给出状态转移。', 'xianxing xitong xt 矩阵指数 状态方程'],
    ['拉普拉斯变换解法', 's^2Y(s)-sy(0)-y\'(0)+p\\left(sY(s)-y(0)\\right)+qY(s)=F(s)', '把初值问题化成代数方程求解。', 'lapulasi jiefa lpls 初值 变换'],
    ['二阶系统稳定性（Routh-Hurwitz）', 'a_0,\\ a_1>0\\ \\Rightarrow\\ \\text{特征根实部为负}', '二阶系统稳定的充要条件。', 'wendingxing wdx 稳定性 特征根'],
    ['阻尼振动', "\\ddot{x}+2\\zeta\\omega_0\\dot{x}+\\omega_0^2x=0,\\qquad \\zeta=\\frac{c}{2\\sqrt{mk}}", 'ζ<1 欠阻尼振荡，ζ≥1 单调衰减。', 'zuni zhenodng znzd 阻尼 振动'],
  ],

  /* ------------------------------------------------------------------ 复变与积分变换 */
  复变与积分变换: [
    ['柯西-黎曼方程', '\\frac{\\partial u}{\\partial x}=\\frac{\\partial v}{\\partial y},\\qquad \\frac{\\partial u}{\\partial y}=-\\frac{\\partial v}{\\partial x}', 'f=u+iv 解析的充要条件（加上连续可偏导）。', 'kexi liman kxlm cauchy riemann 解析'],
    ['柯西积分公式', 'f(z_0)=\\frac{1}{2\\pi\\mathrm{i}}\\oint_{C}\\frac{f(z)}{z-z_0}\\,\\mathrm{d}z', '解析函数在内部的值由边界值完全决定。', 'kexi jifen kxjf 积分公式 解析'],
    ['留数定理', '\\oint_{C}f(z)\\,\\mathrm{d}z=2\\pi\\mathrm{i}\\sum_{k=1}^{n}\\mathrm{Res}\\,[f;z_k]', '围道积分化为内部奇点留数之和。', 'liushu ls residue 留数 围道'],
    ['一阶极点留数', '\\mathrm{Res}\\,[f;z_0]=\\lim_{z\\to z_0}(z-z_0)f(z)', '简单极点处留数的快速算法。', 'yijie jidian ls 极点 留数'],
    ['洛朗级数', 'f(z)=\\sum_{n=-\\infty}^{\\infty}c_n(z-z_0)^n,\\qquad c_n=\\frac{1}{2\\pi\\mathrm{i}}\\oint_C\\frac{f(\\zeta)}{(\\zeta-z_0)^{n+1}}\\,\\mathrm{d}\\zeta', '含负幂次的展开，留数就是 c₋₁。', 'luolang ll laurent 级数 展开'],
    ['拉氏变换微分性质', '\\mathcal{L}\\left[f^{(n)}\\right]=s^nF(s)-s^{n-1}f(0)-\\cdots-f^{(n-1)}(0)', '把微分方程转成代数方程的关键性质。', 'lapulasi weifen lpls 性质 微分'],
    ['拉氏变换常用对', '\\mathcal{L}[1]=\\frac{1}{s},\\quad \\mathcal{L}[e^{at}]=\\frac{1}{s-a},\\quad \\mathcal{L}[\\sin\\omega t]=\\frac{\\omega}{s^2+\\omega^2}', '查表最常用的三个基本变换。', 'lapulasi dui lpls 变换 表'],
    ['卷积定理', '\\mathcal{L}[f*g]=\\mathcal{L}[f]\\cdot\\mathcal{L}[g]', '时域卷积等于频域相乘，滤波器设计的依据。', 'juanji dingli jjdl convolution 卷积'],
    ['z 变换', 'X(z)=\\sum_{n=0}^{\\infty}x[n]z^{-n}', '离散序列的复频域表示，数字信号处理的基本工具。', 'z bianhuan zbh 离散 序列'],
    ['傅里叶变换时移性质', '\\mathcal{F}[f(t-t_0)]=F(\\omega)e^{-\\mathrm{i}\\omega t_0}', '时域平移对应频域乘相位因子。', 'shiyi sy fourier 时移 性质'],
    ['帕塞瓦尔定理', '\\int_{-\\infty}^{\\infty}|f(t)|^2\\,\\mathrm{d}t=\\frac{1}{2\\pi}\\int_{-\\infty}^{\\infty}|F(\\omega)|^2\\,\\mathrm{d}\\omega', '能量在时域与频域守恒。', 'pasaier pse parseval 能量 守恒'],
    ['解析函数的高阶导数', 'f^{(n)}(z_0)=\\frac{n!}{2\\pi\\mathrm{i}}\\oint_C\\frac{f(z)}{(z-z_0)^{n+1}}\\,\\mathrm{d}z', '解析函数无穷次可导，且导数也有积分表示。', 'gaojie daoshu gjds 解析 导数'],
  ],

  /* ------------------------------------------------------------------ 数值分析 */
  数值分析: [
    ['牛顿迭代法', 'x_{k+1}=x_k-\\frac{f(x_k)}{f\'(x_k)}', '二阶收敛，需 f′≠0 且初值足够接近根。', 'niudun nd newton 迭代 求根'],
    ['二分法误差界', '|x_k-x^{*}|\\le\\frac{b-a}{2^{k+1}}', '每次迭代误差减半，稳定但收敛线性。', 'erfen ef bisection 误差 求根'],
    ['割线法', 'x_{k+1}=x_k-f(x_k)\\frac{x_k-x_{k-1}}{f(x_k)-f(x_{k-1})}', '用差商代替导数，免去解析求导。', 'gexian gx secant 差商 求根'],
    ['拉格朗日插值', 'L(x)=\\sum_{i=0}^{n}y_i\\prod_{j\\ne i}\\frac{x-x_j}{x_i-x_j}', '过 n+1 个点的唯一 n 次插值多项式。', 'lagelangri cha zhi lglrcz lagrange 插值'],
    ['牛顿差商插值', 'N(x)=f[x_0]+f[x_0,x_1](x-x_0)+\\cdots', '差商表递推，新增节点不必重算全部。', 'niudun chashang ndcs 插值 差商'],
    ['复合梯形公式', '\\int_a^b f\\,\\mathrm{d}x\\approx\\frac{h}{2}\\left[f_0+2\\sum_{i=1}^{n-1}f_i+f_n\\right]', '二阶精度，误差含 h² 项。', 'fube tixing fbtx trapezoid 数值积分'],
    ['复合辛普森公式', '\\int_a^b f\\,\\mathrm{d}x\\approx\\frac{h}{3}\\left[f_0+4\\sum_{\\text{odd}}f_i+2\\sum_{\\text{even}}f_i+f_n\\right]', '四阶精度，要求等距且 n 为偶数。', 'xinputsen xps simpson 数值积分'],
    ['显式欧拉法', 'y_{n+1}=y_n+h\\,f(t_n,y_n)', '一阶精度，步长过大时不稳定。', 'oulafa olf euler 初值 步长'],
    ['四阶龙格-库塔（RK4）', 'y_{n+1}=y_n+\\frac{h}{6}\\left(k_1+2k_2+2k_3+k_4\\right)', '工程上最常用的常微分方程数值解法。', 'longge kuta lgkt rk4 龙格库塔'],
    ['雅可比迭代', 'x_i^{(k+1)}=\\frac{1}{a_{ii}}\\left(b_i-\\sum_{j\\ne i}a_{ij}x_j^{(k)}\\right)', '对角占优时收敛，可完全并行。', 'yakebi diedai ykbd jacobi 迭代 线性方程组'],
    ['高斯-赛德尔迭代', 'x_i^{(k+1)}=\\frac{1}{a_{ii}}\\left(b_i-\\sum_{j<i}a_{ij}x_j^{(k+1)}-\\sum_{j>i}a_{ij}x_j^{(k)}\\right)', '用最新分量，收敛通常快于雅可比。', 'gaosi saideier gssde gauss seidel 迭代'],
    ['条件数', '\\kappa(A)=\\|A\\|\\,\\|A^{-1}\\|=\\frac{\\sigma_{\\max}}{\\sigma_{\\min}}', '衡量线性方程组对扰动的敏感程度。', 'tiaojianshu tjs condition 病态 稳定'],
  ],

  /* ------------------------------------------------------------------ 大学物理 */
  大学物理: [
    ['牛顿第二定律', '\\vec{F}=m\\vec{a}=\\frac{\\mathrm{d}\\vec{p}}{\\mathrm{d}t}', '力等于动量变化率，经典力学的核心。', 'niudun dier ndde newton 第二定律'],
    ['动能定理', 'W_{\\text{net}}=\\Delta E_k=\\frac{1}{2}mv^2-\\frac{1}{2}mv_0^2', '合外力做功等于动能增量。', 'dongneng dingli dndl 动能 功'],
    ['动量守恒', '\\sum\\vec{p}_i=\\text{const}\\quad\\Leftrightarrow\\quad \\vec{F}_{\\text{ext}}=0', '系统合外力为零时总动量不变。', 'dongliang shouheng dlsh momentum 守恒'],
    ['平行轴定理', 'I=I_{c}+md^{2}', '绕任意平行轴的转动惯量。', 'pingxingzhou pxz 转动惯量 定理'],
    ['匀加速运动学公式', 'v=v_0+at,\\qquad x=x_0+v_0t+\\frac{1}{2}at^2,\\qquad v^2-v_0^2=2a(x-x_0)', '一维匀加速运动的三个基本关系。', 'yunjiasu yjs 运动学 加速度'],
    ['万有引力定律', '\\vec{F}=-G\\frac{m_1m_2}{r^2}\\hat{r}', '两质点间的引力，方向沿连线。', 'wanyouyinli wyyl 引力 牛顿'],
    ['简谐振动方程', 'x(t)=A\\cos(\\omega t+\\varphi),\\qquad \\omega=\\sqrt{\\frac{k}{m}}', '弹簧振子与单摆的共同模型。', 'jianxie zhendong jxzd 简谐 振动'],
    ['波动方程', 'y(x,t)=A\\cos\\!\\left[\\omega\\left(t-\\frac{x}{u}\\right)+\\varphi_0\\right]', '行波解，u 为波速。', 'bodong bo 波动 行波 波速'],
    ['多普勒效应', 'f\'=f\\,\\frac{u\\pm v_o}{u\\mp v_s}', '观察者与波源相对运动引起的频率偏移。', 'duopule dpl doppler 频率 偏移'],
    ['理想气体状态方程', 'pV=nRT=Nk_BT', '压强、体积与温度的约束关系。', 'lixiangqiti lxqt 理想气体 状态方程'],
    ['热力学第一定律', '\\mathrm{d}U=\\delta Q-\\delta W', '内能变化等于吸热减对外做功。', 'rediyl rdy 热力学 第一定律'],
    ['卡诺效率', '\\eta_{\\max}=1-\\frac{T_C}{T_H}', '工作在两热源之间热机的效率上限。', 'kanuo kn carnot 效率 热机'],
    ['熵变（克劳修斯）', '\\mathrm{d}S=\\frac{\\delta Q_{\\mathrm{rev}}}{T}', '可逆过程中的熵变定义。', 'shang sb entropy 熵'],
    ['斯特藩-玻尔兹曼定律', 'P=\\sigma T^{4},\\qquad \\sigma=5.67\\times10^{-8}\\ \\mathrm{W/(m^2\\!\\cdot\\!K^4)}', '黑体辐射总功率与温度四次方成正比。', 'sitefan sdf stefan 黑体 辐射'],
    ['维恩位移定律', '\\lambda_{\\max}T=2.898\\times10^{-3}\\ \\mathrm{m\\!\\cdot\\!K}', '温度越高，辐射峰值波长越短。', 'weien wy wien 位移 峰值 波长'],
    ['库仑定律', 'F=\\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1q_2}{r^2}', '点电荷之间的静电力。', 'kulun kl 库仑 静电力'],
    ['洛伦兹力', '\\vec{F}=q\\left(\\vec{E}+\\vec{v}\\times\\vec{B}\\right)', '带电粒子在电磁场中的受力。', 'luolunzili llzl 洛伦兹 电磁'],
    ['法拉第电磁感应定律', '\\varepsilon=-\\frac{\\mathrm{d}\\Phi_B}{\\mathrm{d}t}', '感应电动势正比于磁通量变化率。', 'faladi fld 电磁感应 电动势'],
    ['麦克斯韦方程组', '\\begin{cases}\\nabla\\cdot\\vec{E}=\\dfrac{\\rho}{\\varepsilon_0} & \\text{高斯定律}\\\\[4pt] \\nabla\\cdot\\vec{B}=0 & \\text{磁场无源}\\\\[4pt] \\nabla\\times\\vec{E}=-\\dfrac{\\partial\\vec{B}}{\\partial t} & \\text{法拉第定律}\\\\[4pt] \\nabla\\times\\vec{B}=\\mu_0\\vec{J}+\\mu_0\\varepsilon_0\\dfrac{\\partial\\vec{E}}{\\partial t} & \\text{安培-麦克斯韦}\\\\ \\end{cases}', '经典电动力学的四个基本方程（微分形式）。', 'maikesiwei mksw maxwell 电磁场'],
    ['光电效应（爱因斯坦方程）', 'h\\nu=W_0+\\frac{1}{2}mv_{\\max}^2', '光子能量减去逸出功等于最大初动能。', 'guangdian xiaoying gdyx 光电 逸出功'],
    ['德布罗意波长', '\\lambda=\\frac{h}{p}=\\frac{h}{mv}', '实物粒子的波动性。', 'debuluoyi dblo de broglie 波长 物质波'],
    ['海森堡不确定关系', '\\Delta x\\,\\Delta p\\ge\\frac{\\hbar}{2}', '位置与动量不能同时精确确定。', 'haisenbao hsb heisenberg 不确定 量子'],
    ['定态薛定谔方程', '-\\frac{\\hbar^2}{2m}\\nabla^2\\psi+V(\\mathbf{r})\\psi=E\\psi', '量子力学的基本方程（定态）。', 'xuedinge xde schrodinger 量子'],
    ['质能方程', 'E=mc^2', '质量与能量的等价关系。', 'zhineng zn 质能 爱因斯坦'],
    ['相对论时间膨胀', '\\Delta t=\\frac{\\Delta t_0}{\\sqrt{1-v^2/c^2}}', '运动参考系中的时钟走得更慢。', 'shijian pengzhang sjpz 相对论 洛伦兹因子'],
  ],

  /* ------------------------------------------------------------------ 信号与电路 */
  信号与电路: [
    ['基尔霍夫电流定律（KCL）', '\\sum_{k}I_k=0', '任一节点流入电流之和等于流出之和。', 'jierhuofu jehf kcl 节点 电流'],
    ['基尔霍夫电压定律（KVL）', '\\sum_{k}U_k=0', '任一闭合回路电压代数和为零。', 'jierhuofu jehf kvl 回路 电压'],
    ['分压公式', 'U_{R_1}=U\\frac{R_1}{R_1+R_2}', '串联电阻按阻值比例分压。', 'fenya fy 分压 串联'],
    ['戴维南等效定理', 'V_{th}=V_{oc},\\qquad R_{th}=\\frac{V_{oc}}{I_{sc}}', '线性含源二端网络可等效为电压源串联电阻。', 'daiweinan dwn 戴维南 等效'],
    ['阻抗与相量形式', 'Z_R=R,\\quad Z_L=\\mathrm{j}\\omega L,\\quad Z_C=\\frac{1}{\\mathrm{j}\\omega C}', '正弦稳态分析中三类元件的阻抗。', 'kanggang zk 阻抗 相量'],
    ['RLC 谐振频率', '\\omega_0=\\frac{1}{\\sqrt{LC}},\\qquad Q=\\frac{1}{R}\\sqrt{\\frac{L}{C}}', '串联谐振时阻抗最小、电流最大。', 'zhenxie zx resonance 谐振 品质因数'],
    ['二阶系统阻尼比', '\\zeta=\\frac{R}{2}\\sqrt{\\frac{C}{L}},\\qquad \\omega_n=\\frac{1}{\\sqrt{LC}}', 'ζ<1 欠阻尼、ζ=1 临界、ζ>1 过阻尼。', 'zuni zhenodng 阻尼比 二阶'],
    ['RC 充电时间常数', 'u_C(t)=U\\left(1-e^{-t/\\tau}\\right),\\qquad \\tau=RC', '一阶 RC 电路的阶跃响应。', 'chongdian cd 时间常数 RC'],
    ['运放虚短虚断', 'v_+=v_-,\\qquad i_+=i_-=0,\\qquad A_v=-\\frac{R_f}{R_1}', '理想运放分析的两条基本假设与反相放大增益。', 'yunfang yf 虚短 虚断 运放'],
    ['传递函数', 'H(s)=\\frac{Y(s)}{X(s)}=\\frac{\\sum_{k=0}^{m}b_k s^k}{\\sum_{k=0}^{n}a_k s^k}', '零初始条件下输出与输入的拉氏比。', 'chuandi chd 传递函数 系统'],
    ['卷积定义', '(f*g)(t)=\\int_{-\\infty}^{\\infty}f(\\tau)g(t-\\tau)\\,\\mathrm{d}\\tau', '线性时不变系统的输出等于输入与冲激响应卷积。', 'juanji jj convolution'],
    ['奈奎斯特采样定理', 'f_s>2f_{\\max}', '采样频率需大于信号最高频率的两倍。', 'naikuisite nkst nyquist 采样'],
    ['理想重建（sinc 插值）', 'x(t)=\\sum_{n}x[n]\\,\\mathrm{sinc}\\!\\left(\\frac{t-nT_s}{T_s}\\right)', '带限信号可由样本完全恢复。', 'chongjian cj sinc 重建 插值'],
    ['离散傅里叶变换（DFT）', 'X[k]=\\sum_{n=0}^{N-1}x[n]e^{-\\mathrm{j}2\\pi kn/N}', '有限长序列的频域表示，FFT 的计算对象。', 'dft lifu lisan 变换 频谱'],
    ['离散帕塞瓦尔定理', '\\sum_{n=0}^{N-1}|x[n]|^2=\\frac{1}{N}\\sum_{k=0}^{N-1}|X[k]|^2', '离散序列的能量守恒。', 'lisan pasaier lspse 能量 守恒'],
    ['香农信道容量公式', 'C=B\\log_2\\left(1+\\frac{S}{N}\\right)', '带宽 B、信噪比 S/N 下的极限速率。', 'xiangnong xn shannon 信道容量'],
  ],

  /* ------------------------------------------------------------------ 计算机算法 */
  计算机算法: [
    ['大 O 记号定义', 'f(n)=O(g(n))\\iff \\exists c>0,n_0>0:\\ \\forall n\\ge n_0,\\ 0\\le f(n)\\le c\\,g(n)', '渐近上界的严格定义。', 'dabiaoji dbj bigO 复杂度 渐近'],
    ['主定理（Master Theorem）', 'T(n)=aT\\left(\\frac{n}{b}\\right)+f(n)\\Rightarrow T(n)=\\begin{cases}\\Theta(n^{\\log_b a}) & f(n)=O(n^{\\log_b a-\\varepsilon})\\\\ \\Theta(n^{\\log_b a}\\log n) & f(n)=\\Theta(n^{\\log_b a})\\\\ \\Theta(f(n)) & f(n)=\\Omega(n^{\\log_b a+\\varepsilon})\\end{cases}', '分治算法复杂度的三种情形。', 'zhudingli zdl master 分治 复杂度'],
    ['二分查找复杂度', 'T(n)=T\\!\\left(\\frac{n}{2}\\right)+O(1)=\\Theta(\\log n)', '每步规模减半，要求有序数组。', 'erfen chazhao efcz binary search 复杂度'],
    ['归并排序复杂度', 'T(n)=2T\\left(\\frac{n}{2}\\right)+\\Theta(n)\\Rightarrow T(n)=\\Theta(n\\log n)', '稳定的分治排序，最坏也为 O(n log n)。', 'guibing gb 归并排序 复杂度'],
    ['快速排序平均复杂度', 'T(n)=2T\\left(\\frac{n}{2}\\right)+\\Theta(n)=\\Theta(n\\log n)', '平均情况下的递推与解。', 'kuaisupaixu kspx 快排 复杂度'],
    ['堆排序复杂度', 'T(n)=\\Theta(n\\log n),\\qquad \\text{建堆 } O(n)', '原地排序，最坏情况仍为 O(n log n)。', 'duipaixu dpx heapsort 复杂度'],
    ['比较排序下界', 'T(n)=\\Omega(n\\log n)', '基于比较的排序不可能更快。', 'paixu xiabian pxb 下界 比较 排序'],
    ['并查集复杂度', 'O\\left(m\\,\\alpha(n)\\right)', '路径压缩 + 按秩合并后近似 O(1)，α 为反阿克曼函数。', 'bingchaji bcj union find 阿克曼'],
    ['KMP 前缀函数', '\\pi[i]=\\max\\{k<i:\\ s[0..k-1]=s[i-k..i-1]\\}', '失配后跳转位置，线性时间字符串匹配。', 'kmp qianzhui hanshu 匹配 字符串'],
    ['0-1 背包转移', 'dp[i][w]=\\max\\left(dp[i-1][w],\\ dp[i-1][w-w_i]+v_i\\right)', '每件物品取或不取的最大价值。', 'beibao bb knapsack 动态规划'],
    ['动态规划状态转移', 'dp[i]=\\max_{j<i}\\left\\{dp[j]+w(j,i)\\right\\}', '常见的序列型 DP 转移方程模板。', 'dongtaiguihua dtgh dp 动态规划'],
    ['Floyd-Warshall', 'd_{ij}^{(k)}=\\min\\left(d_{ij}^{(k-1)},\\ d_{ik}^{(k-1)}+d_{kj}^{(k-1)}\\right)', '全源最短路，O(n³)，可处理负权（无负环）。', 'floyd zuiduanlu 全源 最短路'],
    ['Dijkstra 松弛操作', 'd[v]\\leftarrow\\min\\left(d[v],\\ d[u]+w(u,v)\\right)', '单源最短路的贪心松弛（非负权）。', 'zuiduanlu zdl 最短路 dijkstra 松弛'],
    ['Bellman-Ford 松弛', 'd[v]\\leftarrow\\min\\left(d[v],\\ d[u]+w(u,v)\\right)\\quad\\text{重复 }|V|-1\\text{ 轮}', '可处理负权边，再跑一轮可判负环。', 'beiernan beiernford 负权 最短路'],
    ['最大流最小割定理', '\\max f=\\min_{S\\ni s,\\,T\\ni t}c(S,T)', '网络最大流等于最小割容量。', 'zuidaliu zdll 最小割 网络流'],
    ['快速幂', 'a^n=\\begin{cases}a^{n/2}\\cdot a^{n/2} & n\\ \\text{偶}\\\\ a\\cdot a^{(n-1)/2}\\cdot a^{(n-1)/2} & n\\ \\text{奇}\\end{cases}', 'O(log n) 次乘法，模幂运算的基础。', 'kuaisumi ksm 幂 取模'],
    ['Softmax 函数', '\\sigma(\\mathbf{z})_i=\\frac{e^{z_i}}{\\sum_{j=1}^{K}e^{z_j}}', '把实数向量映射为概率分布。', 'softmax 归一化 分类'],
    ['交叉熵损失', 'L=-\\sum_{i=1}^{C}y_i\\log\\hat{y}_i', '分类任务中最常用的损失函数。', 'jiaochashang jcs 交叉熵 损失'],
    ['梯度下降更新', '\\theta_{t+1}=\\theta_t-\\eta\\nabla_{\\theta}L(\\theta_t)', '沿负梯度方向迭代优化。', 'tiduxiajiang tdxj 梯度 优化'],
    ['缩放点积注意力', '\\mathrm{Attention}(Q,K,V)=\\mathrm{softmax}\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right)V', 'Transformer 的核心计算单元。', 'zhuyili zyl attention transformer'],
    ['Bellman 方程', 'V^{\\pi}(s)=\\sum_{s\'}P(s\'\\mid s,\\pi(s))\\left[R(s,a)+\\gamma V^{\\pi}(s\')\\right]', '强化学习中值函数的递推关系。', 'qianghua qh bellman 强化学习 值函数'],
  ],

  /* ------------------------------------------------------------------ 机器学习 */
  机器学习: [
    ['均方误差损失', 'L(\\theta)=\\frac{1}{2m}\\sum_{i=1}^{m}\\left(h_\\theta(x^{(i)})-y^{(i)}\\right)^2', '回归任务的标准损失，等价于高斯噪声下的极大似然。', 'junfangwucha jfwc mse 回归 损失'],
    ['逻辑回归', 'p(y=1\\mid x)=\\sigma\\!\\left(w^{\\top}x+b\\right),\\qquad \\sigma(z)=\\frac{1}{1+e^{-z}}', '线性判别 + sigmoid 压到 (0,1)。', 'luojihuigui ljhg logistic sigmoid 分类'],
    ['L2 正则化（岭回归）', '\\min_w\\ \\|Xw-y\\|^2+\\lambda\\|w\\|^2\\ \\Rightarrow\\ w=\\left(X^{\\top}X+\\lambda I\\right)^{-1}X^{\\top}y', '抑制权重过大，改善病态与过拟合。', 'zhengzehua zzh ridge l2 正则 岭回归'],
    ['支持向量机（对偶）', '\\max_{\\alpha}\\sum_i\\alpha_i-\\frac{1}{2}\\sum_{i,j}\\alpha_i\\alpha_jy_iy_j\\langle x_i,x_j\\rangle', '约束 0≤α_i≤C 且 Σα_i y_i=0。', 'zhichixiangliang zcxl svm 对偶 间隔'],
    ['RBF 核函数', 'K(x,x\')=\\exp\\!\\left(-\\frac{\\|x-x\'\\|^2}{2\\sigma^2}\\right)', '把样本映射到无穷维特征空间的内积。', 'hehanshu hhs rbf kernel 核函数'],
    ['信息增益', '\\mathrm{Gain}(D,a)=H(D)-\\sum_{v}\\frac{|D^v|}{|D|}H(D^v)', '决策树选择划分属性的依据。', 'xinxizengyi xxzy information gain 决策树'],
    ['K-means 目标函数', 'J=\\sum_{k=1}^{K}\\sum_{x\\in C_k}\\|x-\\mu_k\\|^2', '交替分配与更新中心，单调下降至局部最优。', 'kmeans julei 聚类 目标函数'],
    ['PCA（协方差特征分解）', '\\Sigma=\\frac{1}{n}X^{\\top}X,\\qquad \\Sigma v=\\lambda v', '取最大特征值对应的方向作为主成分。', 'zhuchengfen zcf pca 降维 主成分'],
    ['ELBO（变分下界）', '\\log p(x)\\ge\\mathbb{E}_{q(z)}\\left[\\log p(x\\mid z)\\right]-D_{\\mathrm{KL}}\\left(q(z)\\,\\|\\,p(z)\\right)', '变分自编码器的优化目标。', 'bianfen bf elbo vae 下界'],
    ['反向传播', '\\frac{\\partial L}{\\partial W^{(l)}}=\\delta^{(l)}\\left(a^{(l-1)}\\right)^{\\top},\\qquad \\delta^{(l)}=\\left(W^{(l+1)}\\right)^{\\top}\\delta^{(l+1)}\\odot\\sigma\'\\!\\left(z^{(l)}\\right)', '链式法则逐层回传梯度。', 'fanxiangchuanbo fxcb backprop 梯度'],
    ['Adam 更新', 'm_t=\\beta_1m_{t-1}+(1-\\beta_1)g_t,\\qquad \\theta_{t+1}=\\theta_t-\\eta\\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t}+\\varepsilon}', '一阶矩与二阶矩的自适应步长。', 'adam youhua 自适应 优化器'],
    ['批归一化', '\\hat{x}=\\frac{x-\\mu_{\\mathcal{B}}}{\\sqrt{\\sigma_{\\mathcal{B}}^2+\\varepsilon}},\\qquad y=\\gamma\\hat{x}+\\beta', '按小批统计量归一化，稳定训练。', 'piguoyihua pgyh batchnorm 归一化'],
    ['二维卷积', '(K*f)[i,j]=\\sum_{m}\\sum_{n}K[m,n]\\,f[i-m,j-n]', '卷积核在特征图上滑动加权求和。', 'juanji jj convolution 卷积核'],
    ['梯度裁剪', 'g\\leftarrow g\\cdot\\min\\!\\left(1,\\ \\frac{c}{\\|g\\|}\\right)', '限制梯度范数，防止梯度爆炸。', 'tiducaijian tdcj clip 梯度 爆炸'],
  ],

  /* ------------------------------------------------------------------ 数学物理与几何 */
  数学物理与几何: [
    ['拉普拉斯方程', '\\nabla^2 u=0', '无源稳态场（电势、稳态温度）满足的方程。', 'lapulasi fangcheng lpls laplace 调和'],
    ['一维波动方程', '\\frac{\\partial^2 u}{\\partial t^2}=c^2\\frac{\\partial^2 u}{\\partial x^2}', '弦振动、声波与电磁波的公共模型。', 'bodong fangcheng bd fc wave 波'],
    ['热传导方程', '\\frac{\\partial u}{\\partial t}=\\alpha\\nabla^2u', '扩散过程的抛物型方程。', 'rechuandao rcd heat 扩散 抛物'],
    ['贝塞尔方程', 'x^2y\'\'+xy\'+\\left(x^2-n^2\\right)y=0', '圆柱对称问题的径向方程，解为贝塞尔函数。', 'beisaier bse bessel 圆柱 特殊函数'],
    ['勒让德方程', '\\left(1-x^2\\right)y\'\'-2xy\'+n(n+1)y=0', '球对称问题的角向方程，解为勒让德多项式。', 'lerangde lrd legendre 球谐 特殊函数'],
    ['欧拉-拉格朗日方程', '\\frac{\\mathrm{d}}{\\mathrm{d}t}\\frac{\\partial L}{\\partial\\dot{q}}-\\frac{\\partial L}{\\partial q}=0', '变分原理给出力学运动方程。', 'oulalagelangri ollglr lagrangian 变分'],
    ['第一基本形式', '\\mathrm{I}=E\\,\\mathrm{d}u^2+2F\\,\\mathrm{d}u\\,\\mathrm{d}v+G\\,\\mathrm{d}v^2', '曲面上的弧长与角度由它决定。', 'diyijibenxingshi dyjbxs 曲面 度量 第一基本形式'],
    ['测地线方程', '\\ddot{x}^k+\\Gamma^{k}_{ij}\\dot{x}^i\\dot{x}^j=0', '曲面上「最直」的曲线，克里斯托费尔符号给出联络。', 'cedixian cdx geodesic 测地线 联络'],
    ['高斯-博内定理', '\\int_M K\\,\\mathrm{d}A+\\oint_{\\partial M}k_g\\,\\mathrm{d}s=2\\pi\\chi(M)', '曲率积分由拓扑（欧拉示性数）决定。', 'gaosibonei gsbn gauss bonnet 曲率 拓扑'],
    ['黎曼曲率张量', 'R^{\\rho}_{\\ \\sigma\\mu\\nu}=\\partial_\\mu\\Gamma^{\\rho}_{\\nu\\sigma}-\\partial_\\nu\\Gamma^{\\rho}_{\\mu\\sigma}+\\Gamma^{\\rho}_{\\mu\\lambda}\\Gamma^{\\lambda}_{\\nu\\sigma}-\\Gamma^{\\rho}_{\\nu\\lambda}\\Gamma^{\\lambda}_{\\mu\\sigma}', '衡量流形弯曲程度的核心张量。', 'liman qulv lmql riemann 曲率 张量'],
  ],
}

export const FORMULA_LIBRARY: FormulaEntry[] = FORMULA_CATEGORIES.flatMap((category, ci) =>
  (LIB[category] ?? []).map(([name, latex, desc, keywords], i) => ({
    id: `f${ci}-${i}`,
    name,
    category,
    latex,
    desc,
    keywords,
  }))
)

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

/** 「12 个门类 / 226 条」这类文案统一从这里取，避免文案和实际条目数脱节 */
export const FORMULA_SUMMARY = `${FORMULA_CATEGORIES.length} 个门类 / ${FORMULA_COUNT} 条`
