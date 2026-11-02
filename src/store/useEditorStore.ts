import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import doc1 from '../samples/doc1-math.md?raw'
import doc2 from '../samples/doc2-algorithm.md?raw'
import doc3 from '../samples/doc3-sandbox.md?raw'
import type { MacroDef } from '../core/katexSafeRender'
import type { FormulaEntry } from '../core/formulaLibrary'
import type { RefEntry } from '../core/renderMarkdown'
import { labelsToRefEntries } from '../core/workspaceRefs'
import {
  baseName,
  createFile as apiCreateFile,
  deleteFile as apiDeleteFile,
  detectWorkspace,
  fetchIndex,
  fetchTree,
  moveFile as apiMoveFile,
  pathToDocId,
  parentDir,
  readFile as apiReadFile,
  watchWorkspace,
  writeFile as apiWriteFile,
  type IndexedBib,
  type IndexedLabel,
  type RunMode,
  type TreeNode,
  type WorkspaceInfo,
} from '../core/workspaceApi'

export type ViewMode = 'hybrid' | 'split' | 'source'
export type ModalName =
  | 'matrix'
  | 'truth'
  | 'hand'
  | 'plot'
  | 'ai'
  | 'palette'
  | 'macro'
  | 'export'
  | 'bib'
  | 'cheatsheet'
  | 'manual'
  | 'search'
  | null

export type SidebarTab = 'docs' | 'outline' | 'favorites' | 'bib'
/** 单个文件相对磁盘的同步状态 */
export type FileState = 'clean' | 'dirty' | 'saving' | 'conflict' | 'error'

export interface DocNode {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  /** 本地模式下的工作区相对路径，如 `chapters/intro.md` */
  filePath?: string
  /** 最近一次成功写盘时的内容哈希，用于乐观并发检测 */
  hash?: string
}

export interface FavoriteFormula {
  id: string
  name: string
  latex: string
  tags: string[]
  createdAt: number
}

export interface BibEntry {
  id: string
  key: string
  type: string
  author: string
  title: string
  year: string
  journal: string
  raw: string
}

export interface AIConfig {
  provider: 'openai' | 'deepseek' | 'gemini' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
  visionModel: string
}

export interface Settings {
  autoNumberEquations: boolean
  citationStyle: 'numeric' | 'author-year'
  texTemplate: 'ctexart' | 'ctexbook' | 'article' | 'IEEEtran'
  showLineNumbers: boolean
}

const now = Date.now()

const seedDocs: DocNode[] = [
  {
    id: 'doc-math',
    title: '高等数学与线性代数混合排版示例',
    content: doc1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'doc-algo',
    title: '算法设计与离散数学课程报告',
    content: doc2,
    createdAt: now - 1000,
    updatedAt: now - 1000,
  },
  {
    id: 'doc-sandbox',
    title: '容错诊断与快捷输入沙盒',
    content: doc3,
    createdAt: now - 2000,
    updatedAt: now - 2000,
  },
]

const seedBib: BibEntry[] = [
  {
    id: 'bib-1',
    key: 'knuth1984',
    type: 'book',
    author: 'Knuth, Donald E.',
    title: 'The TeXbook',
    year: '1984',
    journal: 'Addison-Wesley',
    raw: '@book{knuth1984,\n  author = {Knuth, Donald E.},\n  title = {The TeXbook},\n  year = {1984},\n  publisher = {Addison-Wesley}\n}',
  },
  {
    id: 'bib-2',
    key: 'bringhurst2004',
    type: 'book',
    author: 'Bringhurst, Robert',
    title: 'The Elements of Typographic Style',
    year: '2004',
    journal: 'Hartley & Marks',
    raw: '@book{bringhurst2004,\n  author = {Bringhurst, Robert},\n  title = {The Elements of Typographic Style},\n  year = {2004},\n  publisher = {Hartley & Marks}\n}',
  },
  {
    id: 'bib-3',
    key: 'cormen2022',
    type: 'book',
    author: 'Cormen, Thomas H. and Leiserson, Charles E. and Rivest, Ronald L. and Stein, Clifford',
    title: 'Introduction to Algorithms',
    year: '2022',
    journal: 'MIT Press',
    raw: '@book{cormen2022,\n  author = {Cormen, Thomas H. and Leiserson, Charles E. and Rivest, Ronald L. and Stein, Clifford},\n  title = {Introduction to Algorithms},\n  year = {2022},\n  publisher = {MIT Press}\n}',
  },
]

