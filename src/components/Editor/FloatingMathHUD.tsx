import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  FunctionSquare,
  Grid3x3,
  Image as ImageIcon,
  LineChart,
  Plus,
  Rows3,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { renderMathSafely, type MacroMap } from '../../core/katexSafeRender'
import { copyAsMathML, copyAsPng, copyAsSvg, copyPlainText } from '../../core/clipboardExport'
import { useEditorStore } from '../../store/useEditorStore'

/**
 * ============================================================================
 *  FloatingMathHUD.tsx —— 公式悬浮工作台
 * ----------------------------------------------------------------------------
 *  实时容错预览 · 中文诊断与一键修复 · 复制为 Word/PNG/SVG · 绘图与求值入口
 *  · 矩阵环境下的 +行 / +列 / 转置
 * ============================================================================
 */

export interface HudProps {
  latex: string
  display: boolean
  macros: MacroMap
  /** 折叠后只留一条头部，把编辑区高度还给正文 */
  collapsed: boolean
  onToggleCollapse: () => void
  onChangeLatex: (latex: string) => void
  onRequestBuilder: (kind: 'matrix' | 'ai' | 'plot') => void
  onFavorite: () => void
}

function matrixEnvOf(latex: string): string | null {
  const m = /\\begin\{([pbvBV]?matrix|smallmatrix|array)\}/.exec(latex)
  return m ? m[1] : null
}

export function addMatrixRow(latex: string): string {
  const env = matrixEnvOf(latex)
  if (!env) return latex
  const body = new RegExp(`\\\\begin\\{${env}\\}([\\s\\S]*)\\\\end\\{${env}\\}`).exec(latex)
  if (!body) return latex
  const rows = body[1].split(/\\\\/)
  const cols = (rows[0] ?? '').split('&').length
  const newRow = Array.from({ length: cols }).map(() => '0').join(' & ')
  const rebuilt = [...rows.map((r) => r.replace(/\s+$/, '')), newRow].join(' \\\\ ')
  return latex.replace(body[0], `\\begin{${env}}${rebuilt}\\end{${env}}`)
}

export function addMatrixCol(latex: string): string {
  const env = matrixEnvOf(latex)
  if (!env) return latex
  const body = new RegExp(`\\\\begin\\{${env}\\}([\\s\\S]*)\\\\end\\{${env}\\}`).exec(latex)
  if (!body) return latex
  const rows = body[1].split(/\\\\/)
  const rebuilt = rows
    .map((r) => (r.trim() ? `${r.replace(/\s+$/, '')} & 0` : r))
    .join(' \\\\ ')
  return latex.replace(body[0], `\\begin{${env}}${rebuilt}\\end{${env}}`)
}

export function transposeMatrixLatex(latex: string): string {
  const env = matrixEnvOf(latex)
  if (!env) return latex
  const body = new RegExp(`\\\\begin\\{${env}\\}([\\s\\S]*)\\\\end\\{${env}\\}`).exec(latex)
  if (!body) return latex
  const rows = body[1]
    .split(/\\\\/)
    .map((r) => r.split('&').map((c) => c.trim()))
    .filter((r) => r.length)
  const transposed: string[][] = []
  const cols = Math.max(...rows.map((r) => r.length))
  for (let c = 0; c < cols; c++) transposed.push(rows.map((r) => r[c] ?? '0'))
  const rebuilt = transposed.map((r) => r.join(' & ')).join(' \\\\ ')
  return latex.replace(body[0], `\\begin{${env}}${rebuilt}\\end{${env}}`)
}

