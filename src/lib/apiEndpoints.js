export const API_ENDPOINTS = Object.freeze({
  ANALYZE: '/api/analyze',
  ANALYZE_STREAM: '/api/analyze?stream=1',
  ANALYST_REPORTS: '/api/analyst-reports',
  BRAIN: '/api/brain',
  DAILY_SNAPSHOT_STATUS: '/api/daily-snapshot-status',
  EVENT_CALENDAR: '/api/event-calendar',
  FINMIND: '/api/finmind',
  GEMINI_RESEARCH: '/api/gemini-research',
  MOPS_ANNOUNCEMENTS: '/api/mops-announcements',
  MOPS_REVENUE: '/api/mops-revenue',
  MORNING_NOTE: '/api/morning-note',
  NEWS_FEED: '/api/news-feed',
  PARSE: '/api/parse',
  PORTFOLIO_BENCHMARK_ZSCORE: '/api/portfolio-benchmark-zscore',
  PORTFOLIO_MDD: '/api/portfolio-mdd',
  RESEARCH: '/api/research',
  RESEARCH_EXTRACT: '/api/research-extract',
  TARGET_PRICES: '/api/target-prices',
  TELEMETRY: '/api/telemetry',
  TRACKED_STOCKS: '/api/tracked-stocks',
  TRADE_AUDIT: '/api/trade-audit',
  TWSE: '/api/twse',
  TWSE_INSTITUTIONAL: '/api/twse-institutional',
  VALUATION: '/api/valuation',
})

export function buildApiUrl(path, params = null, origin = '') {
  const base =
    origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  const url = new URL(path, base)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return origin ? url.toString() : `${url.pathname}${url.search}${url.hash}`
}
