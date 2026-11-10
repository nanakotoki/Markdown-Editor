import { useState } from 'react'
import { Check, RotateCcw, TriangleAlert, Type } from 'lucide-react'
import { Modal } from '../ui'
import { useEditorStore } from '../../store/useEditorStore'
import {
  EDITOR_FONTS,
  FONT_PAIRINGS,
  LATIN_FONTS,
  PREVIEW_FONTS,
  editorFontStack,
  isFontAvailable,
  previewFontStack,
  type EditorFontKey,
  type PreviewFontKey,
  type RoleFontKey,
} from '../../core/appearance'
import type { Settings } from '../../store/useEditorStore'
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
  const mode = useEditorStore((s) => s.mode)
  /** 「自由搭配」默认收起：绝大多数人用预设就够，展开是给要交稿格式的人 */
  const [showRoles, setShowRoles] = useState(false)
  /** 单独改任一角色 = 不再跟随预设，标记成 custom */
  const setRole = (patch: Partial<Settings>) => updateSettings({ ...patch, fontPairing: 'custom' })

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
        {/* ---------------- 界面主题 ---------------- */}
        <div className="rounded-xl border border-ink-200 p-3">
          <SectionTitle>界面</SectionTitle>
          <Row label="主题">
            <Pills
              value={settings.theme}
              options={[
                { v: 'light' as const, label: '浅色' },
                { v: 'dark' as const, label: '深色' },
                { v: 'system' as const, label: '跟随系统' },
              ]}
              onChange={(v) => updateSettings({ theme: v })}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              只改界面：侧边栏、工具栏、编辑区、弹窗。阅读模式里的 A4 纸面永远是白的 ——
              纸张要是跟着变黑，屏幕上排好的版和打印出来的 PDF 就对不上了。
            </p>
          </Row>
        </div>

        {/* ---------------- 保存方式 ---------------- */}
        <div className="rounded-xl border border-ink-200 p-3">
          <SectionTitle>保存</SectionTitle>
          <Row label="写入磁盘">
            <Pills
              value={settings.saveMode}
              options={[
                { v: 'auto' as const, label: '自动保存' },
                { v: 'manual' as const, label: '手动保存（Ctrl+S）' },
              ]}
              onChange={(v) => updateSettings({ saveMode: v })}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              {settings.saveMode === 'auto'
                ? '停笔约 2 秒后自动写盘，标签上的圆点变蓝表示正在保存。自动保存不会弹提示，只有手动模式按 Ctrl+S 才提示。'
                : '只在你按 Ctrl+S（或点工具栏的保存）时写盘；有未保存改动的标签会亮橙色圆点，关闭标签前会提醒。'}
              {mode !== 'local' && '　浏览器内文档始终存在本地，此项只在打开工作区目录后生效。'}
            </p>
          </Row>
        </div>

        {/* ---------------- 数学输入 ---------------- */}
        <div className="rounded-xl border border-ink-200 p-3">
          <SectionTitle>数学输入</SectionTitle>
          <Row label="自动补全">
            <label className="flex cursor-pointer items-start gap-2 text-[12px] text-ink-700">
              <input
                type="checkbox"
                checked={settings.autoSnippet}
                onChange={(e) => updateSettings({ autoSnippet: e.target.checked })}
                className="mt-0.5 h-3.5 w-3.5 accent-accent-600"
              />
              <span>
                公式里自动展开快捷输入（<code className="rounded bg-ink-100 px-1">//</code> 分式、
                <code className="rounded bg-ink-100 px-1">;a</code> 希腊字母、
                <code className="rounded bg-ink-100 px-1">x1</code> 下标……）
              </span>
            </label>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              关掉之后完全手敲：不会再有任何字符被替换，<code className="rounded bg-ink-100 px-1">_</code>、
              <code className="rounded bg-ink-100 px-1">^</code> 原样留在文档里。工具栏的符号面板与公式库不受影响。
            </p>
          </Row>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ---------------- 渲染结果 ---------------- */}
          <section>
            <SectionTitle>渲染结果（右栏 / 预览 / 导出）</SectionTitle>

            {/* ---------------- 字体搭配：默认固定搭配，也可以拆开自由配 ---------------- */}
            <Row label="字体搭配">
              <div className="grid grid-cols-3 gap-2">
                {FONT_PAIRINGS.map((p) => (
                  <ChoiceCard
                    key={p.key}
                    active={settings.fontPairing === p.key}
                    title={p.label}
                    note={p.note}
                    sampleStyle={{ fontFamily: p.sample }}
                    onClick={() => updateSettings(p.patch)}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                默认「论文」= 中文宋体 ＋ 西文 Times New Roman，环境标题黑体加粗，「证」楷体加粗、「解」跟正文加粗。
                Times 的字脚高度与宋体最接近，中英混排时基线不会一高一低；标题换黑体，是为了让「定理 2.1」从宋体正文里跳出来。
              </p>
              <button
                onClick={() => setShowRoles((v) => !v)}
                className="mt-1.5 text-[11.5px] text-accent-700 hover:underline"
              >
                {showRoles ? '收起自由搭配' : '不满意这套？逐项自由搭配'}
              </button>

              {showRoles && (
                <div className="mt-2 space-y-1.5 rounded-lg bg-ink-50/70 p-2.5">
                  <RolePicker
                    label="西文正文"
                    value={settings.bodyLatin}
                    options={LATIN_FONTS.map((f) => ({ v: f.key, label: f.label }))}
                    onChange={(v) => setRole({ bodyLatin: v as Settings['bodyLatin'] })}
                    custom={settings.bodyLatinCustom}
                    onCustom={(v) => setRole({ bodyLatinCustom: v, bodyLatin: 'custom' })}
                    placeholder="如 Minion Pro"
                  />
                  <RolePicker
                    label="环境标题"
                    value={settings.thmHeadFont}
                    options={ROLE_OPTIONS}
                    onChange={(v) => setRole({ thmHeadFont: v as RoleFontKey })}
                    custom={settings.thmHeadFontCustom}
                    onCustom={(v) => setRole({ thmHeadFontCustom: v, thmHeadFont: 'custom' })}
                    placeholder="如 方正小标宋"
                  />
                  <RolePicker
                    label="证明「证」"
                    value={settings.proofMarkFont}
                    options={ROLE_OPTIONS}
                    onChange={(v) => setRole({ proofMarkFont: v as RoleFontKey })}
                    custom={settings.proofMarkFontCustom}
                    onCustom={(v) => setRole({ proofMarkFontCustom: v, proofMarkFont: 'custom' })}
                  />
                  <RolePicker
                    label="解答「解」"
                    value={settings.solMarkFont}
                    options={ROLE_OPTIONS}
                    onChange={(v) => setRole({ solMarkFont: v as RoleFontKey })}
                    custom={settings.solMarkFontCustom}
                    onCustom={(v) => setRole({ solMarkFontCustom: v, solMarkFont: 'custom' })}
                  />
                  <p className="pt-0.5 text-[10.5px] leading-relaxed text-ink-400">
                    中文正文在下面单独选；标题、「证」、「解」始终加粗，这里只换字体族。改过任一项就记为「自定义」，三张预设卡片不再高亮。
                  </p>
                </div>
              )}
            </Row>

            <Row label="中文正文">
              <div className="grid grid-cols-2 gap-2">
                {PREVIEW_FONTS.map((f) => (
                  <ChoiceCard
                    key={f.key}
                    active={settings.previewFont === f.key}
                    title={f.label}
                    note={f.note}
                    sampleStyle={{ fontFamily: previewFontStack(f.key as PreviewFontKey) }}
                    onClick={() => setRole({ previewFont: f.key })}
                  />
                ))}
              </div>
            </Row>

            <Row label="自定义">
              <FontNameInput
                value={settings.previewFontCustom}
                placeholder="已装字体名，如 霞鹜文楷"
                onChange={(v) => setRole({ previewFontCustom: v })}
              />
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

            <Row label="导出字体">
              <FontNameInput
                value={settings.exportFontCustom}
                placeholder="留空则与上面一致"
                onChange={(v) => updateSettings({ exportFontCustom: v })}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                只作用于导出的 HTML / PDF。想让屏幕用黑体、交稿用宋体，就在这里单独填一个。
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

            <Row label="自定义">
              <FontNameInput
                value={settings.editorFontCustom}
                placeholder="等宽字体名，如 JetBrains Mono"
                onChange={(v) => updateSettings({ editorFontCustom: v })}
              />
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

            <div className="mt-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2">
              <div className="mb-1 text-[11px] font-medium text-ink-400">实时效果</div>
              <div className="mf-academic">
                <p style={{ margin: 0 }}>
                  设 <em>f(x) = ax² + bx + c</em>，当 Δ &gt; 0 时方程有两个不等实根。这段即正文最终的字号、行距与字重。
                </p>
              </div>
              <div
                className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-ink-700 ring-1 ring-ink-100"
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
                  定理正文用楷体（讲义风格；证明始终用正文字体，标题始终黑体）
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

        {/* ---------------- 论文版面 ---------------- */}
        <div className="rounded-xl border border-ink-200 p-3">
          <SectionTitle>论文版面（页边距 / 页眉页脚 / 编号）</SectionTitle>
          <div className="grid grid-cols-2 gap-x-6">
            <Row label="上下边距">
              <Slider
                value={settings.pageMarginY}
                min={10}
                max={40}
                step={1}
                suffix="mm"
                onChange={(v) => updateSettings({ pageMarginY: v })}
              />
            </Row>
            <Row label="左右边距">
              <Slider
                value={settings.pageMarginX}
                min={10}
                max={40}
                step={1}
                suffix="mm"
                onChange={(v) => updateSettings({ pageMarginX: v })}
              />
            </Row>
          </div>

          {/* 页码单独占一行：四个选项并排放得下，不会掉到下一行去 */}
          <Row label="页码">
            <Pills
              value={settings.pageNumber}
              options={[
                { v: 'none' as const, label: '不要' },
                { v: 'plain' as const, label: '1' },
                { v: 'dash' as const, label: '— 1 —' },
                { v: 'slash' as const, label: '1 / N' },
              ]}
              onChange={(v) => updateSettings({ pageNumber: v })}
            />
          </Row>

          <div className="grid grid-cols-2 gap-x-6">
            <Row label="页眉">
              <input
                value={settings.pageHeader}
                onChange={(e) => updateSettings({ pageHeader: e.target.value })}
                placeholder="留空则不显示"
                className="h-7 w-full rounded-lg border border-ink-200 px-2 text-[12px] outline-none focus:border-accent-400"
              />
            </Row>
            <Row label="页脚">
              <input
                value={settings.pageFooter}
                onChange={(e) => updateSettings({ pageFooter: e.target.value })}
                placeholder="留空则不显示"
                className="h-7 w-full rounded-lg border border-ink-200 px-2 text-[12px] outline-none focus:border-accent-400"
              />
            </Row>
          </div>

          <div className="grid grid-cols-2 gap-x-6">
            <Row label="标题编号">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-700">
                <input
                  type="checkbox"
                  checked={settings.headingNumbering}
                  onChange={(e) => updateSettings({ headingNumbering: e.target.checked })}
                  className="h-3.5 w-3.5 accent-accent-600"
                />
                给 # / ## / ### 自动编号（1 / 1.1 / 1.1.1）
              </label>
            </Row>
            <Row label="图表编号">
              <Pills
                value={settings.figNumbering}
                options={[
                  { v: 'section' as const, label: '按节：图 1.1' },
                  { v: 'global' as const, label: '连续：图 1' },
                ]}
                onChange={(v) => updateSettings({ figNumbering: v })}
              />
            </Row>
          </div>

          <p className="text-[11px] leading-relaxed text-ink-400">
            页眉页脚里可以写 <code className="rounded bg-ink-100 px-1">{'{page}'}</code>、
            <code className="rounded bg-ink-100 px-1">{'{total}'}</code>、
            <code className="rounded bg-ink-100 px-1">{'{title}'}</code> 三个占位符。
            阅读模式的纸面、导出的网页与打印出的 PDF 用的是同一组数值，改完三处一起变。
          </p>
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

/** 三个「字体角色」共同的选项：只换字体族，加粗是写死的 */
const ROLE_OPTIONS = [
  { v: 'sans', label: '黑体' },
  { v: 'kai', label: '楷体' },
  { v: 'serif', label: '正文' },
]

/**
 * 一个字体角色（正文中文 / 正文西文 / 环境标题 /「证」/「解」）的选择行。
 * 选「自定义」时才展开字体名输入框，平时保持一行，不把面板撑高。
 */
function RolePicker({
  label,
  value,
  options,
  onChange,
  custom,
  onCustom,
  placeholder,
}: {
  label: string
  value: string
  options: Array<{ v: string; label: string }>
  onChange: (v: string) => void
  custom?: string
  onCustom?: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="w-[60px] shrink-0 text-[11.5px] text-ink-500">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-full rounded-md border border-ink-200 bg-surface px-1 text-[11.5px] text-ink-700 outline-none focus:border-accent-400"
        >
          {options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
          {onCustom && <option value="custom">自定义…</option>}
        </select>
      </div>
      {onCustom && value === 'custom' && (
        <div className="mt-1 pl-[66px]">
          <FontNameInput value={custom ?? ''} placeholder={placeholder ?? '字体名'} onChange={onCustom} />
        </div>
      )}
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
        active ? 'border-accent-400 bg-accent-50/60 ring-1 ring-accent-200' : 'border-ink-200 bg-surface hover:bg-ink-50'
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

/**
 * 自定义字体名输入 + 「检测」。
 * 预设之外总有漏网之鱼（自己装的霞鹜文楷、公司规范字体……），
 * 直接填名字即可；检测按钮用画布量宽度判断系统里到底有没有，
 * 免得填错名字后一头雾水地以为是软件坏了。
 */
function FontNameInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'ok' | 'missing'>('idle')

  const probe = () => {
    if (!value.trim()) {
      setStatus('idle')
      return
    }
    setStatus(isFontAvailable(value) ? 'ok' : 'missing')
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setStatus('idle')
          }}
          onBlur={probe}
          placeholder={placeholder}
          className="h-7 w-full min-w-0 rounded-lg border border-ink-200 px-2 text-[12px] outline-none focus:border-accent-400"
        />
        <button
          onClick={probe}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-ink-500 ring-1 ring-ink-200 transition hover:bg-ink-50"
        >
          检测
        </button>
      </div>
      {status === 'ok' && (
        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-emerald-600">
          <Check size={10} /> 系统里有这个字体，已生效
        </p>
      )}
      {status === 'missing' && (
        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-amber-600">
          <TriangleAlert size={10} /> 没找到这个名字，会退回预设字体
        </p>
      )}
    </div>
  )
}
