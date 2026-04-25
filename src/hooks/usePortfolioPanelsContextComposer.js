import { useMemo } from 'react'
import { buildAnxietyMetrics } from '../lib/anxietyMetrics.js'
import { buildDashboardHeadline } from '../lib/dashboardHeadline.js'
import { buildHoldingDetailDossier } from '../lib/holdingDetailDossier.js'
import {
  buildDashboardCompareStrip,
  buildOverviewDashboardHeadline,
} from '../lib/overviewCompare.js'
import { displayPortfolioName } from '../lib/portfolioDisplay.js'

const EMPTY_LIST = []

function resolvePendingEventsCount(portfolio) {
  const explicitCount = Number(portfolio?.pendingEventsCount)
  if (Number.isFinite(explicitCount)) return explicitCount

  if (Array.isArray(portfolio?.pendingEvents)) return portfolio.pendingEvents.length

  const fallbackCount = Number(portfolio?.pendingEvents)
  return Number.isFinite(fallbackCount) ? fallbackCount : 0
}

export function usePortfolioPanelsContextComposer({
  ready = true,
  activePortfolioId,
  overviewPortfolios,
  overviewTotalValue,
  overviewTotalPnl,
  overviewDuplicateHoldings,
  overviewPendingItems,
  holdings,
  watchlist,
  holdingDossiers,
  totalVal,
  totalCost,
  todayTotalPnl,
  todayPnlHasPriceData,
  todayPnlIsStale,
  urgentCount,
  todayAlertSummary,
  winners,
  losers,
  top5,
  holdingsIntegrityIssues,
  showReversal,
  reversalConditions,
  reviewingEvent,
  attentionCount,
  attentionSummary,
  pendingCount,
  targetUpdateCount,
  scanQuery,
  scanFilter,
  sortBy,
  expandedStock,
  detailStockCode,
  watchlistFocus,
  watchlistRows,
  showRelayPlan,
  relayPlanExpanded,
  filterType,
  filteredEvents,
  catalystFilter,
  morningNote,
  dailySnapshotStatus,
  dailyReport,
  x1BenchmarkState,
  analysisHistory,
  analyzing,
  analyzeStep,
  stressResult,
  stressTesting,
  dailyExpanded,
  newsEvents,
  strategyBrain,
  renderViewMode = 'retail',
  researching,
  researchTarget,
  reportRefreshing,
  reportRefreshStatus,
  reportRefreshMeta = {},
  dataRefreshRows,
  marketPriceSync,
  researchResults,
  researchHistory,
  analystReports,
  enrichingResearchCode,
  proposalActionId,
  proposalActionType,
  tradeLog,
  reviewForm,
  expandedNews,
  stockMeta,
  indColor,
  tradeCapture,
  exitOverview,
  switchPortfolio,
  setShowReversal,
  setReviewingEvent,
  updateReversal,
  setScanQuery,
  setScanFilter,
  setSortBy,
  setExpandedStock,
  setDetailStockCode,
  updateTargetPrice,
  updateAlert,
  upsertThesis,
  handleWatchlistUpsert,
  handleWatchlistDelete,
  formatEventStockOutcomeLine,
  setRelayPlanExpanded,
  setFilterType,
  setCatalystFilter,
  setDailyExpanded,
  runDailyAnalysis,
  maybeAutoConfirmDailyReport,
  runStressTest,
  setStressResult,
  setTab,
  setExpandedNews,
  refreshAnalystReports,
  runResearch,
  applyBrainProposal,
  discardBrainProposal,
  enrichResearchToDossier,
  setResearchResults,
  setReviewForm,
  submitReview,
  cancelReview,
  createDefaultReviewForm,
}) {
  const safeOverviewPortfolios = Array.isArray(overviewPortfolios) ? overviewPortfolios : EMPTY_LIST
  const safeOverviewDuplicateHoldings = Array.isArray(overviewDuplicateHoldings)
    ? overviewDuplicateHoldings
    : EMPTY_LIST
  const safeOverviewPendingItems = Array.isArray(overviewPendingItems)
    ? overviewPendingItems
    : EMPTY_LIST
  const safeHoldings = Array.isArray(holdings) ? holdings : EMPTY_LIST
  const safeWatchlist = Array.isArray(watchlist) ? watchlist : EMPTY_LIST
  const safeHoldingDossiers = Array.isArray(holdingDossiers) ? holdingDossiers : EMPTY_LIST
  const safeNewsEvents = Array.isArray(newsEvents) ? newsEvents : EMPTY_LIST
  const safeAnalysisHistory = Array.isArray(analysisHistory) ? analysisHistory : EMPTY_LIST
  const safeResearchHistory = Array.isArray(researchHistory) ? researchHistory : EMPTY_LIST
  const safeDataRefreshRows = Array.isArray(dataRefreshRows) ? dataRefreshRows : EMPTY_LIST
  const latestInsight = dailyReport?.insight || dailyReport?.aiInsight || null
  const dossierByCode = useMemo(
    () => new Map(safeHoldingDossiers.map((dossier) => [dossier.code, dossier])),
    [safeHoldingDossiers]
  )
  const sharedStaleStatus = useMemo(() => {
    let nextStatus = 'fresh'
    const rank = { fresh: 0, stale: 1, missing: 2, failed: 3 }

    for (const dossier of safeHoldingDossiers) {
      for (const value of Object.values(dossier?.freshness || {})) {
        const normalized =
          value === 'aging'
            ? 'stale'
            : ['fresh', 'stale', 'missing', 'failed'].includes(value)
              ? value
              : ''
        if (!normalized) continue
        if (rank[normalized] > rank[nextStatus]) nextStatus = normalized
      }
    }

    return nextStatus
  }, [safeHoldingDossiers])

  const dashboardHeadline = useMemo(
    () =>
      buildDashboardHeadline(safeHoldingDossiers, {
        viewMode: renderViewMode,
      }),
    [renderViewMode, safeHoldingDossiers]
  )
  const normalizedOverviewPortfolios = useMemo(
    () =>
      safeOverviewPortfolios.map((portfolio) => ({
        ...portfolio,
        pendingEventsCount: resolvePendingEventsCount(portfolio),
      })),
    [safeOverviewPortfolios]
  )
  const activePortfolio = useMemo(
    () =>
      normalizedOverviewPortfolios.find((portfolio) => portfolio?.id === activePortfolioId) || {
        id: activePortfolioId,
      },
    [activePortfolioId, normalizedOverviewPortfolios]
  )
  const overviewCompareStrip = useMemo(
    () =>
      buildDashboardCompareStrip(normalizedOverviewPortfolios, {
        activePortfolioId,
        staleStatus: sharedStaleStatus,
      }),
    [activePortfolioId, normalizedOverviewPortfolios, sharedStaleStatus]
  )
  const overviewDashboardHeadline = useMemo(
    () =>
      buildOverviewDashboardHeadline({
        compareStrip: overviewCompareStrip,
        portfolioCount: normalizedOverviewPortfolios.length,
        duplicateHoldingsCount: safeOverviewDuplicateHoldings.length,
        pendingItemsCount: safeOverviewPendingItems.length,
      }),
    [
      overviewCompareStrip,
      normalizedOverviewPortfolios.length,
      safeOverviewDuplicateHoldings.length,
      safeOverviewPendingItems.length,
    ]
  )
  const overviewLoading = ready === false && normalizedOverviewPortfolios.length === 0
  const derivedAnxietyMetrics = useMemo(
    () =>
      buildAnxietyMetrics({
        holdings: safeHoldings,
        holdingDossiers: safeHoldingDossiers,
        newsEvents: safeNewsEvents,
        dailyReport,
        x1Benchmark: x1BenchmarkState,
        stockMeta,
        loading:
          ready === false &&
          safeHoldings.length === 0 &&
          safeHoldingDossiers.length === 0 &&
          safeNewsEvents.length === 0,
      }),
    [
      dailyReport,
      ready,
      safeHoldingDossiers,
      safeHoldings,
      safeNewsEvents,
      stockMeta,
      x1BenchmarkState,
    ]
  )
  const detailDossier = useMemo(
    () =>
      buildHoldingDetailDossier({
        code: detailStockCode,
        holdings: safeHoldings,
        holdingDossiers: safeHoldingDossiers,
        dailyReport,
        analysisHistory: safeAnalysisHistory,
        researchHistory: safeResearchHistory,
        newsEvents: safeNewsEvents,
        strategyBrain,
      }),
    [
      detailStockCode,
      dailyReport,
      safeAnalysisHistory,
      safeHoldings,
      safeHoldingDossiers,
      safeNewsEvents,
      safeResearchHistory,
      strategyBrain,
    ]
  )

  const actionableRefreshRows = useMemo(
    () =>
      safeDataRefreshRows.filter((row) => {
        const status = String(row?.targetStatus || '').toLowerCase()
        return status === 'missing' || status === 'failed'
      }),
    [safeDataRefreshRows]
  )

  const operatingContext = useMemo(() => {
    const pendingEventCount = safeNewsEvents.filter((event) => event?.status === 'pending').length
    const trackingEventCount = safeNewsEvents.filter((event) => event?.status === 'tracking').length
    const autoReviewedEvents = safeNewsEvents.filter((event) => event?.autoReviewed === true)
    const autoReviewedCorrect = autoReviewedEvents.filter((event) => event?.correct === true).length
    const autoReviewedWrong = autoReviewedEvents.filter((event) => event?.correct === false).length

    const refreshBacklogCount = actionableRefreshRows.length
    const focusItem = watchlistFocus?.item || null
    const focusSummary = watchlistFocus?.summary || watchlistFocus?.action || ''
    const hasInsight = Boolean(latestInsight)

    let nextActionLabel = '持倉健檢與待處理事件都整理在這裡'
    let nextActionReason = '目前持股、觀察名單與事件清單可以一起對照主線。'

    if (refreshBacklogCount > 0) {
      nextActionLabel = '資料補齊中 · 研究結論會跟著更新'
      nextActionReason = `目前還有 ${refreshBacklogCount} 檔尚未取得目標價。資料到位後，研究與事件判讀會更一致。`
    } else if (
      autoReviewedEvents.length > 0 &&
      pendingEventCount === 0 &&
      trackingEventCount === 0
    ) {
      nextActionLabel = `事件自動復盤完成：${autoReviewedCorrect} 件正確、${autoReviewedWrong} 件錯誤`
      nextActionReason = `共 ${autoReviewedEvents.length} 件事件已自動驗證預測方向與實際走勢，可直接查看結果。`
    } else if (pendingCount > 0 || pendingEventCount > 0 || trackingEventCount > 0) {
      const remaining = Math.max(pendingCount, pendingEventCount) + trackingEventCount
      nextActionLabel = `還有 ${remaining} 件事件等待自動復盤`
      nextActionReason = '事件將在取得收盤價後自動驗證，不需手動操作。'
    } else if (focusItem) {
      nextActionLabel = `先聚焦 ${focusItem.name} 的事件追蹤`
      nextActionReason =
        watchlistFocus?.action || focusSummary || '先看焦點標的與相關事件是否支持下一步操作。'
    } else if (hasInsight) {
      nextActionLabel = '先延續最近一次收盤分析的結論'
      nextActionReason = latestInsight
    }

    return {
      portfolio: activePortfolio,
      portfolioLabel: displayPortfolioName(activePortfolio),
      holdingsCount: safeHoldings.length,
      pendingCount,
      attentionCount,
      attentionSummary,
      activeEventCount: pendingEventCount + trackingEventCount,
      autoReviewedCount: autoReviewedEvents.length,
      autoReviewedCorrect,
      autoReviewedWrong,
      refreshBacklogCount,
      refreshBacklogItems: actionableRefreshRows,
      headline: dashboardHeadline.headline,
      headlineTone: dashboardHeadline.tone,
      lastAnalysisLabel: dailyReport?.date
        ? [dailyReport.date, dailyReport.time].filter(Boolean).join(' ')
        : '',
      latestInsightSummary: latestInsight,
      nextActionLabel,
      nextActionReason,
      focus: focusItem
        ? {
            code: focusItem.code,
            name: focusItem.name,
            summary: focusSummary,
            upsideLabel:
              typeof watchlistFocus?.upside === 'number'
                ? `潛在 ${watchlistFocus.upside >= 0 ? '+' : ''}${watchlistFocus.upside.toFixed(1)}%`
                : '',
          }
        : null,
    }
  }, [
    activePortfolio,
    actionableRefreshRows,
    attentionCount,
    attentionSummary,
    dashboardHeadline,
    dailyReport,
    safeHoldings.length,
    latestInsight,
    safeNewsEvents,
    pendingCount,
    watchlistFocus,
  ])

  const portfolioPanelsData = useMemo(
    () => ({
      anxietyMetrics: derivedAnxietyMetrics,
      overview: {
        portfolioCount: normalizedOverviewPortfolios.length,
        totalValue: overviewTotalValue,
        totalPnl: overviewTotalPnl,
        portfolios: normalizedOverviewPortfolios,
        activePortfolioId,
        duplicateHoldings: safeOverviewDuplicateHoldings,
        pendingItems: safeOverviewPendingItems,
        watchlistCount: Array.isArray(watchlistRows) ? watchlistRows.length : 0,
        staleStatus: sharedStaleStatus,
        missingTargetCount: actionableRefreshRows.length,
        dashboardHeadline: overviewDashboardHeadline,
        compareStrip: overviewCompareStrip,
        loading: overviewLoading,
      },
      dashboard: {
        holdings: safeHoldings,
        watchlist: safeWatchlist,
        holdingDossiers: safeHoldingDossiers,
        dataRefreshRows: safeDataRefreshRows,
        morningNote,
        dailySnapshotStatus,
        dailyReport,
        todayTotalPnl,
        todayPnlHasPriceData,
        todayPnlIsStale,
        totalVal,
        totalCost,
        winners,
        losers,
        latestInsight,
        newsEvents: safeNewsEvents,
        urgentCount,
        todayAlertSummary,
        portfolioId: activePortfolioId,
        portfolioName: activePortfolio?.displayName || activePortfolio?.name || '',
        viewMode: renderViewMode,
        compareStrip: overviewCompareStrip,
        anxietyMetrics: derivedAnxietyMetrics,
        reportRefreshMeta,
        marketPriceSync,
      },
      holdings: {
        activePortfolioId,
        holdings: safeHoldings,
        holdingDossiers: safeHoldingDossiers,
        newsEvents: safeNewsEvents,
        totalVal,
        totalCost,
        todayTotalPnl,
        todayPnlHasPriceData,
        todayPnlIsStale,
        winners,
        losers,
        top5,
        holdingsIntegrityIssues,
        showReversal,
        reversalConditions,
        reviewingEvent,
        attentionCount,
        pendingCount,
        targetUpdateCount,
        scanQuery,
        scanFilter,
        sortBy,
        expandedStock,
        latestInsight,
        operatingContext,
        reportRefreshMeta,
        marketPriceSync,
      },
      holdingsTable: {
        holdings: safeHoldings,
        expandedStock,
        detailStockCode,
        detailDossier,
        dossierByCode,
        staleStatus: sharedStaleStatus,
        viewMode: renderViewMode,
        thesisWriteEnabled: typeof upsertThesis === 'function',
        onUpsertThesis: upsertThesis,
      },
      watchlist: {
        watchlistFocus,
        watchlistRows,
        expandedStock,
        operatingContext,
      },
      events: {
        showRelayPlan,
        relayPlanExpanded,
        filterType,
        filteredEvents,
        catalystFilter,
        staleStatus: sharedStaleStatus,
        operatingContext,
      },
      daily: {
        morningNote,
        dailyReport,
        analysisHistory: safeAnalysisHistory,
        analyzing,
        analyzeStep,
        stressResult,
        stressTesting,
        dailyExpanded,
        newsEvents: safeNewsEvents,
        expandedStock,
        strategyBrain,
        staleStatus: sharedStaleStatus,
        operatingContext,
        maybeAutoConfirmDailyReport,
        viewMode: renderViewMode,
      },
      research: {
        holdings: safeHoldings,
        holdingDossiers: safeHoldingDossiers,
        researching,
        researchTarget,
        reportRefreshing,
        reportRefreshStatus,
        reportRefreshMeta,
        dataRefreshRows: safeDataRefreshRows,
        researchResults,
        researchHistory: safeResearchHistory,
        analystReports,
        enrichingResearchCode,
        proposalActionId,
        proposalActionType,
        STOCK_META: stockMeta,
        IND_COLOR: indColor,
        operatingContext,
        viewMode: renderViewMode,
      },
      trade: {
        ...tradeCapture,
      },
      log: {
        portfolioId: activePortfolioId,
        tradeLog,
      },
      news: {
        newsEvents: safeNewsEvents,
        reviewingEvent,
        reviewForm,
        expandedNews,
        operatingContext,
        holdingCodes: safeHoldings.map((h) => h.code).filter(Boolean),
        viewMode: renderViewMode,
      },
    }),
    [
      activePortfolio,
      activePortfolioId,
      actionableRefreshRows,
      analyzing,
      derivedAnxietyMetrics,
      analyzeStep,
      attentionCount,
      catalystFilter,
      dailyExpanded,
      dailyReport,
      detailDossier,
      detailStockCode,
      safeAnalysisHistory,
      safeDataRefreshRows,
      dossierByCode,
      enrichingResearchCode,
      expandedNews,
      expandedStock,
      filterType,
      filteredEvents,
      safeHoldings,
      safeHoldingDossiers,
      holdingsIntegrityIssues,
      indColor,
      latestInsight,
      losers,
      morningNote,
      dailySnapshotStatus,
      safeNewsEvents,
      operatingContext,
      renderViewMode,
      safeOverviewDuplicateHoldings,
      safeOverviewPendingItems,
      normalizedOverviewPortfolios,
      overviewCompareStrip,
      overviewDashboardHeadline,
      overviewLoading,
      overviewTotalPnl,
      overviewTotalValue,
      pendingCount,
      relayPlanExpanded,
      reportRefreshing,
      reportRefreshStatus,
      reportRefreshMeta,
      analystReports,
      marketPriceSync,
      safeResearchHistory,
      researchResults,
      researchTarget,
      researching,
      proposalActionId,
      proposalActionType,
      reviewForm,
      reviewingEvent,
      reversalConditions,
      scanFilter,
      scanQuery,
      showRelayPlan,
      showReversal,
      sharedStaleStatus,
      sortBy,
      stockMeta,
      strategyBrain,
      stressResult,
      stressTesting,
      maybeAutoConfirmDailyReport,
      urgentCount,
      targetUpdateCount,
      todayTotalPnl,
      todayPnlHasPriceData,
      todayPnlIsStale,
      todayAlertSummary,
      top5,
      totalCost,
      totalVal,
      tradeCapture,
      tradeLog,
      safeWatchlist,
      watchlistFocus,
      watchlistRows,
      winners,
      upsertThesis,
    ]
  )

  const portfolioPanelsActions = useMemo(
    () => ({
      overview: {
        onExit: exitOverview,
        onSwitch: switchPortfolio,
      },
      dashboard: {
        onNavigate: setTab,
        onRefreshReminder: () => refreshAnalystReports({ force: true }),
      },
      holdings: {
        setShowReversal,
        setReviewingEvent,
        updateReversal,
        setScanQuery,
        setScanFilter,
        setSortBy,
        setExpandedStock,
      },
      holdingsTable: {
        setExpandedStock,
        onOpenDetail: setDetailStockCode,
        onCloseDetail: () => setDetailStockCode(null),
        onUpdateTarget: updateTargetPrice,
        onUpdateAlert: updateAlert,
        onUpsertThesis: upsertThesis,
      },
      watchlist: {
        setExpandedStock,
        onUpsertItem: handleWatchlistUpsert,
        handleWatchlistDelete,
        formatEventStockOutcomeLine,
      },
      events: {
        setRelayPlanExpanded,
        setFilterType,
        setCatalystFilter,
        onNavigateDaily: () => setTab('daily'),
      },
      daily: {
        setDailyExpanded,
        runDailyAnalysis,
        maybeAutoConfirmDailyReport,
        runStressTest,
        closeStressResult: () => setStressResult(null),
        setTab,
        setExpandedNews,
        setExpandedStock,
      },
      research: {
        onEvolve: () => runResearch('evolve'),
        onRefresh: () => refreshAnalystReports({ force: true }),
        onResearch: runResearch,
        onEnrich: enrichResearchToDossier,
        onApplyProposal: applyBrainProposal,
        onDiscardProposal: discardBrainProposal,
        onSelectHistory: setResearchResults,
      },
      trade: {
        setDragOver: tradeCapture.setDragOver,
        processFile: tradeCapture.processFile,
        processFiles: tradeCapture.processFiles,
        parseShot: tradeCapture.parseShot,
        setParsed: tradeCapture.setParsed,
        setTradeDate: tradeCapture.setTradeDate,
        setMemoIn: tradeCapture.setMemoIn,
        submitMemo: tradeCapture.submitMemo,
        selectUpload: tradeCapture.selectUpload,
        removeUpload: tradeCapture.removeUpload,
        clearUploads: tradeCapture.clearUploads,
        setTpCode: tradeCapture.setTpCode,
        setTpFirm: tradeCapture.setTpFirm,
        setTpVal: tradeCapture.setTpVal,
        setFundamentalDraft: tradeCapture.setFundamentalDraft,
        upsertTargetReport: tradeCapture.upsertTargetReport,
        upsertFundamentalsEntry: tradeCapture.upsertFundamentalsEntry,
        createDefaultFundamentalDraft: tradeCapture.createDefaultFundamentalDraft,
        toSlashDate: tradeCapture.toSlashDate,
      },
      news: {
        setReviewForm,
        submitReview,
        cancelReview,
        setExpandedNews,
        setTab,
        setReviewingEvent,
        createDefaultReviewForm,
        onNavigateDaily: () => setTab('daily'),
      },
    }),
    [
      cancelReview,
      createDefaultReviewForm,
      enrichResearchToDossier,
      exitOverview,
      formatEventStockOutcomeLine,
      handleWatchlistDelete,
      handleWatchlistUpsert,
      applyBrainProposal,
      discardBrainProposal,
      maybeAutoConfirmDailyReport,
      refreshAnalystReports,
      runDailyAnalysis,
      runResearch,
      runStressTest,
      setCatalystFilter,
      setDailyExpanded,
      setExpandedNews,
      setExpandedStock,
      setDetailStockCode,
      setFilterType,
      setRelayPlanExpanded,
      setResearchResults,
      setReviewForm,
      setReviewingEvent,
      setScanFilter,
      setScanQuery,
      setShowReversal,
      setSortBy,
      setStressResult,
      setTab,
      submitReview,
      switchPortfolio,
      tradeCapture,
      updateAlert,
      updateReversal,
      updateTargetPrice,
      upsertThesis,
    ]
  )

  return { portfolioPanelsData, portfolioPanelsActions }
}
