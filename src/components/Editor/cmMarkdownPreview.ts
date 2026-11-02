import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state'
import { scanMath } from '../../core/katexSafeRender'
import { renderMarkdown } from '../../core/renderMarkdown'

/**
 * ============================================================================
 *  cmMarkdownPreview.ts —— 行内混合模式的 Markdown 标记隐藏
 * ----------------------------------------------------------------------------
 *  光标不在该行 / 该片段时隐藏 `#`、`>`、`**`、`*`、`~~`、`` ` `` 等标记，
 *  只留下排版后的正文（字号、字重由 HighlightStyle 提供）。
 *  光标一旦进入，立刻恢复源码，保证可编辑性。
 * ============================================================================
 */

const hide = Decoration.replace({})

/** 独占一行的 `:::` 闭合标记：整行折叠为零高度，避免留下空行 */
class CollapsedLine extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-collapsed-mark'
    return el
  }
  ignoreEvent() {
    return true
  }
}
const collapseLine = Decoration.replace({ widget: new CollapsedLine(), block: true })

/**
 * 表格块：光标不在里面时整块渲染成三线表。
 * 直接复用预览那套渲染器，保证编辑区和右侧预览长得一样。
 */
class TableWidget extends WidgetType {
  constructor(readonly src: string) {
    super()
  }
  eq(other: TableWidget) {
    return other.src === this.src
  }
  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'cm-block-widget'
    try {
      wrap.innerHTML = renderMarkdown(this.src).html
    } catch {
      wrap.textContent = this.src
    }
    return wrap
  }
  /** 返回 false：让点击落到编辑器上，光标进区间后自动展开成源码 */
  ignoreEvent() {
    return false
  }
}

interface Item {
  from: number
  to: number
  deco: Decoration
}

function overlaps(from: number, to: number, a: number, b: number): boolean {
  return a < to && b > from
}

