// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('shows holdings onboarding when the research tab has no holdings yet', () => {
    const { container } = render(<ResearchPanel {...buildProps()} />)
    expect(container.querySelector('[data-empty-state="holdings"]')).toBeTruthy()
    expect(container.textContent).toContain('還沒加股')
  })

  it('shows research empty state once holdings exist but no research has run yet', () => {
    const { container } = render(
      <ResearchPanel {...buildProps({ holdings: [{ code: '2330', name: '台積電' }] })} />
    )
    expect(container.querySelector('[data-empty-state="research"]')).toBeTruthy()
    expect(container.textContent).toContain('此股暫無深度研究')
  })

  it('shows skeleton loading while research history is still hydrating', () => {
    const { container } = render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          researchHistory: null,
        })}
      />
    )

    expect(container.querySelector('[data-skeleton]')).toBeTruthy()
    expect(container.textContent).toContain('研究資料整理中')
  })

  it('hides the research empty state once researchResults exists', () => {
    const results = {
      timestamp: 1,
      summary: 'AI 深度研究摘要',
      stocks: [],
    }
    const { container } = render(<ResearchPanel {...buildProps({ researchResults: results })} />)
    expect(container.querySelector('[data-empty-state="research"]')).toBeFalsy()
  })

  it('hides the research empty state if history has entries even without live results', () => {
    const history = [{ timestamp: 100, summary: 'old run', stocks: [] }]
    const { container } = render(<ResearchPanel {...buildProps({ researchHistory: history })} />)
    expect(container.querySelector('[data-empty-state="research"]')).toBeFalsy()
  })

  it('shows skeleton progress while researching is in progress', () => {
    const { container } = render(
      <ResearchPanel {...buildProps({ researching: true, researchTarget: '2330' })} />
    )
    expect(container.querySelector('[data-skeleton]')).toBeTruthy()
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

  it('shows a stale fundamentals badge when the research fundamentals data is older than 30 days', () => {
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

    const staleUpdatedAt = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()

    render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              fundamentals: { updatedAt: staleUpdatedAt },
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('research-fundamentals-stale-badge-2330')).toHaveTextContent(
      '32 天前'
    )
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
    expect(container.textContent).toContain('需要重新登入')
    expect(container.textContent).toContain('這輪卡在 台積電 (2330)')
  })

  it('renders an accuracy gate block for single-stock research when fundamentals are incomplete and keeps other sections visible', () => {
    const onResearch = vi.fn()

    render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          onResearch,
          dataRefreshRows: [
            {
              code: '2330',
              name: '台積電',
              fundamentalStatus: '缺失',
              targetStatus: '缺少',
            },
          ],
          analystReports: {
            2330: {
              items: [
                {
                  id: 'rss-1',
                  title: '研究摘要',
                  source: 'rss',
                  publishedAt: '2026-04-24',
                  summary: '公開研究摘要',
                },
              ],
            },
          },
          researchResults: {
            timestamp: 9,
            code: '2330',
            name: '台積電',
            mode: 'single',
            date: '2026-04-24',
            summary: '這裡原本有研究摘要',
            rounds: [{ title: '基本面深度分析', content: '這裡原本有逐輪內容' }],
          },
        })}
      />
    )

    expect(screen.getByTestId('accuracy-gate-block')).toHaveAttribute('data-resource', 'research')
    expect(screen.getByText('研究來源索引')).toBeInTheDocument()
    expect(screen.queryByText('這裡原本有逐輪內容')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('accuracy-gate-retry'))

    expect(onResearch).toHaveBeenCalledWith('single', { code: '2330', name: '台積電' })
  })

  it('renders FinMind degraded copy when research falls back to snapshot data', () => {
    render(
      <ResearchPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電' }],
          dataRefreshRows: [
            {
              code: '2330',
              name: '台積電',
              fundamentalStatus: 'stale',
              targetStatus: 'stale',
              degradedReason: 'quota-exceeded',
              fallbackAgeLabel: '昨天',
              staleCopy: '這裡的數字是 昨天 · 現在的盤還沒拉到。',
            },
          ],
          researchResults: {
            timestamp: 10,
            code: '2330',
            name: '台積電',
            mode: 'single',
            date: '2026-04-24',
            summary: '研究摘要',
          },
        })}
      />
    )

    expect(screen.getByTestId('accuracy-gate-block')).toHaveAttribute(
      'data-reason',
      'quota-exceeded'
    )
    expect(screen.getByText(/FinMind 額度/)).toBeInTheDocument()
    expect(screen.getByText('這裡的數字是 昨天 · 現在的盤還沒拉到。')).toBeInTheDocument()
  })
})
