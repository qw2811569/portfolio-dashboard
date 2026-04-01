import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEV_HOST = '127.0.0.1'
const DEV_PORT = 3002
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET?.trim() || ''

const shouldProxyApi = (() => {
  if (!API_PROXY_TARGET) return false
  try {
    const parsed = new URL(API_PROXY_TARGET)
    const port =
      parsed.port === '' ? (parsed.protocol === 'https:' ? 443 : 80) : Number(parsed.port)
    return !(parsed.hostname === DEV_HOST && port === DEV_PORT)
  } catch {
    return true
  }
})()

export default defineConfig({
  plugins: [react()],
  server: {
    host: DEV_HOST,
    port: DEV_PORT,
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
      ...(shouldProxyApi
        ? {
            '/api/': {
              target: API_PROXY_TARGET,
              changeOrigin: true,
            },
          }
        : {}),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor'
          }

          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'router-vendor'
          }

          if (id.includes('@tanstack/react-query') || id.includes('/zustand/')) {
            return 'state-vendor'
          }

          if (id.includes('web-vitals')) {
            return 'telemetry-vendor'
          }
        },
      },
    },
  },
})
