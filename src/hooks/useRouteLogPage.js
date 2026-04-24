import { useMemo } from 'react'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

export function useRouteLogPage() {
  const { portfolioId = '', tradeLog = [] } = usePortfolioRouteContext()

  return useMemo(() => ({ portfolioId, tradeLog }), [portfolioId, tradeLog])
}
