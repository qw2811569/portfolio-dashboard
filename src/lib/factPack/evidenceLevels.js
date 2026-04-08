/**
 * Evidence levels for factPack — 4-tier from Qwen round 1
 *
 * 來源: design doc v1 §3 + Qwen round 1 review
 *
 * | 等級       | 定義                                          | 例                                |
 * |------------|-----------------------------------------------|-----------------------------------|
 * | verified   | 官方來源 + 交叉驗證                            | FinMind PER + 季財報重算對齊       |
 * | sourced    | 單一可靠來源                                   | 經濟日報報導                       |
 * | inferred   | 推論或 scenario, 必須有 depends_on              | normalized EPS scenario            |
 * | speculative| 假設, 需後續驗證                               | "審慎樂觀" 翻譯成 EPS 區間          |
 *
 * 注意:
 * - evidence_level 與 collection_status 是兩個獨立的軸
 * - collection_status 是蒐集狀態 (collected / blocked / partial / pending)
 * - evidence_level 是證據強度
 */

export const EvidenceLevel = Object.freeze({
  VERIFIED: 'verified',
  SOURCED: 'sourced',
  INFERRED: 'inferred',
  SPECULATIVE: 'speculative',
})

export const EVIDENCE_LEVEL_VALUES = Object.freeze([
  EvidenceLevel.VERIFIED,
  EvidenceLevel.SOURCED,
  EvidenceLevel.INFERRED,
  EvidenceLevel.SPECULATIVE,
])

export const CollectionStatus = Object.freeze({
  COLLECTED: 'collected',
  BLOCKED: 'blocked',
  PARTIAL: 'partial',
  PENDING: 'pending',
})

export const COLLECTION_STATUS_VALUES = Object.freeze([
  CollectionStatus.COLLECTED,
  CollectionStatus.BLOCKED,
  CollectionStatus.PARTIAL,
  CollectionStatus.PENDING,
])

/**
 * Severity 等級, 用於 critic report
 * 對應 design doc v1 §1
 */
export const Severity = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
})

export const SEVERITY_VALUES = Object.freeze([
  Severity.CRITICAL,
  Severity.HIGH,
  Severity.MEDIUM,
  Severity.LOW,
])
