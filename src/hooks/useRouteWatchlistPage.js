import { useMemo } from 'react'
import { useBrainStore } from '../stores/brainStore.js'
import { formatEventStockOutcomeLine } from '../lib/eventUtils.js'
import { buildWatchlistRows } from '../lib/routeRuntime.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteWatchlistPage() {
  const { watchlist = [], newsEvents = [] } = usePortfolioRouteContext()

  const expandedStock = useBrainStore((state) => state.expandedStock)
  const setExpandedStock = useBrainStore((state) => state.setExpandedStock)

  return useMemo(() => {
    const blockUpsertWatchlist = (..._args) => {
      warnBlockedRouteWrite('upsertWatchlist')
      return false
    }
    const blockRemoveWatchlist = (..._args) => {
      warnBlockedRouteWrite('removeWatchlist')
      return false
    }
    const watchlistRows = buildWatchlistRows({ watchlist, newsEvents })
    const watchlistFocus =
      watchlistRows.length > 0
        ? [...watchlistRows].sort(
            (a, b) => b.trackingCount + b.pendingCount - (a.trackingCount + a.pendingCount)
          )[0]
        : null

    return {
      watchlistFocus,
      watchlistRows,
      expandedStock,
      setExpandedStock,
      onUpsertItem: blockUpsertWatchlist,
      handleWatchlistDelete: blockRemoveWatchlist,
      formatEventStockOutcomeLine,
    }
  }, [expandedStock, newsEvents, setExpandedStock, watchlist])
}
