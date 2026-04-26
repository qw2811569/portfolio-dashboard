import { describe, expect, it } from 'vitest'
import { buildManualTrade, parseTradesFromText } from '../../src/lib/tradeParser.js'

describe('lib/tradeParser', () => {
  it('parses pasted trade text into normalized trades', () => {
    const parsed = parseTradesFromText('買進 2330 台積電 100 股 @ 950', {
      fallbackDate: '2026-04-26',
    })

    expect(parsed.trades).toEqual([
      expect.objectContaining({
        action: '買進',
        code: '2330',
        name: '台積電',
        qty: 100,
        price: 950,
      }),
    ])
  })

  it('does not treat stock symbols containing s as sell orders', () => {
    const parsed = parseTradesFromText('TSMC 100 @ 950', {
      fallbackDate: '2026-04-26',
    })

    expect(parsed.confidence).toBe('low')
    expect(parsed.trades[0]).toMatchObject({
      action: '買進',
      code: 'TSMC',
      qty: 100,
      price: 950,
      needsActionConfirmation: true,
    })
  })

  it('builds a manual trade parse result', () => {
    const parsed = buildManualTrade({
      code: '2454',
      name: '聯發科',
      action: '賣出',
      qty: '2',
      price: '1250',
      tradeDate: '2026-04-26',
    })

    expect(parsed.trades[0]).toMatchObject({
      action: '賣出',
      code: '2454',
      name: '聯發科',
      qty: 2,
      price: 1250,
    })
  })
})
