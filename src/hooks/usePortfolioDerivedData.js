import { useMemo, useEffect, useState } from 'react'
import { fetchStockDossierData } from '../lib/dataAdapters/finmindAdapter.js'
import { fetchCronTargets, isCronTargetUsable } from '../lib/dataAdapters/cronTargetsAdapter.js'
import { mapFinMindToFundamentals } from '../lib/dataAdapters/finmindFundamentalsMapper.js'
import { mapFinMindToPerBandTargets } from '../lib/dataAdapters/finmindTargetsMapper.js'
import { computeFreshnessGrade, TARGETS_FRESHNESS_THRESHOLDS } from '../lib/dateUtils.js'
import { isSkippedTargetPriceInstrumentType } from '../lib/instrumentTypes.js'
import { classifyStock, mergeClassification } from '../lib/stockClassifier.js'
import { buildReportRefreshCandidates } from '../lib/reportRefreshRuntime.js'

export function usePortfolioDerivedData({
  holdings,
  watchlist,
  sortBy,
  holdingDossiers,
  targets,
  fundamentals,
  analystReports,
  newsEvents,
  researchHistory,
  strategyBrain,
  marketPriceCache,
  marketPriceSync,
  activePortfolioId,
  portfolioSummaries,
  viewMode,
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

  const H = useMemo(() => (Array.isArray(holdings) ? holdings : []), [holdings])
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
    if (normalized.length > 0) return normalized
    return buildHoldingDossiers({
      holdings: H,
      watchlist: W,
      targets,
      fundamentals,
      analystReports,
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
        try {
          const underlying = underlyingByCode.get(code)
          const fetchCode = underlying ? underlying.code : code
          const [fm, cronSnapshot] = await Promise.all([
            fetchStockDossierData(fetchCode),
            fetchCronTargets(fetchCode).catch(() => null),
          ])
          return { code, fm, cronSnapshot, underlying: underlying || null }
        } catch {
          return {
            code,
            fm: null,
            cronSnapshot: null,
            underlying: underlyingByCode.get(code) || null,
          }
        }
      })
    ).then((results) => {
      if (cancelled) return
      const fmMap = new Map(results.map((r) => [r.value.code, r.value.fm]))
      const cronMap = new Map(results.map((r) => [r.value.code, r.value.cronSnapshot]))
      const underlyingMap = new Map(results.map((r) => [r.value.code, r.value.underlying]))
      const enriched = D.map((d) => {
        const fm = fmMap.get(d.code) || d.finmind
        const cronSnapshot = cronMap.get(d.code) || null
        const underlying = underlyingMap.get(d.code) || null
        const next = {
          ...d,
          finmind: fm,
          ...(underlying
            ? { underlyingCode: underlying.code, underlyingName: underlying.name }
            : {}),
        }
        if (!fm) return next
        // Derive fundamentals + freshness from FinMind when available. Partial
        // coverage (revenue only) maps to freshness='aging' which clears the
        // missing/stale backlog without claiming fully fresh financials; full
        // coverage maps to 'fresh'. The completeness grade is preserved in the
        // entry note so downstream consumers can trace partial fills.
        const mapped = mapFinMindToFundamentals(fm, { code: d.code })
        if (!mapped) return next
        const existingFreshness = d.freshness && typeof d.freshness === 'object' ? d.freshness : {}
        const fundamentalsEntry = {
          ...mapped.entry,
          note: [mapped.entry.note, `finmind completeness=${mapped.completeness}`]
            .filter(Boolean)
            .join(' | '),
        }
        const resolvedFundamentals = d.fundamentals || fundamentalsEntry
        // Freshness comes from the entry's updatedAt timestamp via the shared
        // date-based grade helper. This respects completeness implicitly:
        // a partial entry that pulled fresh revenue data is still 'fresh'
        // because it was computed just now. Stale local entries (manual RSS+AI
        // path) age out naturally through the same grading thresholds.
        const derivedFundamentalFreshness = computeFreshnessGrade(
          [resolvedFundamentals?.updatedAt],
          { now: new Date() }
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
        let nextTargetSource = hasExistingTargets ? 'seed' : null
        if (!hasExistingTargets) {
          // Daily target-price cron pipeline: prefer fresh analyst targets
          // collected by api/cron/collect-target-prices.js over PER-band.
          // PER-band is the fallback for unsupported instruments or stale cron data.
          if (cronSnapshot && isCronTargetUsable(cronSnapshot)) {
            nextTargets = cronSnapshot.targets.reports
            nextTargetSource = 'analyst'
            nextTargetsFreshness = computeFreshnessGrade(
              cronSnapshot.targets.reports.map((report) => report.date),
              { now: new Date(), thresholds: TARGETS_FRESHNESS_THRESHOLDS }
            )
          } else {
            const perBand = mapFinMindToPerBandTargets(fm, { code: d.code })
            if (perBand && perBand.reports.length > 0) {
              nextTargets = perBand.reports
              nextTargetSource = 'per-band'
              nextTargetsFreshness = computeFreshnessGrade(
                perBand.reports.map((report) => report.date),
                { now: new Date(), thresholds: TARGETS_FRESHNESS_THRESHOLDS }
              )
            }
          }
        }

        return {
          ...next,
          fundamentals: resolvedFundamentals,
          targets: nextTargets,
          targetSource: nextTargetSource,
          freshness: {
            ...existingFreshness,
            fundamentals: nextFreshness,
            targets: nextTargetsFreshness || existingFreshness.targets,
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
        fundamentals: enriched.fundamentals ?? d.fundamentals,
        targets: enriched.targets ?? d.targets,
        targetSource: enriched.targetSource ?? d.targetSource,
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
  const todayTotalPnl = useMemo(() => {
    const prices = marketPriceCache?.prices
    if (!prices || H.length === 0) return 0
    return Math.round(
      H.reduce((sum, item) => {
        const quote = prices[item.code]
        if (!quote) return sum
        const change = Number(quote.change)
        const qty = Number(item.qty) || 0
        return sum + (Number.isFinite(change) ? change * qty : 0)
      }, 0)
    )
  }, [H, marketPriceCache])
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
      ? C.olive
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
      const useLiveState = viewMode === PORTFOLIO_VIEW_MODE && portfolioId === activePortfolioId
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
      return {
        ...portfolio,
        holdings: snapshot.holdings,
        newsEvents: snapshot.newsEvents,
        notes: snapshot.notes,
        pendingEvents,
      }
    })
  }, [
    portfolioSummaries,
    viewMode,
    PORTFOLIO_VIEW_MODE,
    activePortfolioId,
    H,
    currentNewsEvents,
    portfolioNotes,
    marketPriceCache,
    applyMarketQuotesToHoldings,
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
  const displayedTotalPnl = viewMode === OVERVIEW_VIEW_MODE ? overviewTotalPnl : totalPnl
  const displayedRetPct = viewMode === OVERVIEW_VIEW_MODE ? overviewRetPct : retPct

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

  const dataRefreshRows = useMemo(
    () =>
      dossiersToUse
        .filter((dossier) => !isSkippedTargetPriceInstrumentType(dossier))
        .map((dossier) => {
          const targetStatus = dossier?.freshness?.targets || 'missing'
          const fundamentalStatus = dossier?.freshness?.fundamentals || 'missing'
          const severity =
            (targetStatus === 'missing' ? 2 : targetStatus === 'stale' ? 1 : 0) +
            (fundamentalStatus === 'missing' ? 2 : fundamentalStatus === 'stale' ? 1 : 0)
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
          return {
            code: dossier.code,
            name: dossier.name,
            targetStatus,
            fundamentalStatus,
            severity,
            targetSource,
            targetLabel,
            classificationNote,
            targetUpdatedAt: dossier.targets?.updatedAt || null,
            fundamentalsUpdatedAt: dossier.fundamentals?.updatedAt || null,
          }
        })
        .filter((item) => item.severity > 0 || item.classificationNote)
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
    retPct,
    todayMarketClock,
    activeMarketDate,
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
    watchlistRows,
    watchlistFocus,
    showRelayPlan,
    scanRows,
    top5,
    winners,
    losers,
    attentionCount,
    pendingCount,
    targetUpdateCount,
    dataRefreshRows,
    todayRefreshKey,
    reportRefreshCandidates,
  }
}
