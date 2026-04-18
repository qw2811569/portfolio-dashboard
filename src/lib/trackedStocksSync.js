export const TRACKED_STOCKS_SYNC_EVENT = 'pf-tracked-stocks-sync'
export const TRACKED_STOCKS_SYNC_DEBOUNCE_MS = 5000
export const TRACKED_STOCKS_SYNC_STALE_MS = 24 * 60 * 60 * 1000
export const TRACKED_STOCKS_SYNC_GATE_STALE_MS = 7 * 24 * 60 * 60 * 1000

function toStorage() {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

function toMillis(value) {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? time : 0
}

function normalizeText(value) {
  return String(value || '').trim()
}

function emitTrackedStocksSyncEvent(portfolioId, state) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(
    new CustomEvent(TRACKED_STOCKS_SYNC_EVENT, {
      detail: {
        portfolioId,
        state,
      },
    })
  )
}

export function getTrackedStocksSyncStorageKey(portfolioId) {
  const normalizedPortfolioId = normalizeText(portfolioId)
  return normalizedPortfolioId ? `pf-${normalizedPortfolioId}-tracked-sync-v1` : ''
}

export function collectTrackedStocksFromHoldings(holdings = []) {
  const deduped = []
  const seen = new Set()

  for (const item of Array.isArray(holdings) ? holdings : []) {
    const code = normalizeText(item?.code)
    const name = normalizeText(item?.name)
    const type = normalizeText(item?.type) || '股票'

    if (!code || !name || seen.has(code)) continue
    seen.add(code)
    deduped.push({ code, name, type })
  }

  return deduped
}

export function normalizeTrackedStocksSyncState(value, portfolioId = '') {
  const normalizedPortfolioId = normalizeText(
    value?.portfolioId || portfolioId || value?.pid || value?.portfolio
  )
  if (!normalizedPortfolioId) return null

  return {
    portfolioId: normalizedPortfolioId,
    status: normalizeText(value?.status) || '',
    lastAttemptAt: normalizeText(value?.lastAttemptAt) || null,
    lastSyncedAt: normalizeText(value?.lastSyncedAt) || null,
    totalTracked: Math.max(0, Number(value?.totalTracked) || 0),
    source: normalizeText(value?.source) || '',
    lastError: normalizeText(value?.lastError) || '',
  }
}

export function readTrackedStocksSyncState(portfolioId, storage = toStorage()) {
  const key = getTrackedStocksSyncStorageKey(portfolioId)
  if (!key || !storage) return null

  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return normalizeTrackedStocksSyncState(JSON.parse(raw), portfolioId)
  } catch {
    return null
  }
}

export function writeTrackedStocksSyncState(
  portfolioId,
  value,
  { storage = toStorage(), emit = true } = {}
) {
  const key = getTrackedStocksSyncStorageKey(portfolioId)
  const normalized = normalizeTrackedStocksSyncState(value, portfolioId)
  if (!key || !normalized || !storage) return normalized

  try {
    storage.setItem(key, JSON.stringify(normalized))
  } catch {
    // best-effort local sync state persistence
  }

  if (emit) emitTrackedStocksSyncEvent(normalized.portfolioId, normalized)
  return normalized
}

export function formatTrackedStocksSyncTime(value) {
  const millis = toMillis(value)
  if (!millis) return ''

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(millis))
}

export function resolveTrackedStocksSyncBadge(
  state,
  { now = Date.now(), staleMs = TRACKED_STOCKS_SYNC_STALE_MS } = {}
) {
  const normalized = normalizeTrackedStocksSyncState(state)
  if (!normalized) return null

  if (normalized.status === 'failed') {
    const lastAttemptLabel = formatTrackedStocksSyncTime(
      normalized.lastAttemptAt || normalized.lastSyncedAt
    )
    return {
      status: 'failed',
      label: lastAttemptLabel ? `sync failed ${lastAttemptLabel}` : 'sync failed',
      title: normalized.lastError || 'Tracked stocks sync failed',
    }
  }

  if (!normalized.lastSyncedAt) {
    const lastAttemptLabel = formatTrackedStocksSyncTime(normalized.lastAttemptAt)
    if (lastAttemptLabel) {
      return {
        status: 'stale',
        label: `sync pending ${lastAttemptLabel}`,
        title: 'Tracked stocks sync pending',
      }
    }

    return {
      status: 'missing',
      label: 'last-synced --',
      title: 'Tracked stocks has not synced yet',
    }
  }

  const ageMs = Math.max(0, Number(now) - toMillis(normalized.lastSyncedAt))
  const lastSyncedLabel = formatTrackedStocksSyncTime(normalized.lastSyncedAt)

  if (ageMs > staleMs) {
    return {
      status: 'stale',
      label: `last-synced ${lastSyncedLabel}`,
      title: 'Tracked stocks sync is stale',
    }
  }

  return {
    status: 'fresh',
    label: `last-synced ${lastSyncedLabel}`,
    title: 'Tracked stocks synced recently',
  }
}
