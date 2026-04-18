function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeMonthKey(row) {
  const month =
    toFiniteNumber(row?.month) ??
    toFiniteNumber(row?.revenueMonth) ??
    toFiniteNumber(String(row?.date || '').slice(5, 7))
  const year =
    toFiniteNumber(row?.year) ??
    toFiniteNumber(row?.revenueYear) ??
    toFiniteNumber(String(row?.date || '').slice(0, 4))

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null

  return { year, month }
}

function buildNormalizedRows(monthlyRevenue = []) {
  return monthlyRevenue
    .map((row) => {
      const normalizedDate = normalizeMonthKey(row)
      const revenue = toFiniteNumber(row?.revenue)
      if (!normalizedDate || revenue == null) return null
      return {
        year: normalizedDate.year,
        month: normalizedDate.month,
        revenue,
        yoyChange: toFiniteNumber(row?.revenueYoY ?? row?.yoyChange),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.year - right.year || left.month - right.month)
}

function average(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function computeSeasonality(monthlyRevenue) {
  const normalizedRows = buildNormalizedRows(monthlyRevenue)
  if (normalizedRows.length === 0) {
    return {
      matrix: [],
      monthAvgs: {},
      bestMonths: [],
      worstMonths: [],
      seasonalityIndex: 0,
    }
  }

  const byYear = new Map()
  for (const row of normalizedRows) {
    const bucket = byYear.get(row.year) || []
    bucket.push(row)
    byYear.set(row.year, bucket)
  }

  const yearMeans = new Map()
  for (const [year, rows] of byYear.entries()) {
    const mean = average(rows.map((row) => row.revenue))
    yearMeans.set(year, mean && mean > 0 ? mean : mean === 0 ? 0 : null)
  }

  const monthBuckets = new Map()
  const normalizedMonthBuckets = new Map()
  const matrix = normalizedRows.map((row) => {
    const yearMean = yearMeans.get(row.year)
    const indexedToYearMean =
      Number.isFinite(yearMean) && yearMean !== 0
        ? row.revenue / yearMean
        : row.revenue === 0
          ? 0
          : null

    const revenueBucket = monthBuckets.get(row.month) || []
    revenueBucket.push(row.revenue)
    monthBuckets.set(row.month, revenueBucket)

    if (Number.isFinite(indexedToYearMean)) {
      const normalizedBucket = normalizedMonthBuckets.get(row.month) || []
      normalizedBucket.push(indexedToYearMean)
      normalizedMonthBuckets.set(row.month, normalizedBucket)
    }

    return [row.year, row.month, row.revenue, row.yoyChange, round(indexedToYearMean)]
  })

  const monthAvgs = {}
  for (let month = 1; month <= 12; month += 1) {
    const values = monthBuckets.get(month) || []
    if (values.length > 0) {
      monthAvgs[month] = round(average(values))
    }
  }

  const rankedMonths = Object.entries(monthAvgs)
    .map(([month, avg]) => ({ month: Number(month), avg: Number(avg) }))
    .sort((left, right) => right.avg - left.avg || left.month - right.month)

  const dispersionValues = Array.from(normalizedMonthBuckets.values())
    .map((values) => average(values))
    .filter((value) => Number.isFinite(value))
  const baseline = average(dispersionValues)
  const stdDev =
    dispersionValues.length > 1 && Number.isFinite(baseline)
      ? Math.sqrt(
          dispersionValues.reduce((sum, value) => sum + (value - baseline) ** 2, 0) /
            dispersionValues.length
        )
      : 0
  const coefficientOfVariation = Number.isFinite(baseline) && baseline > 0 ? stdDev / baseline : 0
  const seasonalityIndex = Math.max(0, Math.min(1, round(coefficientOfVariation / 0.35, 4) || 0))

  return {
    matrix,
    monthAvgs,
    bestMonths: rankedMonths.slice(0, 3).map((item) => item.month),
    worstMonths: [...rankedMonths]
      .sort((left, right) => left.avg - right.avg || left.month - right.month)
      .slice(0, 3)
      .map((item) => item.month),
    seasonalityIndex,
  }
}