/* ------------------------------------------------------------------ */
/* 自动保存调度                                                        */
/* ------------------------------------------------------------------ */

const SAVE_DELAY = 800
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSave(id: string, delay = SAVE_DELAY) {
  const prev = saveTimers.get(id)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => {
    saveTimers.delete(id)
    void useEditorStore.getState().saveDoc(id)
  }, delay)
  saveTimers.set(id, timer)
}

function cancelSave(id: string) {
  const t = saveTimers.get(id)
  if (t) {
    clearTimeout(t)
    saveTimers.delete(id)
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

interface EditorState {
  /** 运行形态：本地文件服务 / 纯浏览器沙盒 */
  mode: RunMode
  workspace: WorkspaceInfo | null
  /** 工作区文件树（本地模式） */
  tree: TreeNode[]
  /** 已打开文件的标签页（doc id 顺序） */
  openTabs: string[]
  /** 每个文件的磁盘同步状态 */
  fileState: Record<string, FileState>
  /** 工作区级索引：跨文件交叉引用 + 文献库 */
  indexLabels: IndexedLabel[]
  indexBib: IndexedBib[]
  /** 首次加载是否完成（避免启动瞬间闪出示例文档） */
  booted: boolean
  bootError: string | null

  docs: DocNode[]
  activeDocId: string
  viewMode: ViewMode
  modal: ModalName
  sidebarOpen: boolean
  sidebarTab: SidebarTab
  macros: MacroDef[]
  macroSource: string
  bibEntries: BibEntry[]
  favorites: FavoriteFormula[]
  aiConfig: AIConfig
  settings: Settings
  /** 编辑器内最后一次同步的全文（供大纲、导出、补全使用） */
  liveContent: string
  toast: { id: number; text: string; kind: 'info' | 'success' | 'warn' } | null

  boot: () => Promise<void>
  refreshTree: () => Promise<void>
  refreshIndex: () => Promise<void>
  openFile: (path: string) => Promise<void>
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  saveDoc: (id: string, force?: boolean) => Promise<void>
  reloadDoc: (id: string) => Promise<void>
  createLocalDoc: (dir?: string, name?: string) => Promise<string | null>
  deleteLocalDoc: (id: string) => Promise<void>
  /** 按路径删除（文件树右键用：未打开过的文件不在 docs 里） */
  deleteLocalPath: (path: string) => Promise<void>
  renameLocalDoc: (id: string, name: string) => Promise<void>
  applyExternalChange: (paths: string[]) => void
  workspaceRefs: () => RefEntry[]
  workspaceBib: () => BibEntry[]

  setActiveDoc: (id: string) => void
  updateContent: (id: string, content: string) => void
  createDoc: (title?: string, content?: string) => string
  deleteDoc: (id: string) => void
  renameDoc: (id: string, title: string) => void
  setViewMode: (m: ViewMode) => void
  openModal: (m: ModalName) => void
  toggleSidebar: () => void
  setSidebarTab: (t: SidebarTab) => void
  setMacros: (defs: MacroDef[], source: string) => void
  upsertBib: (entry: BibEntry) => void
  removeBib: (id: string) => void
  addFavorite: (f: Omit<FavoriteFormula, 'id' | 'createdAt'>) => void
  removeFavorite: (id: string) => void
  addLibraryFormula: (f: FormulaEntry) => void
  setAIConfig: (c: Partial<AIConfig>) => void
  updateSettings: (s: Partial<Settings>) => void
  setLiveContent: (c: string) => void
  showToast: (text: string, kind?: 'info' | 'success' | 'warn') => void
  activeDoc: () => DocNode
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      mode: 'sandbox',
      workspace: null,
      tree: [],
      openTabs: seedDocs.map((d) => d.id),
      fileState: {},
      indexLabels: [],
      indexBib: [],
      booted: false,
      bootError: null,

      docs: seedDocs,
      activeDocId: seedDocs[0].id,
      viewMode: 'hybrid',
      modal: null,
      sidebarOpen: true,
      sidebarTab: 'docs',
      macros: [],
      macroSource: '',
      bibEntries: seedBib,
      favorites: [],
      aiConfig: {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        model: 'deepseek-chat',
        visionModel: 'gpt-4o-mini',
      },
      settings: {
        autoNumberEquations: true,
        citationStyle: 'numeric',
        texTemplate: 'ctexart',
        showLineNumbers: true,
      },
      liveContent: seedDocs[0].content,
      toast: null,

      /* ---------------- 启动 ---------------- */

      boot: async () => {
        const info = await detectWorkspace()

        if (!info) {
          // 静态部署：沿用 localStorage 里的沙盒文档
          set({ mode: 'sandbox', booted: true, workspace: null })
          const s = get()
          const active = s.docs.find((d) => d.id === s.activeDocId) ?? s.docs[0]
          set({
            liveContent: active?.content ?? '',
            activeDocId: active?.id ?? '',
            openTabs: s.openTabs.filter((id) => s.docs.some((d) => d.id === id)),
          })
          return
        }

        // 本地模式：文档以磁盘为准，示例文档只作为「新建时」的模板
        set({
          mode: 'local',
          workspace: info,
          docs: [],
          openTabs: [],
          activeDocId: '',
          liveContent: '',
          fileState: {},
        })

        try {
          const [tree, index] = await Promise.all([fetchTree(), fetchIndex()])
          set({ tree, indexLabels: index.labels, indexBib: index.bib })

          const first = findFirstDoc(tree)
          const params = new URLSearchParams(window.location.search)
          const wanted = params.get('file')
          if (wanted) await get().openFile(wanted)
          else if (first) await get().openFile(first)

          set({ booted: true, bootError: null })
          // 文件监听延后建立：首屏渲染优先，也避免个别浏览器把长连接算进加载进度
          setTimeout(subscribeToWorkspace, 1200)
        } catch (e: any) {
          set({ booted: true, bootError: e?.message ?? '工作区加载失败' })
        }
      },

      refreshTree: async () => {
        if (get().mode !== 'local') return
        try {
          set({ tree: await fetchTree() })
        } catch {
          /* 树刷新失败不打断写作 */
        }
      },

      refreshIndex: async () => {
        if (get().mode !== 'local') return
        try {
          const index = await fetchIndex()
          set({ indexLabels: index.labels, indexBib: index.bib })
        } catch {
          /* ignore */
        }
      },

      /* ---------------- 文件 ---------------- */

      openFile: async (path) => {
        if (get().mode !== 'local') return
        const id = pathToDocId(path)
        const existing = get().docs.find((d) => d.id === id)
        if (existing) {
          set((s) => ({
            activeDocId: id,
            liveContent: existing.content,
            openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
            sidebarTab: 'docs',
          }))
          return
        }

        try {
          const file = await apiReadFile(path)
          const doc: DocNode = {
            id,
            title: baseName(path),
            content: file.content,
            createdAt: file.mtime,
            updatedAt: file.mtime,
            filePath: path,
            hash: file.hash,
          }
          set((s) => ({
            docs: [...s.docs, doc],
            activeDocId: id,
            liveContent: file.content,
            openTabs: [...s.openTabs, id],
            fileState: { ...s.fileState, [id]: 'clean' },
          }))
        } catch (e: any) {
          get().showToast(e?.message ?? `打开失败：${path}`, 'warn')
        }
      },

      closeTab: (id) => {
        const { openTabs, docs, activeDocId } = get()
        if (openTabs.length <= 1) return
        const idx = openTabs.indexOf(id)
        const nextTabs = openTabs.filter((t) => t !== id)
        const nextActive = id === activeDocId ? nextTabs[Math.max(0, idx - 1)] : activeDocId
        cancelSave(id)
        const nextDoc = docs.find((d) => d.id === nextActive)
        set({
          openTabs: nextTabs,
          activeDocId: nextActive,
          liveContent: nextDoc?.content ?? '',
          docs: docs.filter((d) => d.id !== id || d.filePath === undefined),
        })
      },

      closeOtherTabs: (id) => {
        const { docs, openTabs } = get()
        const keep = docs.find((d) => d.id === id)
        // 只关掉「已经从磁盘打开过的」文档，未保存的沙盒文档保留
        set({
          openTabs: [id],
          activeDocId: id,
          liveContent: keep?.content ?? '',
          docs: docs.filter((d) => d.id === id || !openTabs.includes(d.id) || d.filePath === undefined),
        })
      },

      saveDoc: async (id, force) => {
        const state = get()
        if (state.mode !== 'local') return
        const doc = state.docs.find((d) => d.id === id)
        if (!doc?.filePath) return
        if (state.workspace?.readonly) {
          set((s) => ({ fileState: { ...s.fileState, [id]: 'error' } }))
          return
        }
        if (state.fileState[id] === 'conflict' && !force) return

        set((s) => ({ fileState: { ...s.fileState, [id]: 'saving' } }))
        try {
          const res = await apiWriteFile(doc.filePath, doc.content, force ? undefined : doc.hash)
          if (res.conflict) {
            set((s) => ({ fileState: { ...s.fileState, [id]: 'conflict' } }))
            get().showToast(`${doc.title} 在磁盘上已被其他程序修改`, 'warn')
            return
          }
          set((s) => ({
            fileState: { ...s.fileState, [id]: 'clean' },
            docs: s.docs.map((d) => (d.id === id ? { ...d, hash: res.hash, updatedAt: Date.now() } : d)),
          }))
          void get().refreshTree()
        } catch (e: any) {
          set((s) => ({ fileState: { ...s.fileState, [id]: 'error' } }))
          get().showToast(`保存失败：${e?.message ?? '未知错误'}`, 'warn')
        }
      },

      reloadDoc: async (id) => {
        const doc = get().docs.find((d) => d.id === id)
        if (!doc?.filePath) return
        try {
          const file = await apiReadFile(doc.filePath)
          set((s) => ({
            docs: s.docs.map((d) =>
              d.id === id ? { ...d, content: file.content, hash: file.hash, updatedAt: file.mtime } : d
            ),
            liveContent: s.activeDocId === id ? file.content : s.liveContent,
            fileState: { ...s.fileState, [id]: 'clean' },
          }))
          get().showToast('已重新载入磁盘内容', 'success')
        } catch (e: any) {
          get().showToast(e?.message ?? '载入失败', 'warn')
        }
      },

      createLocalDoc: async (dir = '', name) => {
        if (get().mode !== 'local') return null
        const base = name?.trim() || '未命名文档'
        const fileName = /\.(md|markdown|mdx)$/i.test(base) ? base : `${base}.md`
        let target = dir ? `${dir}/${fileName}` : fileName
        // 同名时自动加序号，避免直接报错打断思绪
        let n = 1
        while (findNode(get().tree, target)) {
          n++
          target = dir ? `${dir}/${fileName.replace(/\.md$/i, '')}-${n}.md` : `${fileName.replace(/\.md$/i, '')}-${n}.md`
        }
        try {
          await apiCreateFile(target, `# ${base.replace(/\.md$/i, '')}\n\n从这里开始写作。\n\n$$\nE = mc^2\n$$\n`)
          await get().refreshTree()
          await get().openFile(target)
          void get().refreshIndex()
          return target
        } catch (e: any) {
          get().showToast(e?.message ?? '新建失败', 'warn')
          return null
        }
      },

      deleteLocalDoc: async (id) => {
        const doc = get().docs.find((d) => d.id === id)
        if (!doc?.filePath) return
        try {
          const res = await apiDeleteFile(doc.filePath)
          cancelSave(id)
          set((s) => {
            const openTabs = s.openTabs.filter((t) => t !== id)
            const nextActive = openTabs[0] ?? ''
            return {
              docs: s.docs.filter((d) => d.id !== id),
              openTabs,
              activeDocId: s.activeDocId === id ? nextActive : s.activeDocId,
              liveContent: s.activeDocId === id ? (s.docs.find((d) => d.id === nextActive)?.content ?? '') : s.liveContent,
            }
          })
          await get().refreshTree()
          void get().refreshIndex()
          const name = doc.filePath.split('/').pop()
          get().showToast(`已移入 .mathflow-trash（可恢复）：${name}`, 'success')
          void res
        } catch (e: any) {
          get().showToast(e?.message ?? '删除失败', 'warn')
        }
      },

      deleteLocalPath: async (path) => {
        const id = pathToDocId(path)
        const opened = get().docs.find((d) => d.id === id || d.filePath === path)
        if (opened) {
          await get().deleteLocalDoc(opened.id)
          return
        }
        try {
          await apiDeleteFile(path)
          await get().refreshTree()
          void get().refreshIndex()
          get().showToast(`已移入 .mathflow-trash（可恢复）：${baseName(path)}`, 'success')
        } catch (e: any) {
          get().showToast(e?.message ?? '删除失败', 'warn')
        }
      },

      renameLocalDoc: async (id, name) => {
        const doc = get().docs.find((d) => d.id === id)
        if (!doc?.filePath) {
          get().renameDoc(id, name)
          return
        }
        const clean = name.trim().replace(/[/\\]/g, '-')
        if (!clean) return
        const fileName = /\.(md|markdown|mdx)$/i.test(clean) ? clean : `${clean}.md`
        const target = parentDir(doc.filePath) ? `${parentDir(doc.filePath)}/${fileName}` : fileName
        if (target === doc.filePath) return
        try {
          cancelSave(id)
          await get().saveDoc(id)
          await apiMoveFile(doc.filePath, target)
          const nextId = pathToDocId(target)
          set((s) => ({
            docs: s.docs.map((d) => (d.id === id ? { ...d, id: nextId, title: baseName(target), filePath: target } : d)),
            openTabs: s.openTabs.map((t) => (t === id ? nextId : t)),
            activeDocId: s.activeDocId === id ? nextId : s.activeDocId,
          }))
          await get().refreshTree()
          void get().refreshIndex()
        } catch (e: any) {
          get().showToast(e?.message ?? '重命名失败', 'warn')
        }
      },

      /** 后端推送的文件变更：只标记状态，不擅自覆盖用户正在编辑的内容 */
      applyExternalChange: (paths) => {
        const state = get()
        if (state.mode !== 'local') return
        const touched = state.docs.filter(
          (d) => d.filePath && paths.includes(d.filePath) && (state.fileState[d.id] ?? 'clean') === 'clean'
        )
        for (const d of touched) {
          void state.reloadDoc(d.id)
        }
        void get().refreshTree()
        void get().refreshIndex()
      },

      /* ---------------- 工作区级索引 ---------------- */

      /** 把跨文件的标签索引转成补全与跳转需要的 RefEntry */
      workspaceRefs: () => {
        const { indexLabels, docs, mode, activeDocId } = get()
        if (mode !== 'local') return []
        return workspaceRefEntries(indexLabels, docs.find((d) => d.id === activeDocId)?.filePath)
      },

      /** 工作区里所有 .bib 解析出的文献（合并进补全源） */
      workspaceBib: () => {
        const { indexBib, bibEntries, mode } = get()
        if (mode !== 'local') return bibEntries
        return mergeWorkspaceBib(bibEntries, indexBib)
      },

      /* ---------------- 文档（沙盒模式 / 通用） ---------------- */

      setActiveDoc: (id) => {
        const doc = get().docs.find((d) => d.id === id)
        set((s) => ({
          activeDocId: id,
          liveContent: doc?.content ?? '',
          openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
        }))
      },
      updateContent: (id, content) => {
        set((s) => ({
          liveContent: id === s.activeDocId ? content : s.liveContent,
          docs: s.docs.map((d) => (d.id === id ? { ...d, content, updatedAt: Date.now() } : d)),
          fileState:
            s.mode === 'local' && s.fileState[id] !== 'conflict'
              ? { ...s.fileState, [id]: 'dirty' }
              : s.fileState,
        }))
        if (get().mode === 'local' && get().docs.find((d) => d.id === id)?.filePath) {
          scheduleSave(id)
        }
      },
      createDoc: (title, content) => {
        const id = `doc-${Date.now()}`
        const doc: DocNode = {
          id,
          title: title || `未命名文档 ${get().docs.length + 1}`,
          content: content ?? '# 新文档\n\n从这里开始用 Markdown 与 LaTeX 混合写作。\n\n$$\nE = mc^2\n$$\n',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({ docs: [doc, ...s.docs], activeDocId: id, liveContent: doc.content, openTabs: [...s.openTabs, id] }))
        return id
      },
      deleteDoc: (id) => {
        const { docs, activeDocId, openTabs } = get()
        if (docs.length <= 1) {
          get().showToast('至少保留一篇文档', 'warn')
          return
        }
        const next = docs.filter((d) => d.id !== id)
        const nextActive = id === activeDocId ? next[0].id : activeDocId
        set({
          docs: next,
          openTabs: openTabs.filter((t) => t !== id),
          activeDocId: nextActive,
          liveContent: next.find((d) => d.id === nextActive)?.content ?? '',
        })
      },
      renameDoc: (id, title) =>
        set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, title: title || d.title } : d)) })),
      setViewMode: (m) => set({ viewMode: m }),
      openModal: (m) => set({ modal: m }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarTab: (t) => set({ sidebarTab: t, sidebarOpen: true }),
      setMacros: (defs, source) => set({ macros: defs, macroSource: source }),
      upsertBib: (entry) =>
        set((s) => {
          const exists = s.bibEntries.some((b) => b.key === entry.key)
          return {
            bibEntries: exists
              ? s.bibEntries.map((b) => (b.key === entry.key ? entry : b))
              : [...s.bibEntries, entry],
          }
        }),
      removeBib: (id) => set((s) => ({ bibEntries: s.bibEntries.filter((b) => b.id !== id) })),
      addFavorite: (f) =>
        set((s) => {
          if (s.favorites.some((x) => x.latex.trim() === f.latex.trim())) return s
          return {
            favorites: [
              { ...f, id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
              ...s.favorites,
            ],
          }
        }),
      removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
      addLibraryFormula: (f) => get().addFavorite({ name: f.name, latex: f.latex, tags: [f.category] }),
      setAIConfig: (c) => set((s) => ({ aiConfig: { ...s.aiConfig, ...c } })),
      updateSettings: (s2) => set((s) => ({ settings: { ...s.settings, ...s2 } })),
      setLiveContent: (c) => set({ liveContent: c }),
      showToast: (text, kind = 'info') => {
        const id = Date.now()
        set({ toast: { id, text, kind } })
        setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null })
        }, 2600)
      },
      activeDoc: () => {
        const s = get()
        return s.docs.find((d) => d.id === s.activeDocId) ?? s.docs[0]
      },
    }),
    {
      name: 'mathflow-workspace-v1',
      // 本地模式下文档以磁盘为准，localStorage 只记界面偏好，避免两份内容互相打架
      partialize: (s) =>
        s.mode === 'local'
          ? {
              viewMode: s.viewMode,
              sidebarTab: s.sidebarTab,
              sidebarOpen: s.sidebarOpen,
              macros: s.macros,
              macroSource: s.macroSource,
              bibEntries: s.bibEntries,
              favorites: s.favorites,
              aiConfig: s.aiConfig,
              settings: s.settings,
            }
          : {
              docs: s.docs,
              activeDocId: s.activeDocId,
              openTabs: s.openTabs,
              viewMode: s.viewMode,
              sidebarTab: s.sidebarTab,
              sidebarOpen: s.sidebarOpen,
              macros: s.macros,
              macroSource: s.macroSource,
              bibEntries: s.bibEntries,
              favorites: s.favorites,
              aiConfig: s.aiConfig,
              settings: s.settings,
            },
    }
  )
)

