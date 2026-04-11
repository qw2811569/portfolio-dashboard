import { useMemo } from 'react'

const EMPTY_LIST = []

export function usePortfolioPanelsContextComposer({
  activePortfolioId,
  overviewPortfolios,
  overviewTotalValue,
  overviewTotalPnl,
  overviewDuplicateHoldings,
  overviewPendingItems,
  holdings,
  totalVal,
  totalCost,
  todayTotalPnl,
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
  watchlistFocus,
  watchlistRows,
  showRelayPlan,
  relayPlanExpanded,
  filterType,
  filteredEvents,
  catalystFilter,
  morningNote,
  dailyReport,
  analysisHistory,
  analyzing,
  analyzeStep,
  stressResult,
  stressTesting,
  dailyExpanded,
  newsEvents,
  strategyBrain,
  researching,
  researchTarget,
  reportRefreshing,
  reportRefreshStatus,
  dataRefreshRows,
  researchResults,
  researchHistory,
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
  updateTargetPrice,
  updateAlert,
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
  const safeNewsEvents = Array.isArray(newsEvents) ? newsEvents : EMPTY_LIST
  const safeDataRefreshRows = Array.isArray(dataRefreshRows) ? dataRefreshRows : EMPTY_LIST
  const latestInsight = dailyReport?.insight || dailyReport?.aiInsight || null

  const operatingContext = useMemo(() => {
    const pendingEventCount = safeNewsEvents.filter((event) => event?.status === 'pending').length
    const trackingEventCount = safeNewsEvents.filter((event) => event?.status === 'tracking').length

    const refreshBacklogCount = safeDataRefreshRows.length
    const focusItem = watchlistFocus?.item || null
    const focusSummary = watchlistFocus?.summary || watchlistFocus?.action || ''
    const hasInsight = Boolean(latestInsight)

    let nextActionLabel = '先從持倉健檢與待處理事件開始'
    let nextActionReason = '先看目前持股、觀察名單與事件清單是否指向同一條主線。'

    if (refreshBacklogCount > 0) {
      nextActionLabel = '先補齊資料，再做深度研究'
      nextActionReason = `目前還有 ${refreshBacklogCount} 檔缺少最新目標價或財報資料，先補資料才能避免研究與事件判斷各說各話。`
    } else if (pendingCount > 0 || pendingEventCount > 0) {
      nextActionLabel = '先處理待驗證事件，再決定動作'
      nextActionReason = `目前有 ${Math.max(pendingCount, pendingEventCount)} 件待驗證事件，應先確認催化是否落地，再決定加碼、續抱或停損。`
    } else if (focusItem) {
      nextActionLabel = `先聚焦 ${focusItem.name} 的催化驗證`
      nextActionReason =
        watchlistFocus?.action || focusSummary || '先看焦點標的與相關事件是否支持下一步操作。'
    } else if (hasInsight) {
      nextActionLabel = '先延續最近一次收盤分析的結論'
      nextActionReason = latestInsight
    }

    return {
      portfolioLabel: activePortfolioId === 'me' ? '主組合' : `組合 ${activePortfolioId}`,
      holdingsCount: safeHoldings.length,
      pendingCount,
      attentionCount,
      activeEventCount: pendingEventCount + trackingEventCount,
      refreshBacklogCount,
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
    activePortfolioId,
    attentionCount,
    safeDataRefreshRows,
    dailyReport,
    safeHoldings.length,
    latestInsight,
    safeNewsEvents,
    pendingCount,
    watchlistFocus,
  ])

  const portfolioPanelsData = useMemo(
    () => ({
      overview: {
        portfolioCount: safeOverviewPortfolios.length,
        totalValue: overviewTotalValue,
        totalPnl: overviewTotalPnl,
        portfolios: safeOverviewPortfolios,
        activePortfolioId,
        duplicateHoldings: safeOverviewDuplicateHoldings,
        pendingItems: safeOverviewPendingItems,
      },
      holdings: {
        holdings: safeHoldings,
        totalVal,
        totalCost,
        todayTotalPnl,
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
      },
      holdingsTable: {
        holdings: safeHoldings,
        expandedStock,
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
        operatingContext,
      },
      daily: {
        morningNote,
        dailyReport,
        analysisHistory: Array.isArray(analysisHistory) ? analysisHistory : EMPTY_LIST,
        analyzing,
        analyzeStep,
        stressResult,
        stressTesting,
        dailyExpanded,
        newsEvents: safeNewsEvents,
        expandedStock,
        strategyBrain,
        operatingContext,
        maybeAutoConfirmDailyReport,
      },
      research: {
        holdings: safeHoldings,
        researching,
        researchTarget,
        reportRefreshing,
        reportRefreshStatus,
        dataRefreshRows: safeDataRefreshRows,
        researchResults,
        researchHistory,
        enrichingResearchCode,
        proposalActionId,
        proposalActionType,
        STOCK_META: stockMeta,
        IND_COLOR: indColor,
        operatingContext,
      },
      trade: {
        ...tradeCapture,
      },
      log: {
        tradeLog,
      },
      news: {
        newsEvents: safeNewsEvents,
        reviewingEvent,
        reviewForm,
        expandedNews,
        operatingContext,
      },
    }),
    [
      activePortfolioId,
      analyzing,
      analyzeStep,
      attentionCount,
      catalystFilter,
      dailyExpanded,
      dailyReport,
      analysisHistory,
      safeDataRefreshRows,
      enrichingResearchCode,
      expandedNews,
      expandedStock,
      filterType,
      filteredEvents,
      safeHoldings,
      holdingsIntegrityIssues,
      indColor,
      latestInsight,
      losers,
      morningNote,
      safeNewsEvents,
      operatingContext,
      safeOverviewDuplicateHoldings,
      safeOverviewPendingItems,
      safeOverviewPortfolios,
      overviewTotalPnl,
      overviewTotalValue,
      pendingCount,
      relayPlanExpanded,
      reportRefreshing,
      reportRefreshStatus,
      researchHistory,
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
      sortBy,
      stockMeta,
      strategyBrain,
      stressResult,
      stressTesting,
      maybeAutoConfirmDailyReport,
      targetUpdateCount,
      todayTotalPnl,
      top5,
      totalCost,
      totalVal,
      tradeCapture,
      tradeLog,
      watchlistFocus,
      watchlistRows,
      winners,
    ]
  )

  const portfolioPanelsActions = useMemo(
    () => ({
      overview: {
        onExit: exitOverview,
        onSwitch: switchPortfolio,
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
        onUpdateTarget: updateTargetPrice,
        onUpdateAlert: updateAlert,
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
    ]
  )

  return { portfolioPanelsData, portfolioPanelsActions }
}
