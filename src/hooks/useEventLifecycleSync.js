import { useEffect, useRef } from 'react'
import { PORTFOLIO_VIEW_MODE } from '../constants.js'
import { APP_LABELS } from '../lib/appMessages.js'
import { autoReviewEvent } from '../lib/eventUtils.js'

export function useEventLifecycleSync({
  activePortfolioId = '',
  ready = false,
  viewMode = PORTFOLIO_VIEW_MODE,
  tab = 'holdings',
  newsEvents = [],
  setNewsEvents = () => {},
  portfolioTransitionRef = { current: { isHydrating: false } },
  getMarketQuotesForCodes = async () => ({}),
  normalizeNewsEvents = (items) => items,
  getEventStockCodes = () => [],
  parseSlashDate = () => null,
  toSlashDate = () => new Date().toLocaleDateString('zh-TW'),
  appendPriceHistory = (history) => history,
}) {
  const eventLifecycleSyncRef = useRef(false)

  useEffect(() => {
    const shouldSyncLifecycle =
      ready &&
      viewMode === PORTFOLIO_VIEW_MODE &&
      !portfolioTransitionRef.current.isHydrating &&
      Array.isArray(newsEvents) &&
      newsEvents.length > 0 &&
      ['holdings', 'events', 'news', 'daily'].includes(tab)

    if (!shouldSyncLifecycle || eventLifecycleSyncRef.current) return

    let cancelled = false
    eventLifecycleSyncRef.current = true

    const fetchMarketPriceMap = async (codes) => {
      const quotes = await getMarketQuotesForCodes(codes)
      return Object.fromEntries(
        Object.entries(quotes)
          .map(([code, quote]) => [code, quote?.price])
          .filter(([, price]) => Number.isFinite(price) && price > 0)
      )
    }

    const buildEventPriceRecord = (event, priceMap) => {
      const codes = getEventStockCodes(event)
      const entries = codes
        .map((code) => [code, priceMap?.[code]])
        .filter(([, price]) => Number.isFinite(price) && price > 0)
      return entries.length > 0 ? Object.fromEntries(entries) : null
    }

    const syncEventLifecycle = async (events = newsEvents) => {
      const normalizedEvents = normalizeNewsEvents(events)
      if (normalizedEvents.length === 0) return normalizedEvents

      const today = toSlashDate()
      const todayDate = parseSlashDate(today)
      if (!todayDate) return normalizedEvents

      const autoCloseCandidates = normalizedEvents.filter((event) => {
        if (event.status !== 'tracking') return false
        const trackingStart = parseSlashDate(event.trackingStart)
        if (!trackingStart) return false
        const trackingDays = Math.floor((todayDate - trackingStart) / (1000 * 60 * 60 * 24))
        return trackingDays >= 90
      })

      const duePending = normalizedEvents.filter((event) => {
        if (event.status !== 'pending') return false
        const scheduled = parseSlashDate(event.date)
        return scheduled && scheduled.getTime() <= todayDate.getTime()
      })

      const trackingEvents = normalizedEvents.filter(
        (event) =>
          event.status === 'tracking' && !autoCloseCandidates.some((item) => item.id === event.id)
      )

      const priceCodes = Array.from(
        new Set([
          ...autoCloseCandidates.flatMap(getEventStockCodes),
          ...duePending.flatMap(getEventStockCodes),
          ...trackingEvents.flatMap(getEventStockCodes),
        ])
      )

      if (priceCodes.length === 0) return normalizedEvents

      let priceMap = {}
      try {
        priceMap = await fetchMarketPriceMap(priceCodes)
      } catch (error) {
        console.error('事件追蹤價格抓取失敗:', error)
        return normalizedEvents
      }

      // Auto-review: tracking events with valid priceAtEvent get automatic
      // correctness evaluation (pred vs actual price direction) AFTER a
      // minimum observation window. Stock market events need time to digest —
      // a 3-day observation period lets the market fully react before we
      // judge whether the prediction was correct.
      const AUTO_REVIEW_MIN_TRACKING_DAYS = 3
      let result = normalizedEvents.map((event) => {
        if (event.status !== 'tracking') return event
        const latestPrices = buildEventPriceRecord(event, priceMap)
        if (!latestPrices) return event

        // Enforce minimum observation window before auto-review
        const trackingStart = parseSlashDate(event.trackingStart)
        const trackingDays = trackingStart
          ? Math.floor((todayDate - trackingStart) / (1000 * 60 * 60 * 24))
          : 0
        if (trackingDays >= AUTO_REVIEW_MIN_TRACKING_DAYS) {
          const reviewed = autoReviewEvent(event, latestPrices, { today })
          if (reviewed) return reviewed
        }

        // Fallback: 90-day auto-close without correctness (no pred or no priceAtEvent)
        if (autoCloseCandidates.some((item) => item.id === event.id)) {
          return {
            ...event,
            status: 'closed',
            exitDate: today,
            priceAtExit: latestPrices,
            autoClosed: true,
            autoClosedReason: APP_LABELS.eventAutoClosedAfter90Days,
          }
        }

        return event
      })

      result = result.map((event) => {
        if (event.status === 'pending') {
          const scheduled = parseSlashDate(event.date)
          if (!scheduled || scheduled.getTime() > todayDate.getTime()) return event
          const priceAtEvent = buildEventPriceRecord(event, priceMap)
          if (!priceAtEvent) return event
          return {
            ...event,
            status: 'tracking',
            eventDate: today,
            trackingStart: today,
            priceAtEvent,
            priceHistory: appendPriceHistory(event.priceHistory, today, priceAtEvent),
          }
        }
        return event
      })

      result = result.map((event) => {
        if (event.status === 'tracking') {
          const latestPrices = buildEventPriceRecord(event, priceMap)
          if (!latestPrices) return event
          return {
            ...event,
            priceHistory: appendPriceHistory(event.priceHistory, today, latestPrices),
          }
        }
        return event
      })

      return result
    }

    ;(async () => {
      try {
        const nextEvents = await syncEventLifecycle(newsEvents)
        if (cancelled) return
        const currentJson = JSON.stringify(normalizeNewsEvents(newsEvents))
        const nextJson = JSON.stringify(nextEvents)
        if (currentJson !== nextJson) {
          setNewsEvents(nextEvents)
        }
      } finally {
        eventLifecycleSyncRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    activePortfolioId,
    appendPriceHistory,
    getEventStockCodes,
    getMarketQuotesForCodes,
    newsEvents,
    normalizeNewsEvents,
    parseSlashDate,
    portfolioTransitionRef,
    ready,
    setNewsEvents,
    tab,
    toSlashDate,
    viewMode,
  ])
}
