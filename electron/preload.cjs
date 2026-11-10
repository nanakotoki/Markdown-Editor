/**
 * ============================================================================
 *  preload.cjs —— 渲染进程与主进程之间唯一的一扇小窗
 * ----------------------------------------------------------------------------
 *  只放这几件事：导出 PDF、打印当前窗口、窗口置顶、在资源管理器里定位文件、
 *  以及接收菜单发来的指令。
 *  没有文件系统、没有 shell、没有任意 IPC，页面拿到的就是这几个函数。
 * ============================================================================
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mathflow', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  /** 把一份自包含 HTML 直接渲染成 PDF（不弹保存框、不经过系统打印对话框） */
  exportPdf: (payload) => ipcRenderer.invoke('mf:export-pdf', payload),
  /** 把当前窗口按阅读模式的分页打成 PDF */
  printCurrent: (payload) => ipcRenderer.invoke('mf:print-current', payload),
  /** 在资源管理器里选中刚导出的文件 */
  reveal: (filePath) => ipcRenderer.invoke('mf:reveal', filePath),
  /** 窗口始终置顶 */
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('mf:set-always-on-top', flag),
  getWindowState: () => ipcRenderer.invoke('mf:get-window-state'),
  /** 菜单里点了「隐藏侧边栏」之类，主进程会发一条指令过来 */
  onCommand: (handler) => {
    const listener = (_event, cmd) => handler(cmd)
    ipcRenderer.on('mf:command', listener)
    return () => ipcRenderer.removeListener('mf:command', listener)
  },
  /** 菜单里改了置顶状态，界面上的图钉要同步 */
  onWindowChanged: (handler) => {
    const listener = (_event, state) => handler(state)
    ipcRenderer.on('mf:window-changed', listener)
    return () => ipcRenderer.removeListener('mf:window-changed', listener)
  },
})
