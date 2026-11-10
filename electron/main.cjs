/**
 * ============================================================================
 *  MathFlow 桌面客户端（Electron 主进程）
 * ----------------------------------------------------------------------------
 *  与「浏览器 + 本地服务」的关系：
 *    · 内核完全一样 —— 内嵌的还是那台零依赖 Node 服务，页面也是同一份 dist/；
 *    · 差别在壳：这里给的是一个真正的应用窗口（无地址栏、有菜单、单实例、
 *      关窗即退），用户不需要知道 localhost 这回事；
 *    · 浏览器方式继续保留，喜欢网页的人照旧打开页面。
 * ============================================================================
 */
const { app, BrowserWindow, dialog, shell, Menu, nativeTheme, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const { pathToFileURL } = require('node:url')

const APP_ROOT = path.join(__dirname, '..')
const CONFIG_PATH = () => path.join(app.getPath('userData'), 'desktop-config.json')
const START_PORT = 4321

let win = null
let server = null
let currentRoot = null
let serverPort = 0
let exportFn = null

/* ------------------------------------------------------------------ */
/* 配置                                                                */
/* ------------------------------------------------------------------ */

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH(), 'utf8'))
  } catch {
    return {}
  }
}

function writeConfig(patch) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true })
    fs.writeFileSync(CONFIG_PATH(), JSON.stringify({ ...readConfig(), ...patch }, null, 2), 'utf8')
  } catch {
    /* 配置写不进去不影响使用 */
  }
}

/* ------------------------------------------------------------------ */
/* 工作区                                                              */
/* ------------------------------------------------------------------ */

/**
 * 便携版（portable target）会把 exe 所在目录塞进 PORTABLE_EXECUTABLE_DIR。
 * 这种情况下工作区就放在 exe 旁边，U 盘拔走即带走全部文稿；安装版仍用「文档\MathFlow」。
 */
const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || ''
const DEFAULT_ROOT = () =>
  PORTABLE_DIR ? path.join(PORTABLE_DIR, 'workspace') : path.join(app.getPath('documents'), 'MathFlow')

/** 首次启动时把模板拷进去（只写不存在的文件，绝不覆盖） */
async function seedWorkspace(root) {
  const tplDir = path.join(APP_ROOT, 'templates', 'workspace')
  const copied = []
  async function walk(src, dest) {
    let entries
    try {
      entries = await fsp.readdir(src, { withFileTypes: true })
    } catch {
      return
    }
    await fsp.mkdir(dest, { recursive: true })
    for (const e of entries) {
      const s = path.join(src, e.name)
      const d = path.join(dest, e.name)
      if (e.isDirectory()) await walk(s, d)
      else {
        try {
          await fsp.writeFile(d, await fsp.readFile(s), { flag: 'wx' })
          copied.push(path.relative(root, d))
        } catch (err) {
          if (err.code !== 'EEXIST') throw err
        }
      }
    }
  }
  await walk(tplDir, root)
  return copied
}

async function ensureWorkspace(root) {
  await fsp.mkdir(root, { recursive: true })
  const hasDoc = await fsp
    .readdir(root)
    .then((list) => list.some((f) => /\.md$/i.test(f)))
    .catch(() => false)
  if (!hasDoc) await seedWorkspace(root)
  return root
}

/* ------------------------------------------------------------------ */
/* 内嵌服务                                                            */
/* ------------------------------------------------------------------ */

async function startServer(root) {
  const url = (rel) => pathToFileURL(path.join(APP_ROOT, rel)).href
  const { createApp, listenWithFallback } = await import(url('server/index.mjs'))
  const { exportWorkspace } = await import(url('server/exportBatch.mjs'))
  exportFn = exportWorkspace

  const app_ = createApp({
    root,
    distDir: path.join(APP_ROOT, 'dist'),
    exportHandler: (payload) => exportWorkspace({ ...payload, root }),
  })
  const port = await listenWithFallback(app_, START_PORT, '127.0.0.1')
  return { server: app_, port }
}

async function stopServer() {
  if (!server) return
  await new Promise((resolve) => {
    server.close(() => resolve())
    setTimeout(resolve, 800)
  })
  server = null
}

