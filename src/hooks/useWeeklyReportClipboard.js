import { useCallback } from 'react'
import { APP_TOAST_MESSAGES } from '../lib/appMessages.js'
import { displayPortfolioName } from '../lib/portfolioDisplay.js'
import { buildWeeklyReportTemplate } from '../lib/promptTemplateCatalog.js'
import {
  buildWeeklyReportFilename,
  buildWeeklyReportHtmlDocument,
} from '../lib/weeklyReportExport.js'
import {
  buildWeeklyPdfData,
  buildWeeklyPdfDefinition,
  downloadWeeklyPdf,
} from '../lib/weeklyPdfBuilder.js'

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([String(content ?? '')], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

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
  now = () => new Date(),
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

  const downloadWeeklyReportMarkdown = useCallback(() => {
    const report = generateWeeklyReport()

    try {
      downloadTextFile(
        buildWeeklyReportFilename('md', now()),
        report,
        'text/markdown;charset=utf-8'
      )
      flashSaved(APP_TOAST_MESSAGES.weeklyReportDownloaded('md'))
    } catch (error) {
      console.error('downloadWeeklyReportMarkdown failed:', error)
      flashSaved(APP_TOAST_MESSAGES.weeklyReportDownloadFailed('md'))
    }

    return report
  }, [flashSaved, generateWeeklyReport, now])

  const downloadWeeklyReportHtml = useCallback(() => {
    const report = generateWeeklyReport()
    const html = buildWeeklyReportHtmlDocument(report)

    try {
      downloadTextFile(buildWeeklyReportFilename('html', now()), html, 'text/html;charset=utf-8')
      flashSaved(APP_TOAST_MESSAGES.weeklyReportDownloaded('html'))
    } catch (error) {
      console.error('downloadWeeklyReportHtml failed:', error)
      flashSaved(APP_TOAST_MESSAGES.weeklyReportDownloadFailed('html'))
    }

    return html
  }, [flashSaved, generateWeeklyReport, now])

  const downloadWeeklyReportPdf = useCallback(async () => {
    const data = buildWeeklyPdfData({
      portfolioName: activePortfolioName,
      portfolio: activePortfolio,
      complianceMode,
      holdings,
      newsEvents,
      totalVal,
      totalPnl,
      retPct,
      isClosedEvent,
      now: now(),
    })
    const definition = buildWeeklyPdfDefinition(data)

    try {
      await downloadWeeklyPdf(buildWeeklyReportFilename('pdf', now()), definition)
      flashSaved(APP_TOAST_MESSAGES.weeklyReportDownloaded('pdf'))
    } catch (error) {
      console.error('downloadWeeklyReportPdf failed:', error)
      flashSaved(APP_TOAST_MESSAGES.weeklyReportDownloadFailed('pdf'))
    }

    return definition
  }, [
    activePortfolioName,
    activePortfolio,
    complianceMode,
    flashSaved,
    holdings,
    isClosedEvent,
    newsEvents,
    now,
    retPct,
    totalPnl,
    totalVal,
  ])

  return {
    generateWeeklyReport,
    copyWeeklyReport,
    downloadWeeklyReportMarkdown,
    downloadWeeklyReportHtml,
    downloadWeeklyReportPdf,
  }
}