/* ------------------------------------------------------------------ */
/* 订阅与工具                                                          */
/* ------------------------------------------------------------------ */

/**
 * 把工作区里其它文件的标签索转换成补全用的 RefEntry。
 * 排除当前文件——它自己的 refs 由渲染管线提供，信息更完整（带编号与预览）。
 */
export function workspaceRefEntries(labels: IndexedLabel[], excludeFile?: string): RefEntry[] {
  return labelsToRefEntries(labels, excludeFile)
}

/** 合并工作区 .bib 与编辑器内建的文献库，同 key 时以内建为准 */
export function mergeWorkspaceBib(base: BibEntry[], idx: IndexedBib[]): BibEntry[] {
  if (!idx.length) return base
  const seen = new Set(base.map((b) => b.key))
  const extra = idx
    .filter((b) => !seen.has(b.key))
    .map<BibEntry>((b, i) => ({
      id: `wsbib-${b.key}-${i}`,
      key: b.key,
      type: b.type,
      author: b.author,
      title: b.title,
      year: b.year,
      journal: b.journal,
      raw: b.raw,
    }))
  return [...extra, ...base]
}

let unsubscribeWatch: (() => void) | null = null

function subscribeToWorkspace() {
  unsubscribeWatch?.()
  unsubscribeWatch = watchWorkspace((paths) => {
    useEditorStore.getState().applyExternalChange(paths)
  })
}

/** 在文件树里按路径找节点 */
export function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.children) {
      const hit = findNode(n.children, path)
      if (hit) return hit
    }
  }
  return null
}

/** 深度优先找第一个 markdown 文件，作为工作区默认打开的文档 */
export function findFirstDoc(nodes: TreeNode[]): string | null {
  for (const n of nodes) {
    if (n.type === 'file' && /\.(md|markdown|mdx)$/i.test(n.name)) return n.path
  }
  for (const n of nodes) {
    if (n.children) {
      const hit = findFirstDoc(n.children)
      if (hit) return hit
    }
  }
  return null
}

/** 统计文件树里的文档数 */
export function countDocs(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => {
    if (node.type === 'file' && /\.(md|markdown|mdx)$/i.test(node.name)) return n + 1
    if (node.children) return n + countDocs(node.children)
    return n
  }, 0)
}

/** 页面关闭前把未落盘的内容抢救性地写一次 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const s = useEditorStore.getState()
    if (s.mode !== 'local') return
    for (const id of Object.keys(s.fileState)) {
      if (s.fileState[id] === 'dirty') {
        const doc = s.docs.find((d) => d.id === id)
        if (doc?.filePath) void apiWriteFile(doc.filePath, doc.content)
      }
    }
  })
}
