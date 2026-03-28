import { describe, expect, it } from 'vitest'
import { buildDailyHoldingDossierContext } from '../../src/lib/dossierUtils.js'
import { buildStressTestUserPrompt } from '../../src/lib/promptTemplateCatalog.js'
import {
  buildStressTestRequestBody,
  buildStressTestSnapshot,
  getStressTestText,
} from '../../src/lib/stressTestRuntime.js'

describe('lib/stressTestRuntime', () => {
  it('builds a stress-test snapshot from holdings and dossiers', () => {
    const holdings = [
      { code: '2330', name: '台積電', cost: 900, qty: 1000, type: '股票', price: 950 },
      { code: '2454', name: '聯發科', cost: 1200, qty: 500, type: '股票', price: 1180 },
    ]
    const priceMap = {
      2330: { price: 952, yesterday: 948, change: 4, changePct: 0.42 },
      2454: { price: 1182, yesterday: 1190, change: -8, changePct: -0.67 },
    }
    const dossierByCode = new Map([
      [
        '2330',
        {
          code: '2330',
          name: '台積電',
          position: { qty: 1000, cost: 900, value: 952000, pnl: 52000, pct: 5.78 },
        },
      ],
      [
        '2454',
        {
          code: '2454',
          name: '聯發科',
          position: { qty: 500, cost: 1200, value: 591000, pnl: -9000, pct: -1.5 },
        },
      ],
    ])

    const snapshot = buildStressTestSnapshot({
      holdings,
      priceMap,
      dossierByCode,
      resolveHoldingPrice: (holding) => holding.price,
      getHoldingUnrealizedPnl: (holding) => (holding.price - holding.cost) * holding.qty,
      getHoldingReturnPct: (holding) =>
        Math.round((holding.price / holding.cost - 1) * 10000) / 100,
      buildDailyHoldingDossierContext,
    })

    expect(snapshot.totalValue).toBe(1543000)
    expect(snapshot.changes).toHaveLength(2)
    expect(snapshot.dailyDossiers).toHaveLength(2)
    expect(snapshot.holdingSummary).toContain('股票代碼: 2330')
    expect(snapshot.holdingSummary).toContain('股票名稱: 聯發科')
  })

  it('builds request bodies and extracts fallback text safely', () => {
    const body = buildStressTestRequestBody({
      holdingSummary: '股票代碼: 2330',
      totalValue: 1234567,
      buildSystemPrompt: () => 'SYSTEM',
      buildUserPrompt: buildStressTestUserPrompt,
    })

    expect(body).toEqual({
      systemPrompt: 'SYSTEM',
      userPrompt: expect.stringContaining('目前組合總市值約 1,234,567 元'),
    })
    expect(getStressTestText({ content: [{ text: '風險結果' }] }, 'fallback')).toBe('風險結果')
    expect(getStressTestText({}, 'fallback')).toBe('fallback')
  })
})
