/**
 * factPack schema — 4 大支柱必填 + scout_attempts + resolved_facts
 *
 * 來源: design doc v1 §3
 *
 * 4 大支柱 (Rule 0):
 *   - valuation_facts (估值)
 *   - earnings_facts (獲利)
 *   - chip_facts (籌碼)
 *   - news_facts (消息) ← first-class citizen
 *
 * 任何一個缺 = factPackBuilder pre-flight throw
 */

import { EVIDENCE_LEVEL_VALUES, COLLECTION_STATUS_VALUES } from './evidenceLevels.js'

// ─────────────────────────────────────────────────────────────
// JSON Schema (用於 validate)
// ─────────────────────────────────────────────────────────────

export const FACT_PACK_SCHEMA_VERSION = '0.1'

/**
 * factPack 的最小有效結構
 */
export function emptyFactPack(meta = {}) {
  return {
    schema_version: FACT_PACK_SCHEMA_VERSION,
    meta: {
      code: meta.code || null,
      name: meta.name || null,
      market_exchange: meta.market_exchange || null,
      listing_status: meta.listing_status || null,
      industry_category_twse: meta.industry_category_twse || null,
      asOf: meta.asOf || new Date().toISOString().slice(0, 10),
      builder_version: FACT_PACK_SCHEMA_VERSION,
      dossier_cache_key: meta.dossier_cache_key || null,
    },
    valuation_facts: [],
    earnings_facts: [],
    chip_facts: [],
    news_facts: [],
    unresolved: [],
    scout_attempts: [],
    resolved_facts: [],
  }
}

// ─────────────────────────────────────────────────────────────
// FactPackError class
// Qwen Phase 1 review fix: 加 severity 分級 + 完整 debug metadata
// ─────────────────────────────────────────────────────────────

export const FactPackErrorSeverity = Object.freeze({
  CRITICAL: 'critical', // 根本無法執行 (例: MISSING_STOCK_ID, INVALID_SHAPE)
  HIGH: 'high', // pipeline 斷了 (例: NEWS_FACTS_EMPTY_BUT_SOURCE_HAS_DATA)
  MEDIUM: 'medium', // partial degradation
})

const ERROR_CODE_TO_SEVERITY = {
  MISSING_STOCK_ID: FactPackErrorSeverity.CRITICAL,
  INVALID_SHAPE: FactPackErrorSeverity.CRITICAL,
  NEWS_FACTS_EMPTY_BUT_SOURCE_HAS_DATA: FactPackErrorSeverity.HIGH,
  NOT_OBJECT: FactPackErrorSeverity.CRITICAL,
}

