import { useEffect, useState } from 'react'
import {
  TRACKED_STOCKS_SYNC_EVENT,
  getTrackedStocksSyncStorageKey,
  normalizeTrackedStocksSyncState,
  readTrackedStocksSyncState,
  resolveTrackedStocksSyncBadge,
} from '../lib/trackedStocksSync.js'

export function useTrackedStocksSyncStatus(activePortfolioId) {
  const portfolioId = String(activePortfolioId || '').trim()
  const [syncState, setSyncState] = useState(() => readTrackedStocksSyncState(portfolioId))

  useEffect(() => {
    setSyncState(readTrackedStocksSyncState(portfolioId))
  }, [portfolioId])

  useEffect(() => {
    if (!portfolioId || typeof window === 'undefined') return
    const storageKey = getTrackedStocksSyncStorageKey(portfolioId)

    const refreshSyncState = () => {
      setSyncState(readTrackedStocksSyncState(portfolioId))
    }

    const handleSyncEvent = (event) => {
      if (event?.detail?.portfolioId !== portfolioId) return
      setSyncState(event.detail.state || null)
    }

    const handleStorageEvent = (event) => {
      if (event?.key !== storageKey) return

      if (event?.newValue == null) {
        setSyncState(null)
        return
      }

      try {
        const parsed = JSON.parse(event.newValue)
        setSyncState(normalizeTrackedStocksSyncState(parsed, portfolioId))
      } catch {
        refreshSyncState()
      }
    }

    const handleWindowResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      refreshSyncState()
    }

    window.addEventListener(TRACKED_STOCKS_SYNC_EVENT, handleSyncEvent)
    window.addEventListener('storage', handleStorageEvent)
    window.addEventListener('focus', handleWindowResume)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWindowResume)
    }

    return () => {
      window.removeEventListener(TRACKED_STOCKS_SYNC_EVENT, handleSyncEvent)
      window.removeEventListener('storage', handleStorageEvent)
      window.removeEventListener('focus', handleWindowResume)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWindowResume)
      }
    }
  }, [portfolioId])

  return {
    syncState,
    badge: resolveTrackedStocksSyncBadge(syncState),
  }
}
