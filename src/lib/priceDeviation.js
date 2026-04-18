function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatPercentValue(value) {
  const percentage = Math.abs(value) * 100
  const rounded = Math.round(percentage * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatPriceValue(value) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function calculatePriceDeviation({ currentPrice, targetPrice, count = 1 } = {}) {
  const current = toFiniteNumber(currentPrice)
  const target = toFiniteNumber(targetPrice)

  if (current == null || current <= 0 || target == null || target <= 0) {
    return null
  }

  const deviation = (target - current) / current

  if (count < 2) return { deviation, level: 'no_consensus', count }

  const absDeviation = Math.abs(deviation)
  if (absDeviation < 0.1) return { deviation, level: 'aligned', count }
  if (absDeviation < 0.2) return { deviation, level: 'moderate', count }
  return { deviation, level: 'significant', count }
}

export function resolveHoldingTargetPrice(holding = {}) {
  const targetMeanPrice = toFiniteNumber(holding?.targetMeanPrice)
  if (targetMeanPrice != null && targetMeanPrice > 0) return targetMeanPrice

  const targetPrice = toFiniteNumber(holding?.targetPrice)
  return targetPrice != null && targetPrice > 0 ? targetPrice : null
}

export function resolveHoldingTargetCount(holding = {}) {
  const candidateKeys = [
    'targetPriceCount',
    'targetConsensusCount',
    'consensusCount',
    'firmsCount',
    'analystCount',
  ]

  for (const key of candidateKeys) {
    const value = toFiniteNumber(holding?.[key])
    if (value != null && value >= 0) return value
  }

  return 1
}

export function buildPriceDeviationBadgeMeta(holding = {}) {
  const currentPrice = toFiniteNumber(holding?.price)
  const targetPrice = resolveHoldingTargetPrice(holding)
  if (currentPrice == null || currentPrice <= 0 || targetPrice == null) return null

  const count = resolveHoldingTargetCount(holding)
  const result = calculatePriceDeviation({ currentPrice, targetPrice, count })
  if (!result || result.level === 'aligned') return null

  const percentText = `${result.deviation >= 0 ? '+' : '-'}${formatPercentValue(result.deviation)}%`
  const countLabel = `N=${result.count}`
  const tooltip = `${result.count} 家券商共識目標價 $${formatPriceValue(targetPrice)}，當前 $${formatPriceValue(currentPrice)}，偏離 ${percentText}`

  if (result.level === 'no_consensus') {
    return {
      ...result,
      text: `${countLabel} 共識不足`,
      tooltip,
      tone: 'muted',
      pulse: false,
    }
  }

  if (result.level === 'moderate') {
    return {
      ...result,
      text: result.deviation >= 0 ? `${percentText} 上行空間` : `${percentText} 偏高`,
      tooltip,
      tone: result.deviation >= 0 ? 'sage' : 'amber',
      pulse: false,
    }
  }

  return {
    ...result,
    text: result.deviation >= 0 ? `${percentText} 大幅低估 ⚠️` : `${percentText} 大幅高估 ⚠️`,
    tooltip,
    tone: result.deviation >= 0 ? 'sage-strong' : 'danger',
    pulse: true,
  }
}
