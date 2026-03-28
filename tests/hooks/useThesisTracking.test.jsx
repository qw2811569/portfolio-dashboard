import { describe, it, expect } from 'vitest'
import { normalizeThesis } from '../../src/hooks/useThesisTracking.js'

describe('normalizeThesis', () => {
  it('passes through a fully upgraded thesis unchanged', () => {
    const full = {
      id: 'thesis-001',
      stockId: '2330',
      status: 'active',
      createdAt: '2026/01/01',
      updatedAt: '2026/03/28',
      direction: 'long',
      statement: 'AI demand drives CoWoS',
      reason: '',
      expectation: 'Q1 EPS +20%',
      invalidation: '',
      pillars: [
        {
          id: 'p1',
          text: 'Revenue growth',
          status: 'on_track',
          trend: 'up',
          lastChecked: '2026/03/28',
        },
      ],
      risks: [{ id: 'r1', text: 'NVIDIA轉單', triggered: false }],
      conviction: 'high',
      targetPrice: 2200,
      stopLoss: 1650,
      stopLossPercent: 10,
      updateLog: [],
      reviewHistory: [],
    }
    const result = normalizeThesis(full)
    expect(result.statement).toBe('AI demand drives CoWoS')
    expect(result.direction).toBe('long')
    expect(result.pillars).toHaveLength(1)
    expect(result.risks).toHaveLength(1)
    expect(result.conviction).toBe('high')
  })

  it('migrates old format: reason → statement fallback', () => {
    const old = {
      id: 'thesis-old',
      stockId: '3017',
      status: 'active',
      reason: 'AI server demand strong',
      expectation: 'Q1 EPS growth',
      invalidation: '月營收轉負',
      targetPrice: 600,
      stopLossPercent: 10,
    }
    const result = normalizeThesis(old)
    expect(result.statement).toBe('AI server demand strong')
    expect(result.direction).toBe('long')
    expect(result.pillars).toEqual([])
    expect(result.risks).toEqual([{ id: 'r-migrated-0', text: '月營收轉負', triggered: false }])
    expect(result.conviction).toBe('medium')
    expect(result.updateLog).toEqual([])
    expect(result.stopLoss).toBeNull()
  })

  it('does not overwrite statement with reason if statement exists', () => {
    const mixed = {
      id: 'thesis-mix',
      stockId: '2308',
      statement: 'Real statement',
      reason: 'Old reason',
      invalidation: '',
    }
    const result = normalizeThesis(mixed)
    expect(result.statement).toBe('Real statement')
  })

  it('returns null for invalid input', () => {
    expect(normalizeThesis(null)).toBeNull()
    expect(normalizeThesis(undefined)).toBeNull()
    expect(normalizeThesis('string')).toBeNull()
  })

  it('normalizes invalid conviction to medium', () => {
    const thesis = { id: 't1', stockId: '2330', conviction: 'extreme' }
    expect(normalizeThesis(thesis).conviction).toBe('medium')
  })

  it('normalizes pillar with invalid status to on_track', () => {
    const thesis = {
      id: 't1',
      stockId: '2330',
      pillars: [{ id: 'p1', text: 'test', status: 'invalid', trend: 'up' }],
    }
    const result = normalizeThesis(thesis)
    expect(result.pillars[0].status).toBe('on_track')
    expect(result.pillars[0].trend).toBe('up')
  })
})
