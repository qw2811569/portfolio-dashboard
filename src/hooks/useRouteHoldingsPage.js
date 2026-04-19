import { useMemo } from 'react'
import { useBrainStore } from '../stores/brainStore.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteHoldingsPage() {
  const {
    portfolioId = '',
    holdings = [],
    holdingDossiers = [],
    todayTotalPnl = 0,
    reversalConditions = {},
  } = usePortfolioRouteContext()

  const expandedStock = useBrainStore((state) => state.expandedStock)
  const setExpandedStock = useBrainStore((state) => state.setExpandedStock)

  return useMemo(() => {
    const blockUpdateTargetPrice = (..._args) => {
      warnBlockedRouteWrite('updateTargetPrice')
      return false
    }
    const blockUpdateAlert = (..._args) => {
      warnBlockedRouteWrite('updateAlert')
      return false
    }
    const blockUpdateReversal = (..._args) => {
      warnBlockedRouteWrite('updateReversal')
      return false
    }
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
    const holdingsIntegrityIssues = holdings.filter(
      (item) => item.integrityIssue === 'missing-price'
    )
    const dossierByCode = new Map(
      (Array.isArray(holdingDossiers) ? holdingDossiers : []).map((dossier) => [
        dossier.code,
        dossier,
      ])
    )

    return {
      panelProps: {
        activePortfolioId: portfolioId,
        holdings,
        totalVal,
        totalCost,
        todayTotalPnl,
        winners,
        losers,
        holdingsIntegrityIssues,
        showReversal: false,
        setShowReversal: () => {},
        reversalConditions,
        updateReversal: blockUpdateReversal,
      },
      tableProps: {
        holdings,
        dossierByCode,
        expandedStock,
        setExpandedStock,
        onUpdateTarget: blockUpdateTargetPrice,
        onUpdateAlert: blockUpdateAlert,
      },
    }
  }, [
    expandedStock,
    holdingDossiers,
    holdings,
    portfolioId,
    todayTotalPnl,
    reversalConditions,
    setExpandedStock,
  ])
}
