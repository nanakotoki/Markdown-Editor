/**
 * ============================================================================
 *  workspaceRefs.ts —— 跨文件标签索引 → RefEntry
 * ----------------------------------------------------------------------------
 *  这份映射同时被两处使用：
 *   1. 前端（本地模式）把工作区索引变成补全与预览能用的 RefEntry；
 *   2. Node 端批量导出时，让 HTML 产物里的跨文件引用也带文件名徽标。
 *  放在 core 里而不是 store 里，是为了让 CLI 打包时不必把 React/Zustand 拖进来。
 * ============================================================================
 */
import type { RefEntry } from './renderMarkdown'

export interface LabelLike {
  /** 定义该标签的文件（工作区相对路径） */
  file: string
  /** thm / lem / def / eq / alg / sec … */
  kind: string
  /** 裸 id，不含 kind: 前缀 */
  id: string
  /** 目标文件里的 DOM 锚点（原始 id 把冒号换成短横线）；缺省时按 id 推导 */
  anchor?: string
  /** 标题或说明，可能为空 */
  label?: string
}

const KIND_CN: Record<string, string> = {
  eq: '式',
  thm: '定理',
  lem: '引理',
  def: '定义',
  prop: '命题',
  cor: '推论',
  exa: '例题',
  prf: '证明',
  alg: '算法',
  sec: '节',
}

/**
 * 把标签索引转成 RefEntry 列表。
 * @param labels    整个工作区的标签
 * @param excludeFile 要排除的文件（当前文件，它自己的引用由渲染管线提供，信息更完整）
 */
export function labelsToRefEntries(labels: LabelLike[], excludeFile?: string): RefEntry[] {
  return labels
    .filter((l) => l.file !== excludeFile)
    .map<RefEntry>((l) => {
      const cn = KIND_CN[l.kind] ?? ''
      const title = (l.label ?? '').trim()
      const named = title && title !== l.id && title !== cn
      let label: string
      if (l.kind === 'eq') label = cn || '式'
      else if (!cn) label = named ? title : l.kind
      else label = named ? `${cn}「${title.length > 18 ? `${title.slice(0, 18)}…` : title}」` : cn
      return {
        kind: l.kind as RefEntry['kind'],
        id: l.id,
        anchor: `${l.file}#${l.anchor ?? l.id.replace(/:/g, '-')}`,
        label,
        detail: l.file,
        file: l.file,
      }
    })
}
