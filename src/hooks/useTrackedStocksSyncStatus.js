import { useEffect, useState } from 'react'
import {
  TRACKED_STOCKS_SYNC_EVENT,
  getTrackedStocksSyncStorageKey,
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

    const handleSyncEvent = (event) => {
      if (event?.detail?.portfolioId !== portfolioId) return
      setSyncState(event.detail.state || null)
    }

    const handleStorageEvent = (event) => {
      if (event?.key !== getTrackedStocksSyncStorageKey(portfolioId)) return
      setSyncState(readTrackedStocksSyncState(portfolioId))
    }

    window.addEventListener(TRACKED_STOCKS_SYNC_EVENT, handleSyncEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(TRACKED_STOCKS_SYNC_EVENT, handleSyncEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [portfolioId])

  return {
    syncState,
    badge: resolveTrackedStocksSyncBadge(syncState),
  }
}
