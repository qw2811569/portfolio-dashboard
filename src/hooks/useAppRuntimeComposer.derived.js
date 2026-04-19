export function pickPnlTone(value, colors) {
  if (value == null) return colors.textMute
  return value >= 0 ? colors.up : colors.down
}

export function buildFundamentalDraft(defaultDraft, overrides = {}) {
  return { ...defaultDraft, ...overrides }
}

export function composePortfolioDerivedDataInput({ data, helperFns, constants }) {
  return {
    holdings: data.holdings,
    watchlist: data.watchlist,
    sortBy: data.sortBy,
    holdingDossiers: data.holdingDossiers,
    targets: data.targets,
    fundamentals: data.fundamentals,
    analystReports: data.analystReports,
    theses: data.theses,
    newsEvents: data.newsEvents,
    researchHistory: data.researchHistory,
    strategyBrain: data.strategyBrain,
    marketPriceCache: data.marketPriceCache,
    marketPriceSync: data.marketPriceSync,
    activePortfolioId: data.activePortfolioId,
    portfolioSummaries: data.portfolioSummaries,
    viewMode: data.viewMode,
    currentUser: data.currentUser,
    portfolioNotes: data.portfolioNotes,
    reportRefreshMeta: data.reportRefreshMeta,
    helpers: {
      normalizeHoldingDossiers: helperFns.normalizeHoldingDossiers,
      buildHoldingDossiers: helperFns.buildHoldingDossiers,
      getHoldingMarketValue: helperFns.getHoldingMarketValue,
      getHoldingCostBasis: helperFns.getHoldingCostBasis,
      getHoldingUnrealizedPnl: helperFns.getHoldingUnrealizedPnl,
      getHoldingReturnPct: helperFns.getHoldingReturnPct,
      applyMarketQuotesToHoldings: helperFns.applyMarketQuotesToHoldings,
      clonePortfolioNotes: helperFns.clonePortfolioNotes,
      normalizeNewsEvents: helperFns.normalizeNewsEvents,
      getEventStockCodes: helperFns.getEventStockCodes,
      isClosedEvent: helperFns.isClosedEvent,
      parseFlexibleDate: helperFns.parseFlexibleDate,
      todayStorageDate: helperFns.todayStorageDate,
      formatDateToStorageDate: helperFns.formatDateToStorageDate,
      getTaipeiClock: helperFns.getTaipeiClock,
      parseStoredDate: helperFns.parseStoredDate,
      readStorageValue: helperFns.readStorageValue,
      pfKey: helperFns.pfKey,
      getPortfolioFallback: helperFns.getPortfolioFallback,
    },
    constants: {
      OWNER_PORTFOLIO_ID: constants.OWNER_PORTFOLIO_ID,
      PORTFOLIO_VIEW_MODE: constants.PORTFOLIO_VIEW_MODE,
      OVERVIEW_VIEW_MODE: constants.OVERVIEW_VIEW_MODE,
      POST_CLOSE_SYNC_MINUTES: constants.POST_CLOSE_SYNC_MINUTES,
      RELAY_PLAN_CODES: constants.RELAY_PLAN_CODES,
      STOCK_META: constants.STOCK_META,
      C: constants.C,
    },
  }
}
