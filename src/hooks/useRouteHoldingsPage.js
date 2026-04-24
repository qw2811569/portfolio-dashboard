import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useBrainStore } from '../stores/brainStore.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'
import { resolveViewMode } from '../lib/viewModeContract.js'
import { buildHoldingDetailDossier } from '../lib/holdingDetailDossier.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteHoldingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    portfolioId = '',
    portfolioName = '',
    holdings = [],
    holdingDossiers = [],
    newsEvents = [],
    dailyReport = null,
    analysisHistory = [],
    researchHistory = [],
    strategyBrain = null,
    todayTotalPnl = 0,
    reversalConditions = {},
  } = usePortfolioRouteContext()

  const expandedStock = useBrainStore((state) => state.expandedStock)
  const setExpandedStock = useBrainStore((state) => state.setExpandedStock)
  const viewMode = resolveViewMode({
    portfolio: {
      id: portfolioId,
      name: portfolioName,
      displayName: portfolioName,
      isOwner: portfolioId === 'me',
    },
    currentUser: 'me',
  })
  const detailStockCode = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return String(params.get('stock') || '').trim() || null
  }, [location.search])

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
    const detailDossier = buildHoldingDetailDossier({
      code: detailStockCode,
      holdings,
      holdingDossiers,
      dailyReport,
      analysisHistory,
      researchHistory,
      newsEvents,
      strategyBrain,
    })
    const updateStockSearchParam = (nextCode = null) => {
      const params = new URLSearchParams(location.search)
      if (nextCode) params.set('stock', nextCode)
      else params.delete('stock')
      const search = params.toString()
      navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : '',
        },
        { replace: false }
      )
    }

    return {
      panelProps: {
        activePortfolioId: portfolioId,
        holdings,
        holdingDossiers,
        newsEvents,
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
        detailStockCode,
        detailDossier,
        onOpenDetail: (code) => updateStockSearchParam(String(code || '').trim() || null),
        onCloseDetail: () => updateStockSearchParam(null),
        onUpdateTarget: blockUpdateTargetPrice,
        onUpdateAlert: blockUpdateAlert,
        thesisWriteEnabled: false,
        onUpsertThesis: () => false,
        viewMode,
      },
    }
  }, [
    expandedStock,
    detailStockCode,
    dailyReport,
    analysisHistory,
    holdingDossiers,
    holdings,
    newsEvents,
    researchHistory,
    strategyBrain,
    location.pathname,
    location.search,
    navigate,
    portfolioId,
    todayTotalPnl,
    reversalConditions,
    setExpandedStock,
    viewMode,
  ])
}
