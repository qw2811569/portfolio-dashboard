import {
  ACTIVE_PORTFOLIO_KEY,
  PORTFOLIO_ALIAS_TO_SUFFIX,
  PORTFOLIO_VIEW_MODE,
} from '../constants.js'

export const PORTFOLIO_REALTIME_SYNC_CHANNEL = 'portfolio-realtime-sync-v1'
export const PORTFOLIO_REALTIME_FIELD_SUFFIXES = new Set([
  PORTFOLIO_ALIAS_TO_SUFFIX.analysisHistory,
  PORTFOLIO_ALIAS_TO_SUFFIX.dailyReport,
])

let realtimeBroadcastChannel = null
let realtimeSourceId = ''

function getRealtimeSourceId() {
  if (!realtimeSourceId) {
    realtimeSourceId = `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
  return realtimeSourceId
}

function getRealtimeBroadcastChannel() {
  const BroadcastChannelCtor =
    typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function'
      ? window.BroadcastChannel
      : typeof globalThis.BroadcastChannel === 'function'
        ? globalThis.BroadcastChannel
        : null
  if (!BroadcastChannelCtor) return null
  if (!realtimeBroadcastChannel) {
    realtimeBroadcastChannel = new BroadcastChannelCtor(PORTFOLIO_REALTIME_SYNC_CHANNEL)
  }
  return realtimeBroadcastChannel
}

function postRealtimeMessage(payload = {}) {
  const channel = getRealtimeBroadcastChannel()
  if (!channel) return

  try {
    channel.postMessage({
      ...payload,
      sourceId: getRealtimeSourceId(),
      sentAt: Date.now(),
    })
  } catch {
    // BroadcastChannel is best-effort; storage/focus listeners remain the fallback.
  }
}

export function broadcastActivePortfolioSync({
  activePortfolioId,
  viewMode = PORTFOLIO_VIEW_MODE,
} = {}) {
  const normalizedPortfolioId = String(activePortfolioId || '').trim()
  if (!normalizedPortfolioId) return
  postRealtimeMessage({
    type: 'active-portfolio',
    activePortfolioId: normalizedPortfolioId,
    viewMode: String(viewMode || PORTFOLIO_VIEW_MODE),
  })
}

export function broadcastAnalysisStatusSync({
  portfolioId,
  analyzing = false,
  analyzeStep = '',
} = {}) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId) return
  postRealtimeMessage({
    type: 'analysis-status',
    portfolioId: normalizedPortfolioId,
    analyzing: Boolean(analyzing),
    analyzeStep: String(analyzeStep || ''),
  })
}

export function broadcastPortfolioFieldSync({ portfolioId, suffix, value } = {}) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId || !PORTFOLIO_REALTIME_FIELD_SUFFIXES.has(suffix)) return
  postRealtimeMessage({
    type: 'portfolio-field',
    portfolioId: normalizedPortfolioId,
    suffix,
    storageKey: getPortfolioFieldStorageKey(normalizedPortfolioId, suffix),
    value,
  })
}

export function subscribePortfolioRealtimeSync(listener) {
  if (typeof listener !== 'function') return () => {}

  const channel = getRealtimeBroadcastChannel()
  if (!channel) return () => {}

  const handleMessage = (event) => {
    const payload = event?.data || null
    if (!payload || payload.sourceId === getRealtimeSourceId()) return
    listener(payload)
  }

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

export function parseRealtimeStorageValue(rawValue) {
  if (rawValue == null) return undefined
  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
}

export function getPortfolioFieldStorageKey(portfolioId, suffix) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId || !suffix) return ''
  return `pf-${normalizedPortfolioId}-${suffix}`
}

export function __resetPortfolioRealtimeSyncForTests() {
  if (realtimeBroadcastChannel && typeof realtimeBroadcastChannel.close === 'function') {
    try {
      realtimeBroadcastChannel.close()
    } catch {
      // ignore test cleanup errors
    }
  }
  realtimeBroadcastChannel = null
  realtimeSourceId = ''
}

export { ACTIVE_PORTFOLIO_KEY }
