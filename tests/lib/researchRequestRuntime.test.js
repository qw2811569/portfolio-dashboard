import { describe, expect, it } from 'vitest'
import {
  normalizeResearchRequestInput,
  resolveResearchMode,
  summarizeResearchRequestInput,
  validateResearchRequestInput,
} from '../../src/lib/researchRequestRuntime.js'

describe('lib/researchRequestRuntime', () => {
  it('defaults legacy target-only requests to single mode with one stock', () => {
    const normalized = normalizeResearchRequestInput({
      target: {
        code: '2308',
        name: '台達電',
        price: 380,
      },
    })

    expect(normalized.mode).toBe('single')
    expect(normalized.stocks).toEqual([
      expect.objectContaining({
        code: '2308',
        name: '台達電',
        price: 380,
      }),
    ])
  })

  it('promotes holdings into research universe for portfolio mode', () => {
    const normalized = normalizeResearchRequestInput({
      mode: 'portfolio',
      holdings: [
        { code: '2308', name: '台達電', price: 380, qty: 10 },
        { code: '2330', name: '台積電', price: 900, qty: 2 },
      ],
    })

    expect(normalized.mode).toBe('portfolio')
    expect(normalized.stocks).toHaveLength(2)
    expect(normalized.stocks[0]).toMatchObject({ code: '2308' })
  })

  it('rejects single-mode requests without a target stock', () => {
    expect(
      validateResearchRequestInput({
        mode: 'single',
        stocks: [],
        holdings: [],
      })
    ).toBe('深度研究缺少目標股票')
  })

  it('summarizes request diagnostics for logging', () => {
    expect(
      summarizeResearchRequestInput({
        mode: resolveResearchMode({
          mode: 'evolve',
          stocks: [{ code: '2308' }],
          holdings: [{ code: '2308' }],
        }),
        stocks: [{ code: '2308' }],
        holdings: [{ code: '2308' }],
        holdingDossiers: [{ code: '2308' }],
        events: [{ id: 1 }],
        analysisHistory: [{ id: 2 }],
        persist: false,
      })
    ).toEqual({
      mode: 'evolve',
      stockCount: 1,
      holdingCount: 1,
      dossierCount: 1,
      eventCount: 1,
      analysisHistoryCount: 1,
      persist: false,
    })
  })
})
