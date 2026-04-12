/**
 * Investor profile derivation from classified holdings.
 *
 * Aggregates strategy/period/position distributions across the portfolio
 * to produce a human-readable investment style label. Pure function,
 * no side effects, no API calls.
 */

const STRATEGY_LABELS = {
  成長股: '成長型',
  景氣循環: '景氣循環型',
  事件驅動: '事件驅動型',
  權證: '權證操作型',
  'ETF/指數': '被動配置型',
  價值股: '價值型',
  債券: '固定收益型',
}

const PERIOD_LABELS = {
  短: '短線',
  短中: '短中期',
  中: '中期',
  中長: '中長期',
  長: '長期',
}

function topByWeight(distribution) {
  return Object.entries(distribution)
    .sort(([, a], [, b]) => b - a)
    .filter(([, weight]) => weight > 0)
}

function weightedMode(items, getKey, getValue) {
  const dist = {}
  let total = 0
  for (const item of items) {
    const key = getKey(item)
    const val = getValue(item)
    if (key && val > 0) {
      dist[key] = (dist[key] || 0) + val
      total += val
    }
  }
  // Normalize to percentages
  if (total > 0) {
    for (const key of Object.keys(dist)) {
      dist[key] = Math.round((dist[key] / total) * 100)
    }
  }
  return dist
}

export function deriveInvestorProfile(classifiedHoldings, { getMarketValue = () => 0 } = {}) {
  if (!Array.isArray(classifiedHoldings) || classifiedHoldings.length === 0) {
    return {
      style: '尚無持倉',
      strategyDistribution: {},
      periodDistribution: {},
      positionDistribution: {},
      summary: '目前沒有持倉資料，無法分析投資風格。',
    }
  }

  const strategyDist = weightedMode(
    classifiedHoldings,
    (h) => h.classification?.strategy?.value,
    (h) => getMarketValue(h.holding)
  )

  const periodDist = weightedMode(
    classifiedHoldings,
    (h) => h.classification?.period?.value,
    (h) => getMarketValue(h.holding)
  )

  const positionDist = weightedMode(
    classifiedHoldings,
    (h) => h.classification?.position?.value,
    (h) => getMarketValue(h.holding)
  )

  // Primary style from top strategy
  const topStrategies = topByWeight(strategyDist)
  const topPeriods = topByWeight(periodDist)
  const topPositions = topByWeight(positionDist)

  const primaryStrategy = topStrategies[0]?.[0] || '待分類'
  const primaryPeriod = topPeriods[0]?.[0] || '中'
  const styleLabel = STRATEGY_LABELS[primaryStrategy] || primaryStrategy
  const periodLabel = PERIOD_LABELS[primaryPeriod] || primaryPeriod

  // Build a concise summary
  const parts = []
  parts.push(`偏${styleLabel}`)
  parts.push(`${periodLabel}持有為主`)

  if (topPositions.length >= 2) {
    const posLabels = topPositions.slice(0, 2).map(([k]) => k)
    parts.push(`以${posLabels.join('+')}配置`)
  }

  // Concentration warning
  if (topStrategies[0]?.[1] > 70) {
    parts.push('集中度偏高')
  }

  const summary = parts.join('，')

  return {
    style: styleLabel,
    strategyDistribution: strategyDist,
    periodDistribution: periodDist,
    positionDistribution: positionDist,
    summary,
  }
}
