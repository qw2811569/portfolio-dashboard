import { describe, expect, it } from 'vitest'
import {
  buildTwseBatchQueries,
  collectTrackedCodes,
  extractQuotesFromTwsePayload,
  normalizeTrackedCodes,
} from '../../src/lib/marketSyncRuntime.js'

describe('lib/marketSyncRuntime', () => {
  it('normalizes tracked codes and collects them from holdings watchlist and events', () => {
    const storage = {
      'pf-alt-holdings-v2': [{ code: '2454' }],
      'pf-alt-watchlist-v1': [{ code: '2308' }],
      'pf-alt-news-events-v1': [{ stocks: ['聯發科 2454', '台達電 2308'] }],
    }

    const codes = collectTrackedCodes({
      portfolios: [{ id: 'me' }, { id: 'alt' }],
      currentActivePortfolioId: 'me',
      currentViewMode: 'portfolio',
      liveState: {
        holdings: [{ code: '2330' }, { code: '2454' }],
        watchlist: [{ code: '3661' }],
        newsEvents: [{ stocks: ['台積電 2330', '世芯 3661'] }],
      },
      readStorageValue: (key) => storage[key] || null,
      pfKey: (pid, suffix) => `pf-${pid}-${suffix}`,
      portfolioAliasToSuffix: {
        holdings: 'holdings-v2',
        watchlist: 'watchlist-v1',
        newsEvents: 'news-events-v1',
      },
      getEventStockCodes: (event) =>
        (Array.isArray(event?.stocks) ? event.stocks : [])
          .map((item) => String(item).match(/\d+/)?.[0])
          .filter(Boolean),
      portfolioViewMode: 'portfolio',
    })

    expect(normalizeTrackedCodes(['2330', ' 2330 ', '', null, '2454'])).toEqual(['2330', '2454'])
    expect(codes.sort()).toEqual(['2308', '2330', '2454', '3661'])
    expect(buildTwseBatchQueries(['2330', '2454', '2308'], 2)).toEqual([['2330', '2454'], ['2308']])
  })

  it('extracts quote snapshots from TWSE payloads', () => {
    const extracted = extractQuotesFromTwsePayload(
      {
        msgArray: [
          { c: '2330', d: '20260328', z: '952', y: '948' },
          { c: '2454', d: '20260328', h: '1182', y: '1190' },
        ],
      },
      {
        extractBestPrice: (item) => Number(item.z || item.h || 0) || null,
        extractYesterday: (item) => Number(item.y || 0) || null,
      }
    )

    expect(extracted.marketDate).toBe('20260328')
    expect(extracted.quotes).toEqual({
      2330: expect.objectContaining({ price: 952, yesterday: 948, change: 4 }),
      2454: expect.objectContaining({ price: 1182, yesterday: 1190, change: -8 }),
    })
  })
})
