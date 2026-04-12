/**
 * Rules-first stock auto-classifier.
 *
 * Classifies holdings into { industry, strategy, period, position, leader }
 * using static knowledge data + FinMind financial signals. No LLM calls.
 *
 * Data sources (priority order):
 *   1. companyProfiles.json → industry, sector
 *   2. themeClassification.json → theme-based industry inference
 *   3. themes.json → supply chain position lookup
 *   4. FinMind financials → strategy/leader inference from PER, revenue, market cap
 *   5. STOCK_META (seedData) → existing manual classifications (highest confidence)
 *
 * Each field returns { value, confidence, source }.
 * confidence: 'high' (KB match), 'medium' (rule inference), 'low' (fallback/guess)
 */

import companyProfiles from '../data/companyProfiles.json'
import themeClassification from '../data/themeClassification.json'
import themes from '../data/themes.json'

// ── Industry classification ─────────────────────────────────────

function classifyIndustry(code, { stockMeta } = {}) {
  // Priority 1: existing STOCK_META
  if (stockMeta?.industry) {
    return { value: stockMeta.industry, confidence: 'high', source: 'stock-meta' }
  }

  // Priority 2: companyProfiles
  const profile = companyProfiles[code]
  if (profile?.industry) {
    return { value: profile.industry, confidence: 'high', source: 'company-profile' }
  }
  if (profile?.sector) {
    return { value: profile.sector, confidence: 'medium', source: 'company-profile-sector' }
  }

  // Priority 3: themeClassification — pick the primary theme
  const tc = themeClassification[code]
  if (tc?.themes?.length > 0) {
    const primary = tc.themes[0]
    return {
      value: primary.theme.replace(/_/g, '/'),
      confidence: 'medium',
      source: 'theme-classification',
    }
  }

  // Priority 4: themes.json reverse lookup
  for (const [themeName, themeData] of Object.entries(themes)) {
    const stocks = themeData.stocks || {}
    for (const tier of ['upstream', 'midstream', 'downstream']) {
      if (Array.isArray(stocks[tier]) && stocks[tier].includes(code)) {
        return {
          value: themeName.replace(/_/g, '/'),
          confidence: 'medium',
          source: 'theme-reverse',
        }
      }
    }
  }

  return { value: null, confidence: 'low', source: 'unresolved' }
}

// ── Strategy classification ─────────────────────────────────────

const CYCLICAL_INDUSTRIES = new Set([
  '營建',
  '重電',
  '重電設備',
  '被動元件',
  'IC/記憶體',
  '鋼鐵',
  '航運',
  '塑化',
  '紡織',
  '造紙',
  '水泥',
  '面板',
])

const GROWTH_KEYWORDS = new Set([
  'AI',
  '伺服器',
  '半導體',
  '光通訊',
  'HBM',
  'CoWoS',
  'CPO',
  '雲端',
  '資料中心',
  '碳化矽',
  '矽光子',
  '電動車',
])

function classifyStrategy(code, { stockMeta, finmind, holding, industryValue } = {}) {
  if (stockMeta?.strategy) {
    return { value: stockMeta.strategy, confidence: 'high', source: 'stock-meta' }
  }

  const holdingType = String(holding?.type || '').trim()
  if (holdingType === '權證') return { value: '權證', confidence: 'high', source: 'holding-type' }
  if (holdingType === 'ETF')
    return { value: 'ETF/指數', confidence: 'high', source: 'holding-type' }
  if (holdingType === '指數')
    return { value: 'ETF/指數', confidence: 'high', source: 'holding-type' }
  if (holdingType === '債券') return { value: '債券', confidence: 'high', source: 'holding-type' }

  // Check if industry is cyclical
  if (industryValue && CYCLICAL_INDUSTRIES.has(industryValue)) {
    return { value: '景氣循環', confidence: 'medium', source: 'industry-rule' }
  }

  // Check if related to growth themes
  const tc = themeClassification[code]
  if (tc?.themes?.length > 0) {
    const hasGrowthTheme = tc.themes.some(
      (t) => GROWTH_KEYWORDS.has(t.theme) || [...GROWTH_KEYWORDS].some((kw) => t.theme.includes(kw))
    )
    if (hasGrowthTheme) {
      return { value: '成長股', confidence: 'medium', source: 'theme-growth-rule' }
    }
  }

  // Check industry name for growth keywords
  if (industryValue) {
    const isGrowthIndustry = [...GROWTH_KEYWORDS].some((kw) => industryValue.includes(kw))
    if (isGrowthIndustry) {
      return { value: '成長股', confidence: 'medium', source: 'industry-growth-rule' }
    }
  }

  // FinMind signal: high revenue YoY → growth
  if (finmind?.revenue?.length > 0) {
    const latest = finmind.revenue[0]
    if (latest.revenueYoY > 15) {
      return { value: '成長股', confidence: 'medium', source: 'finmind-revenue-yoy' }
    }
  }

  return { value: '待分類', confidence: 'low', source: 'unresolved' }
}

