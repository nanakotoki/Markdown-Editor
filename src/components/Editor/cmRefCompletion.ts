import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { LATEX_COMMANDS, type MacroMap } from '../../core/katexSafeRender'
import { GREEK_MAP } from '../../core/snippetRules'
import type { RefEntry } from '../../core/renderMarkdown'
import type { BibEntry } from '../../store/useEditorStore'

/**
 * ============================================================================
 *  cmRefCompletion.ts —— 自动补全
 * ----------------------------------------------------------------------------
 *   @eq:xxx / @thm:xxx   全文交叉引用联想（公式、定理、算法、章节）
 *   [@key]               BibTeX 文献联想
 *   \fra                  LaTeX 命令补全（带中文释义）
 *   ;a                    希腊字母
 * ============================================================================
 */

export interface CompletionDeps {
  getRefs: () => RefEntry[]
  getBib: () => BibEntry[]
  getMacros: () => MacroMap
}

const KIND_LABEL: Record<string, string> = {
  eq: '公式',
  thm: '定理',
  lem: '引理',
  def: '定义',
  prop: '命题',
  cor: '推论',
  exa: '例题',
  prf: '证明',
  alg: '算法',
  sec: '章节',
  cite: '文献',
  fig: '图',
  tab: '表',
}

export function refCompletion(deps: CompletionDeps) {
  return autocompletion({
    activateOnTyping: true,
    icons: false,
    maxRenderedOptions: 80,
    override: [
      (ctx: CompletionContext): CompletionResult | null => {
        const text = ctx.state.doc.toString()

        /* ---- [@文献key] ---- */
        const cite = ctx.matchBefore(/\[@[A-Za-z0-9_\-:.]*$/)
        if (cite) {
          const typed = cite.text.slice(2).toLowerCase()
          const options = deps
            .getBib()
            .filter((b) => !typed || b.key.toLowerCase().includes(typed) || b.title.toLowerCase().includes(typed))
            .map((b) => ({
              label: b.key,
              detail: `${b.author.split(' and ')[0]} ${b.year}`,
              info: b.title,
              type: 'variable',
              apply: `[@${b.key}]`,
            }))
          return { from: cite.from, options, validFor: /^\[@[A-Za-z0-9_\-:.]*$/ }
        }

        /* ---- @ 交叉引用 ---- */
        const ref = ctx.matchBefore(/@[A-Za-z0-9_\-:.]*$/)
        if (ref) {
          const typedRaw = ref.text.slice(1)
          const typed = typedRaw.toLowerCase()
          const refs = deps.getRefs()
          const options = refs
            .filter((r) => {
              if (!typed) return true
              const full = `${r.kind}:${r.id}`.toLowerCase()
              return full.includes(typed) || r.label.toLowerCase().includes(typed) || (r.detail ?? '').toLowerCase().includes(typed)
            })
            .slice(0, 60)
            .map((r) => ({
              label: `${KIND_LABEL[r.kind] ?? r.kind} · ${r.label}${r.id.startsWith('sec-') ? '' : '  @' + r.kind + ':' + r.id}`,
              detail: r.detail?.slice(0, 30),
              type: 'keyword',
              apply: () => `@${r.kind}:${r.id}`,
            }))
          if (!options.length && typed.length === 0 && !ctx.explicit) return null
          return { from: ref.from, options, validFor: /^@[A-Za-z0-9_\-:.]*$/ }
        }

        /* ---- LaTeX 命令 ---- */
        const cmd = ctx.matchBefore(/\\[a-zA-Z]*$/)
        if (cmd) {
          const typed = cmd.text.slice(1).toLowerCase()
          const options = LATEX_COMMANDS.filter((c) => !typed || c.cmd.toLowerCase().startsWith(typed))
            .slice(0, 60)
            .map((c) => ({
              label: `\\${c.cmd}`,
              detail: c.desc,
              type: 'function',
              apply: `\\${c.cmd}${['begin', 'end', 'text', 'mathbb', 'mathcal', 'mathrm', 'operatorname'].includes(c.cmd) ? '{' : ''}`,
            }))
          if (!options.length) return null
          return { from: cmd.from, options, validFor: /^\\[a-zA-Z]*$/ }
        }

        /* ---- 希腊字母 ---- */
        const greek = ctx.matchBefore(/;[a-zA-Z]$/)
        if (greek) {
          const options = Object.entries(GREEK_MAP).map(([k, v]) => ({
            label: `;${k}`,
            detail: v,
            type: 'constant',
            apply: `${v} `,
          }))
          return { from: greek.from, options }
        }

        // 触发未知时也保持沉默，避免干扰写作
        void text
        return null
      },
    ],
  })
}