/** 切换工作区：关旧服务 → 起新服务 → 重新加载窗口 */
async function switchWorkspace(root) {
  await ensureWorkspace(root)
  await stopServer()
  const next = await startServer(root)
  server = next.server
  serverPort = next.port
  currentRoot = root
  writeConfig({ lastRoot: root })
  if (win) {
    await win.loadURL(`http://127.0.0.1:${serverPort}/`)
    win.setTitle('MathFlow')
  }
  buildMenu()
}

/* ------------------------------------------------------------------ */
/* 导出 PDF                                                            */
/* ------------------------------------------------------------------ */

/**
 * 以前导出 PDF 是「打开一个网页 → Ctrl+P → 系统打印对话框 → 手动敲文件名」，
 * 中间那两步慢且容易写错。这里直接用 Chromium 的 printToPDF：
 * 先弹一个已经填好文件名的保存框，确认后后台渲染、写盘、定位到文件，全程不弹打印对话框。
 */
const PRINT_OPTS = {
  printBackground: true,
  preferCSSPageSize: true,
  pageSize: 'A4',
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
}

/** 打印前把折叠块展开、等字体就位：否则 PDF 里只剩一行标题、字体也可能是回退字形 */
const BEFORE_PRINT = `(async () => {
  document.querySelectorAll('details').forEach((d) => { d.open = true })
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready } catch (e) {} }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  return true
})()`

function safeFileName(name, ext = '.pdf') {
  const base = String(name || 'MathFlow 文档')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  const stem = base.toLowerCase().endsWith(ext) ? base.slice(0, -ext.length) : base
  return `${stem || 'MathFlow 文档'}${ext}`
}

/** 保存位置默认就是文档所在目录；传进来的相对目录必须留在工作区内 */
function resolveOutDir(dirHint) {
  const fallback = currentRoot ?? app.getPath('documents')
  if (!dirHint || !currentRoot) return fallback
  const abs = path.resolve(currentRoot, dirHint)
  const rel = path.relative(currentRoot, abs)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return abs === currentRoot ? currentRoot : fallback
  return abs
}

/**
 * 不覆盖同名文件：`导数笔记.pdf` 已存在就写 `导数笔记 (2).pdf`。
 * 用户要的是「按一下就出文件」，所以这里不做任何询问，直接让路。
 */
function uniquePath(dir, name) {
  const first = path.join(dir, name)
  if (!fs.existsSync(first)) return first
  const ext = path.extname(name)
  const stem = name.slice(0, name.length - ext.length)
  for (let i = 2; i < 1000; i++) {
    const next = path.join(dir, `${stem} (${i})${ext}`)
    if (!fs.existsSync(next)) return next
  }
  return path.join(dir, `${stem}-${Date.now()}${ext}`)
}

/**
 * 打印用的 HTML 放在工作区里的隐藏目录，再用本地服务的地址打开它。
 * 这样页面和图片、KaTeX 字体全部同源：字体不带 CORS 麻烦，
 * 相对路径的插图也不用内联成 base64（那会把 HTML 撑到几 MB，Chromium 解析很久）。
 * 打印完就把临时文件删掉，工作区里不留痕迹。
 */
async function preparePrintPage(html) {
  const dir = currentRoot ? path.join(currentRoot, '.mathflow-print') : ''
  if (dir) {
    await fsp.mkdir(dir, { recursive: true })
    const name = `print-${process.pid}-${Date.now()}.html`
    await fsp.writeFile(path.join(dir, name), html, 'utf8')
    return {
      url: `http://127.0.0.1:${serverPort}/ws/.mathflow-print/${name}`,
      cleanup: async () => {
        await fsp.rm(path.join(dir, name), { force: true }).catch(() => {})
        await fsp.rmdir(dir).catch(() => {}) // 目录非空（并发导出）时忽略
      },
    }
  }
  // 没有工作区（极少见）：退回临时文件
  const tmp = path.join(app.getPath('temp'), `mathflow-print-${process.pid}-${Date.now()}.html`)
  await fsp.writeFile(tmp, html, 'utf8')
  return { url: pathToFileURL(tmp).href, cleanup: () => fsp.rm(tmp, { force: true }).catch(() => {}) }
}