function build(state: EditorState): DecorationSet {
  const items: Item[] = []
  const doc = state.doc
  const sel = state.selection.main
  const text = doc.toString()
  const mathRanges = scanMath(text)

  const inMath = (from: number, to: number) => mathRanges.some((r) => overlaps(from, to, r.from, r.to))

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const raw = line.text
    if (!raw.trim()) continue
    const lineTouched = overlaps(line.from, line.to, sel.from, sel.to) && (sel.from !== sel.to || (sel.head >= line.from && sel.head <= line.to))

    // 表格块：整块渲染（第二行必须是 |---|---| 分隔行）
    if (/^\s*\|.*\|\s*$/.test(raw) && i < doc.lines && /^\s*\|[\s:|-]+\|\s*$/.test(doc.line(i + 1).text)) {
      let last = i + 1
      while (last < doc.lines && /^\s*\|.*\|\s*$/.test(doc.line(last + 1).text)) last++
      const from = line.from
      const to = doc.line(last).to
      if (!overlaps(from, to, sel.from, sel.to)) {
        items.push({
          from,
          to,
          deco: Decoration.replace({ block: true, widget: new TableWidget(doc.sliceString(from, to)) }),
        })
      }
      i = last
      continue
    }

    // 标题 ###
    const heading = /^(#{1,6})(\s+)/.exec(raw)
    if (heading && !lineTouched) {
      items.push({ from: line.from, to: line.from + heading[0].length, deco: hide })
    }

    // 引用 >
    const quote = /^(>\s?)/.exec(raw)
    if (quote && !lineTouched) {
      items.push({ from: line.from, to: line.from + quote[0].length, deco: hide })
    }

    // ::: 容器：隐藏标记，只留标签
    if (/^:::/.test(raw)) {
      const open = /^:::+\s*([A-Za-z][\w-]*)\s*(\[[^\]]*\])?\s*(\{[^}]*\})?\s*$/.exec(raw)
      if (!lineTouched) {
        if (!open) {
          // 单独的闭合 ::: 整行折叠（光标进入该行时恢复源码）
          if (!lineTouched) items.push({ from: line.from, to: line.to, deco: collapseLine })
        } else {
          const markerLen = raw.length - raw.replace(/^:::+\s*/, '').length
          items.push({ from: line.from, to: line.from + markerLen, deco: hide })
          const attr = /\{[^}]*\}\s*$/.exec(raw)
          const bodyFrom = line.from + markerLen
          const bodyTo = attr ? line.from + attr.index : line.to
          const body = raw.slice(markerLen, attr ? attr.index : raw.length)
          // `::: theorem [拉格朗日中值定理]` —— 方括号隐藏，只给标题加标签样式
          const title = /\[([^\]\n]*)\]\s*$/.exec(body)
          if (title && title.index > 0) {
            const titleFrom = bodyFrom + title.index
            const nameEnd = bodyFrom + body.slice(0, title.index).trimEnd().length
            const innerFrom = titleFrom + 1
            const innerTo = titleFrom + title[0].trimEnd().length - 1
            const labelDeco = Decoration.mark({ class: 'cm-directive-label' })
            if (nameEnd > bodyFrom) items.push({ from: bodyFrom, to: nameEnd, deco: labelDeco })
            items.push({ from: nameEnd, to: innerFrom, deco: hide })
            if (innerTo > innerFrom) items.push({ from: innerFrom, to: innerTo, deco: labelDeco })
            if (bodyTo > innerTo) items.push({ from: innerTo, to: bodyTo, deco: hide })
          } else {
            const nameEnd = bodyFrom + body.trimEnd().length
            items.push({ from: bodyFrom, to: nameEnd, deco: Decoration.mark({ class: 'cm-directive-label' }) })
            if (nameEnd < bodyTo) items.push({ from: nameEnd, to: bodyTo, deco: hide })
          }
          if (attr) {
            items.push({ from: line.from + attr.index, to: line.to, deco: hide })
          }
        }
      }
    }

    // 行内强调符号
    const patterns: Array<{ re: RegExp; marker: number }> = [
      { re: /\*\*([^*\n]+)\*\*/g, marker: 2 },
      { re: /(?<!\*)\*([^*\n]+)\*(?!\*)/g, marker: 1 },
      { re: /~~([^~\n]+)~~/g, marker: 2 },
      { re: /`([^`\n]+)`/g, marker: 1 },
    ]
    for (const { re, marker } of patterns) {
      let m: RegExpExecArray | null
      while ((m = re.exec(raw))) {
        const start = line.from + m.index
        const end = start + m[0].length
        if (inMath(start, end)) continue
        const headFrom = start
        const headTo = start + marker
        const tailFrom = end - marker
        const tailTo = end
        if (!overlaps(headFrom, headTo, sel.from, sel.to)) items.push({ from: headFrom, to: headTo, deco: hide })
        if (!overlaps(tailFrom, tailTo, sel.from, sel.to)) items.push({ from: tailFrom, to: tailTo, deco: hide })
      }
    }

    // 交叉引用 @kind:id 与文献引用 [@key]：源码保持可编辑，但给出可读的胶囊样式
    const refRe = /@(?:thm|eq|fig|tab|alg|sec|def|lem|cor|prop|ex):[A-Za-z0-9_\u4e00-\u9fa5-]+/g
    let rm: RegExpExecArray | null
    while ((rm = refRe.exec(raw))) {
      const start = line.from + rm.index
      const end = start + rm[0].length
      if (inMath(start, end)) continue
      items.push({ from: start, to: end, deco: Decoration.mark({ class: 'cm-ref-chip' }) })
    }
    const citeRe = /\[@[^\]\n]{1,120}\]/g
    while ((rm = citeRe.exec(raw))) {
      const start = line.from + rm.index
      const end = start + rm[0].length
      if (inMath(start, end)) continue
      items.push({ from: start, to: end, deco: Decoration.mark({ class: 'cm-cite-chip' }) })
    }
  }

  items.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const it of items) {
    if (it.from < lastTo || it.from > it.to) continue
    builder.add(it.from, it.to, it.deco)
    lastTo = it.to
  }
  return builder.finish()
}

export function markdownPreviewPlugin() {
  return StateField.define<DecorationSet>({
    create: (state) => build(state),
    update(value, tr) {
      if (tr.docChanged || tr.selection) return build(tr.state)
      return value.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}

/**
 * 内联模式下标题标记被隐藏，光标按 Home 会落在「视觉行首」——
 * 但逻辑上它在 `## ` 之后，此时再输入 `#` 就会变成 `## ## 标题`，
 * 预览里于是冒出一个多余的井号。这里把这种输入解释为「升级标题级别」。
 */
export function markdownSmartInput() {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== '#' || from !== to) return false
    const line = view.state.doc.lineAt(from)
    const m = /^(#{1,6})([ \t]+)/.exec(line.text)
    if (!m) return false
    const markerTo = line.from + m[1].length
    // 只在「紧跟被隐藏的标记」这一位置生效，正文中间的 # 照常输入
    if (from !== markerTo) return false
    const depth = Math.min(6, m[1].length + 1)
    view.dispatch({
      changes: { from: line.from, to: markerTo, insert: '#'.repeat(depth) },
      selection: { anchor: line.from + depth },
    })
    return true
  })
}
