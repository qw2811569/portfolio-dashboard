import companyProfiles from '../data/companyProfiles.json'
import { STOCK_META } from '../seedData.js'
import { getHoldingMarketValue } from './holdings.js'

function normalizeCode(value) {
  return String(value || '').trim()
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`
}

function resolveHoldingValue(holding) {
  const explicitValue = Number(holding?.value)
  if (Number.isFinite(explicitValue)) return explicitValue
  return getHoldingMarketValue(holding)
}

function resolveHoldingMeta(holding, options = {}) {
  const code = normalizeCode(holding?.code)
  const providedMeta = options.stockMeta?.[code] || options.stockMeta?.[holding?.code]
  const inlineMeta = holding?.stockMeta
  const seedMeta = STOCK_META?.[code]
  const profileMeta = companyProfiles?.[code]

  const industry =
    holding?.industry ||
    inlineMeta?.industry ||
    providedMeta?.industry ||
    seedMeta?.industry ||
    profileMeta?.industry ||
    options.unknownIndustryLabel ||
    '未分類'

  const themes =
    holding?.themes || inlineMeta?.themes || providedMeta?.themes || seedMeta?.themes || []

  return {
    industry: String(industry || options.unknownIndustryLabel || '未分類').trim() || '未分類',
    themes: Array.isArray(themes) ? themes.filter(Boolean) : [],
  }
}

function buildWarnings({ hhi, top1Weight, top3Weight, maxIndustryWeight, industryBreakdown }) {
  const warnings = []
  const topIndustry = industryBreakdown[0] || null

  if (topIndustry && maxIndustryWeight >= 0.35) {
    warnings.push(`${topIndustry.industry}佔 ${formatPercent(maxIndustryWeight)}`)
  }

  if (top1Weight >= 0.2) {
    warnings.push(`Top 1 佔 ${formatPercent(top1Weight)}`)
  }

  if (top3Weight >= 0.6) {
    warnings.push(`前 3 大佔 ${formatPercent(top3Weight)}`)
  }

  if (hhi >= 2500) {
    warnings.push(`集中度指數 ${Math.round(hhi)}，持股集中度高`)
  }

  return warnings
}

export function calculateConcentration(holdings, options = {}) {
  const rows = Array.isArray(holdings) ? holdings : []
  const normalizedRows = rows
    .map((holding) => {
      const value = resolveHoldingValue(holding)
      if (!Number.isFinite(value) || value <= 0) return null

      return {
        holding,
        value,
        meta: resolveHoldingMeta(holding, options),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value)

  const totalValue = normalizedRows.reduce((sum, row) => sum + row.value, 0)
  if (totalValue <= 0) {
    return {
      hhi: 0,
      top1Weight: 0,
      top3Weight: 0,
      top5Weight: 0,
      industryBreakdown: [],
      maxIndustryWeight: 0,
      risk: 'low',
      warnings: [],
    }
  }

  const weightedRows = normalizedRows.map((row) => ({
    ...row,
    weight: row.value / totalValue,
  }))

  const hhi = weightedRows.reduce((sum, row) => sum + Math.pow(row.weight * 100, 2), 0)
  const top1Weight = weightedRows[0]?.weight || 0
  const top3Weight = weightedRows.slice(0, 3).reduce((sum, row) => sum + row.weight, 0)
  const top5Weight = weightedRows.slice(0, 5).reduce((sum, row) => sum + row.weight, 0)

  const industryBuckets = weightedRows.reduce((map, row) => {
    const key = row.meta.industry
    const existing = map.get(key) || { industry: key, weight: 0, count: 0 }
    existing.weight += row.weight
    existing.count += 1
    map.set(key, existing)
    return map
  }, new Map())

  const industryBreakdown = Array.from(industryBuckets.values()).sort(
    (a, b) => b.weight - a.weight || b.count - a.count || a.industry.localeCompare(b.industry)
  )
  const maxIndustryWeight = industryBreakdown[0]?.weight || 0

  let risk = 'low'
  if (maxIndustryWeight >= 0.5 || top1Weight >= 0.3 || hhi >= 3000) {
    risk = 'critical'
  } else if (maxIndustryWeight >= 0.35 || top1Weight >= 0.2 || hhi >= 2500) {
    risk = 'high'
  } else if ((hhi >= 1500 && hhi <= 2500) || top3Weight >= 0.6) {
    risk = 'moderate'
  }

  return {
    hhi: Math.round(hhi),
    top1Weight,
    top3Weight,
    top5Weight,
    industryBreakdown,
    maxIndustryWeight,
    risk,
    warnings: buildWarnings({
      hhi,
      top1Weight,
      top3Weight,
      maxIndustryWeight,
      industryBreakdown,
    }),
  }
}
