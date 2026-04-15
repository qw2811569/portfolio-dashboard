import { describe, expect, it } from 'vitest'

import {
  buildGoogleNewsQueries,
  buildRssUrls,
  extractExplicitTarget,
  normalizeRssItems,
  rankRssItemsForExtraction,
} from '../../api/analyst-reports.js'

describe('api/analyst-reports helpers', () => {
  it('builds 3 relaxed Google News queries with target price first', () => {
    expect(buildGoogleNewsQueries('2330', '台積電')).toEqual([
      '2330 台積電 目標價 when:30d',
      '2330 台積電 投顧 when:30d',
      '2330 台積電 研究報告 when:30d',
    ])

    const urls = buildRssUrls('2330', '台積電')
    expect(urls).toHaveLength(5)
    expect(urls.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(encodeURIComponent('2330 台積電 目標價 when:30d')),
        expect.stringContaining(encodeURIComponent('2330 台積電 投顧 when:30d')),
        expect.stringContaining(encodeURIComponent('2330 台積電 研究報告 when:30d')),
      ])
    )
  })

  it('dedupes merged RSS items by url and hash', () => {
    const xmlPayloads = [
      `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
        <item>
          <title>2330 台積電 目標價上修</title>
          <link>https://example.com/report-a</link>
          <pubDate>Tue, 15 Apr 2026 02:00:00 GMT</pubDate>
          <description>台積電目標價上修至 1200 元</description>
          <source>工商時報</source>
        </item>
      </channel></rss>`,
      `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
        <item>
          <title>2330 台積電 目標價上修</title>
          <link>https://example.com/report-a</link>
          <pubDate>Tue, 15 Apr 2026 02:00:00 GMT</pubDate>
          <description>同一篇新聞由另一條 query 打到</description>
          <source>Google News</source>
        </item>
        <item>
          <title>2330 台積電 投顧看多 AI 伺服器</title>
          <link>https://example.com/report-b</link>
          <pubDate>Tue, 15 Apr 2026 03:00:00 GMT</pubDate>
          <description>投顧維持買進</description>
          <source>經濟日報</source>
        </item>
      </channel></rss>`,
    ]

    const items = normalizeRssItems(xmlPayloads, { code: '2330', name: '台積電' })

    expect(items).toHaveLength(2)
    expect(items.map((item) => item.url)).toEqual([
      'https://example.com/report-a',
      'https://example.com/report-b',
    ])
  })

  it('prioritizes explicit target-price items ahead of generic chatter', () => {
    const items = [
      {
        id: 'social',
        title: '3167 大量 - 股市爆料同學會討論今天會不會續噴',
        snippet: '社群喊盤，沒有具體券商看法',
      },
      {
        id: 'target',
        title: '目標價上看319元！大量雙引擎全面點火',
        snippet: 'FTNN 新聞網',
      },
      {
        id: 'research',
        title: '大量法說會重點：背鑽機滿載、交期延至十月',
        snippet: '理財周刊整理法說重點',
      },
    ]

    expect(rankRssItemsForExtraction(items).map((item) => item.id)).toEqual([
      'target',
      'research',
      'social',
    ])
  })

  it('extracts only explicit target prices from real RSS-style headlines', () => {
    const fixtures = [
      'Factset 最新調查：昇達科(3491-TW)EPS預估上修至20元，預估目標價為1700元｜新聞快訊｜豐雲學堂',
      '【10:15 即時新聞】瑞軒(2489)攻上漲停42.9元，營收穩健成長題材帶動買盤迴流＋前波整理區突破引爆技術性軋空',
      '【11:53 即時新聞】鉅橡(8074)亮燈漲停至61.2元，AI伺服器高階材料營收創高＋外資與主力近期回補點火',
    ]

    const extracted = fixtures.map((headline) => extractExplicitTarget(headline))

    expect(extracted).toEqual([1700, null, null])
    expect(extracted.filter((value) => value !== null)).toHaveLength(1)
  })
})
