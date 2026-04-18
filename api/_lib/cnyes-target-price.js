import { createHash } from 'crypto'

const CNYES_API_BASE = 'https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/targetPrice'
const CNYES_TIMEOUT_MS = 8000
const CNYES_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'

function normalizeTicker(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

function parsePositiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const normalized = raw.replace(/[/.]/g, '-')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeCnyesAggregatePayload(payload) {
  const row = payload?.data?.targetValuation?.data || payload?.data || null
  if (!row || typeof row !== 'object') return null

  const medianTarget = parsePositiveNumber(row.feMedian)
  const meanTarget = parsePositiveNumber(row.feMean)
  const min = parsePositiveNumber(row.feLow)
  const max = parsePositiveNumber(row.feHigh)
  const firmsCount = Number(row.numEst)
  const rateDate = normalizeDate(row.rateDate)

  if (!medianTarget && !meanTarget && !min && !max) return null
  if (!Number.isFinite(firmsCount) || firmsCount <= 0) return null

  return {
    medianTarget,
    meanTarget,
    min,
    max,
    firmsCount,
    numEst: firmsCount,
    rateDate,
  }
}

export async function fetchCnyesAggregate(
  code,
  { timeoutMs = CNYES_TIMEOUT_MS, fetchImpl = fetch } = {}
) {
  const normalizedCode = normalizeTicker(code)
  if (!normalizedCode) {
    return { source: 'cnyes', aggregate: null, reason: 'invalid_code' }
  }

  const url = `${CNYES_API_BASE}/TWS:${normalizedCode}:STOCK`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': CNYES_USER_AGENT,
      },
      signal: controller.signal,
    })

    if (response.status === 404) {
      return { source: 'cnyes', aggregate: null, reason: 'no_target_data' }
    }

    if (!response.ok) {
      return { source: 'cnyes', aggregate: null, reason: `http_${response.status}` }
    }

    const payload = await response.json().catch(() => null)
    const aggregate = normalizeCnyesAggregatePayload(payload)
    if (!aggregate) {
      return { source: 'cnyes', aggregate: null, reason: 'no_target_data' }
    }

    return {
      source: 'cnyes',
      aggregate,
      rawHtml: null,
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { source: 'cnyes', aggregate: null, reason: 'timeout' }
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function buildCnyesAggregateItem(stock, aggregate) {
  const id = createHash('sha1')
    .update(
      [stock.code, aggregate.rateDate, aggregate.min, aggregate.max, aggregate.firmsCount].join('|')
    )
    .digest('hex')
    .slice(0, 16)

  const evidenceParts = [
    Number.isFinite(Number(aggregate.firmsCount)) ? `${aggregate.firmsCount} 家機構估值` : '',
    Number.isFinite(Number(aggregate.meanTarget)) ? `均值 ${aggregate.meanTarget}` : '',
    Number.isFinite(Number(aggregate.medianTarget)) ? `中位數 ${aggregate.medianTarget}` : '',
    Number.isFinite(Number(aggregate.min)) ? `最低 ${aggregate.min}` : '',
    Number.isFinite(Number(aggregate.max)) ? `最高 ${aggregate.max}` : '',
  ].filter(Boolean)

  return {
    id,
    hash: id,
    title: `${stock.name}(${stock.code}) Cnyes 目標價共識`,
    url: `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/targetPrice/TWS:${stock.code}:STOCK`,
    source: 'cnyes_aggregate',
    publishedAt: aggregate.rateDate,
    snippet: evidenceParts.join('，'),
    summary: evidenceParts.join('，'),
    aggregate: {
      medianTarget: aggregate.medianTarget,
      meanTarget: aggregate.meanTarget,
      min: aggregate.min,
      max: aggregate.max,
      firmsCount: aggregate.firmsCount,
      numEst: aggregate.numEst,
      rateDate: aggregate.rateDate,
    },
    target: null,
    targetType: 'aggregate',
    targetEvidence: evidenceParts.join('，'),
    firm: '',
    stance: 'unknown',
    tags: ['cnyes', 'aggregate'],
    confidence: null,
    extractedAt: new Date().toISOString(),
    rank: 1,
  }
}
