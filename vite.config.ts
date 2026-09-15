import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置：https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 用 @ 指向 src，避免 ../../.. 的相对路径地狱
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5188,
    open: false,
  },
  build: {
    // 面试题内容量很大，把 markdown 依赖单独拆包，方便浏览器缓存
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ['markdown-it', 'highlight.js'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
