const AUTH_COOKIE_NAMES = ['pf_auth_claim', 'portfolio_auth_claim', 'portfolio_claim']

function parseCookieString(value = '') {
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

function decodeBase64UrlJson(value = '') {
  try {
    const base64 = String(value || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function decodeReadableAuthPayload(token = '') {
  const decoded = (() => {
    try {
      return decodeURIComponent(String(token || '').trim())
    } catch {
      return String(token || '').trim()
    }
  })()
  const parts = decoded.split('.')
  if (parts.length === 3) return decodeBase64UrlJson(parts[1])

  try {
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export function getReadableAuthSessionState({
  cookieString = typeof document === 'undefined' ? '' : document.cookie,
  nowMs = Date.now(),
} = {}) {
  const cookies = parseCookieString(cookieString)
  const token = AUTH_COOKIE_NAMES.map((name) => cookies[name]).find(Boolean)
  if (!token) return { available: false, reason: 'missing' }

  const payload = decodeReadableAuthPayload(token)
  if (!payload) return { available: true, reason: 'opaque' }

  const exp = Number(payload.exp)
  if (Number.isFinite(exp) && exp * 1000 <= nowMs) {
    return { available: false, reason: 'expired', exp }
  }

  return { available: true, reason: 'valid', exp: Number.isFinite(exp) ? exp : null }
}

export function isReadableAuthSessionAvailable(options) {
  return getReadableAuthSessionState(options).available
}
