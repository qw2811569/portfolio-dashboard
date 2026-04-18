import { STOCK_META } from '../seedData.js'
import companyProfiles from '../data/companyProfiles.json'

export const PEER_RANKING_THRESHOLD_PCT = 0.3

const MARKET_BENCHMARK_STUB = {
  code: '0050',
  label: '大盤',
  changePct: 0.5,
  source: 'stub',
}

const SEMICONDUCTOR_BENCHMARK_STUB = {
  code: '0052',
  label: '半導體',
  changePct: 0.8,
  source: 'stub',
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundPct(value) {
  return value == null ? null : Math.round(value * 100) / 100
}

function formatSignedPct(value) {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatDeltaLabel(value, label) {
  if (value == null || !label) return null
  const verb = value > 0 ? '領先' : value < 0 ? '落後' : '持平'

  return `${verb} ${Math.abs(value).toFixed(1)}% (vs ${label})`
}

function getHoldingIndustry(holding = {}) {
  const code = String(holding.code || '').trim()
  return (
    holding.industry ||
    STOCK_META[code]?.industry ||
    companyProfiles[code]?.industry ||
    companyProfiles[code]?.sector ||
    null
  )
}

function getHoldingSector(holding = {}) {
  const code = String(holding.code || '').trim()
  return holding.sector || companyProfiles[code]?.sector || null
}

export function resolveIndustryBenchmark(holding = {}) {
  const industry = getHoldingIndustry(holding)
  const sector = getHoldingSector(holding)
  const haystack = [industry, sector].filter(Boolean).join(' ')

  if (/半導體|Semiconductor|IC設計|IC\/記憶體|晶圓|封裝|ASIC/i.test(haystack)) {
    return {
      ...SEMICONDUCTOR_BENCHMARK_STUB,
      industry,
    }
  }

  return null
}

export function getPeerBenchmarkSnapshot(holding = {}) {
  return {
    stockChangePct: toFiniteNumber(holding.changePct),
    marketIndexPct: MARKET_BENCHMARK_STUB.changePct,
    marketLabel: MARKET_BENCHMARK_STUB.label,
    marketBenchmarkCode: MARKET_BENCHMARK_STUB.code,
    industryBenchmark: resolveIndustryBenchmark(holding),
  }
}

export function calculateRelativeStrength({
  stockChangePct,
  industryAvgPct = null,
  marketIndexPct = null,
  industryLabel = '產業',
  marketLabel = '大盤',
  thresholdPct = PEER_RANKING_THRESHOLD_PCT,
} = {}) {
  const stockPct = toFiniteNumber(stockChangePct)
  const industryPct = toFiniteNumber(industryAvgPct)
  const marketPct = toFiniteNumber(marketIndexPct)

  if (stockPct == null) {
    return {
      vsIndustry: null,
      vsMarket: null,
      rank: 'neutral',
      label: '今日漲跌資料不足',
    }
  }

  const vsIndustry = industryPct == null ? null : roundPct(stockPct - industryPct)
  const vsMarket = marketPct == null ? null : roundPct(stockPct - marketPct)
  const comparisons = [vsIndustry, vsMarket].filter((value) => value != null)

  let rank = 'neutral'
  if (comparisons.length > 0 && comparisons.every((value) => value >= thresholdPct)) {
    rank = 'leader'
  } else if (comparisons.length > 0 && comparisons.every((value) => value <= -thresholdPct)) {
    rank = 'laggard'
  }

  const labelParts = [
    formatDeltaLabel(vsIndustry, industryLabel),
    formatDeltaLabel(vsMarket, marketLabel),
  ].filter(Boolean)

  return {
    vsIndustry,
    vsMarket,
    rank,
    label: labelParts.join(' · ') || `今日 ${formatSignedPct(stockPct)}，缺少可比較 benchmark`,
  }
}

export function getPeerRankingForHolding(holding = {}) {
  const snapshot = getPeerBenchmarkSnapshot(holding)
  const industryBenchmark = snapshot.industryBenchmark
  const relativeStrength = calculateRelativeStrength({
    stockChangePct: snapshot.stockChangePct,
    industryAvgPct: industryBenchmark?.changePct ?? null,
    marketIndexPct: snapshot.marketIndexPct,
    industryLabel: industryBenchmark?.label || '產業',
    marketLabel: snapshot.marketLabel,
  })

  return {
    ...relativeStrength,
    stockChangePct: snapshot.stockChangePct,
    marketIndexPct: snapshot.marketIndexPct,
    marketLabel: snapshot.marketLabel,
    marketBenchmarkCode: snapshot.marketBenchmarkCode,
    industryAvgPct: industryBenchmark?.changePct ?? null,
    industryLabel: industryBenchmark?.label || null,
    industryBenchmarkCode: industryBenchmark?.code || null,
    benchmarkSource: industryBenchmark?.source || MARKET_BENCHMARK_STUB.source,
  }
}

export const PEER_RANKING_BENCHMARK_TODO =
  'TODO: 以 FinMind / 既有 cache 接 0050、0052 日漲跌幅，並依個股 classifier 產業對應 benchmark；stub 只保留 UI 驗證。'
