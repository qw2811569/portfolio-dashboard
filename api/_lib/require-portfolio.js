import {
  getAuthClaimFromRequest,
  getPortfolioPolicy,
  normalizeAuthClaim,
} from './portfolio-policy.js'

export class PortfolioAccessError extends Error {
  constructor(message, { status = 403, code = 'forbidden' } = {}) {
    super(message)
    this.name = 'PortfolioAccessError'
    this.status = status
    this.code = code
  }
}

export function requirePortfolio(req, portfolioId, { allowMissing = false } = {}) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId) {
    if (allowMissing) return null
    throw new PortfolioAccessError('portfolioId is required', {
      status: 400,
      code: 'missing_portfolio_id',
    })
  }

  const portfolio = getPortfolioPolicy(normalizedPortfolioId)
  if (!portfolio) {
    throw new PortfolioAccessError(`Unknown portfolio: ${normalizedPortfolioId}`, {
      status: 404,
      code: 'portfolio_not_found',
    })
  }

  const claim = normalizeAuthClaim(getAuthClaimFromRequest(req))
  if (!claim) {
    throw new PortfolioAccessError('Missing or invalid auth claim', {
      status: 401,
      code: 'missing_auth_claim',
    })
  }

  if (claim.role === 'admin') {
    return portfolio
  }

  if (portfolio.owner !== claim.userId) {
    throw new PortfolioAccessError('Forbidden', {
      status: 403,
      code: 'portfolio_forbidden',
    })
  }

  return portfolio
}
