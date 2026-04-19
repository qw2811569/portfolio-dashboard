import { resolveValuationBandPosition } from './valuationEngine.js'

const BROKEN_PILLAR_STATUSES = new Set(['broken', 'invalidated'])
const WEAKENED_PILLAR_STATUSES = new Set(['watch', 'behind', 'weakened'])
const MISSING_DATA_STATUSES = new Set(['missing', 'failed'])
const STALE_DATA_STATUSES = new Set(['stale', 'aging'])

function toFiniteNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function pickNumber(...values) {
  for (const value of values) {
    const number = toFiniteNumber(value)
    if (number != null) return number
  }
  return null
}

function pluralizeHoldings(count) {
  return `${count} 檔`
}

function normalizePillarStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function hasThesisSignal(thesis) {
  if (!thesis || typeof thesis !== 'object') return false
  if (Array.isArray(thesis.pillars) && thesis.pillars.length > 0) return true
  return Boolean(thesis.statement || thesis.reason || thesis.expectation)
}

function resolveThesisState(dossier) {
  const thesis = dossier?.thesis
  if (!hasThesisSignal(thesis)) return 'unknown'
  const pillars = Array.isArray(thesis?.pillars) ? thesis.pillars : []
  if (pillars.some((pillar) => BROKEN_PILLAR_STATUSES.has(normalizePillarStatus(pillar?.status)))) {
    return 'broken'
  }
  if (
    pillars.some((pillar) => WEAKENED_PILLAR_STATUSES.has(normalizePillarStatus(pillar?.status)))
  ) {
    return 'weakened'
  }
  return 'stable'
}

