import { createHmac, timingSafeEqual } from 'node:crypto'

const PORTFOLIO_POLICIES = Object.freeze({
  me: Object.freeze({
    id: 'me',
    name: '我',
    owner: 'xiaokui',
    compliance_mode: 'retail',
  }),
  jinliancheng: Object.freeze({
    id: 'jinliancheng',
    name: '金聯成',
    owner: 'jinliancheng-chairwoman',
    compliance_mode: 'insider',
  }),
})

export const AUTH_CLAIM_COOKIE_NAMES = ['pf_auth_claim', 'portfolio_auth_claim', 'portfolio_claim']
export const AUTH_CLAIM_ISSUER = 'portfolio-dashboard'
export const AUTH_CLAIM_AUDIENCE = 'portfolio-api'

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

function parseCookieHeader(value) {
  return Object.fromEntries(
    String(value || '')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf('=')
        if (separatorIndex <= 0) return [entry, '']
        return [entry.slice(0, separatorIndex).trim(), entry.slice(separatorIndex + 1).trim()]
      })
  )
}

function decodeJsonClaim(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const candidates = [
    raw,
    (() => {
      try {
        return decodeURIComponent(raw)
      } catch {
        return ''
      }
    })(),
    (() => {
      try {
        return Buffer.from(raw, 'base64url').toString('utf8')
      } catch {
        return ''
      }
    })(),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      /* try next format */
    }
  }

  return null
}

function getAuthClaimSecret() {
  return String(
    process.env.PORTFOLIO_AUTH_SECRET ||
      process.env.PF_AUTH_SECRET ||
      process.env.AUTH_CLAIM_SECRET ||
      ''
  ).trim()
}

function isProductionServerRuntime() {
  return Boolean(process.env.VERCEL) || process.env.VERCEL_ENV === 'production'
}

function decodeBase64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function signSegments(unsignedToken, secret) {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url')
}

function signaturesMatch(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''))
  const expectedBuffer = Buffer.from(String(expected || ''))
  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function signAuthClaim(
  claim,
  {
    secret = getAuthClaimSecret(),
    now = Math.floor(Date.now() / 1000),
    ttlSeconds = 5 * 60,
    issuer = AUTH_CLAIM_ISSUER,
    audience = AUTH_CLAIM_AUDIENCE,
  } = {}
) {
  if (!secret) throw new Error('PORTFOLIO_AUTH_SECRET is required to sign auth claims')
  const payload = {
    ...claim,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + ttlSeconds,
  }
  const headerSegment = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  )
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const unsignedToken = `${headerSegment}.${payloadSegment}`
  return `${unsignedToken}.${signSegments(unsignedToken, secret)}`
}

export function verifySignedAuthClaim(
  token,
  {
    secret = getAuthClaimSecret(),
    now = Math.floor(Date.now() / 1000),
    issuer = AUTH_CLAIM_ISSUER,
    audience = AUTH_CLAIM_AUDIENCE,
  } = {}
) {
  if (!secret) return null
  const parts = String(token || '')
    .trim()
    .split('.')
  if (parts.length !== 3) return null

  const [headerSegment, payloadSegment, signature] = parts
  const header = decodeBase64UrlJson(headerSegment)
  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null

  const unsignedToken = `${headerSegment}.${payloadSegment}`
  const expectedSignature = signSegments(unsignedToken, secret)
  if (!signaturesMatch(signature, expectedSignature)) return null

  const payload = decodeBase64UrlJson(payloadSegment)
  if (!payload || payload.iss !== issuer || payload.aud !== audience) return null
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= now) return null
  return payload
}

function decodeAuthClaimValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const decodedRaw = (() => {
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  })()
  const signedClaim = verifySignedAuthClaim(decodedRaw)
  if (signedClaim) return signedClaim

  if (isProductionServerRuntime()) return null
  return decodeJsonClaim(raw)
}

export function getPortfolioPolicy(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  if (!normalized) return null

  const policy = PORTFOLIO_POLICIES[normalized]
  return policy ? { ...policy } : null
}

export function getPortfolioIdFromRequest(req) {
  const bodyId = req?.body?.portfolioId
  if (bodyId != null && String(bodyId).trim()) {
    return String(bodyId).trim()
  }

  const queryId = req?.query?.portfolioId
  if (queryId != null && String(queryId).trim()) {
    return String(queryId).trim()
  }

  return ''
}

export function getAuthClaimFromRequest(req) {
  const cookies = parseCookieHeader(getHeader(req, 'cookie'))

  for (const cookieName of AUTH_CLAIM_COOKIE_NAMES) {
    const claim = decodeAuthClaimValue(cookies[cookieName])
    if (claim) {
      return claim
    }
  }

  return null
}

export function normalizeAuthClaim(claim) {
  const userId = String(claim?.userId || '').trim()
  const role = String(claim?.role || '')
    .trim()
    .toLowerCase()

  if (!userId || !['admin', 'user'].includes(role)) return null
  return { userId, role }
}
