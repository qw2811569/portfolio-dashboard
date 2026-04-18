import { getFinMindDatasetConfig } from '../../src/lib/dataAdapters/finmindDatasetRegistry.js'

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data'
const TOKEN = String(process.env.FINMIND_TOKEN || '').trim()
const FINMIND_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000
const FINMIND_BUCKET_CAPACITY = 1600
const FINMIND_WARNING_THRESHOLD = 600
const FINMIND_REFILL_RATE_PER_MS = FINMIND_BUCKET_CAPACITY / (60 * 60 * 1000)

let finmindRateLimitedUntil = 0
let governorTokens = FINMIND_BUCKET_CAPACITY
let governorUpdatedAt = Date.now()
let governorWarnedForWindow = false

export class FinMindApiError extends Error {
  constructor(message, { status = 500, code = 'unknown', body = '' } = {}) {
    super(message)
    this.name = 'FinMindApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

function refillGovernor(now = Date.now()) {
  const elapsed = Math.max(0, now - governorUpdatedAt)
  governorTokens = Math.min(
    FINMIND_BUCKET_CAPACITY,
    governorTokens + elapsed * FINMIND_REFILL_RATE_PER_MS
  )
  governorUpdatedAt = now
  if (governorTokens >= FINMIND_WARNING_THRESHOLD) {
    governorWarnedForWindow = false
  }
}

function consumeGovernorToken(datasetKey) {
  const now = Date.now()

  if (now < finmindRateLimitedUntil) {
    throw new FinMindApiError('FinMind requests temporarily rate limited', {
      status: 402,
      code: 'rate_limited_cached',
    })
  }

  refillGovernor(now)

  if (governorTokens < 1) {
    finmindRateLimitedUntil = now + FINMIND_RATE_LIMIT_COOLDOWN_MS
    throw new FinMindApiError('FinMind governor blocked request burst', {
      status: 429,
      code: 'governor_blocked',
    })
  }

  governorTokens -= 1

  if (
    !governorWarnedForWindow &&
    FINMIND_BUCKET_CAPACITY - governorTokens >= FINMIND_WARNING_THRESHOLD
  ) {
    governorWarnedForWindow = true
    console.warn(
      `[finmind-governor] warning threshold crossed for current hour window (${FINMIND_WARNING_THRESHOLD}/${FINMIND_BUCKET_CAPACITY}) on ${datasetKey}`
    )
  }
}

function isUpperLimitMessage(value = '') {
  return /upper limit/i.test(String(value || ''))
}

export function isFinMindRateLimitError(error) {
  return error instanceof FinMindApiError && String(error.code || '').startsWith('rate_limited')
}

export function getFinMindGovernorState() {
  refillGovernor(Date.now())
  return {
    tokens: governorTokens,
    capacity: FINMIND_BUCKET_CAPACITY,
    blockedUntil: finmindRateLimitedUntil,
  }
}

export async function queryFinMindDataset(
  datasetKey,
  { code, startDate = '', endDate = '', fetchImpl = fetch, timeoutMs = 8000 } = {}
) {
  const config = getFinMindDatasetConfig(datasetKey)
  if (!config) {
    throw new FinMindApiError(`Unsupported FinMind dataset: ${datasetKey}`, {
      status: 400,
      code: 'unsupported_dataset',
    })
  }

  consumeGovernorToken(datasetKey)

  const searchParams = new URLSearchParams({
    dataset: config.finmindDataset,
    ...Object.fromEntries(
      Object.entries({
        data_id: String(code || '').trim(),
        start_date: startDate,
        end_date: endDate,
      }).filter(([, value]) => value != null && String(value).trim() !== '')
    ),
  })

  const headers = { 'User-Agent': 'portfolio-dashboard/1.0' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const response = await fetchImpl(`${FINMIND_BASE}?${searchParams.toString()}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const text = await response.text()
    const snippet = text.slice(0, 160)

    if (response.status === 402 && isUpperLimitMessage(text)) {
      finmindRateLimitedUntil = Date.now() + FINMIND_RATE_LIMIT_COOLDOWN_MS
      throw new FinMindApiError(`FinMind ${config.finmindDataset} requests reached upper limit`, {
        status: 402,
        code: 'rate_limited',
        body: snippet,
      })
    }

    throw new FinMindApiError(
      `FinMind ${config.finmindDataset} failed (${response.status}): ${snippet}`,
      {
        status: response.status,
        code: 'upstream_error',
        body: snippet,
      }
    )
  }

  const payload = await response.json()
  if (Number(payload?.status) !== 200 && String(payload?.msg || '').trim() !== 'success') {
    const message = String(payload?.msg || '')
    if (Number(payload?.status) === 402 || isUpperLimitMessage(message)) {
      finmindRateLimitedUntil = Date.now() + FINMIND_RATE_LIMIT_COOLDOWN_MS
      throw new FinMindApiError(`FinMind ${config.finmindDataset} requests reached upper limit`, {
        status: 402,
        code: 'rate_limited',
        body: message.slice(0, 160),
      })
    }

    throw new FinMindApiError(`FinMind ${config.finmindDataset}: ${message || 'unknown error'}`, {
      status: Number(payload?.status) || 500,
      code: 'upstream_payload_error',
      body: message.slice(0, 160),
    })
  }

  return Array.isArray(payload?.data) ? payload.data : []
}
