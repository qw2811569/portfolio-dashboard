const MIN_PER_SAMPLE_SIZE = 24
const PER_OUTLIER_CAP = 500

function toFiniteNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function roundTo(value, digits = 2) {
  const number = toFiniteNumber(value)
  if (number == null) return null
  const factor = 10 ** digits
  return Math.round(number * factor) / factor
}

function percentile(sortedValues, ratio) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null
  if (sortedValues.length === 1) return sortedValues[0]

  const index = (sortedValues.length - 1) * ratio
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  const weight = index - lowerIndex
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
}

function normalizePerSamples(perHistory = []) {
  const values = []

  for (const row of Array.isArray(perHistory) ? perHistory : []) {
    const per = toFiniteNumber(row?.per)
    if (per == null || per <= 0 || per > PER_OUTLIER_CAP) continue
    values.push(per)
  }

  return values
}

function resolveConfidence(sampleSize) {
  if (sampleSize >= 60) return 'high'
  if (sampleSize >= 36) return 'medium'
  return 'low'
}

function createEmptyResult(method, note, { sampleSize = 0, confidence = 'low' } = {}) {
  return {
    method,
    lowerBound: null,
    midPoint: null,
    upperBound: null,
    perLow: null,
    perMid: null,
    perHigh: null,
    sampleSize,
    confidence,
    note,
  }
}

export function resolveValuationBandPosition(currentPrice, valuation) {
  const price = toFiniteNumber(currentPrice)
  const lowerBound = toFiniteNumber(valuation?.lowerBound)
  const upperBound = toFiniteNumber(valuation?.upperBound)

  if (price == null || lowerBound == null || upperBound == null) return null
  if (price < lowerBound) return 'below'
  if (price > upperBound) return 'above'
  return 'within'
}

/**
 * 歷史 P/E 區間估值
 * @param {string} code 股票代號
 * @param {Object} opts
 * @param {Array<{date, per}>} opts.perHistory 近 5 年每月 P/E 歷史（FinMind TaiwanStockPER）
 * @param {number} opts.epsTTM 最新 trailing 12 月 EPS
 * @returns {{
 *   method: 'historical-per-band' | 'eps-negative' | 'insufficient-data',
 *   lowerBound: number | null,
 *   midPoint: number | null,
 *   upperBound: number | null,
 *   perLow: number | null,
 *   perMid: number | null,
 *   perHigh: number | null,
 *   sampleSize: number,
 *   confidence: 'high' | 'medium' | 'low',
 *   note: string,
 * }}
 */
export function computeHistoricalPerBand(code, { perHistory, epsTTM } = {}) {
  const trimmedSamples = normalizePerSamples(perHistory)
  const sampleSize = trimmedSamples.length
  const normalizedEps = toFiniteNumber(epsTTM)

  if (normalizedEps == null) {
    return createEmptyResult('insufficient-data', `${code || 'unknown'} 缺少 EPS_TTM`, {
      sampleSize,
    })
  }

  if (normalizedEps < 0) {
    return createEmptyResult('eps-negative', `${code || 'unknown'} EPS_TTM 為負，無法用 P/E 估值`, {
      sampleSize,
    })
  }

  if (sampleSize < MIN_PER_SAMPLE_SIZE) {
    return createEmptyResult(
      'insufficient-data',
      `${code || 'unknown'} 歷史 P/E 樣本不足 ${MIN_PER_SAMPLE_SIZE} 筆（月資料）`,
      {
        sampleSize,
        confidence: resolveConfidence(sampleSize),
      }
    )
  }

  const sorted = [...trimmedSamples].sort((left, right) => left - right)
  const perLow = percentile(sorted, 0.2)
  const perMid = percentile(sorted, 0.5)
  const perHigh = percentile(sorted, 0.8)
  const confidence = resolveConfidence(sampleSize)

  return {
    method: 'historical-per-band',
    lowerBound: roundTo(perLow * normalizedEps),
    midPoint: roundTo(perMid * normalizedEps),
    upperBound: roundTo(perHigh * normalizedEps),
    perLow: roundTo(perLow),
    perMid: roundTo(perMid),
    perHigh: roundTo(perHigh),
    sampleSize,
    confidence,
    note: `近 5 年月度 P/E ${sampleSize} 筆，採 20/50/80 分位數`,
  }
}
