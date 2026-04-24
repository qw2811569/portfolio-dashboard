import { useEffect } from 'react'
import { CLOUD_SYNC_TTL, OWNER_PORTFOLIO_ID } from '../constants.js'
import { APP_BOOTSTRAP_PHASE_COPY } from '../lib/appMessages.js'
import { captureClientDiagnostic } from '../lib/runtimeLogger.js'

const BOOTSTRAP_RUN_COUNTER_KEY = '__PORTFOLIO_BOOTSTRAP_RUN_COUNTER__'

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function getBootstrapRunId() {
  if (typeof window === 'undefined') return 1
  const next = Number(window[BOOTSTRAP_RUN_COUNTER_KEY] || 0) + 1
  window[BOOTSTRAP_RUN_COUNTER_KEY] = next
  return next
}

function markPerformance(label) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  performance.mark(label)
}

function measurePerformance(label, startMark, endMark) {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return
  try {
    performance.measure(label, startMark, endMark)
  } catch {
    // best-effort diagnostics only
  }
}

function updateBootstrapState(setBootstrapState, runId, phase, elapsedMs) {
  const copy = APP_BOOTSTRAP_PHASE_COPY[phase] || APP_BOOTSTRAP_PHASE_COPY.starting
  setBootstrapState({
    phase,
    runId,
    elapsedMs: Math.round(elapsedMs),
    ...copy,
  })
}

function captureBootstrapPhase(runId, phase, startedAt, stepStartedAt, context = {}) {
  const elapsedMs = Math.round(getNow() - startedAt)
  const stepDurationMs = Math.round(getNow() - stepStartedAt)
  captureClientDiagnostic(
    'bootstrap-phase',
    {
      name: 'BootstrapPhase',
      message: APP_BOOTSTRAP_PHASE_COPY[phase]?.title || phase,
    },
    {
      runId,
      phase,
      elapsedMs,
      stepDurationMs,
      ...context,
    },
    { emitConsole: false, level: 'warn' }
  )
  return elapsedMs
}

