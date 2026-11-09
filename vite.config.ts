import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 两种使用方式的构建配置是同一份：
 *  · `npm run build` 产出完全静态的 dist/，可直接扔到 GitHub Pages；
 *  · `npm run lab`   在本机起 Node 服务，dist/ 由服务托管，同时提供 /api 文件接口。
 *
 * dev 模式下把 /api 代理到本地服务（默认 4321），
 * 这样 `npm run dev` 也能直接读写磁盘。没有起服务时前端会自动回退到沙盒模式。
 */
const API_TARGET = process.env.MATHFLOW_API ?? 'http://127.0.0.1:4321'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5183,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      // 文档里相对路径的图片 / 视频：/ws/<工作区路径>
      '/ws': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: { port: 4173 },
  build: { chunkSizeWarningLimit: 2500 },
})
