import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/twse': {
        target: 'https://mis.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/twse/, ''),
      },
      '/api/': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
})
