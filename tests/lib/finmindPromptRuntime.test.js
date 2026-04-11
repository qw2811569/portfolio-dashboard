import { describe, expect, it, vi } from 'vitest'
import {
  hasFinMindPromptData,
  hydrateDossiersWithFinMind,
  summarizeFinMindDailyConfirmation,
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
      fetchOptions: { forceFresh: true },
      logger: vi.fn(),
    })

    expect(fetchStockDossierData).toHaveBeenCalledTimes(1)
    expect(fetchStockDossierData).toHaveBeenCalledWith('2308', { forceFresh: true })
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

  it('summarizes whether FinMind daily datasets are confirmed for the target market date', () => {
    const summary = summarizeFinMindDailyConfirmation(
      [
        {
          code: '2330',
          finmind: {
            institutional: [{ date: '2026-04-11' }],
            valuation: [{ date: '2026-04-11' }],
            margin: [{ date: '2026-04-11' }],
            shareholding: [{ date: '2026-04-11' }],
          },
        },
        {
          code: '2454',
          finmind: {
            institutional: [{ date: '2026-04-10' }],
            valuation: [{ date: '2026-04-11' }],
            margin: [],
            shareholding: [{ date: '2026-04-09' }],
          },
        },
      ],
      '2026/04/11'
    )

    expect(summary).toMatchObject({
      expectedMarketDate: '2026-04-11',
      totalHoldings: 2,
      totalDatasets: 8,
      confirmedDatasets: 5,
      fullyConfirmedCount: 1,
      status: 'preliminary',
      pendingCodes: ['2454'],
    })
    expect(summary.coverage[1]).toMatchObject({
      code: '2454',
      confirmedCount: 1,
      fullyConfirmed: false,
      datasets: {
        institutional: { latestDate: '2026-04-10', status: 'stale' },
        valuation: { latestDate: '2026-04-11', status: 'confirmed' },
        margin: { latestDate: null, status: 'missing' },
        shareholding: { latestDate: '2026-04-09', status: 'stale' },
      },
    })
  })
})
