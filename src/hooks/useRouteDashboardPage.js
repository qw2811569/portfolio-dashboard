import { useMemo } from 'react'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

export function useRouteDashboardPage() {
  const {
    holdings = [],
    todayTotalPnl = 0,
    newsEvents = [],
    dailyReport,
    urgentCount = 0,
    todayAlertSummary = '',
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

    return {
      holdings,
      todayTotalPnl,
      totalVal,
      totalCost,
      winners,
      losers,
      latestInsight,
      newsEvents,
      urgentCount,
      todayAlertSummary,
    }
  }, [holdings, todayTotalPnl, newsEvents, dailyReport, urgentCount, todayAlertSummary])
}
