import { getFinMindDatasetConfig, resolveFinMindDatasetRequest } from './finmindDatasetRegistry.js'
import { API_ENDPOINTS } from '../apiEndpoints.js'

const CACHE_PREFIX = 'fm-cache-'
const CACHE_TTL_MS = 4 * 60 * 60 * 1000
const MAX_CONCURRENT_FINMIND = 3
const FINMIND_ROUTE_PATH = API_ENDPOINTS.FINMIND
const FINMIND_UPSTREAM_BASE = 'https://api.finmindtrade.com/api/v4/data'

let finmindInFlight = 0
const finmindPending = []

function acquireFinMindSlot() {
  return new Promise((resolve) => {
    if (finmindInFlight < MAX_CONCURRENT_FINMIND) {
      finmindInFlight += 1
      resolve()
      return
    }
    finmindPending.push(resolve)
  })
}

function releaseFinMindSlot() {
  const next = finmindPending.shift()
  if (next) {
    next()
    return
  }
  finmindInFlight = Math.max(0, finmindInFlight - 1)
}

function getCacheKey(datasetKey, code, startDate = '', endDate = '', scope = 'route') {
  return `${CACHE_PREFIX}${scope}-${datasetKey}-${code}-${startDate || 'na'}-${endDate || 'na'}`
}

function evictEmptyFinMindCache() {
  try {
    if (typeof localStorage === 'undefined') return
    const victims = []
    const len = localStorage.length || 0
    for (let index = 0; index < len; index += 1) {
      const key = localStorage.key(index)
      if (!key || !key.startsWith(CACHE_PREFIX)) continue
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.data) && parsed.data.length === 0) {
          victims.push(key)
        }
      } catch {
        victims.push(key)
      }
    }
    for (const key of victims) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
    if (victims.length > 0 && typeof console !== 'undefined') {
      console.warn(`[finmindAdapter] evicted ${victims.length} empty cache entries`)
    }
  } catch {
    /* ignore */
  }
}

evictEmptyFinMindCache()

function readCache(cacheKey) {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey)
      return null
    }
    return data
  } catch {
    return null
  }
}

function writeCache(cacheKey, data) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    /* ignore */
  }
}

function buildRouteUrl({ datasetKey, code, startDate, endDate }) {
  const searchParams = new URLSearchParams({
    dataset: datasetKey,
    code: String(code || '').trim(),
  })
  if (startDate) searchParams.set('start_date', startDate)
  if (endDate) searchParams.set('end_date', endDate)
  return `${FINMIND_ROUTE_PATH}?${searchParams.toString()}`
}

function buildUpstreamUrl({ finmindDataset, code, startDate, endDate }) {
  const searchParams = new URLSearchParams({
    dataset: finmindDataset,
    data_id: String(code || '').trim(),
  })
  if (startDate) searchParams.set('start_date', startDate)
  if (endDate) searchParams.set('end_date', endDate)

  const token = String(process.env.FINMIND_TOKEN || '').trim()
  if (token) searchParams.set('token', token)

  return `${FINMIND_UPSTREAM_BASE}?${searchParams.toString()}`
}

function mergeRequestWithBoundaryOptions(request = {}, options = {}) {
  const merged = {
    ...(request && typeof request === 'object' ? request : {}),
  }

  for (const key of ['startDate', 'endDate', 'days', 'months', 'windowDays', 'windowMonths']) {
    if (merged[key] == null && options?.[key] != null) {
      merged[key] = options[key]
    }
  }

  return merged
}

function classifyFinMindErrorMessage(message = '') {
  const text = String(message || '').trim()
  if (!text) return 'analysis-unavailable'
  if (/unauthorized|forbidden|401|auth/i.test(text)) {
    return 'auth-required'
  }
  if (/quota|upper limit|rate limit|429|402|governor blocked/i.test(text)) {
    return 'quota-exceeded'
  }
  if (/timeout|timed out|503|504|502|upstream_error/i.test(text)) {
    return 'api-timeout'
  }
  return 'analysis-unavailable'
}

