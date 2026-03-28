import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3002,
    strictPort: true,
    watch: {
      ignored: [
        '**/.archive/**',
        '**/*.bak*',
        '**/*.backup',
        '**/*.before-opt',
        '**/*.phase4-backup',
        '**/*.watchlist-backup',
        '**/*.broken',
        '**/*.fixed',
      ],
    },
    proxy: {
      '/api/twse': {
        target: 'https://mis.twse.com.tw/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/twse/, ''),
      },
      '/api/': {
        target: 'http://127.0.0.1:3002', // 修正為目標端口 3002
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
})
