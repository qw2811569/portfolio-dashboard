import { loadLocalEnvIfPresent } from './local-env.js'

function getHeader(req, name) {
  const headers = req?.headers || {}
  const expected = String(name || '').toLowerCase()

  if (typeof headers.get === 'function') {
    return headers.get(expected) || headers.get(name) || ''
  }

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== expected) continue
    return Array.isArray(value) ? value[0] : value
  }

  return ''
}

function parseUrlHost(value) {
  try {
    return new URL(String(value || '')).host
  } catch {
    return ''
  }
}

function getRequestHost(req) {
  return String(getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || '')
    .split(',')[0]
    .trim()
}

function isLocalHost(host = '') {
  return (
    /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) || /^192\.168\.\d+\.\d+(?::\d+)?$/i.test(host)
  )
}

function getBearerToken(req) {
  const raw = String(getHeader(req, 'authorization') || '').trim()
  if (!raw.toLowerCase().startsWith('bearer ')) return ''
  return raw.slice(7).trim()
}

export function getInternalApiAuthToken() {
  loadLocalEnvIfPresent()
  return String(process.env.BRIDGE_INTERNAL_TOKEN || process.env.BRIDGE_AUTH_TOKEN || '').trim()
}

export function buildInternalAuthHeaders(headers = {}) {
  const token = getInternalApiAuthToken()
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

function hasValidInternalToken(req) {
  const expected = getInternalApiAuthToken()
  return Boolean(expected) && getBearerToken(req) === expected
}

function isSameOriginBrowserRequest(req) {
  const host = getRequestHost(req)
  if (!host) return false

  const originHost = parseUrlHost(getHeader(req, 'origin'))
  if (originHost && originHost === host) return true

  const refererHost = parseUrlHost(getHeader(req, 'referer'))
  if (refererHost && refererHost === host) return true

  const secFetchSite = String(getHeader(req, 'sec-fetch-site') || '')
    .trim()
    .toLowerCase()
  return secFetchSite === 'same-origin' || secFetchSite === 'same-site'
}

function isLocalRequest(req) {
  if (!process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
    return true
  }
  const host = getRequestHost(req)
  if (host) return isLocalHost(host)
  return Boolean(process.env.VITEST)
}

export function isAuthorizedApiRequest(req, { allowAnonymous = false } = {}) {
  if (allowAnonymous) return true
  if (process.env.VITEST) return true
  if (hasValidInternalToken(req)) return true
  if (isLocalRequest(req)) return true
  if (isSameOriginBrowserRequest(req)) return true
  return false
}

function maybeSetCorsHeaders(req, res, { allowCrossOrigin = false } = {}) {
  if (!allowCrossOrigin) return
  const origin = String(getHeader(req, 'origin') || '').trim()
  if (!origin) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function withApiAuth(handler, options = {}) {
  return async function guardedHandler(req, res) {
    loadLocalEnvIfPresent()
    maybeSetCorsHeaders(req, res, options)

    if (req?.method === 'OPTIONS') {
      if (options.allowCrossOrigin) return res.status(200).end()
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!isAuthorizedApiRequest(req, options)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return handler(req, res)
  }
}