export class FactPackError extends Error {
  constructor({
    code,
    message,
    suggested_fix,
    fact_pack_partial,
    // Qwen review 加的欄位
    stockId,
    stockName,
    rawNewsCount,
    newsFactCount,
    rawNewsSamples, // [{title, source, date}, ...]
    lookbackDays,
    severity,
  }) {
    super(message)
    this.name = 'FactPackError'
    this.code = code
    this.severity = severity || ERROR_CODE_TO_SEVERITY[code] || FactPackErrorSeverity.HIGH
    this.suggested_fix = suggested_fix
    this.fact_pack_partial = fact_pack_partial
    this.stockId = stockId
    this.stockName = stockName
    this.rawNewsCount = rawNewsCount
    this.newsFactCount = newsFactCount
    this.rawNewsSamples = rawNewsSamples
    this.lookbackDays = lookbackDays
    this.timestamp = new Date().toISOString()
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      severity: this.severity,
      message: this.message,
      suggested_fix: this.suggested_fix,
      stockId: this.stockId,
      stockName: this.stockName,
      rawNewsCount: this.rawNewsCount,
      newsFactCount: this.newsFactCount,
      rawNewsSamples: this.rawNewsSamples,
      lookbackDays: this.lookbackDays,
      timestamp: this.timestamp,
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────

/**
 * 驗證 factPack 結構完整性
 * 不檢查內容對錯, 只檢查 schema
 */
export function validateFactPackShape(factPack) {
  const errors = []

  if (!factPack || typeof factPack !== 'object') {
    return [{ code: 'NOT_OBJECT', message: 'factPack 必須是物件' }]
  }

  // schema_version 必填
  if (!factPack.schema_version) {
    errors.push({ code: 'MISSING_SCHEMA_VERSION', message: '缺 schema_version' })
  }

  // meta 必填
  if (!factPack.meta || typeof factPack.meta !== 'object') {
    errors.push({ code: 'MISSING_META', message: '缺 meta' })
  } else {
    if (!factPack.meta.code) errors.push({ code: 'MISSING_META_CODE', message: 'meta.code 必填' })
  }

  // 4 大支柱必填 (可為空陣列, 但 key 必須存在)
  const REQUIRED_PILLARS = ['valuation_facts', 'earnings_facts', 'chip_facts', 'news_facts']
  for (const pillar of REQUIRED_PILLARS) {
    if (!Array.isArray(factPack[pillar])) {
      errors.push({
        code: 'MISSING_PILLAR',
        message: `${pillar} 必須是陣列 (Rule 0: 4 大支柱必填)`,
        pillar,
      })
    }
  }

  // unresolved / scout_attempts / resolved_facts 必須是陣列
  for (const opt of ['unresolved', 'scout_attempts', 'resolved_facts']) {
    if (!Array.isArray(factPack[opt])) {
      errors.push({ code: 'MISSING_OPT_ARRAY', message: `${opt} 必須是陣列 (即使空)`, field: opt })
    }
  }

  return errors
}

/**
 * 驗證單一 fact 的 evidence_level + collection_status
 */
export function validateFact(fact) {
  const errors = []
  if (!fact || typeof fact !== 'object') {
    return [{ code: 'NOT_OBJECT', message: 'fact 必須是物件' }]
  }

  if (!fact.id) errors.push({ code: 'MISSING_ID', message: 'fact.id 必填' })
  if (fact.evidence_level && !EVIDENCE_LEVEL_VALUES.includes(fact.evidence_level)) {
    errors.push({
      code: 'INVALID_EVIDENCE_LEVEL',
      message: `evidence_level 必須是 ${EVIDENCE_LEVEL_VALUES.join('/')}, got ${fact.evidence_level}`,
    })
  }
  if (fact.collection_status && !COLLECTION_STATUS_VALUES.includes(fact.collection_status)) {
    errors.push({
      code: 'INVALID_COLLECTION_STATUS',
      message: `collection_status 必須是 ${COLLECTION_STATUS_VALUES.join('/')}, got ${fact.collection_status}`,
    })
  }

  // depends_on 必須是陣列 (即使空)
  if (fact.depends_on != null && !Array.isArray(fact.depends_on)) {
    errors.push({ code: 'INVALID_DEPENDS_ON', message: 'depends_on 必須是陣列' })
  }

  return errors
}

/**
 * 驗證 NewsFact (Qwen schema)
 */
export function validateNewsFact(newsFact) {
  const errors = validateFact(newsFact)
  if (errors.length > 0 && errors[0].code === 'NOT_OBJECT') return errors

  const REQUIRED_NEWS_FIELDS = [
    'source_url',
    'source_name',
    'published_at',
    'headline',
    'quoted_text',
  ]
  for (const f of REQUIRED_NEWS_FIELDS) {
    if (!newsFact[f]) {
      errors.push({ code: 'MISSING_NEWS_FIELD', message: `news_fact.${f} 必填`, field: f })
    }
  }

  if (newsFact.sentiment && !['positive', 'neutral', 'negative'].includes(newsFact.sentiment)) {
    errors.push({
      code: 'INVALID_SENTIMENT',
      message: `sentiment 必須是 positive/neutral/negative, got ${newsFact.sentiment}`,
    })
  }

  if (newsFact.llm_paraphrased == null) {
    errors.push({
      code: 'MISSING_PARAPHRASE_FLAG',
      message: 'llm_paraphrased 必填 (Qwen 合規規則)',
    })
  }

  return errors
}
