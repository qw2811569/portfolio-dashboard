import { describe, expect, it } from 'vitest'
import {
  applyKnowledgeConfidenceAdjustments,
  buildKnowledgeEvolutionProposal,
  logAnalysisObservation,
  normalizeKnowledgeFeedbackLog,
  normalizeKnowledgeUsageLog,
  scoreKnowledgeRuleOutcomes,
} from '../../src/lib/knowledgeEvolutionRuntime.js'

describe('lib/knowledgeEvolutionRuntime', () => {
  it('normalizes usage and feedback logs into safe arrays', () => {
    expect(
      normalizeKnowledgeUsageLog([null, { timestamp: 'x', itemIds: ['fa-001', '', 'fa-001'] }])
    ).toEqual([{ timestamp: 0, itemIds: ['fa-001'] }])

    expect(
      normalizeKnowledgeFeedbackLog([
        { signal: 'helpful', injectedKnowledgeIds: ['fa-001', '', 'fa-001'] },
        { signal: 'neutral', injectedKnowledgeIds: ['fa-002'] },
      ])
    ).toEqual([
      {
        analysisId: null,
        signal: 'helpful',
        timestamp: 0,
        date: null,
        injectedKnowledgeIds: ['fa-001'],
      },
    ])
  })

  it('builds confidence adjustments from usage recency and linked feedback signals', () => {
    const now = 31 * 24 * 60 * 60 * 1000
    const proposal = buildKnowledgeEvolutionProposal({
      now,
      usageLog: [
        { timestamp: now - 5_000, itemIds: ['fa-001'] },
        { timestamp: 1, itemIds: ['rm-001'] },
      ],
      feedbackLog: [
        { signal: 'helpful', injectedKnowledgeIds: ['fa-001'] },
        { signal: 'helpful', injectedKnowledgeIds: ['fa-001'] },
        { signal: 'misleading', injectedKnowledgeIds: ['rm-001'] },
        { signal: 'misleading', injectedKnowledgeIds: ['rm-001'] },
      ],
    })

    expect(proposal.status).toBe('candidate')
    expect(proposal.evaluation.passed).toBe(true)
    expect(proposal.confidenceAdjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'rm-001',
          delta: -0.04,
          statusAction: 'pending-review',
        }),
        expect.objectContaining({
          id: 'fa-001',
          delta: 0.02,
          statusAction: 'reinforce',
        }),
      ])
    )
  })

  it('returns a no-op proposal when feedback cannot be linked to knowledge ids', () => {
    const proposal = buildKnowledgeEvolutionProposal({
      now: 2,
      usageLog: [{ timestamp: 1, itemIds: ['fa-001'] }],
      feedbackLog: [{ signal: 'helpful', injectedKnowledgeIds: [] }],
    })

    expect(proposal.status).toBe('no-op')
    expect(proposal.confidenceAdjustments).toEqual([])
    expect(proposal.metrics.feedbackMissingLinkCount).toBe(1)
  })

  it('logs observations and keeps only the latest 500 entries', () => {
    const storage = {
      data: new Map(),
      getItem(key) {
        return this.data.get(key) || null
      },
      setItem(key, value) {
        this.data.set(key, value)
      },
    }

    for (let i = 0; i < 505; i++) {
      logAnalysisObservation(
        {
          ruleIds: ['fa-001'],
          stockCode: '2330',
          date: '2026-04-03',
          outcome: i % 2 === 0 ? 'positive' : 'negative',
          evidenceRefs: [],
          timestamp: i + 1,
        },
        storage
      )
    }

    const rows = JSON.parse(storage.getItem('kb-observation-log'))
    expect(rows).toHaveLength(500)
    expect(rows[0].timestamp).toBe(6)
  })

  it('scores rule outcomes and caps single-step confidence deltas', () => {
    const now = 40 * 24 * 60 * 60 * 1000
    const scores = scoreKnowledgeRuleOutcomes(
      [
        { ruleIds: ['fa-001'], outcome: 'positive', timestamp: now - 1000 },
        { ruleIds: ['fa-001'], outcome: 'positive', timestamp: now - 2000 },
        { ruleIds: ['fa-001'], outcome: 'positive', timestamp: now - 3000 },
        { ruleIds: ['rm-001'], outcome: 'negative', timestamp: 1 },
        { ruleIds: ['rm-001'], outcome: 'negative', timestamp: 2 },
      ],
      { now }
    )

    expect(scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'fa-001', suggestedConfidenceChange: 0.02 }),
        expect.objectContaining({ ruleId: 'rm-001', suggestedConfidenceChange: -0.04 }),
      ])
    )
  })

  it('applies confidence adjustments and writes evolution log entries', () => {
    const storage = {
      data: new Map(),
      getItem(key) {
        return this.data.get(key) || null
      },
      setItem(key, value) {
        this.data.set(key, value)
      },
    }

    const applied = applyKnowledgeConfidenceAdjustments(
      [
        { ruleId: 'fa-001', suggestedConfidenceChange: 0.02, reason: '正面率 > 70%' },
        { ruleId: 'rm-001', suggestedConfidenceChange: -0.03, reason: '正面率 < 30%' },
      ],
      { storage }
    )

    expect(applied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'fa-001', delta: 0.02 }),
        expect.objectContaining({ ruleId: 'rm-001', delta: -0.03 }),
      ])
    )

    const evolutionLog = JSON.parse(storage.getItem('kb-evolution-log'))
    expect(evolutionLog.length).toBeGreaterThan(0)
  })
})