export default function FloatingMathHUD({
  latex,
  display,
  macros,
  collapsed,
  onToggleCollapse,
  onChangeLatex,
  onRequestBuilder,
  onFavorite,
}: HudProps) {
  const showToast = useEditorStore((s) => s.showToast)
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => renderMathSafely(latex, display, macros), [latex, display, macros])
  const env = matrixEnvOf(latex)
  const isMatrix = Boolean(env)

  const flash = (k: string, msg: string) => {
    setCopied(k)
    showToast(msg, 'success')
    setTimeout(() => setCopied(null), 1400)
  }

  const doCopy = async (kind: 'mathml' | 'png' | 'svg' | 'latex') => {
    if (kind === 'mathml') {
      const ok = await copyAsMathML(latex, display, macros)
      flash('mathml', ok ? '已复制 Word 原生公式，可直接 Ctrl+V 粘贴' : '复制失败，请检查浏览器权限')
      return
    }
    if (kind === 'png') {
      const r = await copyAsPng(latex, display, macros)
      if (r.ok) flash('png', '已复制 3x 高清 PNG')
      else if (r.blob) {
        const url = URL.createObjectURL(r.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'formula.png'
        a.click()
        flash('png', r.reason ?? '已改为下载图片')
      } else flash('png', r.reason ?? '生成失败')
      return
    }
    if (kind === 'svg') {
      const ok = await copyAsSvg(latex, display, macros)
      flash('svg', ok ? '已复制矢量 SVG' : '复制失败')
      return
    }
    await copyPlainText(latex)
    flash('latex', '已复制纯 LaTeX 源码')
  }

  return (
    <div className="mf-hud mf-hud-dock relative z-20 shrink-0 border-t border-ink-200 bg-white/97 shadow-[0_-8px_24px_-18px_rgba(20,26,35,.35)] backdrop-blur">
      {/* 头部：常驻一行，折叠时也只有这一行 */}
      <div className="flex items-center justify-between gap-2 px-3 py-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-ink-400">
          <FunctionSquare size={12} className="shrink-0 text-accent-500" />
          <span className="shrink-0">{display ? '块级公式' : '行内公式'}</span>
          <span className="text-ink-300">·</span>
          <span className="shrink-0 font-mono text-[10px]">{latex.length} 字符</span>
          {env && (
            <>
              <span className="text-ink-300">·</span>
              <span className="rounded bg-accent-50 px-1 text-[10px] text-accent-600">{env}</span>
            </>
          )}
          {collapsed && result.diagnosis && (
            <span className="ml-1 truncate rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600">
              {result.diagnosis.title}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HudIcon title="自然语言转公式" onClick={() => onRequestBuilder('ai')}>
            <Sparkles size={13} />
          </HudIcon>
          <HudIcon title="矩阵 / 分段函数构造器" onClick={() => onRequestBuilder('matrix')}>
            <Grid3x3 size={13} />
          </HudIcon>
          <HudIcon title="函数绘图 / 矩阵计算" onClick={() => onRequestBuilder('plot')}>
            <LineChart size={13} />
          </HudIcon>
          <HudIcon title="收藏到公式库" onClick={onFavorite}>
            <BookmarkPlus size={13} />
          </HudIcon>
          <span className="mx-0.5 h-4 w-px bg-ink-100" />
          <button
            title={collapsed ? '展开公式工作台（Ctrl+Shift+M）' : '折叠，把空间还给正文（Ctrl+Shift+M）'}
            onClick={onToggleCollapse}
            className="rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-accent-600"
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* 实时预览：横向可滚，竖向限高，绝不盖住编辑区 */}
          <div className="mf-hud-preview max-h-[104px] overflow-auto border-t border-ink-100 px-4 py-2">
            <div className={display ? 'text-center' : ''} dangerouslySetInnerHTML={{ __html: result.html }} />
            {result.healed.applied.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-amber-600">
                <Wand2 size={11} />
                <span>已自动愈合：</span>
                {result.healed.applied.map((a) => (
                  <span key={a} className="rounded bg-amber-50 px-1.5 py-0.5">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 中文诊断 */}
          {result.diagnosis && (
            <div className="mx-3 mb-1.5 rounded-lg border border-rose-100 bg-rose-50/70 px-2.5 py-1.5">
              <div className="flex items-start gap-1.5 text-[12px] font-medium text-rose-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{result.diagnosis.title}</span>
              </div>
              <div className="mt-0.5 pl-[19px] text-[11px] leading-relaxed text-rose-500">{result.diagnosis.detail}</div>
              {result.diagnosis.fixed && result.diagnosis.fixed !== latex && (
                <button
                  className="ml-[19px] mt-1 inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700"
                  onClick={() => {
                    onChangeLatex(result.diagnosis!.fixed!)
                    showToast('已应用修复', 'success')
                  }}
                >
                  <Check size={11} />
                  {result.diagnosis.fixLabel ?? '一键修复'}
                </button>
              )}
            </div>
          )}

          {/* 矩阵参数调节 + 快捷动作，挤在一行里省高度 */}
          <div className="flex flex-wrap items-center gap-1 border-t border-ink-100 px-3 py-1.5">
            {isMatrix && (
              <>
                <span className="mr-0.5 text-[11px] text-ink-400">矩阵</span>
                <SmallBtn onClick={() => onChangeLatex(addMatrixRow(latex))}>
                  <Rows3 size={11} /> +行
                </SmallBtn>
                <SmallBtn onClick={() => onChangeLatex(addMatrixCol(latex))}>
                  <Plus size={11} /> +列
                </SmallBtn>
                <SmallBtn onClick={() => onChangeLatex(transposeMatrixLatex(latex))}>
                  <ChevronDown size={11} className="rotate-90" /> 转置
                </SmallBtn>
                <span className="mx-1 h-4 w-px bg-ink-100" />
              </>
            )}
            <span className="mr-1 text-[11px] text-ink-300">复制为</span>
            <ActionBtn active={copied === 'mathml'} onClick={() => doCopy('mathml')} icon={<FileText size={11} />}>
              Word
            </ActionBtn>
            <ActionBtn active={copied === 'png'} onClick={() => doCopy('png')} icon={<ImageIcon size={11} />}>
              PNG
            </ActionBtn>
            <ActionBtn active={copied === 'svg'} onClick={() => doCopy('svg')} icon={<Copy size={11} />}>
              SVG
            </ActionBtn>
            <ActionBtn active={copied === 'latex'} onClick={() => doCopy('latex')} icon={<Copy size={11} />}>
              LaTeX
            </ActionBtn>
          </div>
        </>
      )}
    </div>
  )
}

function HudIcon({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-accent-600"
    >
      {children}
    </button>
  )
}

function SmallBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[11px] text-ink-600 ring-1 ring-ink-200 transition hover:text-accent-600 hover:ring-accent-300"
    >
      {children}
    </button>
  )
}

function ActionBtn({
  children,
  icon,
  onClick,
  active,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition ${
        active ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700'
      }`}
    >
      {active ? <Check size={11} /> : icon}
      {children}
    </button>
  )
}
