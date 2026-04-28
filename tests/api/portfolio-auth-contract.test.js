import { afterEach, describe, expect, it } from 'vitest'
import { signAuthClaim, verifySignedAuthClaim } from '../../api/_lib/portfolio-policy.js'
import { PortfolioAccessError, requirePortfolio } from '../../api/_lib/require-portfolio.js'

const SECRET = 'test-secret-for-hmac-contract'
const NOW = 2_000_000_000

function withSecret(fn) {
  const previousSecret = process.env.PORTFOLIO_AUTH_SECRET
  const previousVercel = process.env.VERCEL
  process.env.PORTFOLIO_AUTH_SECRET = SECRET
  process.env.VERCEL = '1'
  try {
    return fn()
  } finally {
    if (previousSecret == null) delete process.env.PORTFOLIO_AUTH_SECRET
    else process.env.PORTFOLIO_AUTH_SECRET = previousSecret
    if (previousVercel == null) delete process.env.VERCEL
    else process.env.VERCEL = previousVercel
  }
}

function reqForToken(token) {
  return {
    headers: {
      cookie: `pf_auth_claim=${encodeURIComponent(token)}`,
    },
  }
}

describe('portfolio auth claim contract', () => {
  afterEach(() => {
    delete process.env.PORTFOLIO_AUTH_SECRET
    delete process.env.VERCEL
  })

  it('accepts a signed owner claim with issuer, audience, and expiry', () => {
    withSecret(() => {
      const token = signAuthClaim(
        { userId: 'jinliancheng-chairwoman', role: 'user' },
        { secret: SECRET, now: NOW, ttlSeconds: 60 }
      )

      expect(verifySignedAuthClaim(token, { secret: SECRET, now: NOW + 30 })).toMatchObject({
        userId: 'jinliancheng-chairwoman',
        role: 'user',
        iss: 'portfolio-dashboard',
        aud: 'portfolio-api',
        exp: NOW + 60,
      })
      expect(requirePortfolio(reqForToken(token), 'jinliancheng')).toMatchObject({
        id: 'jinliancheng',
      })
    })
  })

  it('rejects a forged unsigned admin claim in production', () => {
    withSecret(() => {
      const forged = JSON.stringify({ userId: 'attacker', role: 'admin' })

      expect(() => requirePortfolio(reqForToken(forged), 'jinliancheng')).toThrow(
        PortfolioAccessError
      )
      try {
        requirePortfolio(reqForToken(forged), 'jinliancheng')
      } catch (error) {
        expect(error.status).toBe(401)
        expect(error.code).toBe('missing_auth_claim')
      }
    })
  })

  it('rejects an expired signed claim', () => {
    withSecret(() => {
      const token = signAuthClaim(
        { userId: 'jinliancheng-chairwoman', role: 'user' },
        { secret: SECRET, now: 1_000, ttlSeconds: 60 }
      )

      expect(verifySignedAuthClaim(token, { secret: SECRET, now: 2_000 })).toBe(null)
      expect(() => requirePortfolio(reqForToken(token), 'jinliancheng')).toThrow(
        PortfolioAccessError
      )
    })
  })

  it('rejects a token with the wrong signature', () => {
    withSecret(() => {
      const token = signAuthClaim(
        { userId: 'jinliancheng-chairwoman', role: 'user' },
        { secret: SECRET, now: NOW, ttlSeconds: 60 }
      )
      const [header, payload] = token.split('.')
      const tampered = `${header}.${payload}.not-the-signature`

      expect(verifySignedAuthClaim(tampered, { secret: SECRET, now: NOW + 30 })).toBe(null)
      expect(() => requirePortfolio(reqForToken(tampered), 'jinliancheng')).toThrow(
        PortfolioAccessError
      )
    })
  })
})
