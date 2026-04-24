import { useMemo } from 'react'
import { buildResearchRefreshRows } from '../lib/routeRuntime.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'
import { resolveViewMode } from '../lib/viewModeContract.js'

export function useRouteDashboardPage() {
  const {
    holdings = [],
    watchlist = [],
    holdingDossiers = [],
    targets = {},
    fundamentals = {},
    todayTotalPnl = 0,
    newsEvents = [],
    dailyReport,
    urgentCount = 0,
    todayAlertSummary = '',
    portfolioId,
    portfolioName,
  } = usePortfolioRouteContext()

  return useMemo(() => {
    const totalVal = holdings.reduce((sum, item) => sum + (item.value || 0), 0)
    const totalCost = holdings.reduce(
      (sum, item) => sum + (Number(item.cost) || 0) * (Number(item.qty) || 0),
      0
    )
    const winners = [...holdings]
      .filter((item) => (item.pct || 0) > 0)
      .sort((a, b) => (b.pct || 0) - (a.pct || 0))
    const losers = [...holdings]
      .filter((item) => (item.pct || 0) < 0)
      .sort((a, b) => (a.pct || 0) - (b.pct || 0))

    const latestInsight = dailyReport?.insight || dailyReport?.aiInsight || null
    const dataRefreshRows = buildResearchRefreshRows({ holdings, targets, fundamentals })

    return {
      holdings,
      watchlist,
      holdingDossiers,
      dataRefreshRows,
      dailyReport,
      todayTotalPnl,
      totalVal,
      totalCost,
      winners,
      losers,
      latestInsight,
      newsEvents,
      urgentCount,
      todayAlertSummary,
      portfolioId,
      portfolioName,
      viewMode: resolveViewMode({
        portfolio: {
          id: portfolioId,
          name: portfolioName,
          displayName: portfolioName,
          isOwner: portfolioId === 'me',
        },
        currentUser: 'me',
      }),
    }
  }, [
    holdings,
    watchlist,
    holdingDossiers,
    targets,
    fundamentals,
    todayTotalPnl,
    newsEvents,
    dailyReport,
    urgentCount,
    todayAlertSummary,
    portfolioId,
    portfolioName,
  ])
}
