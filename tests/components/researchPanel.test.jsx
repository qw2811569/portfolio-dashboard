// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchPanel } from '../../src/components/research/ResearchPanel.jsx'

function buildProps(overrides = {}) {
  return {
    holdings: [],
    researching: false,
    researchTarget: '',
    reportRefreshing: false,
    reportRefreshStatus: '',
    reportRefreshMeta: {},
    dataRefreshRows: [],
    researchResults: null,
    researchHistory: [],
    analystReports: {},
    enrichingResearchCode: null,
    proposalActionId: null,
    proposalActionType: null,
    STOCK_META: {},
    IND_COLOR: {},
    operatingContext: null,
    onEvolve: vi.fn(),
    onRefresh: vi.fn(),
    onResearch: vi.fn(),
    onEnrich: vi.fn(),
    onApplyProposal: vi.fn(),
    onDiscardProposal: vi.fn(),
    onSelectHistory: vi.fn(),
    ...overrides,
  }
}

describe('components/ResearchPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // The empty-state hint lives in a div mixed with <br/> and a second text node,
  // so RTL's exact-match getByText fails. Use container.textContent instead.
  const EMPTY_HINT = '點擊上方按鈕開始第一次深度研究'

  it('shows the first-research hint when there is nothing to show yet', () => {
    const { container } = render(<ResearchPanel {...buildProps()} />)
    expect(container.textContent).toContain(EMPTY_HINT)
  })

  it('hides the first-research hint once researchResults exists', () => {
    const results = {
      timestamp: 1,
      summary: 'AI 深度研究摘要',
      stocks: [],
    }
    const { container } = render(<ResearchPanel {...buildProps({ researchResults: results })} />)
    expect(container.textContent).not.toContain(EMPTY_HINT)
  })

  it('hides the first-research hint if history has entries even without live results', () => {
    const history = [{ timestamp: 100, summary: 'old run', stocks: [] }]
    const { container } = render(<ResearchPanel {...buildProps({ researchHistory: history })} />)
    expect(container.textContent).not.toContain(EMPTY_HINT)
  })

  it('hides the first-research hint while researching is in progress', () => {
    const { container } = render(
      <ResearchPanel {...buildProps({ researching: true, researchTarget: '2330' })} />
    )
    expect(container.textContent).not.toContain(EMPTY_HINT)
  })

  it('renders the cnyes aggregate consensus card when aggregate payload exists', () => {
    const { container } = render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          analystReports: {
            2330: {
              items: [
                {
                  id: 'agg-1',
                  title: '台積電 Cnyes 目標價共識',
                  source: 'cnyes_aggregate',
                  publishedAt: '2026-04-13',
                  aggregate: {
                    medianTarget: 2352.5,
                    meanTarget: 2390.17,
                    min: 1900,
                    max: 3030,
                    firmsCount: 36,
                    rateDate: '2026-04-13',
                  },
                },
              ],
            },
          },
        })}
      />
    )

    expect(container.textContent).toContain('外資券商共識')
    expect(container.textContent).toContain('$2,352.5')
    expect(container.textContent).toContain('36 家投顧 · 2026-04-13')
    expect(container.textContent).toContain('台積電 · 2330')
  })

  it('renders source badges for non-aggregate analyst report items without duplicating the consensus item', () => {
    const { container, getAllByText, queryByText } = render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          analystReports: {
            2330: {
              items: [
                {
                  id: 'rss-1',
                  title: '外資上修台積電目標價',
                  source: 'rss',
                  publishedAt: '2026-04-15',
                  summary: '新聞整理券商最新上修觀點',
                  target: 1280,
                  targetType: 'price-target',
                  firm: '摩根士丹利',
                },
                {
                  id: 'gemini-1',
                  title: 'Gemini 整理外資觀點',
                  source: 'Morgan Stanley',
                  publishedAt: '2026-04-14',
                  summary: 'AI 搜尋整合多家公開研究結論',
                  target: 1300,
                  targetType: 'price-target',
                  firm: '摩根士丹利',
                  tags: ['gemini-merged'],
                },
                {
                  id: 'cmoney-1',
                  title: 'CMoney 投顧摘錄',
                  source: '元大投顧',
                  publishedAt: '2026-04-13',
                  summary: '投顧維持買進與目標價',
                  target: 1260,
                  targetType: 'price-target',
                  firm: '元大投顧',
                  tags: ['cmoney-merged'],
                },
                {
                  id: 'agg-1',
                  title: '台積電 Cnyes 目標價共識',
                  source: 'cnyes_aggregate',
                  publishedAt: '2026-04-13',
                  aggregate: {
                    medianTarget: 2352.5,
                    meanTarget: 2390.17,
                    min: 1900,
                    max: 3030,
                    firmsCount: 36,
                    rateDate: '2026-04-13',
                  },
                },
              ],
            },
          },
        })}
      />
    )

    expect(container.textContent).toContain('研究來源索引')
    expect(getAllByText('新聞摘錄')).toHaveLength(1)
    expect(getAllByText('AI 搜尋綜合')).toHaveLength(1)
    expect(getAllByText('CMoney 投顧')).toHaveLength(1)
    expect(getAllByText('FactSet 聚合')).toHaveLength(1)
    expect(queryByText('FactSet 共識')).toBeNull()
    expect(container.querySelectorAll('[data-source-badge]').length).toBe(3)
  })

  it('renders seasonality heatmap from cached monthly revenue below the research summary area', () => {
    const storage = new Map([
      [
        'fm-cache-revenue-2330',
        JSON.stringify({
          data: Array.from({ length: 5 }, (_, yearOffset) =>
            Array.from({ length: 12 }, (_, monthOffset) => ({
              revenueYear: 2021 + yearOffset,
              revenueMonth: monthOffset + 1,
              revenue: monthOffset >= 9 ? 220 : monthOffset <= 2 ? 55 : 100,
            }))
          ).flat(),
          ts: Date.now(),
        }),
      ],
    ])
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => storage.get(key) || null),
    })

    const { container } = render(
      <ResearchPanel {...buildProps({ holdings: [{ code: '2330', name: '台積電' }] })} />
    )

    expect(container.textContent).toContain('營收季節性')
    expect(container.textContent).toContain('12 月 × 5 年')
    expect(container.textContent).toContain('旺月：10月、11月、12月')
    expect(container.textContent).toContain('淡月：1月、2月、3月')
  })

  it('shows a seasonality empty state when monthly revenue cache is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
    })

    const { container } = render(
      <ResearchPanel {...buildProps({ holdings: [{ code: '1101', name: '台泥' }] })} />
    )

    expect(container.textContent).toContain('營收季節性')
    expect(container.textContent).toContain('台泥 · 1101')
    expect(container.textContent).toContain('資料尚未取得')
  })

  it('renders visible analyst-report error state when refresh failed with auth error', () => {
    const { container } = render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          reportRefreshMeta: {
            2330: {
              lastStatus: 'failed',
              errorStatus: 401,
              lastMessage: 'Unauthorized',
            },
          },
        })}
      />
    )

    expect(container.querySelector('[data-error="analyst-reports"]')).toBeTruthy()
    expect(container.textContent).toContain('此帳號暫無分析師報告存取權限')
    expect(container.textContent).toContain('這輪卡在 台積電 (2330)')
  })
})
