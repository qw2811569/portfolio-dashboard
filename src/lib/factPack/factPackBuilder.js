/**
 * factPack builder — 把 dossier 包成 factPack envelope
 *
 * 來源: design doc v1 §0 + Qwen pre-flight check
 *
 * 核心責任:
 *   1. 把現有 dossier 4 區塊資料對齊成 factPack 4 大支柱
 *   2. PRE-FLIGHT CHECK: news_facts 為空且 finmind news source 有資料 → throw
 *   3. 對每個 fact 套用 metric semantics (id 帶 dimensions)
 *   4. 標記 evidence_level + collection_status
 */

import {
  emptyFactPack,
  FactPackError,
  validateFactPackShape,
} from './factPackSchema.js'
import { extractNewsFacts } from './newsFactExtractor.js'
import { EvidenceLevel, CollectionStatus } from './evidenceLevels.js'
import { KNOWN_METRICS } from './metricSemantics.js'

// ─────────────────────────────────────────────────────────────
// Source-to-fact 轉換
// ─────────────────────────────────────────────────────────────

/**
 * 從 finmind dossier (現有的 fetchStockDossierData 輸出) 轉成 valuation_facts
 */
function buildValuationFacts(dossierData = {}) {
  const facts = []
  const valuation = dossierData.valuation || []

  // 取最近一筆 PE / PB / 殖利率
  if (Array.isArray(valuation) && valuation.length > 0) {
    const latest = valuation[valuation.length - 1]
    if (latest.PER != null) {
      facts.push({
        id: KNOWN_METRICS.PE_TRAILING,
        value: latest.PER,
        unit: 'times',
        period: latest.date || null,
        source: 'finmind:TaiwanStockPER',
        evidence_level: EvidenceLevel.VERIFIED,
        collection_status: CollectionStatus.COLLECTED,
        confidence: 0.99,
        depends_on: [],
        formula_version: null,
      })
    }
    if (latest.PBR != null) {
      facts.push({
        id: KNOWN_METRICS.PB,
        value: latest.PBR,
        unit: 'times',
        period: latest.date || null,
        source: 'finmind:TaiwanStockPER',
        evidence_level: EvidenceLevel.VERIFIED,
        collection_status: CollectionStatus.COLLECTED,
        confidence: 0.99,
        depends_on: [],
        formula_version: null,
      })
    }
    if (latest.dividend_yield != null) {
      facts.push({
        id: KNOWN_METRICS.DIVIDEND_YIELD,
        value: latest.dividend_yield,
        unit: '%',
        period: latest.date || null,
        source: 'finmind:TaiwanStockPER',
        evidence_level: EvidenceLevel.VERIFIED,
        collection_status: CollectionStatus.COLLECTED,
        confidence: 0.99,
        depends_on: [],
        formula_version: null,
      })
    }
  }

  return facts
}

/**
 * 從 finmind financials 轉成 earnings_facts (含 metric semantics)
 */
function buildEarningsFacts(dossierData = {}) {
  const facts = []
  const financials = dossierData.financials || []

  // FinMind FinancialStatements 是 long format: { date, type, value, ... }
  // 把每個 type 轉成標準 metric id
  const typeToMetric = {
    EPS: KNOWN_METRICS.EPS_POST_QUARTERLY,
    Revenue: KNOWN_METRICS.REVENUE_QUARTERLY,
    GrossProfit: KNOWN_METRICS.GROSS_PROFIT_QUARTERLY,
    OperatingIncome: KNOWN_METRICS.OPERATING_INCOME_QUARTERLY,
    TotalNonoperatingIncomeAndExpense: KNOWN_METRICS.NONOP_QUARTERLY,
    PreTaxIncome: KNOWN_METRICS.PRETAX_QUARTERLY,
    TAX: KNOWN_METRICS.TAX_QUARTERLY,
    IncomeAfterTaxes: KNOWN_METRICS.NET_INCOME_QUARTERLY,
  }

  for (const row of financials) {
    if (!row || !row.type || row.value == null) continue
    const metricId = typeToMetric[row.type]
    if (!metricId) continue

    facts.push({
      id: `${metricId}@${row.date}`,
      base_id: metricId,
      value: row.value,
      unit: row.type === 'EPS' ? 'TWD' : 'TWD',
      period: row.date,
      source: 'finmind:TaiwanStockFinancialStatements',
      evidence_level: EvidenceLevel.VERIFIED,
      collection_status: CollectionStatus.COLLECTED,
      confidence: 0.99,
      depends_on: [],
      formula_version: null,
    })
  }

  return facts
}

/**
 * 從 finmind institutional + margin + shareholding 轉成 chip_facts
 */
