import { RotateCcw, Type } from 'lucide-react'
import { Modal } from '../ui'
import { useEditorStore } from '../../store/useEditorStore'
import {
  EDITOR_FONTS,
  PREVIEW_FONTS,
  editorFontStack,
  previewFontStack,
  type EditorFontKey,
  type PreviewFontKey,
} from '../../core/appearance'
import { eqTagText } from '../../core/numbering'

/**
 * ============================================================================
 *  AppearanceModal.tsx —— 字体与外观
 * ----------------------------------------------------------------------------
 *  正文（渲染结果）与源码（编辑区）分开设置：字体族 / 字号 / 行距 / 字重。
 *  改动即时生效——设置写进 CSS 变量，面板里的示例段落就是最终效果。
 * ============================================================================
 */

export default function AppearanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useEditorStore((s) => s.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const reset = useEditorStore((s) => s.resetAppearance)

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="字体与外观"
      subtitle="渲染结果和源码分开设置，改完立刻生效，设置会被记住"
      icon={<Type size={18} />}
      width="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          {/* ---------------- 渲染结果 ---------------- */}
          <section>
            <SectionTitle>渲染结果（右栏 / 预览 / 导出）</SectionTitle>

            <Row label="字体">
              <div className="grid grid-cols-2 gap-2">
                {PREVIEW_FONTS.map((f) => (
                  <ChoiceCard
                    key={f.key}
                    active={settings.previewFont === f.key}
                    title={f.label}
                    note={f.note}
                    sampleStyle={{ fontFamily: previewFontStack(f.key as PreviewFontKey) }}
                    onClick={() => updateSettings({ previewFont: f.key })}
                  />
                ))}
              </div>
            </Row>

            <Row label="字号">
              <Slider
                value={settings.previewFontSize}
                min={13}
                max={24}
                step={0.5}
                suffix="px"
                onChange={(v) => updateSettings({ previewFontSize: v })}
              />
            </Row>

            <Row label="行距">
              <Slider
                value={settings.previewLineHeight}
                min={1.4}
                max={2.6}
                step={0.05}
                suffix=""
                onChange={(v) => updateSettings({ previewLineHeight: v })}
              />
            </Row>

            <Row label="字重">
              <div className="flex gap-2">
                {[
                  { v: 400 as const, label: '常规', note: '默认' },
                  { v: 500 as const, label: '中等', note: '笔画略厚' },
                  { v: 600 as const, label: '加粗', note: '宋体可用' },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => updateSettings({ previewWeight: o.v })}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition ${
                      settings.previewWeight === o.v
                        ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-300'
                        : 'text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                    }`}
                    title={o.note}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                宋体只有常规一档，选「加粗」由系统合成加厚；装了思源宋体则用真实的 Medium / SemiBold。
              </p>
            </Row>
          </section>

          {/* ---------------- 编辑区 ---------------- */}
          <section>
            <SectionTitle>源码（编辑区）</SectionTitle>

            <Row label="字体">
              <div className="grid grid-cols-2 gap-2">
                {EDITOR_FONTS.map((f) => (
                  <ChoiceCard
                    key={f.key}
                    active={settings.editorFont === f.key}
                    title={f.label}
                    note={f.note}
                    sampleStyle={{ fontFamily: editorFontStack(f.key as EditorFontKey) }}
                    onClick={() => updateSettings({ editorFont: f.key })}
                  />
                ))}
              </div>
            </Row>

            <Row label="字号">
              <Slider
                value={settings.editorFontSize}
                min={11}
                max={20}
                step={0.5}
                suffix="px"
                onChange={(v) => updateSettings({ editorFontSize: v })}
              />
            </Row>

            <div className="mt-2 rounded-xl border border-ink-200 bg-[#fbfcfd] px-3 py-2">
              <div className="mb-1 text-[11px] font-medium text-ink-400">实时效果</div>
              <div className="mf-academic">
                <p style={{ margin: 0 }}>
                  设 <em>f(x) = ax² + bx + c</em>，当 Δ &gt; 0 时方程有两个不等实根。这段即正文最终的字号、行距与字重。
                </p>
              </div>
              <div
                className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-ink-700 ring-1 ring-ink-100"
                style={{ fontFamily: editorFontStack(settings.editorFont), fontSize: settings.editorFontSize }}
              >
                <div className="text-ink-400">## 源码区</div>
                <div>$$\int_0^1 x^2\,dx = \tfrac&#123;1&#125;&#123;3&#125;$$</div>
              </div>
            </div>
          </section>
        </div>


        {/* ---------------- 排印细节 ---------------- */}
        <div className="rounded-xl border border-ink-200 p-3">
          <SectionTitle>排印细节（定理、编号、数学字形）</SectionTitle>
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <Row label="数学字形">
                <Pills
                  value={settings.mathStyle}
                  options={[
                    { v: 'cm', label: '锐利' },
                    { v: 'soft', label: '饱满（默认）' },
                    { v: 'bold', label: '粗壮' },
                  ]}
                  onChange={(v) => updateSettings({ mathStyle: v as typeof settings.mathStyle })}
                />
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-400">
                  公式用的是 Computer Modern，笔画偏细偏尖。「饱满」会给笔画加一道极细描边，屏幕上看更圆润；打印几乎无差别。
                </p>
              </Row>

              <Row label="容器样式">
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { v: 'classic', label: '经典' },
                    { v: 'beamer', label: '色块' },
                    { v: 'boxed', label: '方框' },
                    { v: 'plain', label: '纯文' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => updateSettings({ thmStyle: o.v as typeof settings.thmStyle })}
                      className={`rounded-lg py-1.5 text-[11.5px] transition ${
                        settings.thmStyle === o.v
                          ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-300'
                          : 'text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-600">
                  <input
                    type="checkbox"
                    checked={settings.thmBodyKai}
                    onChange={(e) => updateSettings({ thmBodyKai: e.target.checked })}
                    className="h-3.5 w-3.5 accent-accent-600"
                  />
                  定理 / 证明正文用楷体（标题始终黑体）
                </label>
              </Row>
            </div>

            <div>
              <Row label="定理编号">
                <Pills
                  value={settings.thmNumbering}
                  options={[
                    { v: 'section', label: '按节：定义 1.1' },
                    { v: 'global', label: '连续：定义 1' },
                  ]}
                  onChange={(v) => updateSettings({ thmNumbering: v as typeof settings.thmNumbering })}
                />
              </Row>

              <Row label="公式编号">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pills
                    value={settings.eqNumbering}
                    options={[
                      { v: 'global', label: '连续' },
                      { v: 'section', label: '按节' },
                    ]}
                    onChange={(v) => updateSettings({ eqNumbering: v as typeof settings.eqNumbering })}
                  />
                  <span className="text-ink-300">·</span>
                  <Pills
                    value={settings.eqTagStyle}
                    options={[
                      { v: 'paren', label: '(1)' },
                      { v: 'dash', label: '1-1' },
                      { v: 'dot', label: '1.1' },
                    ]}
                    onChange={(v) => updateSettings({ eqTagStyle: v as typeof settings.eqTagStyle })}
                  />
                </div>
                <p className="mt-1 text-[10.5px] text-ink-400">
                  当前效果：{eqTagText(1, 1, settings.eqNumbering, settings.eqTagStyle)}　编号本身可点击，正文里写 @eq:标签 也能跳回来。
                </p>
              </Row>

              <Row label="证毕符号">
                <div className="flex flex-wrap items-center gap-1.5">
                  {['∎', '□', '■', '▪', 'Q.E.D.'].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => updateSettings({ qedSymbol: sym })}
                      className={`min-w-[30px] rounded-lg px-2 py-1 text-[12px] transition ${
                        settings.qedSymbol === sym
                          ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-300'
                          : 'text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                  <button
                    onClick={() => updateSettings({ qedSymbol: '' })}
                    className={`rounded-lg px-2 py-1 text-[11.5px] transition ${
                      settings.qedSymbol === ''
                        ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-300'
                        : 'text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    不要
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-ink-400">自定义</span>
                  <input
                    value={settings.qedSymbol}
                    onChange={(e) => updateSettings({ qedSymbol: e.target.value.slice(0, 12) })}
                    placeholder="∎"
                    className="h-7 w-[62px] rounded-lg border border-ink-200 px-2 text-center text-[12px] outline-none focus:border-accent-400"
                  />
                  <span className="text-[10.5px] text-ink-400">留空则不加符号</span>
                </div>
              </Row>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 pt-3">
          <p className="text-[11px] text-ink-400">
            字体按「装了就用」排序；系统里没有的自动退到下一个，不会变成方框。
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-ink-600 ring-1 ring-ink-200 transition hover:bg-ink-50"
          >
            <RotateCcw size={12} />
            恢复默认
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[12.5px] font-semibold text-ink-800">{children}</div>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-[64px_1fr] items-start gap-3">
      <div className="pt-1.5 text-[12px] text-ink-500">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function ChoiceCard({
  active,
  title,
  note,
  sampleStyle,
  onClick,
}: {
  active: boolean
  title: string
  note: string
  sampleStyle: React.CSSProperties
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        active ? 'border-accent-400 bg-accent-50/60 ring-1 ring-accent-200' : 'border-ink-200 bg-white hover:bg-ink-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-ink-800">{title}</span>
        <span className="shrink-0 text-[15px] leading-none text-ink-600" style={sampleStyle}>
          Aa
        </span>
      </div>
      <div className="mt-0.5 text-[10.5px] leading-tight text-ink-400">{note}</div>
    </button>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-accent-600"
      />
      <span className="w-[52px] shrink-0 text-right font-mono text-[12px] text-ink-600">
        {value}
        {suffix}
      </span>
    </div>
  )
}

function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-lg px-2.5 py-1 text-[11.5px] transition ${
            value === o.v ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-300' : 'text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
