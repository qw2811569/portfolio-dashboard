import { useCallback, useEffect } from 'react'
import {
  API_ENDPOINTS,
  CLOUD_SAVE_DEBOUNCE,
  CLOUD_SYNC_TTL,
  HISTORY_ENTRY_LIMIT,
  PORTFOLIO_ALIAS_TO_SUFFIX,
  STATUS_MESSAGE_TIMEOUT_MS,
} from '../constants.js'
import { createDataError, normalizeDataError } from '../lib/dataError.js'
import { STOCK_META } from '../seedData.js'
import { normalizeWatchlist } from '../lib/watchlistUtils.js'
import { readStoredWatchlist } from '../lib/watchlistSync.js'
import {
  getPortfolioFieldStorageKey,
  parseRealtimeStorageValue,
  subscribePortfolioRealtimeSync,
} from '../lib/portfolioRealtimeSync.js'
import { useTrackedStocksSync } from './useTrackedStocksSync.js'

function mergeResearchHistory(existingReports, incomingReports) {
  return [...(existingReports || []), ...(incomingReports || [])]
    .filter(
      (report, index, rows) =>
        rows.findIndex((item) => item.timestamp === report.timestamp) === index
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, HISTORY_ENTRY_LIMIT)
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function buildHistorySyncStatus(status = 'idle', message = '') {
  return { status, message }
}

function identityDailyReportEntry(value) {
  return value
}

async function fetchJsonOrThrow(url, options = {}, failureMessage = 'cloud sync failed') {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw createDataError(response.status, failureMessage)
  }
  return response.json()
}

function resolveHistorySyncErrorMessage(error, fallbackMessage) {
  const normalizedError = normalizeDataError(error)
  if (normalizedError?.status === 'offline') return '網路連線不穩，稍後再試。'
  if (normalizedError?.status === 401) return '登入狀態已過期，重新整理後再試。'
  if (normalizedError?.status === 404) return '資料來源暫時不可用，晚點再試。'
  if (normalizedError?.status === '5xx') return '資料來源暫時不穩，請稍後重試。'
  return fallbackMessage
}

