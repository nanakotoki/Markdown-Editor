import { useMemo, useState } from 'react'
import { Library, Search, Star, Trash2 } from 'lucide-react'
import { Button, Modal, TextInput } from '../ui'
import { renderMathSafely } from '../../core/katexSafeRender'
import { editorBridge } from '../../store/editorBridge'
import { useEditorStore } from '../../store/useEditorStore'

interface Sym {
  label: string
  insert: string
  name: string
}

const GROUPS: Array<{ key: string; title: string; items: Sym[] }> = [
  {
    key: 'struct',
    title: '常用结构',
    items: [
      { label: '\\frac{a}{b}', insert: '\\frac{}{}', name: '分式' },
      { label: '\\dfrac{a}{b}', insert: '\\dfrac{}{}', name: '行间分式' },
      { label: '\\sqrt{x}', insert: '\\sqrt{}', name: '根号' },
      { label: '\\sqrt[n]{x}', insert: '\\sqrt[]{}', name: 'n 次根' },
      { label: 'x^{a}', insert: '^{}', name: '上标' },
      { label: 'x_{a}', insert: '_{}', name: '下标' },
      { label: '\\binom{n}{k}', insert: '\\binom{}{}', name: '组合数' },
      { label: '\\overline{AB}', insert: '\\overline{}', name: '上划线' },
      { label: '\\underbrace{}_{}', insert: '\\underbrace{}_{}', name: '下大括号' },
      { label: '\\overbrace{}^{}', insert: '\\overbrace{}^{}', name: '上大括号' },
      { label: '\\begin{cases}\\end{cases}', insert: '\\begin{cases}\n  , & \\\\\n  , &\n\\end{cases}', name: '分段函数' },
      { label: '\\begin{aligned}\\end{aligned}', insert: '\\begin{aligned}\n  &= \\\\\n  &=\n\\end{aligned}', name: '多行对齐' },
      { label: '\\begin{pmatrix}\\end{pmatrix}', insert: '\\begin{pmatrix} & \\\\ & \\end{pmatrix}', name: '矩阵' },
      { label: '\\begin{vmatrix}\\end{vmatrix}', insert: '\\begin{vmatrix} & \\\\ & \\end{vmatrix}', name: '行列式' },
      { label: '\\boxed{x}', insert: '\\boxed{}', name: '方框' },
      { label: '\\quad', insert: '\\quad ', name: '空格' },
    ],
  },
  {
    key: 'calculus',
    title: '高等数学与微积分',
    items: [
      { label: '\\lim_{x\\to a}', insert: '\\lim_{x \\to }', name: '极限' },
      { label: '\\sum_{i=1}^{n}', insert: '\\sum_{i=1}^{n}', name: '求和' },
      { label: '\\prod_{i=1}^{n}', insert: '\\prod_{i=1}^{n}', name: '连乘' },
      { label: '\\int_{a}^{b}', insert: '\\int_{}^{}', name: '定积分' },
      { label: '\\iint_{D}', insert: '\\iint_{D}', name: '二重积分' },
      { label: '\\iiint_{V}', insert: '\\iiint_{V}', name: '三重积分' },
      { label: '\\oint_{L}', insert: '\\oint_{L}', name: '环路积分' },
      { label: '\\frac{\\partial z}{\\partial x}', insert: '\\frac{\\partial }{\\partial }', name: '偏导' },
      { label: '\\frac{\\mathrm{d}y}{\\mathrm{d}x}', insert: '\\frac{\\mathrm{d}y}{\\mathrm{d}x}', name: '导数' },
      { label: '\\nabla', insert: '\\nabla', name: '梯度算子' },
      { label: '\\infty', insert: '\\infty', name: '无穷' },
      { label: '\\to', insert: '\\to ', name: '趋于' },
      { label: 'f\'(x)', insert: "'", name: '撇号' },
      { label: '\\Delta x', insert: '\\Delta ', name: '增量' },
      { label: '\\varepsilon', insert: '\\varepsilon', name: 'epsilon' },
      { label: '\\limsup', insert: '\\limsup_{n \\to \\infty}', name: '上极限' },
    ],
  },
  {
    key: 'linear',
    title: '线性代数与矩阵',
    items: [
      { label: '\\vec{v}', insert: '\\vec{}', name: '向量' },
      { label: '\\hat{A}', insert: '\\hat{}', name: '帽子' },
      { label: 'A^{\\top}', insert: '^{\\top}', name: '转置' },
      { label: 'A^{-1}', insert: '^{-1}', name: '逆' },
      { label: '\\det A', insert: '\\det A', name: '行列式' },
      { label: '\\operatorname{tr}A', insert: '\\operatorname{tr}A', name: '迹' },
      { label: '\\operatorname{rank}A', insert: '\\operatorname{rank}A', name: '秩' },
      { label: '\\|\\vec{x}\\|', insert: '\\left\\| \\right\\|', name: '范数' },
      { label: '\\langle u,v\\rangle', insert: '\\langle , \\rangle', name: '内积' },
      { label: '\\lambda', insert: '\\lambda', name: '特征值' },
      { label: '\\oplus', insert: '\\oplus', name: '直和' },
      { label: '\\otimes', insert: '\\otimes', name: '张量积' },
      { label: '\\times', insert: '\\times ', name: '叉乘' },
      { label: 'A\\mathbf{x}=b', insert: 'A\\mathbf{x}=\\mathbf{b}', name: '线性方程组' },
      { label: '\\Sigma', insert: '\\Sigma', name: '协方差矩阵' },
      { label: '\\mathrm{diag}', insert: '\\mathrm{diag}(\\cdots)', name: '对角阵' },
    ],
  },
  {
    key: 'prob',
    title: '概率统计',
    items: [
      { label: 'P(A\\mid B)', insert: 'P(A \\mid B)', name: '条件概率' },
      { label: '\\mathbb{E}[X]', insert: '\\mathbb{E}[X]', name: '期望' },
      { label: '\\operatorname{Var}(X)', insert: '\\operatorname{Var}(X)', name: '方差' },
      { label: '\\operatorname{Cov}(X,Y)', insert: '\\operatorname{Cov}(X,Y)', name: '协方差' },
      { label: 'X\\sim\\mathcal{N}(\\mu,\\sigma^2)', insert: 'X \\sim \\mathcal{N}(\\mu,\\sigma^{2})', name: '正态分布' },
      { label: '\\mu', insert: '\\mu', name: '均值' },
      { label: '\\sigma^2', insert: '\\sigma^{2}', name: '方差符号' },
      { label: '\\rho', insert: '\\rho', name: '相关系数' },
      { label: '\\hat{\\theta}', insert: '\\hat{\\theta}', name: '估计量' },
      { label: '\\bar{X}', insert: '\\bar{X}', name: '样本均值' },
      { label: '\\sum_{i=1}^{n}X_i', insert: '\\sum_{i=1}^{n} X_i', name: '求和' },
      { label: '\\prod', insert: '\\prod', name: '似然' },
      { label: '\\binom{n}{k}p^k', insert: '\\binom{n}{k}p^{k}(1-p)^{n-k}', name: '二项分布' },
      { label: '\\xrightarrow{d}', insert: '\\xrightarrow{d}', name: '依分布收敛' },
    ],
  },
  {
    key: 'discrete',
    title: '离散数学与集合逻辑',
    items: [
      { label: '\\land', insert: '\\land ', name: '合取' },
      { label: '\\lor', insert: '\\lor ', name: '析取' },
      { label: '\\neg', insert: '\\neg ', name: '否定' },
      { label: '\\to', insert: '\\to ', name: '蕴含' },
      { label: '\\iff', insert: '\\iff ', name: '等价' },
      { label: '\\oplus', insert: '\\oplus ', name: '异或' },
      { label: '\\forall', insert: '\\forall ', name: '任意' },
      { label: '\\exists', insert: '\\exists ', name: '存在' },
      { label: '\\in', insert: '\\in ', name: '属于' },
      { label: '\\notin', insert: '\\notin ', name: '不属于' },
      { label: '\\subset', insert: '\\subset ', name: '真子集' },
      { label: '\\subseteq', insert: '\\subseteq ', name: '子集' },
      { label: '\\cup', insert: '\\cup ', name: '并' },
      { label: '\\cap', insert: '\\cap ', name: '交' },
      { label: '\\emptyset', insert: '\\emptyset', name: '空集' },
      { label: '\\mathbb{N}', insert: '\\mathbb{N}', name: '自然数' },
      { label: '\\mathbb{Z}', insert: '\\mathbb{Z}', name: '整数' },
      { label: '\\mathbb{R}', insert: '\\mathbb{R}', name: '实数' },
      { label: '\\therefore', insert: '\\therefore ', name: '所以' },
      { label: '\\because', insert: '\\because ', name: '因为' },
    ],
  },
  {
    key: 'greek',
    title: '希腊与花体字母',
    items: [
      { label: '\\alpha', insert: '\\alpha ', name: 'α' },
      { label: '\\beta', insert: '\\beta ', name: 'β' },
      { label: '\\gamma', insert: '\\gamma ', name: 'γ' },
      { label: '\\Gamma', insert: '\\Gamma ', name: 'Γ' },
      { label: '\\delta', insert: '\\delta ', name: 'δ' },
      { label: '\\Delta', insert: '\\Delta ', name: 'Δ' },
      { label: '\\theta', insert: '\\theta ', name: 'θ' },
      { label: '\\lambda', insert: '\\lambda ', name: 'λ' },
      { label: '\\Lambda', insert: '\\Lambda ', name: 'Λ' },
      { label: '\\pi', insert: '\\pi ', name: 'π' },
      { label: '\\sigma', insert: '\\sigma ', name: 'σ' },
      { label: '\\Sigma', insert: '\\Sigma ', name: 'Σ' },
      { label: '\\varphi', insert: '\\varphi ', name: 'φ' },
      { label: '\\omega', insert: '\\omega ', name: 'ω' },
      { label: '\\Omega', insert: '\\Omega ', name: 'Ω' },
      { label: '\\mathcal{L}', insert: '\\mathcal{L}', name: '花体 L' },
      { label: '\\mathfrak{g}', insert: '\\mathfrak{g}', name: '哥特体' },
      { label: '\\mathbb{1}', insert: '\\mathbb{1}', name: '指示函数' },
      { label: '\\ell', insert: '\\ell ', name: 'ℓ' },
      { label: '\\hbar', insert: '\\hbar ', name: 'ℏ' },
    ],
  },
  {
    key: 'physics',
    title: '物理与化学',
    items: [
      { label: '\\vec{E}', insert: '\\vec{E}', name: '电场' },
      { label: '\\vec{B}', insert: '\\vec{B}', name: '磁场' },
      { label: '\\nabla\\cdot\\vec{E}', insert: '\\nabla\\cdot\\vec{E}', name: '散度' },
      { label: '\\nabla\\times\\vec{B}', insert: '\\nabla\\times\\vec{B}', name: '旋度' },
      { label: '\\oint\\vec{B}\\cdot\\mathrm{d}\\vec{l}', insert: '\\oint \\vec{B}\\cdot\\mathrm{d}\\vec{l}', name: '环路积分' },
      { label: '\\varepsilon_0', insert: '\\varepsilon_{0}', name: '真空介电常数' },
      { label: '\\mu_0', insert: '\\mu_{0}', name: '真空磁导率' },
      { label: '\\hbar', insert: '\\hbar', name: '约化普朗克常数' },
      { label: '\\psi', insert: '\\psi', name: '波函数' },
      { label: 'k_B', insert: 'k_{B}', name: '玻尔兹曼常数' },
      { label: '\\eta', insert: '\\eta', name: '效率' },
      { label: '\\omega', insert: '\\omega', name: '角频率' },
      { label: '\\ce{H2O}', insert: '\\ce{H2O}', name: '水（mhchem）' },
      { label: '\\ce{2H2 + O2 -> 2H2O}', insert: '\\ce{2H2 + O2 -> 2H2O}', name: '化学方程式' },
      { label: '\\ce{SO4^2-}', insert: '\\ce{SO4^2-}', name: '离子' },
      { label: '\\ce{CH3COOH <=> H+ + CH3COO-}', insert: '\\ce{CH3COOH <=> H+ + CH3COO-}', name: '可逆反应' },
    ],
  },
]

