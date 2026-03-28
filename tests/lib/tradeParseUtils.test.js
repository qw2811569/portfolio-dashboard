import { describe, expect, it, vi } from 'vitest'
import {
  assessTradeParseQuality,
  applyParsedTradesToHoldings,
  buildTradeLogEntries,
  getTradeBatchMode,
  normalizeTradeParseResult,
  summarizeTradeBatch,
} from '../../src/lib/tradeParseUtils.js'

describe('lib/tradeParseUtils', () => {
  it('normalizes OCR parse payload into consistent trade fields', () => {
    const normalized = normalizeTradeParseResult(
      {
        tradeDate: '2026-03-27',
        trades: [
          {
            action: '買進',
            code: '2330',
            name: '台積電',
            qty: '1,000',
            price: '952',
            time: '09:05',
          },
          { action: '賣出', code: '2454', name: '聯發科', qty: '500', price: '1,255' },
        ],
        targetPriceUpdates: [
          { code: '2330', firm: '元大投顧', target: '1200', date: '2026-03-27' },
        ],
        note: '第二筆時間模糊',
        confidence: 'medium',
      },
      '2026/03/28'
    )

    expect(normalized.tradeDate).toBe('2026/03/27')
    expect(normalized.trades).toEqual([
      expect.objectContaining({
        action: '買進',
        code: '2330',
        qty: 1000,
        price: 952,
        date: '2026/03/27',
        time: '09:05',
      }),
      expect.objectContaining({
        action: '賣出',
        code: '2454',
        qty: 500,
        price: 1255,
        date: '2026/03/27',
      }),
    ])
    expect(normalized.targetPriceUpdates).toEqual([
      expect.objectContaining({
        code: '2330',
        firm: '元大投顧',
        target: 1200,
        date: '2026/03/27',
      }),
    ])
    expect(normalized.confidence).toBe('medium')
  })

  it('builds one trade log entry per parsed trade with selected backfill date', () => {
    const now = new Date('2026-03-28T02:15:00.000Z')
    const entries = buildTradeLogEntries({
      parsed: {
        trades: [
          { action: '買進', code: '2330', name: '台積電', qty: 1000, price: 952, time: '09:05' },
          { action: '賣出', code: '2454', name: '聯發科', qty: 500, price: 1255 },
        ],
      },
      tradeDate: '2026/3/27',
      memoQuestions: ['Q1', 'Q2'],
      memoAnswers: ['A1', 'A2'],
      now,
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      date: '2026/3/27',
      time: '09:05',
      action: '買進',
      code: '2330',
    })
    expect(entries[1]).toMatchObject({
      date: '2026/3/27',
      action: '賣出',
      code: '2454',
    })
    expect(entries[1].qa).toEqual([
      { q: 'Q1', a: 'A1' },
      { q: 'Q2', a: 'A2' },
    ])
  })

  it('applies every parsed trade to holdings sequentially and detects mixed batches', () => {
    const applyTradeEntryToHoldings = vi.fn((rows, trade) => [...rows, trade.code])
    const nextHoldings = applyParsedTradesToHoldings({
      holdings: [],
      parsed: {
        trades: [
          { action: '買進', code: '2330' },
          { action: '賣出', code: '2454' },
        ],
      },
      applyTradeEntryToHoldings,
    })

    expect(nextHoldings).toEqual(['2330', '2454'])
    expect(applyTradeEntryToHoldings).toHaveBeenCalledTimes(2)
    expect(getTradeBatchMode([{ action: '買進' }, { action: '賣出' }])).toBe('混合')
  })

  it('builds batch preview summary and low-confidence warnings', () => {
    const parsed = normalizeTradeParseResult({
      confidence: 'low',
      note: '第二筆成交價看不清楚',
      trades: [
        { action: '買進', code: '2330', name: '台積電', qty: 1000, price: 952, amount: 952000 },
        { action: '賣出', code: '', name: '聯發科', qty: 0, price: 1255 },
      ],
      targetPriceUpdates: [{ code: '2330', firm: '元大投顧', target: 1200 }],
    })

    expect(summarizeTradeBatch(parsed)).toMatchObject({
      tradeCount: 2,
      buyCount: 1,
      sellCount: 1,
      targetUpdateCount: 1,
      totalNotional: 952000,
    })

    const quality = assessTradeParseQuality(parsed)
    expect(quality.needsManualReview).toBe(true)
    expect(quality.rowWarnings).toEqual([
      expect.objectContaining({
        name: '聯發科',
        issues: expect.arrayContaining(['代碼缺失', '股數異常']),
      }),
    ])
  })
})
