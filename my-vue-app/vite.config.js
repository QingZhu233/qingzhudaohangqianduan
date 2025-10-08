import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 代理所有 /api 路径到后端端口
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 如果后端没有 /api 前缀，可以加 rewrite: path => path.replace(/^\/api/, "")
      }
    }
  }
})