function normalizeFinMindStatePayload(payload = {}, { data, source = 'finmind' } = {}) {
  const safeData = Array.isArray(data) ? data : Array.isArray(payload?.data) ? payload.data : []
  const degradedMeta =
    payload?.degradedMeta && typeof payload.degradedMeta === 'object' ? payload.degradedMeta : {}
  const degraded = payload?.degraded === true
  const reason =
    String(degradedMeta.reason || payload?.reason || '').trim() ||
    (degraded ? classifyFinMindErrorMessage(payload?.error || payload?.warning) : '')

  return {
    data: safeData,
    isStale: degraded,
    error:
      degraded || reason
        ? {
            reason: reason || 'analysis-unavailable',
            message:
              String(degradedMeta.liveError || payload?.warning || payload?.error || '').trim() ||
              null,
            fallbackAt: String(degradedMeta.fallbackAt || '').trim() || null,
            snapshotDate: String(degradedMeta.snapshotDate || '').trim() || null,
            attempts: Number.isFinite(Number(degradedMeta.attempts))
              ? Number(degradedMeta.attempts)
              : null,
          }
        : null,
    degraded,
    fetchedAt: String(payload?.fetchedAt || '').trim() || null,
    source: String(payload?.source || source).trim() || source,
    fallbackSnapshot:
      payload?.fallbackSnapshot && typeof payload.fallbackSnapshot === 'object'
        ? payload.fallbackSnapshot
        : null,
  }
}

async function fetchFinMindWithBoundaryState(
  datasetKey,
  code,
  request = {},
  options = {},
  scope = 'route'
) {
  const datasetConfig = getFinMindDatasetConfig(datasetKey)
  if (!datasetConfig) {
    throw new Error(`Unsupported FinMind dataset: ${datasetKey}`)
  }

  const effectiveRequest = mergeRequestWithBoundaryOptions(request, options)
  const { startDate, endDate, finmindDataset } = resolveFinMindDatasetRequest(
    datasetKey,
    effectiveRequest
  )
  const forceFresh = options?.forceFresh === true
  const cacheKey = getCacheKey(datasetKey, code, startDate, endDate, scope)
  const cached = forceFresh ? null : readCache(cacheKey)
  if (cached) {
    return normalizeFinMindStatePayload(
      {
        data: cached,
        source: 'cache',
      },
      { data: cached, source: 'cache' }
    )
  }

  const url =
    scope === 'upstream'
      ? buildUpstreamUrl({ finmindDataset, code, startDate, endDate })
      : buildRouteUrl({ datasetKey, code, startDate, endDate })
  const requestedTimeoutMs = Number(options?.timeoutMs)
  const timeoutMs =
    Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0 ? requestedTimeoutMs : 10000

  await acquireFinMindSlot()
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      if (scope === 'upstream') {
        throw new Error(`FinMind ${finmindDataset} failed (${response.status})`)
      }
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || `FinMind ${datasetKey} failed (${response.status})`)
    }

    const json = await response.json()
    const data = Array.isArray(json?.data) ? json.data : []
    const state = normalizeFinMindStatePayload(json, {
      data,
      source: scope === 'upstream' ? 'finmind-upstream' : 'finmind',
    })

    if (scope === 'route' && state.degraded) {
      return state
    }

    writeCache(cacheKey, data)
    return state
  } finally {
    releaseFinMindSlot()
  }
}

async function fetchFinMindWithBoundary(
  datasetKey,
  code,
  request = {},
  options = {},
  scope = 'route'
) {
  const state = await fetchFinMindWithBoundaryState(datasetKey, code, request, options, scope)
  return state.data
}

export async function fetchFinMindDatasetState(datasetKey, code, request = {}, options = {}) {
  return fetchFinMindWithBoundaryState(datasetKey, code, request, options, 'route')
}

export async function fetchFinMindDataset(datasetKey, code, request = {}, options = {}) {
  return fetchFinMindWithBoundary(datasetKey, code, request, options, 'route')
}

export async function fetchFinMindRawDataset(datasetKey, code, request = {}, options = {}) {
  return fetchFinMindWithBoundary(datasetKey, code, request, options, 'upstream')
}

export async function fetchCustomFinMindRawDataset(
  finmindDataset,
  { code, startDate = '', endDate = '' } = {},
  options = {}
) {
  const cacheKey = getCacheKey(`custom-${finmindDataset}`, code, startDate, endDate, 'upstream')
  const forceFresh = options?.forceFresh === true
  const cached = forceFresh ? null : readCache(cacheKey)
  if (cached) return cached
  const requestedTimeoutMs = Number(options?.timeoutMs)
  const timeoutMs =
    Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0 ? requestedTimeoutMs : 10000

  await acquireFinMindSlot()
  try {
    const response = await fetch(
      buildUpstreamUrl({
        finmindDataset,
        code,
        startDate,
        endDate,
      }),
      {
        signal: AbortSignal.timeout(timeoutMs),
      }
    )

    if (!response.ok) {
      throw new Error(`FinMind ${finmindDataset} failed (${response.status})`)
    }

    const json = await response.json()
    const data = Array.isArray(json?.data) ? json.data : []
    writeCache(cacheKey, data)
    return data
  } finally {
    releaseFinMindSlot()
  }
}
