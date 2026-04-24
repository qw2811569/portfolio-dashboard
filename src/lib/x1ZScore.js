export const X1_RECENT_WINDOW_DAYS = 7
export const X1_TRAILING_STD_DAYS = 20

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function roundTo(value, digits = 4) {
  const numeric = toFiniteNumber(value)
  if (numeric == null) return null
  const base = 10 ** digits
  return Math.round(numeric * base) / base
}

function standardDeviation(values = []) {
  const safeValues = (Array.isArray(values) ? values : [])
    .map((value) => toFiniteNumber(value))
    .filter((value) => value != null)

  if (safeValues.length < 2) return null

  const mean = safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length
  const variance =
    safeValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (safeValues.length - 1)

  return variance > 0 ? Math.sqrt(variance) : 0
}

export function deriveX1Interpretation(zScore) {
  const numeric = toFiniteNumber(zScore)
  if (numeric == null) return 'normal'

  const abs = Math.abs(numeric)
  if (abs >= 2) return 'anomaly'
  if (numeric >= 1) return 'outperform'
  if (numeric <= -1) return 'underperform'
  return 'normal'
}

export function buildReturnSeriesFromValueSnapshots(snapshots = [], valueKey = 'totalValue') {
  const sorted = (Array.isArray(snapshots) ? snapshots : [])
    .map((snapshot) => ({
      date: String(snapshot?.date || '').trim(),
      value: toFiniteNumber(snapshot?.[valueKey]),
    }))
    .filter((snapshot) => snapshot.date && snapshot.value != null && snapshot.value >= 0)
    .sort((left, right) => left.date.localeCompare(right.date))

  const series = []

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (!previous || !current) continue
    if (previous.value == null || current.value == null || previous.value <= 0) continue

    series.push({
      date: current.date,
      previousDate: previous.date,
      returnPct: roundTo((current.value / previous.value - 1) * 100, 4),
      currentValue: current.value,
      previousValue: previous.value,
    })
  }

  return series
}

function alignReturnSeries(portfolioDailyReturns = [], benchmarkDailyReturns = []) {
  const benchmarkByDate = new Map()
  for (const row of Array.isArray(benchmarkDailyReturns) ? benchmarkDailyReturns : []) {
    const date = String(row?.date || '').trim()
    const returnPct = toFiniteNumber(row?.returnPct)
    if (!date || returnPct == null) continue
    benchmarkByDate.set(date, returnPct)
  }

  return (Array.isArray(portfolioDailyReturns) ? portfolioDailyReturns : [])
    .map((row) => {
      const date = String(row?.date || '').trim()
      const portfolioReturnPct = toFiniteNumber(row?.returnPct)
      const benchmarkReturnPct = benchmarkByDate.get(date)
      if (!date || portfolioReturnPct == null || benchmarkReturnPct == null) return null

      return {
        date,
        previousDate: String(row?.previousDate || '').trim() || null,
        portfolioReturnPct,
        benchmarkReturnPct,
        diffPct: roundTo(portfolioReturnPct - benchmarkReturnPct, 4),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date))
}

export function calculateX1ZScore({
  portfolioDailyReturns = [],
  benchmarkDailyReturns = [],
  trailingWindow = X1_TRAILING_STD_DAYS,
  recentWindow = X1_RECENT_WINDOW_DAYS,
} = {}) {
  const alignedSeries = alignReturnSeries(portfolioDailyReturns, benchmarkDailyReturns)
  const safeTrailingWindow = Math.max(2, Number(trailingWindow) || X1_TRAILING_STD_DAYS)
  const safeRecentWindow = Math.max(1, Number(recentWindow) || X1_RECENT_WINDOW_DAYS)

  if (alignedSeries.length < safeTrailingWindow) {
    return {
      zScore: null,
      interpretation: 'normal',
      sampleSize: alignedSeries.length,
      recentSeries: alignedSeries.slice(-safeRecentWindow),
      reason: 'insufficient_history',
    }
  }

  const trailingSeries = alignedSeries.slice(-safeTrailingWindow)
  const latest = trailingSeries[trailingSeries.length - 1] || null
  const volatilityPct = standardDeviation(trailingSeries.map((row) => row.diffPct))

  if (!latest || volatilityPct == null) {
    return {
      zScore: null,
      interpretation: 'normal',
      sampleSize: trailingSeries.length,
      recentSeries: alignedSeries.slice(-safeRecentWindow),
      reason: 'insufficient_history',
    }
  }

  const zScore = volatilityPct > 0 ? roundTo(latest.diffPct / volatilityPct, 4) : 0

  return {
    zScore,
    interpretation: deriveX1Interpretation(zScore),
    latestDate: latest.date,
    latestPortfolioReturnPct: latest.portfolioReturnPct,
    latestBenchmarkReturnPct: latest.benchmarkReturnPct,
    latestDiffPct: latest.diffPct,
    volatilityPct: roundTo(volatilityPct, 4),
    sampleSize: trailingSeries.length,
    recentSeries: alignedSeries.slice(-safeRecentWindow),
    reason: null,
  }
}
