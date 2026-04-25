import { useEffect } from 'react'
import { normalizeWatchlist } from '../lib/watchlistUtils.js'
import {
  getWatchlistStorageKey,
  readStoredWatchlist,
  subscribeWatchlistSync,
} from '../lib/watchlistSync.js'

export function useWatchlistStorageSync({
  portfolioId,
  enabled = true,
  onWatchlistSync = () => {},
}) {
  const normalizedPortfolioId = String(portfolioId || '').trim()

  useEffect(() => {
    if (!enabled || !normalizedPortfolioId || typeof window === 'undefined') return undefined

    const storageKey = getWatchlistStorageKey(normalizedPortfolioId)
    const applyStoredWatchlist = () => onWatchlistSync(readStoredWatchlist(normalizedPortfolioId))

    const handleStorageEvent = (event) => {
      if (event?.key !== storageKey) return

      if (event?.newValue == null) {
        onWatchlistSync([])
        return
      }

      try {
        onWatchlistSync(normalizeWatchlist(JSON.parse(event.newValue)))
      } catch {
        applyStoredWatchlist()
      }
    }

    const handleBroadcastMessage = (payload) => {
      if (payload?.portfolioId !== normalizedPortfolioId) return
      onWatchlistSync(normalizeWatchlist(payload.watchlist))
    }

    const handleWindowResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      applyStoredWatchlist()
    }

    const unsubscribeBroadcast = subscribeWatchlistSync(handleBroadcastMessage)

    window.addEventListener('storage', handleStorageEvent)
    window.addEventListener('focus', handleWindowResume)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWindowResume)
    }

    return () => {
      unsubscribeBroadcast()
      window.removeEventListener('storage', handleStorageEvent)
      window.removeEventListener('focus', handleWindowResume)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWindowResume)
      }
    }
  }, [enabled, normalizedPortfolioId, onWatchlistSync])
}
