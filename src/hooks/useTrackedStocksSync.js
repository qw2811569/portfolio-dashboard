import { useEffect, useRef } from 'react'
import { API_ENDPOINTS } from '../constants.js'
import { normalizeDataError } from '../lib/dataError.js'
import {
  TRACKED_STOCKS_SYNC_DEBOUNCE_MS,
  collectTrackedStocksFromHoldings,
  readTrackedStocksSyncState,
  writeTrackedStocksSyncState,
} from '../lib/trackedStocksSync.js'

export function useTrackedStocksSync({
  activePortfolioId,
  holdings,
  enabled = true,
  fetchImpl = fetch,
  debounceMs = TRACKED_STOCKS_SYNC_DEBOUNCE_MS,
  onStateChange = null,
}) {
  const syncedSignatureRef = useRef('')

  useEffect(() => {
    const portfolioId = String(activePortfolioId || '').trim()
    const trackedStocks = collectTrackedStocksFromHoldings(holdings)
    if (!enabled || !portfolioId || trackedStocks.length === 0 || typeof fetchImpl !== 'function') {
      return
    }

    const signature = JSON.stringify({ portfolioId, trackedStocks })
    if (signature === syncedSignatureRef.current) return

    const controller = new AbortController()
    const timer = setTimeout(
      async () => {
        const previousState = readTrackedStocksSyncState(portfolioId) || { portfolioId }
        const attemptAt = new Date().toISOString()

        try {
          const response = await fetchImpl(API_ENDPOINTS.TRACKED_STOCKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              portfolioId,
              pid: portfolioId,
              stocks: trackedStocks,
            }),
            signal: controller.signal,
          })
          const payload = await response.json().catch(() => ({}))

          if (!response.ok) {
            const error = new Error(
              payload?.error || `tracked stocks sync failed (${response.status})`
            )
            error.status = response.status
            throw error
          }

          const nextState = writeTrackedStocksSyncState(portfolioId, {
            portfolioId,
            status: 'fresh',
            lastAttemptAt: attemptAt,
            lastSyncedAt: payload?.lastSyncedAt || attemptAt,
            totalTracked: Number(payload?.totalTracked) || trackedStocks.length,
            source: 'live-sync',
            lastError: '',
          })

          syncedSignatureRef.current = signature
          if (typeof onStateChange === 'function') onStateChange(nextState)
        } catch (error) {
          if (error?.name === 'AbortError') return
          const normalizedError = normalizeDataError(error, { resource: 'tracked-stocks' })

          const nextState = writeTrackedStocksSyncState(portfolioId, {
            ...previousState,
            portfolioId,
            status: 'failed',
            lastAttemptAt: attemptAt,
            lastSyncedAt: previousState?.lastSyncedAt || null,
            totalTracked: Math.max(Number(previousState?.totalTracked) || 0, trackedStocks.length),
            source: previousState?.source || 'live-sync',
            lastError: normalizedError?.message || 'tracked stocks sync failed',
            errorStatus: normalizedError?.status || null,
          })

          if (typeof onStateChange === 'function') onStateChange(nextState)
        }
      },
      Math.max(0, Number(debounceMs) || 0)
    )

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [activePortfolioId, debounceMs, enabled, fetchImpl, holdings, onStateChange])
}
