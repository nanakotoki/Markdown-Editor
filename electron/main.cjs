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
const { app, BrowserWindow, dialog, shell, Menu, nativeTheme } = require('electron')
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
    },
  })

  win.once('ready-to-show', () => win.show())

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
