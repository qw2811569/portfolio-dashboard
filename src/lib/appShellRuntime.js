import { normalizeEventType } from './eventTypeMeta.js'

export function buildLivePortfolioSnapshot({
  holdings = null,
  tradeLog = null,
  targets = null,
  fundamentals = null,
  watchlist = null,
  analystReports = null,
  reportRefreshMeta = null,
  holdingDossiers = null,
  newsEvents = null,
  analysisHistory = null,
  dailyReport = null,
  reversalConditions = null,
  strategyBrain = null,
  researchHistory = null,
  portfolioNotes = null,
} = {}) {
  return {
    holdings,
    tradeLog,
    targets,
    fundamentals,
    watchlist,
    analystReports,
    reportRefreshMeta,
    holdingDossiers,
    newsEvents,
    analysisHistory,
    dailyReport,
    reversalConditions,
    strategyBrain,
    researchHistory,
    portfolioNotes,
  }
}

export function resolveRuntimeNewsEvents(newsEvents, fallbackEvents = []) {
  if (Array.isArray(newsEvents)) return newsEvents
  return fallbackEvents
}

export function filterEventsByType({
  newsEvents = null,
  fallbackEvents = [],
  filterType = '',
  allFilterLabel = '全部',
}) {
  const resolvedEvents = resolveRuntimeNewsEvents(newsEvents, fallbackEvents)
  if (filterType === allFilterLabel) return resolvedEvents
  const exactTypeMatches = resolvedEvents.filter((event) => event?.type === filterType)
  if (exactTypeMatches.length > 0) return exactTypeMatches
  const normalizedFilterType = normalizeEventType(filterType)
  return resolvedEvents.filter((event) => {
    const eventType = normalizeEventType(event?.eventType || event?.type)
    if (normalizedFilterType) return eventType === normalizedFilterType
    return event?.type === filterType
  })
}
