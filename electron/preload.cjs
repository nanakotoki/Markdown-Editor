/**
 * ============================================================================
 *  preload.cjs —— 渲染进程与主进程之间唯一的一扇小窗
 * ----------------------------------------------------------------------------
 *  只放三件事：导出 PDF、打印当前窗口、以及「我是不是在桌面壳里」。
 *  没有文件系统、没有 shell、没有任意 IPC，页面拿到的就是这三个函数。
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
  /** 把一份自包含 HTML 直接渲染成 PDF（不经过系统打印对话框） */
  exportPdf: (payload) => ipcRenderer.invoke('mf:export-pdf', payload),
  /** 把当前窗口按阅读模式的分页打成 PDF */
  printCurrent: (payload) => ipcRenderer.invoke('mf:print-current', payload),
})