// ── Period classification ────────────────────────────────────────

const STRATEGY_PERIOD_MAP = {
  權證: '短',
  事件驅動: '短中',
  景氣循環: '中',
  成長股: '中長',
  'ETF/指數': '中長',
  債券: '中長',
  價值股: '長',
}

function classifyPeriod(code, { stockMeta, strategyValue } = {}) {
  if (stockMeta?.period) {
    return { value: stockMeta.period, confidence: 'high', source: 'stock-meta' }
  }

  const derived = STRATEGY_PERIOD_MAP[strategyValue]
  if (derived) {
    return { value: derived, confidence: 'medium', source: 'strategy-derived' }
  }

  return { value: '中', confidence: 'low', source: 'default' }
}

// ── Position classification (portfolio-relative, dynamic) ────────

function classifyPosition(code, { stockMeta, holdingRank, totalHoldings } = {}) {
  if (stockMeta?.position) {
    return { value: stockMeta.position, confidence: 'high', source: 'stock-meta' }
  }

  if (holdingRank == null || totalHoldings == null || totalHoldings === 0) {
    return { value: '戰術', confidence: 'low', source: 'default' }
  }

  // Top 20% by value → 核心, next 30% → 衛星, rest → 戰術
  const pct = holdingRank / totalHoldings
  if (pct <= 0.2) return { value: '核心', confidence: 'medium', source: 'portfolio-weight' }
  if (pct <= 0.5) return { value: '衛星', confidence: 'medium', source: 'portfolio-weight' }
  return { value: '戰術', confidence: 'medium', source: 'portfolio-weight' }
}

// ── Leader classification ────────────────────────────────────────

function classifyLeader(code, { stockMeta, finmind, holding } = {}) {
  if (stockMeta?.leader) {
    return { value: stockMeta.leader, confidence: 'high', source: 'stock-meta' }
  }

  const holdingType = String(holding?.type || '').trim()
  if (['權證', 'ETF', '指數', '債券'].includes(holdingType)) {
    return { value: 'N/A', confidence: 'high', source: 'non-company-type' }
  }

  // FinMind: estimate from market cap (price * equity proxy)
  if (finmind?.balanceSheet?.length > 0 && holding?.price > 0) {
    const equity = finmind.balanceSheet[0]?.Equity || 0
    if (equity > 5000000) return { value: '大型', confidence: 'medium', source: 'finmind-equity' }
    if (equity > 1000000) return { value: '龍頭', confidence: 'low', source: 'finmind-equity' }
  }

  // Profile hint
  const profile = companyProfiles[code]
  if (profile?.description) {
    if (/龍頭|領導|最大|第一/.test(profile.description)) {
      return { value: '龍頭', confidence: 'medium', source: 'profile-hint' }
    }
  }

  return { value: '小型', confidence: 'low', source: 'default' }
}

// ── Main classifier ──────────────────────────────────────────────

export function classifyStock(
  code,
  { stockMeta, finmind, holding, holdingRank, totalHoldings } = {}
) {
  const industry = classifyIndustry(code, { stockMeta, finmind })
  const strategy = classifyStrategy(code, {
    stockMeta,
    finmind,
    holding,
    industryValue: industry.value,
  })
  const period = classifyPeriod(code, { stockMeta, strategyValue: strategy.value })
  const position = classifyPosition(code, { stockMeta, holdingRank, totalHoldings })
  const leader = classifyLeader(code, { stockMeta, finmind, holding })

  return { industry, strategy, period, position, leader }
}

/**
 * Merge auto-classified fields into a flat STOCK_META-compatible object.
 * Only overrides fields that are missing in the existing stockMeta.
 */
export function mergeClassification(existingMeta, classification) {
  const merged = { ...(existingMeta || {}) }
  for (const [field, result] of Object.entries(classification)) {
    if (!merged[field] && result.value && result.value !== '待分類') {
      merged[field] = result.value
      merged[`${field}Source`] = result.source
      merged[`${field}Confidence`] = result.confidence
    }
  }
  return merged
}
