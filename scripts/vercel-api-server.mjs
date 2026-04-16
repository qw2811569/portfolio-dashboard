#!/usr/bin/env node

import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HOST = process.env.HOST || process.env.VERCEL_API_HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || process.env.VERCEL_API_PORT || 3000)
const API_ROOT = path.resolve(process.env.VERCEL_API_ROOT || path.join(process.cwd(), 'api'))
const BODY_LIMIT = process.env.VERCEL_API_BODY_LIMIT || '25mb'

const ROUTE_CACHE = new Map()
const MODULE_CACHE = new Map()

function isHandlerFile(entryPath) {
  return entryPath.endsWith('.js') && !entryPath.includes(`${path.sep}_lib${path.sep}`)
}

function routeFromFile(filePath) {
  const relative = path.relative(API_ROOT, filePath).replace(/\\/g, '/')
  const withoutExt = relative.replace(/\.js$/i, '')
  if (withoutExt === 'index') return '/api'
  if (withoutExt.endsWith('/index')) return `/api/${withoutExt.slice(0, -'/index'.length)}`
  return `/api/${withoutExt}`
}

async function walk(dirPath) {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true })
  const files = []

  for (const dirent of dirents) {
    const entryPath = path.join(dirPath, dirent.name)
    if (dirent.isDirectory()) {
      if (dirent.name.startsWith('.')) continue
      files.push(...(await walk(entryPath)))
      continue
    }
    if (dirent.isFile() && isHandlerFile(entryPath)) files.push(entryPath)
  }

  return files
}

async function refreshRoutes() {
  const next = new Map()
  const files = await walk(API_ROOT)
  for (const filePath of files) {
    next.set(routeFromFile(filePath), filePath)
  }
  ROUTE_CACHE.clear()
  for (const [routePath, filePath] of next.entries()) ROUTE_CACHE.set(routePath, filePath)
  return ROUTE_CACHE
}

async function resolveHandlerFile(routePath) {
  const normalized = routePath.endsWith('/') && routePath !== '/api' ? routePath.slice(0, -1) : routePath
  if (ROUTE_CACHE.has(normalized)) return ROUTE_CACHE.get(normalized)
  await refreshRoutes()
  return ROUTE_CACHE.get(normalized) || null
}

async function loadHandler(filePath) {
  const stats = await fs.stat(filePath)
  const cacheKey = `${filePath}:${stats.mtimeMs}`
  if (MODULE_CACHE.has(cacheKey)) return MODULE_CACHE.get(cacheKey)

  for (const existingKey of MODULE_CACHE.keys()) {
    if (existingKey.startsWith(`${filePath}:`) && existingKey !== cacheKey) MODULE_CACHE.delete(existingKey)
  }

  const moduleUrl = `${pathToFileURL(filePath).href}?mtime=${stats.mtimeMs}`
  const mod = await import(moduleUrl)
  const handler = mod.default
  if (typeof handler !== 'function') {
    throw new TypeError(`Expected default export function from ${path.relative(process.cwd(), filePath)}`)
  }
  MODULE_CACHE.set(cacheKey, handler)
  return handler
}

async function bootstrapRoutes() {
  try {
    await refreshRoutes()
  } catch (error) {
    console.warn(`[vercel-api] route bootstrap failed: ${error.message}`)
  }
}

function createNotFoundPayload(routePath) {
  return {
    error: 'Not found',
    detail: `No Vercel-compatible handler for ${routePath}`,
  }
}

const app = express()
app.disable('x-powered-by')
app.set('etag', false)
app.use(express.json({ limit: BODY_LIMIT }))
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }))
app.use(express.text({ type: ['text/*', 'application/graphql'], limit: BODY_LIMIT }))

app.get('/healthz', async (_req, res) => {
  if (!ROUTE_CACHE.size) await refreshRoutes().catch(() => {})
  res.json({
    ok: true,
    host: HOST,
    port: PORT,
    apiRoot: API_ROOT,
    routeCount: ROUTE_CACHE.size,
  })
})

app.use('/api', async (req, res) => {
  const routePath = req.path === '/' ? '/api' : `/api${req.path}`
  const filePath = await resolveHandlerFile(routePath)

  if (!filePath) {
    return res.status(404).json(createNotFoundPayload(routePath))
  }

  req.cookies = req.cookies || {}

  try {
    const handler = await loadHandler(filePath)
    await handler(req, res)
    if (!res.writableEnded && !res.headersSent) {
      res.status(204).end()
    }
  } catch (error) {
    console.error(`[vercel-api] ${req.method} ${routePath} failed:`, error)
    if (res.headersSent || res.writableEnded) return
    res.status(500).json({
      error: 'Internal server error',
      detail: error?.message || 'unknown error',
      route: routePath,
    })
  }
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  console.error('[vercel-api] unhandled express error:', error)
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', detail: error?.message || 'unknown error' })
  }
})

await bootstrapRoutes()

app.listen(PORT, HOST, () => {
  console.log(`[vercel-api] listening on http://${HOST}:${PORT}`)
  console.log(`[vercel-api] api root: ${API_ROOT}`)
  console.log(`[vercel-api] routes: ${ROUTE_CACHE.size}`)
})
