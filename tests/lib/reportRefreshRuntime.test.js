import { describe, expect, it } from 'vitest'
import {
  buildAnalystTargetUpserts,
  buildReportRefreshCandidates,
  buildResearchExtractRequest,
  extractStructuredResearchRefreshPlan,
  getResearchReportText,
  mergeAnalystReportBatchStore,
  mergeReportRefreshMetaStore,
} from '../../src/lib/reportRefreshRuntime.js'

describe('lib/reportRefreshRuntime', () => {
  it('extracts structured research refresh plans and research request payloads', () => {
    const plan = extractStructuredResearchRefreshPlan({
      code: '2330',
      fundamentals: { eps: 38.5 },
      targets: {
        reports: [{ firm: '外資A', target: 1180, date: '2026/03/28' }],
      },
    })
    const request = buildResearchExtractRequest({
      report: {
        name: '台積電',
        date: '2026/03/28',
        rounds: [
          { title: '產業', content: 'AI 需求持續強勁' },
          { title: '結論', content: '維持偏多' },
        ],
      },
      targetStock: { code: '2330', name: '台積電', price: 952, cost: 900, qty: 1000 },
      dossier: { code: '2330', thesis: { summary: 'AI 伺服器' } },
      todayLabel: '2026/03/28',
    })

    expect(plan).toEqual({
      code: '2330',
      fundamentals: { eps: 38.5 },
      reports: [{ firm: '外資A', target: 1180, date: '2026/03/28' }],
    })
    expect(
      getResearchReportText({
        rounds: [
          { title: '產業', content: 'AI 需求持續強勁' },
          { title: '結論', content: '維持偏多' },
        ],
      })
    ).toContain('## Round 1 產業')
    expect(request.report.text).toContain('## Round 1 產業')
    expect(request).toMatchObject({
      report: expect.objectContaining({ code: '2330', date: '2026/03/28' }),
      stock: expect.objectContaining({ code: '2330', qty: 1000 }),
      dossier: expect.objectContaining({ code: '2330' }),
    })
  })

  it('merges analyst report batches and derives target upserts', () => {
    const merged = mergeAnalystReportBatchStore(
      {
        2330: {
          items: [
            {
              id: 'old',
              title: '舊報告',
              publishedAt: '2026/03/20',
              hash: 'old',
            },
          ],
        },
      },
      '2330',
      {
        fetchedAt: '2026-03-28T00:00:00.000Z',
        items: [
          {
            id: 'new',
            title: '新報告',
            publishedAt: '2026/03/28',
            firm: '外資B',
            target: 1250,
            source: '公開來源',
            hash: 'new',
          },
        ],
      }
    )

    expect(merged.incomingItems).toHaveLength(1)
    expect(merged.nextStore['2330']).toEqual(
      expect.objectContaining({
        latestPublishedAt: '2026/03/28',
        latestTargetAt: '2026/03/28',
        lastCheckedAt: '2026-03-28T00:00:00.000Z',
      })
    )
    expect(merged.nextStore['2330'].items.map((item) => item.id)).toEqual(['new', 'old'])
    expect(
      buildAnalystTargetUpserts('2330', merged.incomingItems, { todayLabel: '2026/03/28' })
    ).toEqual([
      {
        code: '2330',
        firm: '外資B',
        target: 1250,
        date: '2026/03/28',
      },
    ])
  })

  it('updates report refresh meta for success and failure branches', () => {
    const success = mergeReportRefreshMetaStore(
      {},
      {
        code: '2330',
        todayRefreshKey: '2026/03/28',
        fetchedAt: '2026-03-28T00:00:00.000Z',
        changed: true,
        items: [{ id: 'new', hash: 'new' }],
        newCount: 1,
      }
    )
    const failed = mergeReportRefreshMetaStore(success, {
      code: '2454',
      todayRefreshKey: '2026/03/28',
      fetchedAt: '2026-03-28T01:00:00.000Z',
      errorMessage: '刷新失敗',
    })

    expect(success.__daily).toEqual(
      expect.objectContaining({
        date: '2026/03/28',
        processedCodes: ['2330'],
        runCount: 1,
      })
    )
    expect(success['2330']).toEqual(
      expect.objectContaining({
        lastStatus: 'updated',
        lastHashes: ['new'],
      })
    )
    expect(failed.__daily.processedCodes).toEqual(['2330', '2454'])
    expect(failed['2454']).toEqual(
      expect.objectContaining({
        lastStatus: 'failed',
        lastMessage: '刷新失敗',
      })
    )
  })

  it('prioritizes report refresh candidates by dossier freshness, events and size', () => {
    const candidates = buildReportRefreshCandidates({
      holdings: [
        { code: '2330', name: '台積電', qty: 1000, price: 950 },
        { code: '2454', name: '聯發科', qty: 100, price: 1200 },
        { code: '2303', name: '聯電', qty: 1000, price: 50 },
      ],
      dossierByCode: new Map([
        ['2330', { code: '2330', freshness: { targets: 'missing', analyst: 'missing' } }],
        ['2454', { code: '2454', freshness: { targets: 'stale', analyst: 'fresh' } }],
        ['2303', { code: '2303', freshness: { targets: 'fresh', analyst: 'fresh' } }],
      ]),
      reportRefreshMeta: {
        2454: { checkedDate: '2026-04-01' },
      },
      newsEvents: [
        { id: 'e1', title: '法說會', stocks: ['台積電 2330'], status: 'tracking' },
        { id: 'e2', title: '已結案', stocks: ['聯發科 2454'], status: 'closed' },
      ],
      todayRefreshKey: '2026-04-01',
      getEventStockCodes: (event) =>
        Array.isArray(event?.stocks)
          ? event.stocks.map((item) => String(item).trim().split(/\s+/).at(-1))
          : [],
      isClosedEvent: (event) => event.status === 'closed',
      getHoldingMarketValue: (holding) => Number(holding.qty || 0) * Number(holding.price || 0),
    })

    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toMatchObject({
      holding: expect.objectContaining({ code: '2330' }),
      score: 11,
      checkedToday: false,
    })
    expect(candidates[1]).toMatchObject({
      holding: expect.objectContaining({ code: '2454' }),
      score: 3,
      checkedToday: true,
    })
  })
})
