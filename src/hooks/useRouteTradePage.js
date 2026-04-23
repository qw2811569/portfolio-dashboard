import { useCallback, useMemo } from 'react'
import { useTradeCaptureRuntime } from './useTradeCaptureRuntime.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteTradePage() {
  const {
    portfolioId = 'me',
    holdings = [],
    tradeLog = [],
    setHoldings: routeSetHoldings,
    setTradeLog: routeSetTradeLog,
    upsertTargetReport: routeUpsertTargetReport,
    updateTargetPrice: routeUpdateTargetPrice,
    upsertFundamentalsEntry: routeUpsertFundamentalsEntry,
    applyTradeEntryToHoldings = (rows) => rows,
    createDefaultFundamentalDraft = () => ({}),
    toSlashDate = () => new Date().toISOString().slice(0, 10),
    flashSaved = () => {},
  } = usePortfolioRouteContext()

  const blockedSetHoldings = useCallback((..._args) => {
    warnBlockedRouteWrite('setHoldings')
  }, [])
  const blockedSetTradeLog = useCallback((..._args) => {
    warnBlockedRouteWrite('setTradeLog')
  }, [])
  const blockedUpsertTargetReport = useCallback((..._args) => {
    warnBlockedRouteWrite('upsertTargetReport')
    return false
  }, [])
  const blockedUpdateTargetPrice = useCallback((..._args) => {
    warnBlockedRouteWrite('updateTargetPrice')
    return false
  }, [])
  const blockedUpsertFundamentalsEntry = useCallback((..._args) => {
    warnBlockedRouteWrite('upsertFundamentalsEntry')
    return false
  }, [])

  const setHoldings = routeSetHoldings || blockedSetHoldings
  const setTradeLog = routeSetTradeLog || blockedSetTradeLog
  const upsertTargetReport = routeUpsertTargetReport || blockedUpsertTargetReport
  const updateTargetPrice = routeUpdateTargetPrice || blockedUpdateTargetPrice
  const upsertFundamentalsEntry = routeUpsertFundamentalsEntry || blockedUpsertFundamentalsEntry

  const tradeRuntime = useTradeCaptureRuntime({
    portfolioId,
    holdings,
    tradeLog,
    setHoldings,
    setTradeLog,
    upsertTargetReport,
    updateTargetPrice,
    upsertFundamentalsEntry,
    applyTradeEntryToHoldings,
    createDefaultFundamentalDraft,
    toSlashDate,
    flashSaved,
  })

  return useMemo(() => tradeRuntime, [tradeRuntime])
}
