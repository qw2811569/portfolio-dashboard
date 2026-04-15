import { describe, expect, it } from 'vitest'

import {
  buildGoogleNewsQueries,
  buildRssUrls,
  normalizeRssItems,
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
})