export function usePortfolioPersistence({
  activePortfolioId,
  canPersistPortfolioData,
  canUseCloud,
  tab,
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
  brainValidation,
  researchHistory,
  portfolioNotes,
  marketPriceCache,
  marketPriceSync,
  setHoldingDossiers,
  setAnalysisHistory,
  setAnalysisHistoryStatus,
  setDailyReport,
  setResearchHistory,
  setResearchHistoryStatus,
  setSaved,
  notifySaved = null,
  cloudSyncStateRef,
  cloudSaveTimersRef,
  normalizeHoldings: _normalizeHoldings,
  savePortfolioData,
  buildHoldingDossiers,
  applyMarketQuotesToHoldings,
  normalizeHoldingDossiers,
  normalizeAnalysisHistoryEntries,
  normalizeDailyReportEntry = identityDailyReportEntry,
  readSyncAt,
  writeSyncAt,
}) {
  useTrackedStocksSync({
    activePortfolioId,
    holdings,
    enabled: canPersistPortfolioData,
  })

  const emitSaved = useCallback(
    (message, timeout = STATUS_MESSAGE_TIMEOUT_MS.DEFAULT) => {
      if (typeof notifySaved === 'function') {
        notifySaved(message, timeout)
        return
      }
      setSaved(message)
      if (timeout != null) {
        setTimeout(() => setSaved(''), timeout)
      }
    },
    [notifySaved, setSaved]
  )

  const scheduleCloudSave = useCallback(
    (action, data, successMsg) => {
      if (!cloudSyncStateRef.current.enabled) return

      clearTimeout(cloudSaveTimersRef.current[action])
      cloudSaveTimersRef.current[action] = setTimeout(async () => {
        try {
          await fetch(API_ENDPOINTS.BRAIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data }),
          })
          const now = Date.now()
          cloudSyncStateRef.current.syncedAt = now
          writeSyncAt('pf-cloud-sync-at', now)
          if (successMsg) {
            emitSaved(successMsg, STATUS_MESSAGE_TIMEOUT_MS.BRIEF)
          }
        } catch {
          // best-effort cloud save; local state remains source of truth
        }
      }, CLOUD_SAVE_DEBOUNCE)
    },
    [cloudSaveTimersRef, cloudSyncStateRef, emitSaved, writeSyncAt]
  )

  useEffect(() => {
    if (!canPersistPortfolioData || !holdings) return
    // holdings 已在 setHoldings 時 normalize 過，不再重複 normalize 避免無限迴圈
    savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.holdings, holdings)
    scheduleCloudSave('save-holdings', holdings)
  }, [activePortfolioId, canPersistPortfolioData, holdings, savePortfolioData, scheduleCloudSave])

  useEffect(() => {
    if (canPersistPortfolioData && tradeLog)
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog, tradeLog)
  }, [activePortfolioId, canPersistPortfolioData, tradeLog, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && targets)
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.targets, targets)
  }, [activePortfolioId, canPersistPortfolioData, targets, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && fundamentals)
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.fundamentals, fundamentals)
  }, [activePortfolioId, canPersistPortfolioData, fundamentals, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && watchlist) {
      const normalizedWatchlist = normalizeWatchlist(watchlist)
      const persistedWatchlist = readStoredWatchlist(activePortfolioId)

      if (JSON.stringify(persistedWatchlist) === JSON.stringify(normalizedWatchlist)) return
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.watchlist, normalizedWatchlist)
    }
  }, [activePortfolioId, canPersistPortfolioData, watchlist, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && analystReports) {
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.analystReports, analystReports)
    }
  }, [activePortfolioId, analystReports, canPersistPortfolioData, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && reportRefreshMeta) {
      savePortfolioData(activePortfolioId, 'report-refresh-meta-v1', reportRefreshMeta)
    }
  }, [activePortfolioId, canPersistPortfolioData, reportRefreshMeta, savePortfolioData])

  useEffect(() => {
    if (!canPersistPortfolioData || !holdings) return

    const nextDossiers = buildHoldingDossiers({
      holdings: applyMarketQuotesToHoldings(holdings, marketPriceCache?.prices),
      watchlist,
      targets,
      fundamentals,
      analystReports,
      newsEvents,
      researchHistory,
      strategyBrain,
      marketPriceCache,
      marketPriceSync,
      stockMeta: STOCK_META,
    })
    const prevJson = JSON.stringify(normalizeHoldingDossiers(holdingDossiers))
    const nextJson = JSON.stringify(nextDossiers)
    if (prevJson !== nextJson) {
      setHoldingDossiers(nextDossiers)
    }
  }, [
    canPersistPortfolioData,
    holdings,
    holdingDossiers,
    marketPriceCache,
    marketPriceSync,
    newsEvents,
    researchHistory,
    strategyBrain,
    targets,
    fundamentals,
    watchlist,
    analystReports,
    buildHoldingDossiers,
    applyMarketQuotesToHoldings,
    normalizeHoldingDossiers,
    setHoldingDossiers,
  ])

  useEffect(() => {
    if (canPersistPortfolioData && holdingDossiers) {
      savePortfolioData(
        activePortfolioId,
        PORTFOLIO_ALIAS_TO_SUFFIX.holdingDossiers,
        holdingDossiers
      )
    }
  }, [activePortfolioId, canPersistPortfolioData, holdingDossiers, savePortfolioData])

  useEffect(() => {
    if (!canPersistPortfolioData || !newsEvents) return
    savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.newsEvents, newsEvents)
    scheduleCloudSave('save-events', newsEvents)
  }, [activePortfolioId, canPersistPortfolioData, newsEvents, savePortfolioData, scheduleCloudSave])

  useEffect(() => {
    if (canPersistPortfolioData && analysisHistory) {
      savePortfolioData(
        activePortfolioId,
        PORTFOLIO_ALIAS_TO_SUFFIX.analysisHistory,
        analysisHistory
      )
    }
  }, [activePortfolioId, analysisHistory, canPersistPortfolioData, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && dailyReport)
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.dailyReport, dailyReport)
  }, [activePortfolioId, canPersistPortfolioData, dailyReport, savePortfolioData])

  useEffect(() => {
    if (!activePortfolioId || typeof window === 'undefined') return undefined

    const historySuffix = PORTFOLIO_ALIAS_TO_SUFFIX.analysisHistory
    const dailySuffix = PORTFOLIO_ALIAS_TO_SUFFIX.dailyReport
    const historyKey = getPortfolioFieldStorageKey(activePortfolioId, historySuffix)
    const dailyKey = getPortfolioFieldStorageKey(activePortfolioId, dailySuffix)

    const applyPortfolioField = (suffix, value) => {
      if (suffix === historySuffix) {
        setAnalysisHistory(normalizeAnalysisHistoryEntries(value))
        setAnalysisHistoryStatus(buildHistorySyncStatus('success'))
        return
      }

      if (suffix === dailySuffix && typeof setDailyReport === 'function') {
        setDailyReport(normalizeDailyReportEntry(value) || null)
      }
    }

    const unsubscribeBroadcast = subscribePortfolioRealtimeSync((payload) => {
      if (payload?.type !== 'portfolio-field') return
      if (String(payload.portfolioId || '').trim() !== String(activePortfolioId || '').trim())
        return
      applyPortfolioField(payload.suffix, payload.value)
    })

    const handleStorageEvent = (event) => {
      if (event?.key === historyKey) {
        applyPortfolioField(historySuffix, parseRealtimeStorageValue(event.newValue))
        return
      }
      if (event?.key === dailyKey) {
        applyPortfolioField(dailySuffix, parseRealtimeStorageValue(event.newValue))
      }
    }

    window.addEventListener('storage', handleStorageEvent)
    return () => {
      unsubscribeBroadcast()
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [
    activePortfolioId,
    normalizeAnalysisHistoryEntries,
    normalizeDailyReportEntry,
    setAnalysisHistory,
    setAnalysisHistoryStatus,
    setDailyReport,
  ])

  useEffect(() => {
    if (canPersistPortfolioData && reversalConditions) {
      savePortfolioData(
        activePortfolioId,
        PORTFOLIO_ALIAS_TO_SUFFIX.reversalConditions,
        reversalConditions
      )
    }
  }, [activePortfolioId, canPersistPortfolioData, reversalConditions, savePortfolioData])

  useEffect(() => {
    if (!canPersistPortfolioData || !strategyBrain) return
    savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.strategyBrain, strategyBrain)
    scheduleCloudSave('save-brain', strategyBrain)
  }, [
    activePortfolioId,
    canPersistPortfolioData,
    strategyBrain,
    savePortfolioData,
    scheduleCloudSave,
  ])

  useEffect(() => {
    if (canPersistPortfolioData && brainValidation) {
      savePortfolioData(activePortfolioId, 'brain-validation-v1', brainValidation)
    }
  }, [activePortfolioId, brainValidation, canPersistPortfolioData, savePortfolioData])

  useEffect(() => {
    const lastAnalysisSyncAt = readSyncAt('pf-analysis-cloud-sync-at')
    const shouldFetchAnalysis =
      canUseCloud &&
      (tab === 'daily' || tab === 'log') &&
      (!lastAnalysisSyncAt || Date.now() - lastAnalysisSyncAt > CLOUD_SYNC_TTL)
    if (!shouldFetchAnalysis) return undefined

    let active = true
    const controller = typeof AbortController === 'function' ? new AbortController() : null

    setAnalysisHistoryStatus(buildHistorySyncStatus('loading'))

    fetchJsonOrThrow(
      `${API_ENDPOINTS.BRAIN}?action=history`,
      { signal: controller?.signal },
      'analysis history sync failed'
    )
      .then((data) => {
        if (!active) return
        const historyRows = ensureArray(data?.history)
        setAnalysisHistory((prev) => {
          const uniqueHistory = normalizeAnalysisHistoryEntries([...(prev || []), ...historyRows])
          savePortfolioData(
            activePortfolioId,
            PORTFOLIO_ALIAS_TO_SUFFIX.analysisHistory,
            uniqueHistory
          )
          return uniqueHistory
        })
        setAnalysisHistoryStatus(buildHistorySyncStatus('success'))
        writeSyncAt('pf-analysis-cloud-sync-at', Date.now())
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setAnalysisHistoryStatus(
          buildHistorySyncStatus(
            'error',
            resolveHistorySyncErrorMessage(error, '收盤分析歷史同步失敗，請稍後重試。')
          )
        )
      })

    return () => {
      active = false
      controller?.abort()
    }
  }, [
    activePortfolioId,
    canUseCloud,
    tab,
    readSyncAt,
    setAnalysisHistory,
    setAnalysisHistoryStatus,
    normalizeAnalysisHistoryEntries,
    savePortfolioData,
    writeSyncAt,
  ])

  useEffect(() => {
    const lastResearchSyncAt = readSyncAt('pf-research-cloud-sync-at')
    const shouldFetchResearch =
      canUseCloud &&
      tab === 'research' &&
      (!lastResearchSyncAt || Date.now() - lastResearchSyncAt > CLOUD_SYNC_TTL)
    if (!shouldFetchResearch) return undefined

    let active = true
    const controller = typeof AbortController === 'function' ? new AbortController() : null

    setResearchHistoryStatus(buildHistorySyncStatus('loading'))

    fetchJsonOrThrow(
      API_ENDPOINTS.RESEARCH,
      { signal: controller?.signal },
      'research history sync failed'
    )
      .then((data) => {
        if (!active) return
        const reportRows = ensureArray(data?.reports)
        const uniqueReports = mergeResearchHistory(researchHistory, reportRows)
        setResearchHistory(uniqueReports)
        setResearchHistoryStatus(buildHistorySyncStatus('success'))
        savePortfolioData(
          activePortfolioId,
          PORTFOLIO_ALIAS_TO_SUFFIX.researchHistory,
          uniqueReports
        )
        writeSyncAt('pf-research-cloud-sync-at', Date.now())
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setResearchHistoryStatus(
          buildHistorySyncStatus(
            'error',
            resolveHistorySyncErrorMessage(error, '研究歷史同步失敗，請稍後重試。')
          )
        )
      })

    return () => {
      active = false
      controller?.abort()
    }
  }, [
    activePortfolioId,
    canUseCloud,
    researchHistory,
    tab,
    readSyncAt,
    setResearchHistory,
    setResearchHistoryStatus,
    savePortfolioData,
    writeSyncAt,
  ])

  useEffect(() => {
    if (canPersistPortfolioData && researchHistory) {
      savePortfolioData(
        activePortfolioId,
        PORTFOLIO_ALIAS_TO_SUFFIX.researchHistory,
        researchHistory
      )
    }
  }, [activePortfolioId, canPersistPortfolioData, researchHistory, savePortfolioData])

  useEffect(() => {
    if (canPersistPortfolioData && portfolioNotes) {
      savePortfolioData(activePortfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.portfolioNotes, portfolioNotes)
    }
  }, [activePortfolioId, canPersistPortfolioData, portfolioNotes, savePortfolioData])

  useEffect(
    () => () => {
      Object.values(cloudSaveTimersRef.current).forEach(clearTimeout)
    },
    [cloudSaveTimersRef]
  )
}
