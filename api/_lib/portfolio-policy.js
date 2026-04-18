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
    const claim = decodeJsonClaim(cookies[cookieName])
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
