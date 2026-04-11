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
    holdings = [],
    tradeLog = [],
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

  const tradeRuntime = useTradeCaptureRuntime({
    holdings,
    tradeLog,
    setHoldings: blockedSetHoldings,
    setTradeLog: blockedSetTradeLog,
    upsertTargetReport: blockedUpsertTargetReport,
    updateTargetPrice: blockedUpdateTargetPrice,
    upsertFundamentalsEntry: blockedUpsertFundamentalsEntry,
    applyTradeEntryToHoldings,
    createDefaultFundamentalDraft,
    toSlashDate,
    flashSaved,
  })

  return useMemo(
    () => ({
      ...tradeRuntime,
      submitMemo: (..._args) => {
        warnBlockedRouteWrite('submitTradeMemo')
        return false
      },
      skipMemo: (..._args) => {
        warnBlockedRouteWrite('skipTradeMemo')
        return false
      },
      upsertTargetReport: blockedUpsertTargetReport,
      upsertFundamentalsEntry: blockedUpsertFundamentalsEntry,
    }),
    [blockedUpsertFundamentalsEntry, blockedUpsertTargetReport, tradeRuntime]
  )
}
