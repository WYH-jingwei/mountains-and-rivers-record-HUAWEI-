import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    // 本机 Windows 上由 Vite 清理旧 dist 会触发 0xC0000409 崩溃，
    // 因此改由 npm run build 预先删除 dist，构建阶段不再清理输出目录。
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})