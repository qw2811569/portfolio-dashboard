import { describe, expect, it } from 'vitest'
import {
  buildAnalystTargetUpserts,
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
})
