import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base: './': 使用相对路径，支持 GitHub Pages 子目录部署
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // 按依赖大小自动拆包，减少首屏加载量
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react') || id.includes('zustand')) return 'vendor-react';
          }
        },
      },
    },
  },
})
