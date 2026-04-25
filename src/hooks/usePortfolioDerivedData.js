import { useMemo, useEffect, useState } from 'react'
import { fetchStockDossierDataState } from '../lib/dataAdapters/finmindAdapter.js'
import { fetchCronTargets, isCronTargetUsable } from '../lib/dataAdapters/cronTargetsAdapter.js'
import { normalizeDataError } from '../lib/dataError.js'
import { mapFinMindToFundamentals } from '../lib/dataAdapters/finmindFundamentalsMapper.js'
import { mapFinMindToPerBandTargets } from '../lib/dataAdapters/finmindTargetsMapper.js'
import { computeFreshnessGrade, TARGETS_FRESHNESS_THRESHOLDS } from '../lib/dateUtils.js'
import { isSkippedTargetPriceInstrumentType } from '../lib/instrumentTypes.js'
import { classifyStock, mergeClassification } from '../lib/stockClassifier.js'
import { buildReportRefreshCandidates } from '../lib/reportRefreshRuntime.js'
import { normalizeFundamentalsEntry } from '../lib/dossierUtils.js'
import { formatStaleBadgeRelativeLabel } from '../lib/staleBadge.js'
import { resolveViewMode } from '../lib/viewModeContract.js'

function buildAggregateConsensusTargets(snapshot) {
  const aggregate =
    snapshot?.targets?.aggregate &&
    typeof snapshot.targets.aggregate === 'object' &&
    !Array.isArray(snapshot.targets.aggregate)
      ? snapshot.targets.aggregate
      : null
  if (!aggregate) return []

  const target =
    Number.isFinite(Number(aggregate.medianTarget)) && Number(aggregate.medianTarget) > 0
      ? Number(aggregate.medianTarget)
      : Number.isFinite(Number(aggregate.meanTarget)) && Number(aggregate.meanTarget) > 0
        ? Number(aggregate.meanTarget)
        : null
  if (!target) return []

  const source = String(snapshot?.targets?.source || '')
    .trim()
    .toLowerCase()
  const firm = source === 'cnyes' ? 'Cnyes 共識' : source === 'cmoney' ? 'CMoney 共識' : '券商共識'

  return [
    {
      firm,
      target,
      date: aggregate.rateDate || snapshot?.targets?.updatedAt || null,
      source: source ? `${source}_aggregate` : 'aggregate',
      targetType: 'aggregate',
      aggregate,
      coverageState: 'aggregate-only',
    },
  ]
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function readHoldingMarketValue(holding, getHoldingMarketValue) {
  const explicitValue = toFiniteNumber(holding?.value)
  if (explicitValue != null) return explicitValue
  const derivedValue = toFiniteNumber(getHoldingMarketValue?.(holding))
  if (derivedValue != null) return derivedValue

  const qty = toFiniteNumber(holding?.qty, 0)
  const price = toFiniteNumber(holding?.price, 0)
  return qty * price
}

function readTodayQuoteSnapshot(quote = null) {
  const safeQuote = quote && typeof quote === 'object' ? quote : null
  const price = toFiniteNumber(safeQuote?.price)
  const yesterday = toFiniteNumber(safeQuote?.yesterday)
  const change = toFiniteNumber(safeQuote?.change)
  const changePct = toFiniteNumber(safeQuote?.changePct)
  const hasQuote = price != null && price > 0
  const hasUsableDelta = Boolean(
    hasQuote &&
    ((yesterday != null && yesterday > 0) ||
      (change != null && change !== 0) ||
      (changePct != null && changePct !== 0))
  )

  return {
    hasQuote,
    hasUsableDelta,
    change: change != null ? change : 0,
  }
}

function buildPortfolioTodayMetrics(holdings = [], priceMap = {}, getHoldingMarketValue) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const safePriceMap = priceMap && typeof priceMap === 'object' ? priceMap : {}
  if (safeHoldings.length === 0) {
    return {
      todayTotalPnl: 0,
      todayRetPct: 0,
      todayTopContributor: null,
      todayTopDrag: null,
      hasPriceData: false,
      isStale: false,
    }
  }

  let todayTotalPnl = 0
  let priorCloseValue = 0
  let todayTopContributor = null
  let todayTopDrag = null
  let hasPriceData = false

  for (const holding of safeHoldings) {
    const code = String(holding?.code || '').trim()
    const qty = toFiniteNumber(holding?.qty, 0)
    const quoteSnapshot = readTodayQuoteSnapshot(safePriceMap?.[code])
    const quoteChange = quoteSnapshot.hasUsableDelta ? quoteSnapshot.change : 0
    const holdingTodayPnl = quoteChange * qty
    const currentValue = readHoldingMarketValue(holding, getHoldingMarketValue)
    const previousValue = Math.max(0, currentValue - holdingTodayPnl)
    if (quoteSnapshot.hasUsableDelta) hasPriceData = true

    todayTotalPnl += holdingTodayPnl
    priorCloseValue += previousValue

    const metric = {
      code,
      name: holding?.name || code,
      pnl: holdingTodayPnl,
    }

    if (!todayTopContributor || metric.pnl > todayTopContributor.pnl) {
      todayTopContributor = metric
    }
    if (!todayTopDrag || metric.pnl < todayTopDrag.pnl) {
      todayTopDrag = metric
    }
  }

  return {
    todayTotalPnl: hasPriceData ? Math.round(todayTotalPnl) : null,
    todayRetPct:
      hasPriceData && priorCloseValue > 0 ? (todayTotalPnl / priorCloseValue) * 100 : null,
    todayTopContributor: hasPriceData && todayTopContributor?.pnl > 0 ? todayTopContributor : null,
    todayTopDrag: hasPriceData && todayTopDrag?.pnl < 0 ? todayTopDrag : null,
    hasPriceData,
    isStale: !hasPriceData,
  }
}