export default function SymbolPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [group, setGroup] = useState(GROUPS[0].key)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'fav'>('all')
  const favorites = useEditorStore((s) => s.favorites)
  const removeFavorite = useEditorStore((s) => s.removeFavorite)
  const showToast = useEditorStore((s) => s.showToast)

  const items = useMemo(() => {
    const g = GROUPS.find((x) => x.key === group) ?? GROUPS[0]
    const base = tab === 'fav' ? [] : g.items
    if (!query.trim()) return base
    return base.filter((s) => s.name.includes(query) || s.insert.includes(query))
  }, [group, query, tab])

  const insert = (latex: string) => {
    const active = editorBridge.current?.getActiveMath()
    if (active) editorBridge.current?.insert(latex)
    else editorBridge.current?.insertMath(latex, false)
    editorBridge.current?.focus()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="分类符号面板"
      subtitle="点击即插入；光标位于公式内时直接追加源码，否则自动包裹为行内公式"
      icon={<Library size={18} />}
      width="max-w-3xl"
    >
      <div className="flex gap-4">
        <div className="w-[152px] shrink-0 space-y-1">
          <button
            onClick={() => setTab('fav')}
            className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition ${
              tab === 'fav' ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <Star size={12} /> 我的收藏 ({favorites.length})
          </button>
          <div className="my-1 h-px bg-ink-100" />
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => {
                setGroup(g.key)
                setTab('all')
              }}
              className={`block w-full rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                tab === 'all' && group === g.key ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {tab === 'all' && (
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <TextInput value={query} onChange={setQuery} placeholder="搜索符号（中文名或 LaTeX）" className="pl-7" />
            </div>
          )}

          {tab === 'fav' ? (
            favorites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-[12px] leading-relaxed text-ink-400">
                还没有收藏公式。
                <br />
                把光标放进任意公式，点击悬浮窗右上角的书签即可收藏。
              </div>
            ) : (
              <div className="space-y-1.5">
                {favorites.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-2 hover:border-accent-200">
                    <div
                      className="min-w-0 flex-1 cursor-pointer overflow-hidden text-[13px]"
                      onClick={() => insert(f.latex)}
                      dangerouslySetInnerHTML={{ __html: renderMathSafely(f.latex, false, {}).html }}
                    />
                    <button onClick={() => removeFavorite(f.id)} className="text-ink-300 hover:text-rose-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid max-h-[400px] grid-cols-4 gap-1.5 overflow-auto pr-1">
              {items.map((s) => (
                <button
                  key={s.insert + s.name}
                  title={`${s.name}  ${s.insert}`}
                  onClick={() => insert(s.insert)}
                  className="flex h-[54px] flex-col items-center justify-center gap-1 rounded-lg border border-ink-100 bg-white px-1 transition hover:border-accent-300 hover:bg-accent-50/40"
                >
                  <span
                    className="max-w-full overflow-hidden text-[13px] text-ink-800"
                    dangerouslySetInnerHTML={{ __html: renderMathSafely(s.label, false, {}).html }}
                  />
                  <span className="text-[10px] text-ink-400">{s.name}</span>
                </button>
              ))}
              {items.length === 0 && <div className="col-span-4 py-8 text-center text-[12px] text-ink-400">没有匹配的符号</div>}
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => showToast('符号已插入，可继续输入', 'success')}>
              提示：Tab 可跳转占位符
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
