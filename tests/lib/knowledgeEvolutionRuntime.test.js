import { describe, expect, it } from 'vitest'
import {
  buildKnowledgeEvolutionProposal,
  normalizeKnowledgeFeedbackLog,
  normalizeKnowledgeUsageLog,
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
})