function appendSnapshotFallbackNote(note = '', snapshotDate = '') {
  const fallbackNote = snapshotDate ? `snapshot fallback=${snapshotDate}` : 'snapshot fallback'
  return [String(note || '').trim(), fallbackNote].filter(Boolean).join(' | ')
}

function resolveFallbackTargetsEntry(fallbackSnapshot = null) {
  if (!fallbackSnapshot || typeof fallbackSnapshot !== 'object') return null
  if (fallbackSnapshot.targetsEntry && typeof fallbackSnapshot.targetsEntry === 'object') {
    return fallbackSnapshot.targetsEntry
  }
  return null
}

function resolveFallbackTargetReports(fallbackSnapshot = null) {
  const dossierTargets = Array.isArray(fallbackSnapshot?.dossier?.targets)
    ? fallbackSnapshot.dossier.targets
    : []
  if (dossierTargets.length > 0) return dossierTargets

  const targetsEntry = resolveFallbackTargetsEntry(fallbackSnapshot)
  return Array.isArray(targetsEntry?.reports) ? targetsEntry.reports : []
}

function toDateMillis(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const parsed = Date.parse(text.replace(/\//g, '-'))
  return Number.isFinite(parsed) ? parsed : null
}

function pickLatestTimestamp(values = []) {
  let latestValue = null
  let latestMs = -Infinity

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || '').trim()
    if (!normalized) continue
    const ms = toDateMillis(normalized)
    if (ms == null) {
      if (!latestValue) latestValue = normalized
      continue
    }
    if (ms >= latestMs) {
      latestMs = ms
      latestValue = normalized
    }
  }

  return latestValue || null
}

function resolveFallbackUpdatedAt(fallbackSnapshot = null) {
  const latestTargetDate = pickLatestTimestamp(
    resolveFallbackTargetReports(fallbackSnapshot).map((report) =>
      String(report?.date || '').trim()
    )
  )

  return pickLatestTimestamp([
    fallbackSnapshot?.updatedAt,
    fallbackSnapshot?.dossier?.fundamentals?.updatedAt,
    fallbackSnapshot?.fundamentals?.updatedAt,
    resolveFallbackTargetsEntry(fallbackSnapshot)?.updatedAt,
    latestTargetDate,
    fallbackSnapshot?.exportedAt,
    fallbackSnapshot?.snapshotDate,
  ])
}

function buildStaleRefreshCopy(updatedAt, { now = new Date() } = {}) {
  const ageLabel = formatStaleBadgeRelativeLabel(updatedAt, { now })
  if (!ageLabel) return ''
  return `這裡的數字是 ${ageLabel} · 現在的盤還沒拉到。`
}

