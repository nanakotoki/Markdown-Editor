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
      width="max-w-3xl"
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
