import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchAllStockDailyPrices,
  fetchInstitutionalInvestors,
  fetchListedStocksCatalog,
  fetchValuationMetrics,
} from '../../api/_lib/twse-market-data.js'

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

describe('api/_lib/twse-market-data', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  describe('fetchListedStocksCatalog', () => {
    it('normalizes listed stock catalog rows', async () => {
      global.fetch.mockResolvedValue(
        createJsonResponse([
          {
            出表日期: '1150415',
            公司代號: '2330',
            公司名稱: '台灣積體電路製造股份有限公司',
            公司簡稱: '台積電',
            產業別: '24',
            上市日期: '830905',
          },
        ])
      )

      await expect(fetchListedStocksCatalog()).resolves.toEqual([
        {
          code: '2330',
          name: '台灣積體電路製造股份有限公司',
          shortName: '台積電',
          date: '2026-04-15',
          industryCode: '24',
          listedAt: '1994-09-05',
        },
      ])
    })

    it('returns an empty array when catalog payload is empty', async () => {
      global.fetch.mockResolvedValue(createJsonResponse([]))

      await expect(fetchListedStocksCatalog()).resolves.toEqual([])
    })

    it('throws when catalog endpoint returns http error', async () => {
      global.fetch.mockResolvedValue(createJsonResponse(null, 503))

      await expect(fetchListedStocksCatalog()).rejects.toThrow(/TWSE request failed \(503\)/)
    })
  })

  describe('fetchAllStockDailyPrices', () => {
    it('normalizes daily price rows and filters by requested date', async () => {
      global.fetch.mockResolvedValue(
        createJsonResponse([
          {
            Date: '1150415',
            Code: '2330',
            Name: '台積電',
            TradeVolume: '12,345',
            TradeValue: '9,876,543',
            OpeningPrice: '850.00',
            HighestPrice: '860.00',
            LowestPrice: '845.00',
            ClosingPrice: '858.00',
            Change: '8.00',
            Transaction: '321',
          },
          {
            Date: '1150414',
            Code: '3055',
            Name: '蔚華科',
            TradeVolume: '1,000',
            TradeValue: '2,000',
            OpeningPrice: '50',
            HighestPrice: '51',
            LowestPrice: '49',
            ClosingPrice: '50',
            Change: '0',
            Transaction: '10',
          },
        ])
      )

      await expect(fetchAllStockDailyPrices('2026-04-15')).resolves.toEqual([
        {
          code: '2330',
          name: '台積電',
          shortName: '台積電',
          date: '2026-04-15',
          tradeVolume: 12345,
          tradeValue: 9876543,
          openingPrice: 850,
          highestPrice: 860,
          lowestPrice: 845,
          closingPrice: 858,
          change: 8,
          transactions: 321,
        },
      ])
    })

    it('returns an empty array when daily price payload is empty', async () => {
      global.fetch.mockResolvedValue(createJsonResponse([]))

      await expect(fetchAllStockDailyPrices('2026-04-15')).resolves.toEqual([])
    })

    it('throws when daily price endpoint returns http error', async () => {
      global.fetch.mockResolvedValue(createJsonResponse(null, 500))

      await expect(fetchAllStockDailyPrices('2026-04-15')).rejects.toThrow(
        /TWSE request failed \(500\)/
      )
    })
  })

  describe('fetchValuationMetrics', () => {
    it('normalizes valuation rows and keeps empty peRatio as null', async () => {
      global.fetch.mockResolvedValue(
        createJsonResponse([
          {
            Date: '1150415',
            Code: '3055',
            Name: '蔚華科',
            PEratio: '',
            DividendYield: '4.25',
            PBratio: '1.35',
          },
        ])
      )

      await expect(fetchValuationMetrics('2026-04-15')).resolves.toEqual([
        {
          code: '3055',
          name: '蔚華科',
          shortName: '蔚華科',
          date: '2026-04-15',
          peRatio: null,
          priceBookRatio: 1.35,
          dividendYield: 4.25,
        },
      ])
    })

    it('returns an empty array when valuation payload is empty', async () => {
      global.fetch.mockResolvedValue(createJsonResponse([]))

      await expect(fetchValuationMetrics('2026-04-15')).resolves.toEqual([])
    })

    it('throws when valuation endpoint returns http error', async () => {
      global.fetch.mockResolvedValue(createJsonResponse(null, 502))

      await expect(fetchValuationMetrics('2026-04-15')).rejects.toThrow(
        /TWSE request failed \(502\)/
      )
    })

    it('throws timeout error when valuation fetch exceeds timeoutMs', async () => {
      global.fetch.mockImplementation((_url, { signal }) => {
        expect(signal).toBeDefined()

        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      })

      const promise = fetchValuationMetrics('2026-04-15', { timeoutMs: 8000 })
      const expectation = expect(promise).rejects.toMatchObject({
        name: 'TimeoutError',
        reason: 'timeout',
        timeoutMs: 8000,
      })
      await vi.advanceTimersByTimeAsync(8000)
      await expectation
    })
  })

  describe('fetchInstitutionalInvestors', () => {
    it('normalizes institutional rows from T86 response', async () => {
      global.fetch.mockResolvedValue(
        createJsonResponse({
          date: '20260415',
          data: [
            [
              '2330',
              '台積電',
              '1,000',
              '800',
              '200',
              '50',
              '20',
              '30',
              '300',
              '100',
              '200',
              '150',
              '60',
              '10',
              '50',
              '120',
              '20',
              '100',
              '550',
            ],
          ],
        })
      )

      await expect(fetchInstitutionalInvestors('2026-04-15')).resolves.toEqual([
        {
          code: '2330',
          name: '台積電',
          shortName: '台積電',
          date: '2026-04-15',
          foreignBuy: 1000,
          foreignSell: 800,
          foreignNet: 200,
          foreignDealerBuy: 50,
          foreignDealerSell: 20,
          foreignDealerNet: 30,
          investmentTrustBuy: 300,
          investmentTrustSell: 100,
          investmentTrustNet: 200,
          dealerNet: 150,
          dealerBuy: 180,
          dealerSell: 30,
          dealerSelfBuy: 60,
          dealerSelfSell: 10,
          dealerSelfNet: 50,
          dealerHedgeBuy: 120,
          dealerHedgeSell: 20,
          dealerHedgeNet: 100,
          totalNet: 550,
        },
      ])
    })

    it('returns an empty array when institutional payload is empty', async () => {
      global.fetch.mockResolvedValue(createJsonResponse({ date: '20260415', data: [] }))

      await expect(fetchInstitutionalInvestors('2026-04-15')).resolves.toEqual([])
    })

    it('throws when institutional endpoint returns http error', async () => {
      global.fetch.mockResolvedValue(createJsonResponse(null, 429))

      await expect(fetchInstitutionalInvestors('2026-04-15')).rejects.toThrow(
        /TWSE request failed \(429\)/
      )
    })
  })
})