export function usePortfolioDerivedData({
  holdings,
  watchlist,
  sortBy,
  holdingDossiers,
  targets,
  fundamentals,
  analystReports,
  theses,
  newsEvents,
  researchHistory,
  strategyBrain,
  marketPriceCache,
  marketPriceSync,
  activePortfolioId,
  portfolioSummaries,
  viewMode: appViewMode,
  currentUser,
  portfolioNotes,
  reportRefreshMeta,
  helpers,
  constants,
}) {
  const {
    normalizeHoldingDossiers,
    buildHoldingDossiers,
    getHoldingMarketValue,
    getHoldingCostBasis,
    getHoldingUnrealizedPnl,
    getHoldingReturnPct,
    applyMarketQuotesToHoldings,
    clonePortfolioNotes,
    normalizeNewsEvents,
    getEventStockCodes,
    isClosedEvent,
    parseFlexibleDate,
    todayStorageDate,
    formatDateToStorageDate,
    getTaipeiClock,
    parseStoredDate,
    readStorageValue,
    pfKey,
    getPortfolioFallback,
  } = helpers
  const {
    OWNER_PORTFOLIO_ID,
    PORTFOLIO_VIEW_MODE,
    OVERVIEW_VIEW_MODE,
    POST_CLOSE_SYNC_MINUTES,
    RELAY_PLAN_CODES,
    STOCK_META,
    C,
  } = constants
  const effectiveCurrentUser = currentUser || OWNER_PORTFOLIO_ID

  const H = useMemo(() => (Array.isArray(holdings) ? holdings : []), [holdings])
  const activePortfolio = useMemo(
    () =>
      (Array.isArray(portfolioSummaries) ? portfolioSummaries : []).find(
        (portfolio) => portfolio?.id === activePortfolioId
      ) || { id: activePortfolioId, isOwner: activePortfolioId === OWNER_PORTFOLIO_ID },
    [portfolioSummaries, activePortfolioId, OWNER_PORTFOLIO_ID]
  )
  const viewMode = useMemo(
    () => resolveViewMode({ portfolio: activePortfolio, currentUser: effectiveCurrentUser }),
    [activePortfolio, effectiveCurrentUser]
  )
  const coverageState = viewMode === 'insider-compressed' ? 'aggregate-only' : 'full'
  const thesisByCode = useMemo(
    () =>
      new Map(
        (Array.isArray(theses) ? theses : [])
          .filter((thesis) => thesis?.stockId)
          .map((thesis) => [String(thesis.stockId), thesis])
      ),
    [theses]
  )
  const currentNewsEvents = useMemo(
    () => (Array.isArray(newsEvents) ? newsEvents : []),
    [newsEvents]
  )

  const W = useMemo(() => {
    const watchlistRows = Array.isArray(watchlist) ? watchlist : []
    if (!marketPriceCache?.prices || watchlistRows.length === 0) return watchlistRows

    return watchlistRows.map((item) => {
      const quote = marketPriceCache.prices[item.code]
      if (!quote?.price) return item

      const newPrice = quote.price
      const newTarget = item.target || null
      const newUpside = newTarget && newPrice > 0 ? ((newTarget - newPrice) / newPrice) * 100 : null

      return {
        ...item,
        price: newPrice,
        change: quote.change || 0,
        changePct: quote.changePct || 0,
        upside: newUpside,
      }
    })
  }, [watchlist, marketPriceCache])

  const D = useMemo(() => {
    const normalized = normalizeHoldingDossiers(holdingDossiers)
    if (normalized.length > 0) {
      return normalized.map((dossier) => ({
        ...dossier,
        thesis:
          dossier?.thesis && typeof dossier.thesis === 'object'
            ? dossier.thesis
            : thesisByCode.get(String(dossier.code)) || null,
      }))
    }
    return buildHoldingDossiers({
      holdings: H,
      watchlist: W,
      targets,
      fundamentals,
      analystReports,
      theses,
      newsEvents: currentNewsEvents,
      researchHistory,
      strategyBrain,
      marketPriceCache,
      marketPriceSync,
      stockMeta: STOCK_META,
    })
  }, [
    holdingDossiers,
    H,
    W,
    targets,
    fundamentals,
    analystReports,
    thesisByCode,
    theses,
    currentNewsEvents,
    researchHistory,
    strategyBrain,
    marketPriceCache,
    marketPriceSync,
    STOCK_META,
    normalizeHoldingDossiers,
    buildHoldingDossiers,
  ])

  // FinMind 數據充實：異步載入籌碼/估值/營收數據（best-effort，失敗不影響主流程）
  const [enrichedDossiers, setEnrichedDossiers] = useState(/** @type {typeof D | null} */ (null))

  // Stable dependency for the enrichment effect. D itself rebuilds every time
  // marketPriceCache ticks (price refresh), which caused the enrichment effect
  // to cancel and restart repeatedly, never completing. Live diagnostic probe
  // observed 7+ effect fires in 50 seconds with 0 resolutions. Keying the
  // effect on the sorted joined code list makes it only re-fire when holdings
  // are added or removed — not every render. Verified via playwright diag
  // that with this dep the effect fires exactly once and resolves cleanly.
  const codesToEnrichKey = useMemo(
    () =>
      D.map((d) => d.code)
        .sort()
        .join(','),
    [D]
  )

  useEffect(() => {
    let cancelled = false
    const codesToEnrich = D.filter((d) => !d.finmind).map((d) => d.code)
    if (codesToEnrich.length === 0) {
      return
    }
    // Build a lookup for warrant → underlying stock so we can fetch data for
    // the underlying when the warrant itself has no FinMind coverage.
    const underlyingByCode = new Map()
    for (const d of D) {
      const meta = STOCK_META[d.code]
      if (meta?.underlyingCode) {
        underlyingByCode.set(d.code, { code: meta.underlyingCode, name: meta.underlying || '' })
      }
    }
    Promise.allSettled(
      codesToEnrich.map(async (code) => {
        const underlying = underlyingByCode.get(code)
        const fetchCode = underlying ? underlying.code : code
        const [fmResult, cronResult] = await Promise.allSettled([
          fetchStockDossierDataState(fetchCode),
          fetchCronTargets(fetchCode),
        ])

        return {
          code,
          fmState: fmResult.status === 'fulfilled' ? fmResult.value : null,
          cronSnapshot: cronResult.status === 'fulfilled' ? cronResult.value : null,
          targetFetchError:
            cronResult.status === 'rejected'
              ? normalizeDataError(cronResult.reason, { resource: 'target-prices' })
              : null,
          underlying: underlying || null,
        }
      })
    ).then((results) => {
      if (cancelled) return
      const fulfilled = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
      const fmStateMap = new Map(fulfilled.map((item) => [item.code, item.fmState]))
      const cronMap = new Map(fulfilled.map((item) => [item.code, item.cronSnapshot]))
      const targetErrorMap = new Map(fulfilled.map((item) => [item.code, item.targetFetchError]))
      const underlyingMap = new Map(fulfilled.map((item) => [item.code, item.underlying]))
      const now = new Date()
      const enriched = D.map((d) => {
        const fmState = fmStateMap.get(d.code) || null
        const fallbackSnapshot = fmState?.fallbackSnapshot || null
        const fallbackDossier =
          fallbackSnapshot?.dossier && typeof fallbackSnapshot.dossier === 'object'
            ? fallbackSnapshot.dossier
            : null
        const fallbackFundamentals = normalizeFundamentalsEntry(
          fallbackSnapshot?.fundamentals || fallbackDossier?.fundamentals || null
        )
        const fallbackTargetsEntry = resolveFallbackTargetsEntry(fallbackSnapshot)
        const fallbackTargets = resolveFallbackTargetReports(fallbackSnapshot)
        const fallbackUpdatedAt = resolveFallbackUpdatedAt(fallbackSnapshot)
        const fallbackStaleCopy = buildStaleRefreshCopy(
          fallbackUpdatedAt || fallbackFundamentals?.updatedAt,
          { now }
        )
        const finmindDegraded = fmState?.error?.reason
          ? {
              reason: fmState.error.reason,
              message: fmState.error.message || null,
              fallbackAt: fallbackUpdatedAt || fmState.error.fallbackAt || null,
              snapshotDate: fallbackSnapshot?.snapshotDate || fmState.error.snapshotDate || null,
              fallbackAgeLabel: formatStaleBadgeRelativeLabel(
                fallbackUpdatedAt || fmState.error.fallbackAt,
                { now }
              ),
              staleCopy: fallbackStaleCopy || null,
              hasFallbackSnapshot: Boolean(fallbackSnapshot),
            }
          : null
        const fm = fmState?.data || fallbackDossier?.finmind || d.finmind || null
        const cronSnapshot = cronMap.get(d.code) || null
        const targetFetchError = targetErrorMap.get(d.code) || null
        const underlying = underlyingMap.get(d.code) || null
        const next = {
          ...d,
          finmind: fm,
          targetFetchError,
          finmindDegraded,
          ...(underlying
            ? { underlyingCode: underlying.code, underlyingName: underlying.name }
            : {}),
        }
        const existingFreshness = d.freshness && typeof d.freshness === 'object' ? d.freshness : {}
        // Derive fundamentals + freshness from FinMind when available. Partial
        // coverage (revenue only) maps to freshness='aging' which clears the
        // missing/stale backlog without claiming fully fresh financials; full
        // coverage maps to 'fresh'. The completeness grade is preserved in the
        // entry note so downstream consumers can trace partial fills.
        const mapped = fm ? mapFinMindToFundamentals(fm, { code: d.code }) : null
        let resolvedFundamentals = d.fundamentals || null
        if (mapped) {
          const fundamentalsEntry = {
            ...mapped.entry,
            note: [mapped.entry.note, `finmind completeness=${mapped.completeness}`]
              .filter(Boolean)
              .join(' | '),
          }
          resolvedFundamentals = resolvedFundamentals || fundamentalsEntry
        } else if (!resolvedFundamentals && fallbackFundamentals) {
          resolvedFundamentals = {
            ...fallbackFundamentals,
            note: appendSnapshotFallbackNote(
              fallbackFundamentals.note,
              fallbackSnapshot?.snapshotDate
            ),
          }
        }
        // Freshness comes from the entry's updatedAt timestamp via the shared
        // date-based grade helper. This respects completeness implicitly:
        // a partial entry that pulled fresh revenue data is still 'fresh'
        // because it was computed just now. Stale local entries (manual RSS+AI
        // path) age out naturally through the same grading thresholds.
        const derivedFundamentalFreshness = computeFreshnessGrade(
          [resolvedFundamentals?.updatedAt || fallbackUpdatedAt],
          { now }
        )
        const nextFreshness =
          existingFreshness.fundamentals && existingFreshness.fundamentals !== 'missing'
            ? existingFreshness.fundamentals
            : derivedFundamentalFreshness

        // PER-band derived targets: only populate when the holding has no
        // existing seed/manual target reports. Seeded reports always win —
        // derived bands are a fallback, not a replacement.
        const hasExistingTargets = Array.isArray(d.targets) && d.targets.length > 0
        let nextTargets = d.targets
        let nextTargetsFreshness = existingFreshness.targets
        let nextTargetSource = d.targetSource || (hasExistingTargets ? 'seed' : null)
        let nextTargetAggregate = d.targetAggregate || fallbackDossier?.targetAggregate || null
        if (!hasExistingTargets) {
          // Daily target-price cron pipeline: prefer fresh analyst targets
          // collected by api/cron/collect-target-prices.js over PER-band.
          // PER-band is the fallback for unsupported instruments or stale cron data.
          if (cronSnapshot && isCronTargetUsable(cronSnapshot)) {
            const cronReports = Array.isArray(cronSnapshot?.targets?.reports)
              ? cronSnapshot.targets.reports
              : []
            const aggregateTargets =
              cronReports.length > 0 ? [] : buildAggregateConsensusTargets(cronSnapshot)
            nextTargets = cronReports.length > 0 ? cronReports : aggregateTargets
            nextTargetAggregate = cronSnapshot?.targets?.aggregate || null
            nextTargetSource = String(cronSnapshot?.targets?.source || '').trim() || 'analyst'
            nextTargetsFreshness = computeFreshnessGrade(
              nextTargets.map((report) => report.date),
              { now, thresholds: TARGETS_FRESHNESS_THRESHOLDS }
            )
          } else {
            const perBand = fm ? mapFinMindToPerBandTargets(fm, { code: d.code }) : null
            if (perBand && perBand.reports.length > 0) {
              nextTargets = perBand.reports
              nextTargetSource = 'per-band'
              nextTargetsFreshness = computeFreshnessGrade(
                perBand.reports.map((report) => report.date),
                { now, thresholds: TARGETS_FRESHNESS_THRESHOLDS }
              )
            } else if (fallbackTargets.length > 0) {
              nextTargets = fallbackTargets
              nextTargetSource =
                fallbackDossier?.targetSource ||
                String(fallbackTargetsEntry?.source || '').trim() ||
                'snapshot'
              nextTargetAggregate = nextTargetAggregate || fallbackTargetsEntry?.aggregate || null
              nextTargetsFreshness = computeFreshnessGrade(
                nextTargets.map((report) => report.date || fallbackUpdatedAt),
                { now, thresholds: TARGETS_FRESHNESS_THRESHOLDS }
              )
            }
          }
        }

        return {
          ...next,
          fundamentals: resolvedFundamentals,
          targets: nextTargets,
          targetAggregate: nextTargetAggregate,
          targetSource: nextTargetSource,
          freshness: {
            ...existingFreshness,
            fundamentals: nextFreshness,
            targets: nextTargetsFreshness || existingFreshness.targets,
            fallback:
              finmindDegraded?.hasFallbackSnapshot ||
              fallbackTargets.length > 0 ||
              fallbackFundamentals
                ? 'snapshot'
                : existingFreshness.fallback,
          },
        }
      })
      setEnrichedDossiers(enriched)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesToEnrichKey])

  // Merge enrichment data onto the always-fresh D. enrichedDossiers captures a
  // snapshot of D at enrichment time, so when D changes (market price tick,
  // fundamentals update, etc.) but codes stay the same, enrichedDossiers holds
  // stale base fields. By re-merging only the finmind-specific overlay fields
  // from the enrichment onto the current D, downstream consumers always see
  // fresh base data + cached enrichment data.
  const enrichedBase = useMemo(() => {
    if (!enrichedDossiers) return D
    const enrichmentByCode = new Map(enrichedDossiers.map((d) => [d.code, d]))
    return D.map((d) => {
      const enriched = enrichmentByCode.get(d.code)
      if (!enriched) return d
      // Overlay only the fields that the enrichment effect adds/modifies.
      // Everything else (position, price, base freshness) comes from D.
      return {
        ...d,
        finmind: enriched.finmind ?? d.finmind,
        finmindDegraded: enriched.finmindDegraded ?? d.finmindDegraded ?? null,
        fundamentals: enriched.fundamentals ?? d.fundamentals,
        targets: enriched.targets ?? d.targets,
        targetAggregate: enriched.targetAggregate ?? d.targetAggregate,
        targetSource: enriched.targetSource ?? d.targetSource,
        targetFetchError: enriched.targetFetchError ?? d.targetFetchError ?? null,
        freshness: enriched.freshness
          ? { ...(d.freshness || {}), ...enriched.freshness }
          : d.freshness,
        ...(enriched.underlyingCode
          ? { underlyingCode: enriched.underlyingCode, underlyingName: enriched.underlyingName }
          : {}),
      }
    })
  }, [D, enrichedDossiers])

  // Auto-classify stocks separately from FinMind enrichment so that
  // portfolio-relative fields (position rank) update when market prices
  // change — not only when holdings are added/removed. Previously this
  // ran inside the enrichment effect and was keyed on codesToEnrichKey,
  // causing stale position classifications. (P0 fix from R2 consensus)
  const dossiersToUse = useMemo(() => {
    const totalHoldings = enrichedBase.length
    if (totalHoldings === 0) return enrichedBase
    const ranked = [...enrichedBase]
      .map((d) => ({ code: d.code, val: getHoldingMarketValue(d.position || {}) }))
      .sort((a, b) => b.val - a.val)
    const rankMap = new Map(ranked.map((r, i) => [r.code, i + 1]))
    return enrichedBase.map((d) => {
      const classification = classifyStock(d.code, {
        stockMeta: d.stockMeta || STOCK_META[d.code] || null,
        finmind: d.finmind || null,
        holding: d.position || null,
        holdingRank: rankMap.get(d.code) || totalHoldings,
        totalHoldings,
      })
      const enrichedMeta = mergeClassification(
        d.stockMeta || STOCK_META[d.code] || {},
        classification
      )
      return { ...d, stockMeta: enrichedMeta, classification }
    })
  }, [enrichedBase, STOCK_META, getHoldingMarketValue])

  const dossierByCode = useMemo(
    () => new Map(dossiersToUse.map((item) => [item.code, item])),
    [dossiersToUse]
  )
  const totalVal = useMemo(
    () => H.reduce((sum, item) => sum + getHoldingMarketValue(item), 0),
    [H, getHoldingMarketValue]
  )
  const totalCost = useMemo(
    () => H.reduce((sum, item) => sum + getHoldingCostBasis(item), 0),
    [H, getHoldingCostBasis]
  )
  const totalPnl = totalVal - totalCost
  const retPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
  const todayMetrics = useMemo(
    () => buildPortfolioTodayMetrics(H, marketPriceCache?.prices, getHoldingMarketValue),
    [H, marketPriceCache, getHoldingMarketValue]
  )
  const todayTotalPnl = todayMetrics.todayTotalPnl
  const todayMarketClock = getTaipeiClock(new Date())
  const activeMarketDate = marketPriceSync?.marketDate || marketPriceCache?.marketDate || null
  const activePriceSyncAt = parseStoredDate(
    marketPriceSync?.syncedAt || marketPriceCache?.syncedAt || null
  )
  const priceSyncStatusLabel = !activeMarketDate
    ? '收盤價未同步'
    : activeMarketDate === todayMarketClock.marketDate
      ? `收盤價 ${activeMarketDate.replace(/-/g, '/')}`
      : `沿用 ${activeMarketDate.replace(/-/g, '/')}`
  const priceSyncStatusTone = !activeMarketDate
    ? C.amber
    : activeMarketDate === todayMarketClock.marketDate
      ? C.positive
      : C.textMute
  const holdingsIntegrityIssues = useMemo(
    () => H.filter((item) => item?.integrityIssue === 'missing-price'),
    [H]
  )
  const missingTrackedQuoteCodes = useMemo(
    () => H.map((item) => String(item?.code || '').trim()),
    [H]
  )

  const shouldTriggerPostCloseSelfHeal =
    !todayMarketClock.isWeekend &&
    todayMarketClock.minutes >= POST_CLOSE_SYNC_MINUTES &&
    H.length > 0 &&
    (totalVal <= 0 ||
      holdingsIntegrityIssues.length > 0 ||
      activeMarketDate !== todayMarketClock.marketDate ||
      missingTrackedQuoteCodes.length > 0)

  const overviewPortfolios = useMemo(() => {
    const getPortfolioSnapshot = (portfolioId) => {
      const useLiveState = appViewMode === PORTFOLIO_VIEW_MODE && portfolioId === activePortfolioId
      const holdingsValue = useLiveState ? H : readStorageValue(pfKey(portfolioId, 'holdings-v2'))
      const eventsValue = useLiveState
        ? currentNewsEvents
        : readStorageValue(pfKey(portfolioId, 'news-events-v1'))
      const notesValue = useLiveState
        ? portfolioNotes
        : readStorageValue(pfKey(portfolioId, 'notes-v1'))
      return {
        holdings: applyMarketQuotesToHoldings(
          Array.isArray(holdingsValue)
            ? holdingsValue
            : getPortfolioFallback(portfolioId, 'holdings-v2'),
          marketPriceCache?.prices
        ),
        newsEvents: normalizeNewsEvents(
          Array.isArray(eventsValue)
            ? eventsValue
            : getPortfolioFallback(portfolioId, 'news-events-v1')
        ),
        notes:
          notesValue && typeof notesValue === 'object'
            ? { ...clonePortfolioNotes(), ...notesValue }
            : clonePortfolioNotes(),
      }
    }

    return (portfolioSummaries || []).map((portfolio) => {
      const snapshot = getPortfolioSnapshot(portfolio.id)
      const pendingEvents = (snapshot.newsEvents || []).filter((event) => !isClosedEvent(event))
      const todayMetrics = buildPortfolioTodayMetrics(
        snapshot.holdings,
        marketPriceCache?.prices,
        getHoldingMarketValue
      )
      return {
        ...portfolio,
        holdings: snapshot.holdings,
        newsEvents: snapshot.newsEvents,
        notes: snapshot.notes,
        pendingEvents,
        pendingEventsCount: pendingEvents.length,
        todayTotalPnl: todayMetrics.todayTotalPnl,
        todayRetPct: todayMetrics.todayRetPct,
        todayTopContributor: todayMetrics.todayTopContributor,
        todayTopDrag: todayMetrics.todayTopDrag,
        todayHasPriceData: todayMetrics.hasPriceData,
      }
    })
  }, [
    portfolioSummaries,
    appViewMode,
    PORTFOLIO_VIEW_MODE,
    activePortfolioId,
    H,
    currentNewsEvents,
    portfolioNotes,
    marketPriceCache,
    applyMarketQuotesToHoldings,
    getHoldingMarketValue,
    normalizeNewsEvents,
    clonePortfolioNotes,
    isClosedEvent,
    readStorageValue,
    pfKey,
    getPortfolioFallback,
  ])

  const overviewTotalValue = useMemo(
    () => overviewPortfolios.reduce((sum, portfolio) => sum + portfolio.totalValue, 0),
    [overviewPortfolios]
  )
  const overviewTotalPnl = useMemo(
    () => overviewPortfolios.reduce((sum, portfolio) => sum + portfolio.totalPnl, 0),
    [overviewPortfolios]
  )
  const overviewTotalCost = useMemo(
    () =>
      overviewPortfolios.reduce(
        (sum, portfolio) => sum + (portfolio.totalValue - portfolio.totalPnl),
        0
      ),
    [overviewPortfolios]
  )
  const overviewRetPct = overviewTotalCost > 0 ? (overviewTotalPnl / overviewTotalCost) * 100 : 0
  const displayedTotalPnl = appViewMode === OVERVIEW_VIEW_MODE ? overviewTotalPnl : totalPnl
  const displayedRetPct = appViewMode === OVERVIEW_VIEW_MODE ? overviewRetPct : retPct

  const overviewDuplicateHoldings = useMemo(() => {
    const byCode = new Map()
    overviewPortfolios.forEach((portfolio) => {
      ;(portfolio.holdings || []).forEach((item) => {
        const existing = byCode.get(item.code) || {
          code: item.code,
          name: item.name,
          totalValue: 0,
          portfolios: [],
        }
        const holdingValue = getHoldingMarketValue(item)
        const holdingPnl = getHoldingUnrealizedPnl(item)
        existing.totalValue += holdingValue
        existing.portfolios.push({
          id: portfolio.id,
          name: portfolio.name,
          qty: Number(item.qty) || 0,
          value: holdingValue,
          pnl: holdingPnl,
        })
        byCode.set(item.code, existing)
      })
    })
    return Array.from(byCode.values())
      .filter((item) => item.portfolios.length > 1)
      .sort((a, b) => b.portfolios.length - a.portfolios.length || b.totalValue - a.totalValue)
  }, [overviewPortfolios, getHoldingMarketValue, getHoldingUnrealizedPnl])

  const overviewPendingItems = useMemo(
    () =>
      overviewPortfolios
        .flatMap((portfolio) =>
          portfolio.pendingEvents.map((event) => ({
            ...event,
            portfolioId: portfolio.id,
            portfolioName: portfolio.name,
          }))
        )
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    [overviewPortfolios]
  )

  const todayAlertItems = useMemo(
    () =>
      H.filter((item) => typeof item.alert === 'string' && item.alert.trim())
        .map((item) => {
          const alertText = item.alert.replace(/^⚡\s*/, '').trim()
          if (!alertText) return null
          if (alertText.includes('法說')) return `${item.name}${alertText}`
          if (alertText.includes('出場區間'))
            return `${item.name}已到${alertText.replace(/到$/, '')}`
          return `${item.name} ${alertText}`
        })
        .filter(Boolean),
    [H]
  )

  const urgentCount = todayAlertItems.length
  const todayAlertSummary =
    urgentCount > 2
      ? `${todayAlertItems.slice(0, 2).join(' · ')} · 另有 ${urgentCount - 2} 項提醒`
      : todayAlertItems.join(' · ')

  const watchlistRows = useMemo(
    () =>
      W.map((item, index) => {
        const relatedEvents = currentNewsEvents.filter((event) =>
          event.stocks?.some((stock) => stock.includes(item.code))
        )
        const trackingCount = relatedEvents.filter((event) => event.status === 'tracking').length
        const pendingCount = relatedEvents.filter((event) => event.status === 'pending').length
        const hits = relatedEvents.filter((event) => event.correct === true).length
        const misses = relatedEvents.filter((event) => event.correct === false).length
        const isUrgent =
          /⚡/.test(item.status || '') ||
          relatedEvents.some((event) => {
            if (!event) return false
            const eventDate = parseFlexibleDate(
              event.eventDate || event.date || event.trackingStart || event.exitDate
            )
            if (!eventDate) return false
            return formatDateToStorageDate(eventDate) === todayStorageDate()
          })
        const primaryEvent =
          relatedEvents.find((event) => event.status === 'tracking') ||
          relatedEvents.find((event) => event.status === 'pending') ||
          relatedEvents[0] ||
          null
        const upside =
          item.price > 0 && item.target > 0 ? ((item.target - item.price) / item.price) * 100 : null
        const summary = primaryEvent?.title || item.catalyst || item.note || '持續觀察'
        const action = isUrgent
          ? '今天先看事件結果，再決定是否加碼、續抱或停損。'
          : trackingCount > 0
            ? '目前已進入追蹤期，優先看價格與事件驗證。'
            : pendingCount > 0
              ? '先保留觀察，等事件落地再加大部位。'
              : item.note || '暫列觀察名單，還不急著動作。'
        const priority =
          (isUrgent ? 5 : 0) +
          (trackingCount > 0 ? 3 : 0) +
          (pendingCount > 0 ? 2 : 0) +
          (upside != null && upside >= 20 ? 1 : 0)
        return {
          item,
          index,
          relatedEvents,
          trackingCount,
          pendingCount,
          hits,
          misses,
          primaryEvent,
          upside,
          summary,
          action,
          priority,
        }
      }),
    [W, currentNewsEvents, parseFlexibleDate, formatDateToStorageDate, todayStorageDate]
  )

  const watchlistFocus = useMemo(
    () =>
      watchlistRows.length > 0
        ? [...watchlistRows].sort(
            (a, b) => b.priority - a.priority || (b.upside ?? -999) - (a.upside ?? -999)
          )[0]
        : null,
    [watchlistRows]
  )

  const showRelayPlan =
    activePortfolioId === OWNER_PORTFOLIO_ID ||
    H.some((item) => RELAY_PLAN_CODES.has(item.code)) ||
    W.some((item) => RELAY_PLAN_CODES.has(item.code))

  const sorted = useMemo(
    () =>
      [...H].sort((a, b) => {
        if (sortBy === 'value') return getHoldingMarketValue(b) - getHoldingMarketValue(a)
        if (sortBy === 'pnl')
          return (getHoldingUnrealizedPnl(b) || 0) - (getHoldingUnrealizedPnl(a) || 0)
        if (sortBy === 'pct') {
          const pctA = getHoldingReturnPct(a) || 0
          const pctB = getHoldingReturnPct(b) || 0
          return pctB - pctA
        }
        return 0
      }),
    [H, sortBy, getHoldingMarketValue, getHoldingUnrealizedPnl, getHoldingReturnPct]
  )

  const scanRows = useMemo(
    () =>
      sorted.map((item) => {
        const meta = STOCK_META[item.code]
        const targetEntry = targets?.[item.code]
        const relatedEvents = currentNewsEvents.filter((event) =>
          event.stocks?.some((stock) => stock.includes(item.code))
        )
        const hasPending = relatedEvents.some((event) => event.correct == null)
        const pnl = getHoldingUnrealizedPnl(item)
        const priority =
          item.alert || targetEntry?.isNew
            ? 'A'
            : hasPending || (pnl !== null && pnl < 0)
              ? 'B'
              : 'C'
        const needsAttention = priority !== 'C'
        return {
          h: item,
          meta,
          T: targetEntry,
          relatedEvents,
          hasPending,
          needsAttention,
          priority,
        }
      }),
    [sorted, targets, currentNewsEvents, STOCK_META, getHoldingUnrealizedPnl]
  )

  const top5 = useMemo(
    () => [...H].sort((a, b) => getHoldingMarketValue(b) - getHoldingMarketValue(a)).slice(0, 5),
    [H, getHoldingMarketValue]
  )
  const winners = useMemo(
    () =>
      H.filter((item) => getHoldingUnrealizedPnl(item) > 0).sort(
        (a, b) => getHoldingReturnPct(b) - getHoldingReturnPct(a)
      ),
    [H, getHoldingUnrealizedPnl, getHoldingReturnPct]
  )
  const losers = useMemo(
    () =>
      H.filter((item) => getHoldingUnrealizedPnl(item) < 0).sort(
        (a, b) => getHoldingReturnPct(a) - getHoldingReturnPct(b)
      ),
    [H, getHoldingUnrealizedPnl, getHoldingReturnPct]
  )
  const attentionCount = scanRows.filter((item) => item.needsAttention).length
  const pendingCount = scanRows.filter((item) => item.hasPending).length
  const targetUpdateCount = scanRows.filter((item) => item.T?.isNew).length
  const attentionSummary = useMemo(() => {
    const alertCount = scanRows.filter((item) => String(item?.h?.alert || '').trim()).length
    const pendingEventCount = scanRows.filter((item) => item.hasPending).length
    const weakPnlCount = scanRows.filter((item) => getHoldingUnrealizedPnl(item.h) < 0).length
    const reasons = []

    if (alertCount > 0) reasons.push(`提醒條件 ${alertCount} 檔`)
    if (pendingEventCount > 0) reasons.push(`事件待驗證 ${pendingEventCount} 檔`)
    if (weakPnlCount > 0) reasons.push(`走勢轉弱 ${weakPnlCount} 檔`)

    return reasons.slice(0, 2).join(' / ')
  }, [scanRows, getHoldingUnrealizedPnl])

  const dataRefreshRows = useMemo(
    () =>
      dossiersToUse
        .filter((dossier) => !isSkippedTargetPriceInstrumentType(dossier))
        .map((dossier) => {
          const targetStatus = dossier?.freshness?.targets || 'missing'
          const fundamentalStatus = dossier?.freshness?.fundamentals || 'missing'
          const finmindDegraded =
            dossier?.finmindDegraded && typeof dossier.finmindDegraded === 'object'
              ? dossier.finmindDegraded
              : null
          const weight = (status) => {
            if (status === 'failed') return 3
            if (status === 'missing') return 2
            if (status === 'stale' || status === 'aging') return 1
            return 0
          }
          const baseSeverity = weight(targetStatus) + weight(fundamentalStatus)
          // Target source label for UI distinction (Task 7):
          // 'analyst' = cron-collected broker report, 'per-band' = PER-band estimate,
          // 'seed' = manually seeded, null = no targets yet
          const targetSource = dossier.targetSource || null
          const topTarget =
            Array.isArray(dossier.targets) && dossier.targets.length > 0 ? dossier.targets[0] : null
          let targetLabel = null
          if (topTarget) {
            const isPerBand = targetSource === 'per-band' || /歷史PE/.test(topTarget.firm || '')
            if (isPerBand) {
              targetLabel = `系統推估 ${topTarget.target?.toLocaleString() || ''}元`
            } else {
              targetLabel = `${topTarget.firm} 目標 ${topTarget.target?.toLocaleString() || ''}（${topTarget.date || ''}）`
            }
          }
          // Classification confidence — surface 待分類/待確認 for stocks
          // outside the knowledge base coverage (P1 from multi-LLM review)
          const cls = dossier.classification || {}
          const lowConfidenceFields = ['industry', 'strategy'].filter(
            (f) => !cls[f]?.value || cls[f]?.value === '待分類'
          )
          const classificationNote =
            lowConfidenceFields.length > 0
              ? `這檔還在補標籤：${lowConfidenceFields.join('、')}`
              : null
          const staleUpdatedAt =
            finmindDegraded?.fallbackAt ||
            dossier?.fundamentals?.updatedAt ||
            topTarget?.date ||
            null
          const staleCopy =
            finmindDegraded?.staleCopy ||
            ((targetStatus === 'stale' ||
              targetStatus === 'aging' ||
              fundamentalStatus === 'stale' ||
              fundamentalStatus === 'aging') &&
            staleUpdatedAt
              ? buildStaleRefreshCopy(staleUpdatedAt)
              : '')
          const severity = finmindDegraded?.reason ? Math.max(baseSeverity, 2) : baseSeverity
          return {
            code: dossier.code,
            name: dossier.name,
            targetStatus,
            fundamentalStatus,
            severity,
            targetSource,
            targetLabel,
            classificationNote,
            degradedReason: finmindDegraded?.reason || '',
            degradedMessage: finmindDegraded?.message || '',
            staleCopy,
            fallbackAt: finmindDegraded?.fallbackAt || null,
            fallbackAgeLabel: finmindDegraded?.fallbackAgeLabel || '',
            targetUpdatedAt: dossier.targets?.updatedAt || topTarget?.date || null,
            fundamentalsUpdatedAt: dossier.fundamentals?.updatedAt || null,
          }
        })
        .filter((item) => item.severity > 0 || item.classificationNote || item.degradedReason)
        .sort((a, b) => b.severity - a.severity || String(a.code).localeCompare(String(b.code))),
    [dossiersToUse]
  )

  const todayRefreshKey = getTaipeiClock(new Date()).marketDate
  const reportRefreshCandidates = useMemo(
    () =>
      buildReportRefreshCandidates({
        holdings: H,
        dossierByCode,
        reportRefreshMeta,
        newsEvents: currentNewsEvents,
        todayRefreshKey,
        getEventStockCodes,
        isClosedEvent,
        getHoldingMarketValue,
      }),
    [
      H,
      dossierByCode,
      reportRefreshMeta,
      currentNewsEvents,
      todayRefreshKey,
      getEventStockCodes,
      isClosedEvent,
      getHoldingMarketValue,
    ]
  )

  return {
    H,
    W,
    D,
    dossierByCode,
    currentNewsEvents,
    totalVal,
    totalCost,
    totalPnl,
    todayTotalPnl,
    todayPnlHasPriceData: todayMetrics.hasPriceData,
    todayPnlIsStale: todayMetrics.isStale,
    retPct,
    todayMarketClock,
    activeMarketDate,
    marketPriceSync,
    activePriceSyncAt,
    priceSyncStatusLabel,
    priceSyncStatusTone,
    holdingsIntegrityIssues,
    missingTrackedQuoteCodes,
    shouldTriggerPostCloseSelfHeal,
    overviewPortfolios,
    overviewTotalValue,
    overviewTotalPnl,
    overviewRetPct,
    displayedTotalPnl,
    displayedRetPct,
    overviewDuplicateHoldings,
    overviewPendingItems,
    urgentCount,
    todayAlertSummary,
    viewMode,
    coverageState,
    watchlistRows,
    watchlistFocus,
    showRelayPlan,
    scanRows,
    top5,
    winners,
    losers,
    attentionCount,
    attentionSummary,
    pendingCount,
    targetUpdateCount,
    dataRefreshRows,
    todayRefreshKey,
    reportRefreshCandidates,
  }
}