export function usePortfolioBootstrap({
  bootRuntimeRef,
  setReady,
  setBootstrapState = () => {},
  setCloudSync,
  cloudSyncStateRef,
  setHoldings,
  setStrategyBrain,
  setNewsEvents,
  setAnalysisHistory,
  setDailyReport,
  setResearchHistory,
  restoreTabForPortfolio = () => {},
  migrateLegacyPortfolioStorageIfNeeded,
  seedJinlianchengIfNeeded,
  ensurePortfolioRegistry,
  applyTradeBackfillPatchesIfNeeded,
  loadPortfolioSnapshot,
  readSyncAt,
  writeSyncAt,
  shouldAdoptCloudHoldings,
  normalizeHoldings,
  buildHoldingPriceHints,
  getPortfolioFallback,
  savePortfolioData,
  normalizeStrategyBrain,
  normalizeNewsEvents,
  normalizeAnalysisHistoryEntries,
  normalizeDailyReportEntry,
}) {
  useEffect(() => {
    let cancelled = false

    const runBootstrap = async () => {
      const runtime = bootRuntimeRef.current
      if (!runtime) return

      const {
        activePortfolioId,
        marketPriceQuotes,
        applyPortfolioSnapshot,
        setPortfolios,
        setActivePortfolioId,
        setViewMode,
        portfolioTransitionRef,
      } = runtime

      portfolioTransitionRef.current = {
        isHydrating: true,
        fromPid: activePortfolioId,
        toPid: activePortfolioId,
      }

      const runId = getBootstrapRunId()
      const startedAt = getNow()
      let previousMark = `pf-bootstrap:${runId}:start`
      markPerformance(previousMark)
      updateBootstrapState(setBootstrapState, runId, 'starting', 0)
      const isStillActivePortfolio = (targetPid) => {
        if (cancelled) return false
        return bootRuntimeRef.current?.activePortfolioId === targetPid
      }

      const runStep = async (phase, work, context = {}) => {
        updateBootstrapState(setBootstrapState, runId, phase, getNow() - startedAt)
        const stepStartedAt = getNow()
        const stepMark = `pf-bootstrap:${runId}:${phase}`
        markPerformance(stepMark)
        const result = await work()
        measurePerformance(`pf-bootstrap:${runId}:${phase}`, previousMark, stepMark)
        previousMark = stepMark
        captureBootstrapPhase(runId, phase, startedAt, stepStartedAt, context)
        return result
      }

      await runStep('migrate-legacy', () => migrateLegacyPortfolioStorageIfNeeded())
      await runStep('seed-portfolio', () => seedJinlianchengIfNeeded())
      const registry = await runStep('ensure-registry', () => ensurePortfolioRegistry())
      const pid = registry.activePortfolioId
      let snapshot = await runStep('load-snapshot', () => loadPortfolioSnapshot(pid), { pid })
      if (cancelled) return

      updateBootstrapState(setBootstrapState, runId, 'hydrate-shell', getNow() - startedAt)
      setPortfolios(registry.portfolios)
      setActivePortfolioId(pid)
      setViewMode(registry.viewMode)
      applyPortfolioSnapshot(snapshot)
      restoreTabForPortfolio(pid)
      setReady(true)
      captureBootstrapPhase(runId, 'hydrate-shell', startedAt, startedAt, {
        pid,
        holdingsCount: Array.isArray(snapshot?.holdings) ? snapshot.holdings.length : 0,
      })
      updateBootstrapState(setBootstrapState, runId, 'ready', getNow() - startedAt)

      const postReadyBackfillStartedAt = getNow()
      const postReadyBackfillChanges = await applyTradeBackfillPatchesIfNeeded()
      captureBootstrapPhase(
        runId,
        'trade-backfill-post-ready',
        startedAt,
        postReadyBackfillStartedAt,
        {
          pid,
          changed: postReadyBackfillChanges,
          postReady: true,
        }
      )

      if (!cancelled && postReadyBackfillChanges > 0) {
        snapshot = await loadPortfolioSnapshot(pid)
        if (isStillActivePortfolio(pid)) {
          applyPortfolioSnapshot(snapshot)
        }
      }

      const lastCloudSyncAt = readSyncAt('pf-cloud-sync-at')
      const shouldSyncCloud =
        pid === OWNER_PORTFOLIO_ID &&
        (!lastCloudSyncAt || Date.now() - lastCloudSyncAt > CLOUD_SYNC_TTL)

      cloudSyncStateRef.current = {
        enabled: false,
        syncedAt: lastCloudSyncAt,
      }

      if (pid !== OWNER_PORTFOLIO_ID) {
        setCloudSync(false)
        portfolioTransitionRef.current = {
          isHydrating: false,
          fromPid: pid,
          toPid: pid,
        }
        return
      }

      if (!shouldSyncCloud) {
        try {
          const cloudHoldings = await fetch('/api/brain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load-holdings' }),
          }).then((res) => res.json())

          const cloudRows = cloudHoldings?.holdings
          if (
            !cancelled &&
            Array.isArray(cloudRows) &&
            cloudRows.length > 0 &&
            shouldAdoptCloudHoldings(snapshot.holdings, cloudRows)
          ) {
            const normalizedCloudHoldings = normalizeHoldings(
              cloudRows,
              marketPriceQuotes,
              buildHoldingPriceHints({
                analysisHistory: snapshot.analysisHistory,
                fallbackRows: getPortfolioFallback(pid, 'holdings-v2'),
              })
            )
            savePortfolioData(pid, 'holdings-v2', normalizedCloudHoldings)
            if (isStillActivePortfolio(pid)) {
              snapshot.holdings = normalizedCloudHoldings
              setHoldings(normalizedCloudHoldings)
            }
          }
        } catch {
          // localStorage fallback keeps app usable offline
        }

        if (isStillActivePortfolio(pid)) {
          cloudSyncStateRef.current = {
            enabled: true,
            syncedAt: readSyncAt('pf-cloud-sync-at'),
          }
          setCloudSync(true)
          portfolioTransitionRef.current = {
            isHydrating: false,
            fromPid: pid,
            toPid: pid,
          }
        }
        return
      }

      try {
        // Holdings 最重要，單獨 fetch 確保失敗不影響
        let cloudHoldings = { holdings: null }
        try {
          cloudHoldings = await fetch('/api/brain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load-holdings' }),
          }).then((res) => res.json())
        } catch {
          console.warn('Cloud holdings fetch failed')
        }

        // 其他資料平行 fetch，個別失敗不影響整體
        const [cloudBrain, cloudEvents, cloudHistory, cloudResearch] = await Promise.all([
          fetch('/api/brain?action=brain')
            .then((res) => res.json())
            .catch(() => ({ brain: null })),
          fetch('/api/brain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load-events' }),
          })
            .then((res) => res.json())
            .catch(() => ({ events: null })),
          fetch('/api/brain?action=history')
            .then((res) => res.json())
            .catch(() => ({ history: null })),
          fetch('/api/research')
            .then((res) => res.json())
            .catch(() => ({ reports: null })),
        ])
        if (cancelled) return

        if (cloudBrain.brain && !snapshot.strategyBrain) {
          const normalizedBrain = normalizeStrategyBrain(cloudBrain.brain)
          savePortfolioData(pid, 'brain-v1', normalizedBrain)
          if (isStillActivePortfolio(pid)) {
            setStrategyBrain(normalizedBrain)
          }
        }

        const cloudEventRows = ensureArray(cloudEvents?.events)
        if (
          cloudEventRows.length > 0 &&
          (!snapshot.newsEvents || snapshot.newsEvents.length === 0)
        ) {
          const normalizedEvents = normalizeNewsEvents(cloudEventRows)
          savePortfolioData(pid, 'news-events-v1', normalizedEvents)
          if (isStillActivePortfolio(pid)) {
            setNewsEvents(normalizedEvents)
          }
        }

        const cloudRows = ensureArray(cloudHoldings?.holdings)
        if (cloudRows.length > 0 && shouldAdoptCloudHoldings(snapshot.holdings, cloudRows)) {
          const normalizedCloudHoldings = normalizeHoldings(
            cloudRows,
            marketPriceQuotes,
            buildHoldingPriceHints({
              analysisHistory: snapshot.analysisHistory,
              fallbackRows: getPortfolioFallback(pid, 'holdings-v2'),
            })
          )
          savePortfolioData(pid, 'holdings-v2', normalizedCloudHoldings)
          if (isStillActivePortfolio(pid)) {
            snapshot.holdings = normalizedCloudHoldings
            setHoldings(normalizedCloudHoldings)
          }
        }

        const cloudHistoryRows = ensureArray(cloudHistory?.history)
        if (cloudHistoryRows.length > 0) {
          const uniqueHistory = normalizeAnalysisHistoryEntries([
            ...(snapshot.analysisHistory || []),
            ...cloudHistoryRows,
          ])
          savePortfolioData(pid, 'analysis-history-v1', uniqueHistory)
          if (isStillActivePortfolio(pid)) {
            setAnalysisHistory(uniqueHistory)
          }
          writeSyncAt('pf-analysis-cloud-sync-at', Date.now())
          if (isStillActivePortfolio(pid) && !snapshot.dailyReport && uniqueHistory.length > 0) {
            setDailyReport(normalizeDailyReportEntry(uniqueHistory[0]))
          }
        }

        const cloudResearchRows = ensureArray(cloudResearch?.reports)
        if (cloudResearchRows.length > 0) {
          const uniqueReports = [...(snapshot.researchHistory || []), ...cloudResearchRows]
            .filter(
              (report, index, rows) =>
                rows.findIndex((item) => item.timestamp === report.timestamp) === index
            )
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 30)
          savePortfolioData(pid, 'research-history-v1', uniqueReports)
          if (isStillActivePortfolio(pid)) {
            setResearchHistory(uniqueReports)
          }
          writeSyncAt('pf-research-cloud-sync-at', Date.now())
        }

        const syncedAt = Date.now()
        writeSyncAt('pf-cloud-sync-at', syncedAt)
        if (isStillActivePortfolio(pid)) {
          cloudSyncStateRef.current = {
            enabled: true,
            syncedAt,
          }
          setCloudSync(true)
        }
      } catch (syncErr) {
        console.warn('Cloud full sync failed, localStorage fallback:', syncErr)
      } finally {
        // 無論 full sync 成功或失敗，都啟用 cloud sync 以確保後續改動能存上去
        if (isStillActivePortfolio(pid)) {
          cloudSyncStateRef.current = {
            enabled: true,
            syncedAt: cloudSyncStateRef.current.syncedAt || Date.now(),
          }
          setCloudSync(true)
        }
        if (isStillActivePortfolio(pid)) {
          portfolioTransitionRef.current = {
            isHydrating: false,
            fromPid: pid,
            toPid: pid,
          }
        }
      }
    }

    runBootstrap()

    return () => {
      cancelled = true
    }
  }, [
    bootRuntimeRef,
    setReady,
    setBootstrapState,
    setCloudSync,
    cloudSyncStateRef,
    setHoldings,
    setStrategyBrain,
    setNewsEvents,
    setAnalysisHistory,
    setDailyReport,
    setResearchHistory,
    restoreTabForPortfolio,
    migrateLegacyPortfolioStorageIfNeeded,
    seedJinlianchengIfNeeded,
    ensurePortfolioRegistry,
    applyTradeBackfillPatchesIfNeeded,
    loadPortfolioSnapshot,
    readSyncAt,
    writeSyncAt,
    shouldAdoptCloudHoldings,
    normalizeHoldings,
    buildHoldingPriceHints,
    getPortfolioFallback,
    savePortfolioData,
    normalizeStrategyBrain,
    normalizeNewsEvents,
    normalizeAnalysisHistoryEntries,
    normalizeDailyReportEntry,
  ])
}