function resolveFreshnessStatuses(dossier) {
  const freshness = dossier?.freshness
  if (!freshness || typeof freshness !== 'object') return []
  return Object.values(freshness)
    .map((value) =>
      String(value || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
}

function hasMissingData(dossier) {
  return resolveFreshnessStatuses(dossier).some((status) => MISSING_DATA_STATUSES.has(status))
}

function hasStaleData(dossier) {
  return resolveFreshnessStatuses(dossier).some((status) => STALE_DATA_STATUSES.has(status))
}

function resolveUpperValuationRef(dossier) {
  const aggregate =
    dossier?.targetAggregate && typeof dossier.targetAggregate === 'object'
      ? dossier.targetAggregate
      : dossier?.targets?.aggregate && typeof dossier.targets.aggregate === 'object'
        ? dossier.targets.aggregate
        : null
  const topTarget =
    Array.isArray(dossier?.targets) && dossier.targets.length > 0 ? dossier.targets[0] : null
  return pickNumber(
    aggregate?.upperBound,
    aggregate?.highTarget,
    aggregate?.medianTarget,
    aggregate?.meanTarget,
    topTarget?.aggregate?.upperBound,
    topTarget?.target,
    dossier?.thesis?.targetPrice
  )
}

function resolvePrice(dossier) {
  return pickNumber(
    dossier?.position?.price,
    dossier?.position?.currentPrice,
    dossier?.price,
    dossier?.currentPrice
  )
}

function resolveValuationState(dossier) {
  const price = resolvePrice(dossier)
  const upperBound = resolveUpperValuationRef(dossier)
  if (price == null || upperBound == null || upperBound <= 0) return 'unknown'

  const bandPosition = resolveValuationBandPosition(price, {
    lowerBound: dossier?.targetAggregate?.lowerBound,
    upperBound,
  })
  if (bandPosition === 'above') return 'above'
  if (price >= upperBound * 0.94) return 'near'
  if (bandPosition === 'within') return 'within'
  return 'below'
}

function buildRetailHeadline(summary) {
  const {
    holdingsCount,
    stableCount,
    weakenedCount,
    brokenCount,
    nearUpperCount,
    aboveUpperCount,
    missingDataCount,
    staleDataCount,
  } = summary

  if (brokenCount > 0 && stableCount > 0) {
    return `${pluralizeHoldings(stableCount)}論述仍穩 · ${pluralizeHoldings(brokenCount)}需要重看`
  }
  if (brokenCount > 0) {
    return `${pluralizeHoldings(brokenCount)}論述需要重看 · 今天多留意 thesis 變化`
  }
  if (aboveUpperCount > 0 && stableCount > 0) {
    return `${pluralizeHoldings(stableCount)}論述仍穩 · ${pluralizeHoldings(aboveUpperCount)}已到估值上緣`
  }
  if (aboveUpperCount > 0) {
    return `有 ${pluralizeHoldings(aboveUpperCount)}已到估值上緣 · 可以回來看一下空間`
  }
  if (nearUpperCount > 0 && stableCount > 0) {
    return `${pluralizeHoldings(stableCount)}論述仍穩 · ${pluralizeHoldings(nearUpperCount)}接近估值上緣`
  }
  if (weakenedCount > 0 && stableCount > 0) {
    return `${pluralizeHoldings(stableCount)}論述仍穩 · ${pluralizeHoldings(weakenedCount)}需要多看一眼`
  }
  if (weakenedCount > 0) {
    return `${pluralizeHoldings(weakenedCount)}論述有些鬆動 · 可以進來看看`
  }
  if (missingDataCount > 0) {
    return `${pluralizeHoldings(missingDataCount)}資料補齊中 · 首頁結論會跟著更新`
  }
  if (staleDataCount > 0) {
    return `${pluralizeHoldings(staleDataCount)}資料有點久了 · 其餘持倉仍在追蹤區間`
  }
  if (stableCount > 0) {
    return `今日論述大致穩定 · ${pluralizeHoldings(Math.max(stableCount, holdingsCount))}持倉持續追蹤中`
  }
  if (holdingsCount > 0) {
    return `今日持倉 overview · ${pluralizeHoldings(holdingsCount)}持倉持續追蹤中`
  }
  return '今日持倉 overview'
}

function buildCompressedHeadline(summary) {
  const {
    holdingsCount,
    weakenedCount,
    brokenCount,
    nearUpperCount,
    aboveUpperCount,
    missingDataCount,
  } = summary

  if (brokenCount > 0) {
    return `整體論述有 ${pluralizeHoldings(brokenCount)}需要重看`
  }
  if (aboveUpperCount > 0) {
    return `整體估值有 ${pluralizeHoldings(aboveUpperCount)}已到上緣`
  }
  if (nearUpperCount > 0) {
    return `整體論述仍穩 · 有 ${pluralizeHoldings(nearUpperCount)}接近估值上緣`
  }
  if (weakenedCount > 0) {
    return `整體論述大致穩定 · 有 ${pluralizeHoldings(weakenedCount)}待確認`
  }
  if (missingDataCount > 0) {
    return `整體資料大致到位 · 有 ${pluralizeHoldings(missingDataCount)}待補齊`
  }
  if (holdingsCount > 0) {
    return `整體論述穩定 · ${pluralizeHoldings(holdingsCount)}持倉持續追蹤中`
  }
  return '今日持倉 overview'
}

function buildTone(summary) {
  if (summary.brokenCount > 0 || summary.aboveUpperCount > 0) return 'alert'
  if (summary.weakenedCount > 0 || summary.nearUpperCount > 0) return 'watch'
  return 'calm'
}

export function buildDashboardHeadline(dossiers = [], { viewMode = 'retail' } = {}) {
  const safeDossiers = Array.isArray(dossiers) ? dossiers.filter(Boolean) : []

  const summary = safeDossiers.reduce(
    (acc, dossier) => {
      acc.holdingsCount += 1

      const thesisState = resolveThesisState(dossier)
      if (thesisState === 'stable') acc.stableCount += 1
      if (thesisState === 'weakened') acc.weakenedCount += 1
      if (thesisState === 'broken') acc.brokenCount += 1

      const valuationState = resolveValuationState(dossier)
      if (valuationState === 'near') acc.nearUpperCount += 1
      if (valuationState === 'above') acc.aboveUpperCount += 1

      if (hasMissingData(dossier)) acc.missingDataCount += 1
      else if (hasStaleData(dossier)) acc.staleDataCount += 1

      return acc
    },
    {
      holdingsCount: 0,
      stableCount: 0,
      weakenedCount: 0,
      brokenCount: 0,
      nearUpperCount: 0,
      aboveUpperCount: 0,
      missingDataCount: 0,
      staleDataCount: 0,
    }
  )

  const headline =
    viewMode === 'insider-compressed'
      ? buildCompressedHeadline(summary)
      : buildRetailHeadline(summary)

  return {
    headline: String(headline || '').trim() || '今日持倉 overview',
    tone: buildTone(summary),
  }
}
