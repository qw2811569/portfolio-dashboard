/**
 * Tests for evidenceLevels.js
 * Phase 1 unit test — design doc v1 §3
 */

import { describe, it, expect } from 'vitest'
import {
  EvidenceLevel,
  EVIDENCE_LEVEL_VALUES,
  CollectionStatus,
  COLLECTION_STATUS_VALUES,
  Severity,
  SEVERITY_VALUES,
} from '../evidenceLevels.js'

describe('evidenceLevels', () => {
  describe('EvidenceLevel (Qwen 4 級簡化)', () => {
    it('恰好有 4 個級別', () => {
      expect(EVIDENCE_LEVEL_VALUES).toHaveLength(4)
    })

    it('包含 verified / sourced / inferred / speculative', () => {
      expect(EVIDENCE_LEVEL_VALUES).toEqual(
        expect.arrayContaining(['verified', 'sourced', 'inferred', 'speculative']),
      )
    })

    it('frozen, 不可被修改', () => {
      expect(Object.isFrozen(EvidenceLevel)).toBe(true)
      expect(Object.isFrozen(EVIDENCE_LEVEL_VALUES)).toBe(true)
    })

    it('沒有第 5 級 (例如 attempted_failed)', () => {
      // Qwen 強調: attempted_failed 是 collection_status 軸, 不該混在 evidence_level
      expect(EVIDENCE_LEVEL_VALUES).not.toContain('attempted_failed')
      expect(EVIDENCE_LEVEL_VALUES).not.toContain('failed')
      expect(EVIDENCE_LEVEL_VALUES).not.toContain('partially_verified')
    })
  })

  describe('CollectionStatus (Codex 補位提的獨立軸)', () => {
    it('恰好有 4 種狀態', () => {
      expect(COLLECTION_STATUS_VALUES).toHaveLength(4)
    })

    it('包含 collected / blocked / partial / pending', () => {
      expect(COLLECTION_STATUS_VALUES).toEqual(
        expect.arrayContaining(['collected', 'blocked', 'partial', 'pending']),
      )
    })

    it('與 EvidenceLevel 是獨立的軸', () => {
      // 不可以有 verified / sourced 等 evidence level 混在 collection status
      for (const ev of EVIDENCE_LEVEL_VALUES) {
        expect(COLLECTION_STATUS_VALUES).not.toContain(ev)
      }
    })
  })

  describe('Severity (給 critic report 用)', () => {
    it('包含 critical / high / medium / low', () => {
      expect(SEVERITY_VALUES).toEqual(
        expect.arrayContaining(['critical', 'high', 'medium', 'low']),
      )
    })

    it('frozen', () => {
      expect(Object.isFrozen(Severity)).toBe(true)
    })
  })
})
