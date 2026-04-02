import { describe, expect, it, vi } from 'vitest'
import {
  hasFinMindPromptData,
  hydrateDossiersWithFinMind,
  summarizeFinMindPromptDatasets,
} from '../../src/lib/finmindPromptRuntime.js'

describe('lib/finmindPromptRuntime', () => {
  it('summarizes the seven FinMind prompt datasets', () => {
    const summary = summarizeFinMindPromptDatasets({
      institutional: [{}, {}],
      valuation: [{}],
      margin: [],
      revenue: [{}],
      balanceSheet: [{}],
      cashFlow: [],
      shareholding: [{}, {}],
    })

    expect(summary).toMatchObject({
      institutional: 2,
      valuation: 1,
      margin: 0,
      revenue: 1,
      balanceSheet: 1,
      cashFlow: 0,
      shareholding: 2,
      availableCount: 5,
      missingCount: 2,
    })
    expect(hasFinMindPromptData({ revenue: [{}] })).toBe(true)
    expect(hasFinMindPromptData(null)).toBe(false)
  })

  it('hydrates only dossiers that are missing FinMind prompt data', async () => {
    const fetchStockDossierData = vi.fn(async (code) => ({
      institutional: [{ code }],
      valuation: [{ per: 18 }],
      margin: [{ marginBalance: 1200 }, { marginBalance: 1180 }],
      revenue: [{ revenueMonth: '2026/03' }],
      balanceSheet: [{ totalAssets: 120000 }],
      cashFlow: [{ operatingCF: 18000 }],
      shareholding: [{ foreignShareRatio: 61.5 }],
    }))

    const originalMap = new Map([
      ['2308', { code: '2308', finmind: null }],
      ['2330', { code: '2330', finmind: { revenue: [{ revenueMonth: '2026/03' }] } }],
    ])

    const hydrated = await hydrateDossiersWithFinMind({
      codes: ['2308', '2330'],
      dossierByCode: originalMap,
      fetchStockDossierData,
      logger: vi.fn(),
    })

    expect(fetchStockDossierData).toHaveBeenCalledTimes(1)
    expect(fetchStockDossierData).toHaveBeenCalledWith('2308')
    expect(hydrated.dossierByCode.get('2308')?.finmind).toMatchObject({
      valuation: [expect.objectContaining({ per: 18 })],
      shareholding: [expect.objectContaining({ foreignShareRatio: 61.5 })],
    })
    expect(hydrated.coverage).toEqual([
      expect.objectContaining({
        code: '2308',
        datasets: expect.objectContaining({ availableCount: 7 }),
      }),
      expect.objectContaining({
        code: '2330',
        datasets: expect.objectContaining({ availableCount: 1 }),
      }),
    ])
  })
})