ipcMain.handle('mf:export-pdf', async (_event, payload = {}) => {
  let page = null
  let cleanup = null
  try {
    if (typeof payload.html !== 'string' || !payload.html.trim()) {
      return { ok: false, error: '没有可导出的内容' }
    }
    const dir = resolveOutDir(payload?.dirHint)
    await fsp.mkdir(dir, { recursive: true }).catch(() => {})
    const target = uniquePath(dir, safeFileName(payload?.defaultName))

    const started = Date.now()
    const prepared = await preparePrintPage(payload.html)
    cleanup = prepared.cleanup

    page = new BrowserWindow({
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: { offscreen: false, javascript: true, contextIsolation: true, sandbox: true },
    })
    await page.loadURL(prepared.url)
    await page.webContents.executeJavaScript(BEFORE_PRINT, true).catch(() => {})
    const pdf = await page.webContents.printToPDF(PRINT_OPTS)
    await fsp.writeFile(target, pdf)
    if (payload?.reveal !== false) shell.showItemInFolder(target)
    return { ok: true, filePath: target, bytes: pdf.length, ms: Date.now() - started }
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) }
  } finally {
    try {
      page?.destroy()
    } catch {
      /* 窗口可能已经自己关了 */
    }
    if (cleanup) await cleanup().catch(() => {})
  }
})

ipcMain.handle('mf:print-current', async (_event, payload = {}) => {
  try {
    if (!win) return { ok: false, error: '窗口已关闭' }
    const dir = resolveOutDir(payload?.dirHint)
    await fsp.mkdir(dir, { recursive: true }).catch(() => {})
    const target = uniquePath(dir, safeFileName(payload?.defaultName))
    const started = Date.now()
    const pdf = await win.webContents.printToPDF(PRINT_OPTS)
    await fsp.writeFile(target, pdf)
    if (payload?.reveal !== false) shell.showItemInFolder(target)
    return { ok: true, filePath: target, bytes: pdf.length, ms: Date.now() - started }
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) }
  }
})

/** 打开导出文件所在的文件夹（前端 toast 上点一下就能定位） */
ipcMain.handle('mf:reveal', async (_event, filePath) => {
  if (typeof filePath === 'string' && filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
    return { ok: true }
  }
  return { ok: false }
})

/* ------------------------------------------------------------------ */
/* 窗口控制：置顶 / 状态                                               */
/* ------------------------------------------------------------------ */

function applyAlwaysOnTop(flag) {
  if (!win) return false
  // floating：比普通窗口高一层，又不会盖住任务栏与系统弹窗
  win.setAlwaysOnTop(!!flag, 'floating')
  return win.isAlwaysOnTop()
}

ipcMain.handle('mf:set-always-on-top', (_event, flag) => {
  const next = applyAlwaysOnTop(!!flag)
  writeConfig({ alwaysOnTop: next })
  return { ok: true, alwaysOnTop: next }
})

ipcMain.handle('mf:get-window-state', () => ({
  ok: true,
  alwaysOnTop: win ? win.isAlwaysOnTop() : false,
  maximized: win ? win.isMaximized() : false,
  desktop: true,
}))

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1f27' : '#f3f5f8',
    title: 'MathFlow',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.once('ready-to-show', () => win.show())

  // 上次退出时是置顶状态，这次接着置顶
  if (readConfig().alwaysOnTop) applyAlwaysOnTop(true)

  // 站内跳转放行，外链交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}`)) {
      event.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })

  win.on('closed', () => {
    win = null
  })

  win.loadURL(`http://127.0.0.1:${serverPort}/`)
}

