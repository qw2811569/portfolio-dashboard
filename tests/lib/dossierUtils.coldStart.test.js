import { describe, expect, it } from 'vitest'
import { buildColdStartDossierSummary } from '../../src/lib/dossierUtils.js'
import { getTopKnowledgeRules } from '../../src/lib/knowledgeBase.js'

describe('dossierUtils cold start summary', () => {
  it('builds a dense summary under 2000 chars', () => {
    const text = buildColdStartDossierSummary(
      '2308',
      {
        institutional: [
          { foreign: 1000, investment: 200 },
          { foreign: 500, investment: 0 },
        ],
        valuation: [{ per: 18.5, pbr: 4.1 }],
        margin: [{ marginBalance: 12000 }, { marginBalance: 11800 }],
        revenue: [{ revenueMonth: '2026/03', revenueYoY: 22.5, revenueMoM: 4.2 }],
        balanceSheet: [{ totalAssets: 1000, totalLiabilities: 400, debtRatio: 40 }],
        cashFlow: [{ operatingCF: 180, investingCF: -30, financingCF: -20 }],
        shareholding: [{ foreignShareRatio: 23.5 }, { foreignShareRatio: 22.9 }],
      },
      [{ date: '2026-03-30', title: '台達電法說會' }],
      getTopKnowledgeRules({ maxItems: 10 })
    )

    expect(text).toContain('FinMind七組摘要')
    expect(text).toContain('知識庫高信心規則')
    expect(text.length).toBeLessThanOrEqual(2000)
  })
})