function buildChipFacts(dossierData = {}) {
  const facts = []

  // 三大法人 (institutional)
  const inst = dossierData.institutional || []
  for (const row of inst) {
    if (!row || !row.date || !row.name) continue
    facts.push({
      id: `inst:${row.name}:${row.date}`,
      value: (row.buy ?? 0) - (row.sell ?? 0),
      unit: 'shares',
      period: row.date,
      label: row.name,
      source: 'finmind:TaiwanStockInstitutionalInvestorsBuySell',
      evidence_level: EvidenceLevel.VERIFIED,
      collection_status: CollectionStatus.COLLECTED,
      confidence: 0.99,
      depends_on: [],
    })
  }

  // 融資融券 (margin)
  const margin = dossierData.margin || []
  for (const row of margin) {
    if (!row || !row.date) continue
    facts.push({
      id: `margin_balance:${row.date}`,
      value: row.MarginPurchaseTodayBalance ?? 0,
      unit: 'lots',
      period: row.date,
      source: 'finmind:TaiwanStockMarginPurchaseShortSale',
      evidence_level: EvidenceLevel.VERIFIED,
      collection_status: CollectionStatus.COLLECTED,
      confidence: 0.99,
      depends_on: [],
    })
  }

  // 外資持股率 (shareholding)
  const sh = dossierData.shareholding || []
  for (const row of sh) {
    if (!row || !row.date) continue
    facts.push({
      id: `foreign_ratio:${row.date}`,
      value: row.ForeignInvestmentSharesRatio ?? 0,
      unit: '%',
      period: row.date,
      source: 'finmind:TaiwanStockShareholding',
      evidence_level: EvidenceLevel.VERIFIED,
      collection_status: CollectionStatus.COLLECTED,
      confidence: 0.99,
      depends_on: [],
    })
  }

  return facts
}

// ─────────────────────────────────────────────────────────────
// Pre-flight check (Rule 0)
// ─────────────────────────────────────────────────────────────

/**
 * Rule 0 enforcement: news_facts 為空且 source 有資料 → throw
 *
 * @param {Array} rawNews - 從 finmind fetchStockNews 拿到的原始陣列
 * @param {Array} newsFacts - 經 extractNewsFacts 處理後的結果
 * @param {string} stockId
 * @param {Object} factPackPartial - 已建好的部分 factPack (帶在 error 內方便 debug)
 */
export function preflightNewsCheck({ rawNews, newsFacts, stockId, factPackPartial }) {
  const newsFactsLen = Array.isArray(newsFacts) ? newsFacts.length : 0
  const rawNewsLen = Array.isArray(rawNews) ? rawNews.length : 0

  if (newsFactsLen === 0 && rawNewsLen > 0) {
    throw new FactPackError({
      code: 'NEWS_FACTS_EMPTY_BUT_SOURCE_HAS_DATA',
      message: `${stockId}: news_facts 為空但 finmind 有 ${rawNewsLen} 筆 raw news (Rule 0 違反)`,
      suggested_fix: '檢查 extractNewsFacts 為什麼產出空陣列, 可能 sentiment/scoring 有 bug',
      fact_pack_partial: factPackPartial,
    })
  }
}

// ─────────────────────────────────────────────────────────────
// 主介面: buildFactPack
// ─────────────────────────────────────────────────────────────

/**
 * 從 dossier 組 factPack
 *
 * @param {Object} input
 * @param {string} input.stockId
 * @param {string} [input.stockName]
 * @param {Object} input.dossierData - finmind fetchStockDossierData 的結果
 * @param {Object} [input.meta] - 額外 metadata (market_exchange / industry_category_twse 等)
 * @param {Object} [options]
 * @param {boolean} [options.skipPreflightCheck=false] - 跳過 pre-flight (測試用)
 * @returns {Object} factPack
 */
export function buildFactPack(input, options = {}) {
  const { stockId, stockName, dossierData = {}, meta = {} } = input || {}
  const { skipPreflightCheck = false } = options

  if (!stockId) {
    throw new FactPackError({
      code: 'MISSING_STOCK_ID',
      message: 'buildFactPack: stockId 必填',
    })
  }

  // 1. 起始空 factPack
  const factPack = emptyFactPack({
    code: stockId,
    name: stockName,
    asOf: new Date().toISOString().slice(0, 10),
    dossier_cache_key: `${stockId}:${new Date().toISOString().slice(0, 10)}`,
    ...meta,
  })

  // 2. 4 大支柱
  factPack.valuation_facts = buildValuationFacts(dossierData)
  factPack.earnings_facts = buildEarningsFacts(dossierData)
  factPack.chip_facts = buildChipFacts(dossierData)

  // 3. news_facts: 用 extractor (含 6 維度評分 + sentiment + cluster)
  const rawNews = dossierData.news || []
  const newsFacts = extractNewsFacts(rawNews, { stockId, stockName }, {})
  factPack.news_facts = newsFacts

  // 4. PRE-FLIGHT CHECK (Rule 0)
  if (!skipPreflightCheck) {
    preflightNewsCheck({
      rawNews,
      newsFacts,
      stockId,
      factPackPartial: factPack,
    })
  }

  // 5. unresolved 處理
  if (newsFacts.length === 0 && rawNews.length === 0) {
    // 真的沒新聞 → 必須記錄
    factPack.unresolved.push({
      id: `news_empty_${stockId}`,
      reason: 'no news in last 14 days from finmind TaiwanStockNews',
      verified_at: new Date().toISOString(),
      blocker_for: [],
    })
  }

  // 6. 最後驗證 schema
  const shapeErrors = validateFactPackShape(factPack)
  if (shapeErrors.length > 0) {
    throw new FactPackError({
      code: 'INVALID_SHAPE',
      message: `factPack shape validation failed: ${JSON.stringify(shapeErrors)}`,
      fact_pack_partial: factPack,
    })
  }

  return factPack
}