/* ------------------------------------------------------------------ */
/* 菜单                                                                */
/* ------------------------------------------------------------------ */

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const folder = currentRoot ?? DEFAULT_ROOT()

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: '关于 MathFlow' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏' },
              { role: 'hideOthers', label: '隐藏其他' },
              { type: 'separator' },
              { role: 'quit', label: '退出 MathFlow' },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '打开工作区文件夹…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const res = await dialog.showOpenDialog(win, {
              title: '选择要编辑的文件夹',
              properties: ['openDirectory', 'createDirectory'],
              defaultPath: folder,
            })
            if (res.canceled || !res.filePaths[0]) return
            await switchWorkspace(res.filePaths[0])
          },
        },
        {
          label: '在资源管理器中打开工作区',
          click: () => {
            if (currentRoot) shell.openPath(currentRoot)
          },
        },
        {
          label: '打开导出目录',
          click: () => {
            if (!currentRoot) return
            const dir = path.join(currentRoot, 'export')
            if (fs.existsSync(dir)) shell.openPath(dir)
            else dialog.showMessageBox(win, {
              type: 'info',
              message: '还没有导出过',
              detail: '在应用里点右上角「导出」，或在菜单里执行「导出整本」。',
            })
          },
        },
        { type: 'separator' },
        {
          label: '导出整本…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: async () => {
            if (!currentRoot || !exportFn) return
            const outDir = path.join(currentRoot, 'export')
            win?.setProgressBar(2)
            try {
              const res = await exportFn({ root: currentRoot, outDir: 'export', to: ['tex', 'html'], combine: true })
              win?.setProgressBar(-1)
              const extra = res.combined?.mainHtml ? '\n\n整本阅读版：main.html' : ''
              const pick = await dialog.showMessageBox(win, {
                type: 'info',
                title: '导出完成',
                message: `${res.outputs.length} 篇文档已编译`,
                detail: `输出目录：${outDir}${extra}`,
                buttons: ['打开目录', '好'],
                defaultId: 0,
              })
              if (pick.response === 0) shell.openPath(outDir)
            } catch (err) {
              win?.setProgressBar(-1)
              dialog.showErrorBox('导出失败', String(err?.message ?? err))
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        {
          label: '始终置顶',
          type: 'checkbox',
          checked: !!win?.isAlwaysOnTop(),
          accelerator: 'CmdOrCtrl+Shift+P',
          click: (item) => {
            const next = applyAlwaysOnTop(item.checked)
            writeConfig({ alwaysOnTop: next })
            // 让界面上的图钉按钮跟着变，别出现「菜单说置顶、按钮没亮」
            win?.webContents.send('mf:window-changed', { alwaysOnTop: next })
          },
        },
        {
          label: '隐藏 / 显示侧边栏',
          accelerator: 'CmdOrCtrl+B',
          click: () => win?.webContents.send('mf:command', 'toggle-sidebar'),
        },
        { type: 'separator' },
        { role: 'minimize', label: '最小化' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '打开工作区位置',
          click: () => currentRoot && shell.openPath(currentRoot),
        },
        {
          label: '项目主页',
          click: () => shell.openExternal('https://github.com/'),
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '关于 MathFlow',
              message: `MathFlow ${app.getVersion()}`,
              detail:
                `Markdown 为主、LaTeX 为辅的混合学术编辑器\n\n` +
                `工作区：${currentRoot ?? '(未设置)'}\n` +
                `内嵌服务：http://127.0.0.1:${serverPort}/\n` +
                `Electron：${process.versions.electron}   Chromium：${process.versions.chrome}`,
              buttons: ['好'],
            })
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    const arg = argv.find((a) => !a.startsWith('-') && a !== process.execPath)
    if (arg && fs.existsSync(arg) && fs.statSync(arg).isDirectory() && arg !== currentRoot) {
      switchWorkspace(path.resolve(arg)).catch(() => {})
    }
  })

  app.whenReady().then(async () => {
    // 命令行传目录：MathFlow.exe "D:\论文"
    // 注意 `electron .` 会把 "." 当作参数传进来，那不是用户选的工作区
    const argRoot = process.argv
      .slice(1)
      .find((a) => !a.startsWith('-') && a !== process.execPath && a !== '.' && a !== '--')
    const cfg = readConfig()
    const root =
      argRoot && fs.existsSync(argRoot) && fs.statSync(argRoot).isDirectory()
        ? path.resolve(argRoot)
        : PORTABLE_DIR
          ? DEFAULT_ROOT() // 便携版固定用 exe 旁的 workspace，换电脑也能原样带走
          : cfg.lastRoot || DEFAULT_ROOT()

    await ensureWorkspace(root)
    const started = await startServer(root)
    server = started.server
    serverPort = started.port
    currentRoot = root
    writeConfig({ lastRoot: root })

    createWindow()
    buildMenu()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', async () => {
    await stopServer()
  })
}
