import { createHmac, timingSafeEqual } from 'crypto'

export const DEFAULT_SIGNED_BLOB_TTL_MS = 15 * 60 * 1000
export const SIGNED_BLOB_MARKER = 'signed-blob-v1'
export const SIGNED_BLOB_READ_ROUTE = '/api/blob-read'
const DEFAULT_LOCAL_ORIGIN = 'http://127.0.0.1:3002'

function normalizeOrigin(value) {
  const text = String(value || '').trim()
  return (text || DEFAULT_LOCAL_ORIGIN).replace(/\/$/, '')
}

function normalizeExpiresAt(value) {
  const numeric = Math.trunc(Number(value))
  return numeric > 0 ? numeric : 0
}

export function extractBlobPathname(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  if (/^https?:\/\//i.test(text)) {
    try {
      return decodeURIComponent(new URL(text).pathname).replace(/^\/+/, '')
    } catch {
      return ''
    }
  }

  return text.replace(/^\/+/, '')
}

export function resolveSignedBlobOrigin(req) {
  const protocol =
    req?.headers?.['x-forwarded-proto'] ||
    req?.headers?.get?.('x-forwarded-proto') ||
    (process.env.VERCEL_URL ? 'https' : 'http')
  const host =
    req?.headers?.host || req?.headers?.get?.('host') || process.env.VERCEL_URL || '127.0.0.1:3002'
  return normalizeOrigin(`${protocol}://${host}`)
}

export function getSignedBlobSecret() {
  const candidates = [
    process.env.BLOB_SIGNING_SECRET,
    process.env.BRIDGE_INTERNAL_TOKEN,
    process.env.BRIDGE_AUTH_TOKEN,
    process.env.CRON_SECRET,
    process.env.PUB_BLOB_READ_WRITE_TOKEN,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  if (candidates.length > 0) return candidates[0]
  if (process.env.VITEST) return 'vitest-signed-blob-secret'
  throw new Error('signed blob secret not configured')
}

function buildSigningPayload({ pathname, expiresAt, download = false }) {
  return [SIGNED_BLOB_MARKER, pathname, String(expiresAt), download ? '1' : '0'].join(':')
}

export function signBlobRead({ pathname, expiresAt, download = false }) {
  const normalizedPath = extractBlobPathname(pathname)
  const normalizedExpiresAt = normalizeExpiresAt(expiresAt)
  if (!normalizedPath) throw new Error('blob pathname is required for signing')
  if (!normalizedExpiresAt) throw new Error('blob expiresAt is required for signing')

  return createHmac('sha256', getSignedBlobSecret())
    .update(
      buildSigningPayload({
        pathname: normalizedPath,
        expiresAt: normalizedExpiresAt,
        download,
      })
    )
    .digest('hex')
}

export function createSignedBlobReadUrl(
  pathname,
  { origin, ttlMs = DEFAULT_SIGNED_BLOB_TTL_MS, expiresAt, download = false } = {}
) {
  const normalizedPath = extractBlobPathname(pathname)
  if (!normalizedPath) throw new Error('blob pathname is required')

  const resolvedExpiresAt =
    normalizeExpiresAt(expiresAt) ||
    Date.now() + Math.max(1000, Number(ttlMs) || DEFAULT_SIGNED_BLOB_TTL_MS)
  const url = new URL(SIGNED_BLOB_READ_ROUTE, normalizeOrigin(origin))
  url.searchParams.set('path', normalizedPath)
  url.searchParams.set('expires', String(resolvedExpiresAt))
  url.searchParams.set(
    'sig',
    signBlobRead({
      pathname: normalizedPath,
      expiresAt: resolvedExpiresAt,
      download,
    })
  )
  if (download) url.searchParams.set('download', '1')
  return url.toString()
}

export function verifySignedBlobReadQuery(query = {}) {
  const pathname = extractBlobPathname(query.path || query.pathname)
  const expiresAt = normalizeExpiresAt(query.expires || query.expiresAt)
  const signature = String(query.sig || query.signature || '').trim()
  const download =
    String(query.download || '')
      .trim()
      .toLowerCase() === '1'

  if (!pathname || !expiresAt || !signature) {
    return { ok: false, error: 'missing signed blob params' }
  }

  if (Date.now() > expiresAt) {
    return { ok: false, error: 'signed blob url expired' }
  }

  const expected = signBlobRead({ pathname, expiresAt, download })
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  const isValid =
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)

  if (!isValid) {
    return { ok: false, error: 'invalid signed blob signature' }
  }

  return { ok: true, pathname, expiresAt, download }
}

async function throwSignedBlobFetchError(response) {
  const detail = await response.text().catch(() => '')
  throw new Error(detail || `signed blob fetch failed (${response.status})`)
}

export async function fetchSignedBlobJson(
  pathname,
  { origin, ttlMs = DEFAULT_SIGNED_BLOB_TTL_MS, expiresAt, fetchImpl = fetch, headers } = {}
) {
  const url = createSignedBlobReadUrl(pathname, { origin, ttlMs, expiresAt })
  const response = await fetchImpl(url, { headers })
  if (!response.ok) {
    await throwSignedBlobFetchError(response)
  }
  return response.json()
}
