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

function classifyIndustry(code, { stockMeta, holding } = {}) {
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

  // Priority 5: Name-keyword heuristic for unknown stocks
  const name = String(holding?.name || '').trim()
  if (name) {
    if (/半導體|晶圓|IC|封測/.test(name))
      return { value: '半導體', confidence: 'low', source: 'name-keyword' }
    if (/光[通電]|光纖/.test(name))
      return { value: '光通訊', confidence: 'low', source: 'name-keyword' }
    if (/伺服器|雲端|資料中心/.test(name))
      return { value: 'AI/伺服器', confidence: 'low', source: 'name-keyword' }
    if (/鋼鐵|鋼/.test(name)) return { value: '鋼鐵', confidence: 'low', source: 'name-keyword' }
    if (/營建|建設/.test(name)) return { value: '營建', confidence: 'low', source: 'name-keyword' }
    if (/航運|船/.test(name)) return { value: '航運', confidence: 'low', source: 'name-keyword' }
    if (/金融|銀行|證券|壽險/.test(name))
      return { value: '金融', confidence: 'low', source: 'name-keyword' }
    if (/食品|飲料/.test(name)) return { value: '食品', confidence: 'low', source: 'name-keyword' }
    if (/紡織|製鞋/.test(name)) return { value: '紡織', confidence: 'low', source: 'name-keyword' }
    if (/電子|科技/.test(name)) return { value: '電子', confidence: 'low', source: 'name-keyword' }
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

  // Name-keyword heuristic for unknown stocks
  const name = String(holding?.name || '').trim()
  if (name) {
    // 6-digit code or name contains 購/售/認 = warrant
    if (/^\d{6}$/.test(String(code)) || /[購售認][0-9]/.test(name)) {
      return { value: '權證', confidence: 'low', source: 'name-keyword' }
    }
    if (/ETF|指數|反[1一]|正[2二]|槓桿/.test(name)) {
      return { value: 'ETF/指數', confidence: 'low', source: 'name-keyword' }
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
// Four dimensions per user decision (2026-04-12):
//   1. 市佔率 (market share) — from profile description keywords
//   2. 高盈利 (high profitability) — from FinMind gross margin
//   3. 高營收 (high revenue) — from FinMind revenue scale
//   4. 技術護城河 (tech moat) — from profile description + theme depth

const LEADER_KEYWORDS = /龍頭|領導|最大|第一|領先|獨占|寡占|壟斷|市佔.*第一|全球.*最大/
const MOAT_KEYWORDS = /護城河|專利|獨家|技術門檻|不可替代|壁壘|獨佔|關鍵供應|唯���/

function scoreLeaderDimensions(code, { finmind, holding } = {}) {
  let score = 0
  const reasons = []

  // Dimension 1: 市佔率 — profile description hints
  const profile = companyProfiles[code]
  if (profile?.description) {
    if (LEADER_KEYWORDS.test(profile.description)) {
      score += 2
      reasons.push('market-share-hint')
    }
  }

  // Dimension 2: 高盈利 — FinMind gross margin > 30%
  if (finmind?.financials?.length > 0) {
    const latest = finmind.financials[0]
    const revenue = Number(latest.Revenue) || 0
    const grossProfit = Number(latest.GrossProfit) || 0
    if (revenue > 0 && grossProfit / revenue > 0.3) {
      score += 1
      reasons.push('high-margin')
    }
  }

  // Dimension 3: 高營收 — FinMind revenue > 10B NTD (quarterly, units in thousands)
  if (finmind?.revenue?.length > 0) {
    const latestRevenue = Number(finmind.revenue[0]?.revenue) || 0
    // FinMind revenue unit is NTD thousands → 10B = 10,000,000 thousands
    if (latestRevenue > 10000000) {
      score += 2
      reasons.push('high-revenue')
    } else if (latestRevenue > 1000000) {
      score += 1
      reasons.push('mid-revenue')
    }
  }

  // Dimension 4: 技術護城河 — profile description + theme depth
  if (profile?.description && MOAT_KEYWORDS.test(profile.description)) {
    score += 2
    reasons.push('tech-moat')
  }
  const tc = themeClassification[code]
  if (tc?.themes?.length >= 3) {
    score += 1
    reasons.push('multi-theme')
  }

  return { score, reasons }
}

function classifyLeader(code, { stockMeta, finmind, holding } = {}) {
  if (stockMeta?.leader) {
    return { value: stockMeta.leader, confidence: 'high', source: 'stock-meta' }
  }

  const holdingType = String(holding?.type || '').trim()
  if (['權證', 'ETF', '指數', '債券'].includes(holdingType)) {
    return { value: 'N/A', confidence: 'high', source: 'non-company-type' }
  }

  const { score, reasons } = scoreLeaderDimensions(code, { finmind, holding })

  // Score thresholds: ≥5 龍頭, ≥3 二線, ≥1 小型, 0 待分類
  if (score >= 5) {
    return { value: '龍頭', confidence: 'medium', source: `leader-score(${reasons.join(',')})` }
  }
  if (score >= 3) {
    return { value: '二線', confidence: 'medium', source: `leader-score(${reasons.join(',')})` }
  }
  if (score >= 1) {
    return { value: '小型', confidence: 'low', source: `leader-score(${reasons.join(',')})` }
  }
  return { value: '小型', confidence: 'low', source: 'default' }
}

// ── Main classifier ──────────────────────────────────────────────

export function classifyStock(
  code,
  { stockMeta, finmind, holding, holdingRank, totalHoldings } = {}
) {
  const industry = classifyIndustry(code, { stockMeta, holding })
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
