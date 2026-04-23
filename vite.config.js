import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEV_HOST = '127.0.0.1'
const DEV_PORT = 3002
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET?.trim() || ''
const DEV_ALLOWED_HOSTS = ['mac-mini.taila0e378.ts.net', '.taila0e378.ts.net']

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

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) return {}

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

function toQueryObject(searchParams) {
  const query = {}
  for (const [key, value] of searchParams.entries()) {
    if (key in query) {
      query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value]
    } else {
      query[key] = value
    }
  }
  return query
}

function createNodeStyleResponse(res) {
  return {
    statusCode: 200,
    setHeader(name, value) {
      res.setHeader(name, value)
    },
    status(code) {
      this.statusCode = code
      res.statusCode = code
      return this
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      res.statusCode = this.statusCode
      res.end(JSON.stringify(payload))
      return payload
    },
    end(payload = '') {
      res.statusCode = this.statusCode
      res.end(payload)
    },
  }
}

const LOCAL_API_ROUTE_MODULES = {
  '/api/blob-read': './api/blob-read.js',
  '/api/brain': './api/brain.js',
  '/api/target-prices': './api/target-prices.js',
  '/api/telemetry': './api/telemetry.js',
  '/api/trade-audit': './api/trade-audit.js',
  '/api/tracked-stocks': './api/tracked-stocks.js',
  '/api/valuation': './api/valuation.js',
}

function localApiBridgePlugin() {
  const handlerPromiseByPrefix = new Map()

  const getHandler = async (prefix) => {
    if (!handlerPromiseByPrefix.has(prefix)) {
      handlerPromiseByPrefix.set(
        prefix,
        Promise.all([
          import('./api/_lib/local-env.js').then((mod) => mod.loadLocalEnvIfPresent()),
          import(LOCAL_API_ROUTE_MODULES[prefix]),
        ]).then(([, mod]) => mod.default)
      )
    }
    return handlerPromiseByPrefix.get(prefix)
  }

  return {
    name: 'local-api-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const matchedPrefix = Object.keys(LOCAL_API_ROUTE_MODULES).find((prefix) =>
          req.url?.startsWith(prefix)
        )
        if (!matchedPrefix) return next()

        try {
          const handler = await getHandler(matchedPrefix)
          const requestUrl = new URL(req.url, `http://${DEV_HOST}:${DEV_PORT}`)
          const request = {
            method: req.method || 'GET',
            headers: req.headers,
            query: toQueryObject(requestUrl.searchParams),
            body: req.method === 'POST' ? await readJsonBody(req) : undefined,
          }
          const response = createNodeStyleResponse(res)
          await handler(request, response)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error?.message || 'local api bridge failed' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiBridgePlugin()],
  server: {
    host: DEV_HOST,
    port: DEV_PORT,
    strictPort: true,
    allowedHosts: DEV_ALLOWED_HOSTS,
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
