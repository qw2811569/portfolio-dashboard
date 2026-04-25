import { PORTFOLIO_ALIAS_TO_SUFFIX } from '../constants.js'
import { normalizeWatchlist } from './watchlistUtils.js'

export const WATCHLIST_SYNC_CHANNEL = 'portfolio-watchlist-sync-v1'

let watchlistBroadcastChannel = null

function readWatchlistStorageValue(key) {
  if (!key || typeof localStorage === 'undefined') return undefined
  const raw = localStorage.getItem(key)
  if (raw == null) return undefined

  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function getWatchlistBroadcastChannel() {
  const BroadcastChannelCtor =
    typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function'
      ? window.BroadcastChannel
      : typeof globalThis.BroadcastChannel === 'function'
        ? globalThis.BroadcastChannel
        : null
  if (!BroadcastChannelCtor) return null
  if (!watchlistBroadcastChannel) {
    watchlistBroadcastChannel = new BroadcastChannelCtor(WATCHLIST_SYNC_CHANNEL)
  }
  return watchlistBroadcastChannel
}

export function getWatchlistStorageKey(portfolioId) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId) return ''
  return `pf-${normalizedPortfolioId}-${PORTFOLIO_ALIAS_TO_SUFFIX.watchlist}`
}

export function readStoredWatchlist(portfolioId) {
  const storageKey = getWatchlistStorageKey(portfolioId)
  if (!storageKey) return []
  return normalizeWatchlist(readWatchlistStorageValue(storageKey))
}

export function broadcastWatchlistSync({ portfolioId, watchlist }) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId) return

  const channel = getWatchlistBroadcastChannel()
  if (!channel) return

  try {
    channel.postMessage({
      portfolioId: normalizedPortfolioId,
      watchlist: normalizeWatchlist(watchlist),
    })
  } catch {
    // BroadcastChannel is best-effort; storage event remains the fallback.
  }
}

export function subscribeWatchlistSync(listener) {
  if (typeof listener !== 'function') return () => {}

  const channel = getWatchlistBroadcastChannel()
  if (!channel) return () => {}

  const handleMessage = (event) => listener(event?.data || null)

  if (typeof channel.addEventListener === 'function') {
    channel.addEventListener('message', handleMessage)
    return () => channel.removeEventListener('message', handleMessage)
  }

  const previousHandler = channel.onmessage
  channel.onmessage = handleMessage
  return () => {
    if (channel.onmessage === handleMessage) {
      channel.onmessage = previousHandler || null
    }
  }
}

export function __resetWatchlistBroadcastChannelForTests() {
  if (watchlistBroadcastChannel && typeof watchlistBroadcastChannel.close === 'function') {
    try {
      watchlistBroadcastChannel.close()
    } catch {
      // ignore test cleanup errors
    }
  }
  watchlistBroadcastChannel = null
}
