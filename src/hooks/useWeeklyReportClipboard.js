import { useCallback } from 'react'
import { APP_TOAST_MESSAGES } from '../lib/appMessages.js'
import { displayPortfolioName } from '../lib/portfolioDisplay.js'
import { buildWeeklyReportTemplate } from '../lib/promptTemplateCatalog.js'

export function useWeeklyReportClipboard({
  activePortfolioId = '',
  portfolios = [],
  holdings = [],
  watchlist = [],
  analysisHistory = [],
  newsEvents = [],
  strategyBrain = null,
  totalCost = 0,
  totalVal = 0,
  totalPnl = 0,
  retPct = 0,
  isClosedEvent = () => false,
  resolveHoldingPrice = () => 0,
  getHoldingUnrealizedPnl = () => 0,
  getHoldingReturnPct = () => 0,
  brainRuleSummary = () => '',
  flashSaved = () => {},
  toDateLabel = () => new Date().toLocaleDateString('zh-TW'),
}) {
  const activePortfolio = (Array.isArray(portfolios) ? portfolios : []).find(
    (portfolio) => portfolio?.id === activePortfolioId
  )
  const complianceMode = String(
    activePortfolio?.compliance_mode || activePortfolio?.complianceMode || 'retail'
  )
    .trim()
    .toLowerCase()
  const activePortfolioName = displayPortfolioName(activePortfolio || { id: activePortfolioId })

  const generateWeeklyReport = useCallback(
    () =>
      buildWeeklyReportTemplate({
        portfolioName: activePortfolioName,
        complianceMode,
        today: toDateLabel(),
        holdings,
        watchlist,
        analysisHistory: analysisHistory || [],
        newsEvents: newsEvents || [],
        strategyBrain,
        totalCost,
        totalVal,
        totalPnl,
        retPct,
        isClosedEvent,
        resolveHoldingPrice,
        getHoldingUnrealizedPnl,
        getHoldingReturnPct,
        brainRuleSummary,
      }),
    [
      activePortfolioName,
      analysisHistory,
      brainRuleSummary,
      complianceMode,
      getHoldingReturnPct,
      getHoldingUnrealizedPnl,
      holdings,
      isClosedEvent,
      newsEvents,
      resolveHoldingPrice,
      retPct,
      strategyBrain,
      toDateLabel,
      totalCost,
      totalPnl,
      totalVal,
      watchlist,
    ]
  )

  const copyWeeklyReport = useCallback(async () => {
    const report = generateWeeklyReport()
    try {
      await navigator.clipboard.writeText(report)
      flashSaved(APP_TOAST_MESSAGES.weeklyReportCopiedClipboard)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = report
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      flashSaved(APP_TOAST_MESSAGES.weeklyReportCopied)
    }
    return report
  }, [flashSaved, generateWeeklyReport])

  return {
    generateWeeklyReport,
    copyWeeklyReport,
  }
}
