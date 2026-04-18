import { describe, expect, it } from 'vitest'

import {
  mapFinMindAnnouncementFallbackRows,
  normalizeAnnouncementDateInput,
  parseMopsAnnouncementHtml,
} from '../../api/mops-announcements.js'
import {
  mapFinMindRevenueFallback,
  parseMopsRevenueHtml,
  parseRevenueRowCells,
} from '../../api/mops-revenue.js'

describe('api/mops-announcements helpers', () => {
  it('accepts three date formats and normalizes to YYYYMMDD', () => {
    expect(normalizeAnnouncementDateInput('20260418')).toBe('20260418')
    expect(normalizeAnnouncementDateInput('2026-04-18')).toBe('20260418')
    expect(normalizeAnnouncementDateInput('2026/04/18')).toBe('20260418')
    expect(normalizeAnnouncementDateInput('2026-02-30')).toBeNull()
  })

  it('parses announcement rows from variable-width MOPS tables', () => {
    const html = `
      <table>
        <tr><th>公司代號</th><th>公司名稱</th><th>時間</th><th>主旨</th><th>備註</th></tr>
        <tr>
          <td>2330</td>
          <td>台積電</td>
          <td>17:30</td>
          <td>法人說明會將於 2026/04/20 召開</td>
          <td>說明營運概況</td>
        </tr>
      </table>
    `

    expect(parseMopsAnnouncementHtml(html)).toEqual([
      {
        code: '2330',
        name: '台積電',
        time: '17:30',
        title: '法人說明會將於 2026/04/20 召開',
        type: 'conference',
      },
    ])
  })

  it('maps same-day FinMind news into announcement fallback rows', () => {
    const rows = [
      {
        date: '2026-04-18',
        title: '台達電法說會將於下週舉行',
        link: 'https://example.com/news',
      },
      {
        date: '2026-04-17',
        title: '舊聞',
      },
    ]

    expect(mapFinMindAnnouncementFallbackRows(rows, { code: '2308', date: '20260418' })).toEqual([
      expect.objectContaining({
        code: '2308',
        title: '台達電法說會將於下週舉行',
        type: 'conference',
        source: 'finmind-fallback',
      }),
    ])
  })
})

describe('api/mops-revenue helpers', () => {
  it('parses the core MOPS monthly revenue columns from a company row', () => {
    const cells = [
      '2330',
      '台積電',
      '195,211,000',
      '180,000,000',
      '160,000,000',
      '8.45%',
      '22.01%',
      '520,000,000',
      '480,000,000',
      '8.33%',
    ]

    expect(parseRevenueRowCells(cells, { code: '2330' })).toEqual({
      available: true,
      code: '2330',
      name: '台積電',
      revenue: 195211000,
      revenueYoY: 22.01,
      revenueMoM: 8.45,
      cumulativeRevenue: 520000000,
      cumulativeYoY: 8.33,
    })
  })

  it('finds the matching row inside a MOPS revenue HTML table', () => {
    const html = `
      <table>
        <tr><th>公司代號</th><th>公司名稱</th></tr>
        <tr>
          <td>2308</td><td>台達電</td><td>40,000</td><td>38,000</td><td>35,000</td><td>5.26%</td><td>14.29%</td><td>120,000</td><td>108,000</td><td>11.11%</td>
        </tr>
      </table>
    `

    expect(parseMopsRevenueHtml(html, { code: '2308' })).toEqual({
      available: true,
      code: '2308',
      name: '台達電',
      revenue: 40000,
      revenueYoY: 14.29,
      revenueMoM: 5.26,
      cumulativeRevenue: 120000,
      cumulativeYoY: 11.11,
    })
  })

  it('maps raw FinMind revenue rows into the shared fallback contract', () => {
    expect(
      mapFinMindRevenueFallback(
        {
          revenue_year: 2026,
          revenue_month: 3,
          revenue: 180817000,
          revenue_year_growth_rate: -16.9,
          revenue_month_growth_rate: 68.3,
          accumulated_revenue: 288217000,
          accumulated_revenue_growth_rate: -8.5,
        },
        { year: 2026, month: 3 }
      )
    ).toEqual({
      available: true,
      revenue: 180817000,
      revenueYoY: -16.9,
      revenueMoM: 68.3,
      cumulativeRevenue: 288217000,
      cumulativeYoY: -8.5,
    })
  })
})
