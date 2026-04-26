// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoldingsPanel } from '../../src/components/holdings/HoldingsPanel.jsx'

function buildProps(overrides = {}) {
  return {
    holdings: [],
    totalVal: 0,
    totalCost: 0,
    todayTotalPnl: 0,
    todayPnlHasPriceData: true,
    todayPnlIsStale: false,
    winners: [],
    losers: [],
    top5: [],
    holdingsIntegrityIssues: [],
    latestInsight: null,
    operatingContext: null,
    reportRefreshMeta: {},
    marketPriceSync: null,
    ...overrides,
  }
}

describe('components/HoldingsPanel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders without crashing when holdings is empty', () => {
    const { container } = render(<HoldingsPanel {...buildProps()} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders children passed through the slot', () => {
    render(
      <HoldingsPanel {...buildProps()}>
        <div data-testid="holdings-table-slot">table goes here</div>
      </HoldingsPanel>
    )
    expect(screen.getByTestId('holdings-table-slot')).toBeInTheDocument()
  })

  it('surfaces holdings integrity warnings when issues are present', () => {
    const issues = [{ code: '2330', name: '台積電', issue: 'price missing', severity: 'high' }]
    const { container } = render(
      <HoldingsPanel {...buildProps({ holdingsIntegrityIssues: issues })} />
    )
    // HoldingsIntegrityWarning renders when issues.length > 0; the stock code
    // should appear somewhere in the rendered output.
    expect(container.textContent).toContain('2330')
  })

  it('includes summary numbers for totals even when holdings is empty', () => {
    const { container } = render(
      <HoldingsPanel {...buildProps({ totalVal: 9876, todayTotalPnl: 42 })} />
    )
    // HoldingsSummary renders totalVal with thousands separators — check for '9,876'
    expect(container.textContent).toContain('9,876')
  })

  it('renders the home headline variant without the old command card label', () => {
    render(
      <HoldingsPanel
        {...buildProps({
          operatingContext: {
            portfolioLabel: '我的組合',
            holdingsCount: 4,
            refreshBacklogCount: 1,
            refreshBacklogItems: [{ code: '2330', name: '台積電' }],
            headline: '3 檔論述仍穩 · 1 檔接近估值上緣',
            headlineTone: 'watch',
            latestInsightSummary: '目前估值仍在追蹤區間，財報更新後會更完整。',
          },
        })}
      />
    )

    expect(screen.getByTestId('holdings-home-headline')).toHaveTextContent('接近估值上緣')
    expect(screen.queryByText('現在先看這裡')).not.toBeInTheDocument()
  })

  it('renders tracked-stocks sync badge when local sync state exists', () => {
    vi.stubGlobal('localStorage', {
      getItem(key) {
        if (key !== 'pf-me-tracked-sync-v1') return null
        return JSON.stringify({
          portfolioId: 'me',
          status: 'fresh',
          lastSyncedAt: '2026-04-19T06:00:00.000Z',
          totalTracked: 2,
          source: 'live-sync',
        })
      },
      setItem() {},
    })

    render(<HoldingsPanel {...buildProps({ activePortfolioId: 'me' })} />)
    expect(screen.getByTestId('tracked-stocks-sync-badge')).toHaveTextContent('上次同步')
  })

  it('renders target-price data error when dossier carries a target fetch failure', () => {
    const { container } = render(
      <HoldingsPanel
        {...buildProps({
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              targetFetchError: { status: 404, message: 'no target snapshot' },
            },
          ],
        })}
      />
    )

    expect(container.querySelector('[data-error="target-prices"]')).toBeTruthy()
    expect(container.textContent).toContain('無券商目標價')
  })

  it('renders an accuracy gate block when FinMind fallback is carrying holdings data', () => {
    render(
      <HoldingsPanel
        {...buildProps({
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              finmindDegraded: {
                reason: 'api-timeout',
                fallbackAgeLabel: '昨天',
              },
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('accuracy-gate-block')).toBeInTheDocument()
    expect(screen.getByTestId('accuracy-gate-block')).toHaveAttribute('data-reason', 'api-timeout')
    expect(screen.getByText(/FinMind/i)).toBeInTheDocument()
  })

  it('renders tracked-stocks auth error state when the latest sync failed', () => {
    vi.stubGlobal('localStorage', {
      getItem(key) {
        if (key !== 'pf-me-tracked-sync-v1') return null
        return JSON.stringify({
          portfolioId: 'me',
          status: 'failed',
          lastAttemptAt: '2026-04-19T06:00:00.000Z',
          lastSyncedAt: '2026-04-18T06:00:00.000Z',
          totalTracked: 2,
          source: 'live-sync',
          lastError: 'Unauthorized',
          errorStatus: 401,
        })
      },
      setItem() {},
    })

    const { container } = render(<HoldingsPanel {...buildProps({ activePortfolioId: 'me' })} />)
    expect(container.querySelector('[data-error="tracked-stocks"]')).toBeTruthy()
    expect(container.textContent).toContain('登入 session 過期')
  })

  it('collapses multiple upstream failures into one global banner', () => {
    vi.stubGlobal('localStorage', {
      getItem(key) {
        if (key !== 'pf-me-tracked-sync-v1') return null
        return JSON.stringify({
          portfolioId: 'me',
          status: 'failed',
          lastAttemptAt: '2026-04-19T06:00:00.000Z',
          lastSyncedAt: '2026-04-18T06:00:00.000Z',
          totalTracked: 2,
          source: 'live-sync',
          lastError: 'Unauthorized',
          errorStatus: 401,
        })
      },
      setItem() {},
    })

    const { container } = render(
      <HoldingsPanel
        {...buildProps({
          activePortfolioId: 'me',
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              finmindDegraded: { reason: 'auth-required' },
              targetFetchError: { status: 401, message: 'Unauthorized' },
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('upstream-health-banner')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="accuracy-gate-block"]')).toBeFalsy()
    expect(container.querySelector('[data-error="target-prices"]')).toBeFalsy()
    expect(container.querySelector('[data-error="tracked-stocks"]')).toBeFalsy()
  })

  it('renders a stale placeholder instead of 0 when today pnl has no usable price data', () => {
    render(
      <HoldingsPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          totalVal: 950,
          totalCost: 900,
          todayTotalPnl: null,
          todayPnlHasPriceData: false,
          todayPnlIsStale: true,
        })}
      />
    )

    expect(screen.getByTestId('holdings-summary-today-pnl')).toHaveTextContent('—')
  })

  it('renders the retail-intent filter bar with search and saved controls', async () => {
    render(
      <HoldingsPanel
        {...buildProps({
          holdingsFilterBar: {
            totalCount: 3,
            filteredCount: 2,
            activeFilterCount: 2,
            searchQuery: 'AI',
            debouncedSearchQuery: 'AI',
            primaryChips: [
              { key: 'attention', label: '🔥 需關注', count: 1, active: false, onClick: vi.fn() },
              { key: 'all', label: '📊 全部', count: 3, active: true, onClick: vi.fn() },
            ],
            filterGroups: [
              {
                key: 'type',
                label: '類型',
                chips: [
                  { key: 'growth', label: '成長股', count: 2, active: true, onClick: vi.fn() },
                ],
              },
            ],
            savedFilters: [{ id: 'focus', name: '法說前先看', filterState: {} }],
            activeSavedFilterId: '',
            canSaveCurrentFilter: true,
            onSearchChange: vi.fn(),
            onSaveCurrentFilter: vi.fn(() => ({ ok: true })),
            onApplySavedFilter: vi.fn(),
            onClearAll: vi.fn(),
          },
        })}
      />
    )

    fireEvent.click(screen.getByTestId('holdings-filter-expand'))

    await waitFor(() => expect(screen.getByTestId('holdings-filter-chip-bar')).toBeInTheDocument())
    expect(screen.getByTestId('holdings-filter-search')).toHaveValue('AI')
    expect(screen.getByTestId('holdings-filter-saved-select')).toBeInTheDocument()
    expect(screen.getByTestId('holdings-filter-save')).toBeInTheDocument()
    expect(screen.getByTestId('holdings-filter-type-growth')).toBeInTheDocument()
  })
})
