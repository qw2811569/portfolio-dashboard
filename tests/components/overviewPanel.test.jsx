// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewPanel } from '../../src/components/overview/OverviewPanel.jsx'

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function buildProps(overrides = {}) {
  return {
    portfolioCount: 2,
    totalValue: 180000,
    totalPnl: 1234,
    portfolios: [
      {
        id: 'me',
        name: '我',
        holdingCount: 3,
        pendingEvents: [{ id: 'evt-1' }, { id: 'evt-2' }],
        retPct: 5.2,
        totalPnl: 1234,
        holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
        notes: {},
      },
      {
        id: '7865',
        name: '金聯成',
        holdingCount: 2,
        pendingEventsCount: 1,
        retPct: 4.8,
        totalPnl: -320,
        holdings: [{ code: '2489', name: '瑞軒', qty: 1, cost: 50, price: 45 }],
        notes: {},
      },
    ],
    activePortfolioId: 'me',
    duplicateHoldings: [],
    pendingItems: [],
    watchlistCount: 0,
    missingTargetCount: 0,
    staleStatus: 'fresh',
    onExit: vi.fn(),
    onSwitch: vi.fn(),
    ...overrides,
  }
}

describe('components/OverviewPanel', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders numeric pending event counts and signed positive pnl text', () => {
    render(<OverviewPanel {...buildProps()} />)

    expect(screen.getByText('待處理事件 2 件', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('+1,234').length).toBeGreaterThan(0)
  })

  it('collapses the summary metrics card to one column on mobile', () => {
    mockMatchMedia(true)

    render(<OverviewPanel {...buildProps()} />)

    expect(screen.getByTestId('overview-summary-metrics-grid').style.gridTemplateColumns).toBe(
      'minmax(0, 1fr)'
    )
  })

  it('shows the panel-level skeleton when loading is true', () => {
    render(<OverviewPanel {...buildProps({ loading: true, portfolios: [] })} />)

    expect(screen.getByTestId('overview-panel-skeleton')).toBeInTheDocument()
  })

  it('renders an auditable empty state when there are no portfolios', () => {
    render(
      <OverviewPanel
        {...buildProps({
          portfolios: [],
          portfolioCount: 0,
          totalValue: 0,
          totalPnl: 0,
        })}
      />
    )

    const emptyShell = screen.getByTestId('overview-empty-state')
    expect(emptyShell).toBeInTheDocument()
    expect(emptyShell.querySelector('[data-empty-state="overview"]')).not.toBeNull()
  })

  it('renders empty state when portfolios have zero aggregated value', () => {
    render(
      <OverviewPanel
        {...buildProps({
          portfolios: [{ id: 'me', name: '我', holdings: [], notes: {} }],
          totalValue: 0,
          totalPnl: 0,
        })}
      />
    )

    expect(screen.getByTestId('overview-empty-state')).toBeInTheDocument()
  })

  // Per Codex R31-R6 critique: regression test that empty state still surfaces
  // duplicate / pending audit content when those exist (avoid silent drop on early return).
  it('keeps duplicate-holdings + pending-items audit visible inside empty state', () => {
    render(
      <OverviewPanel
        {...buildProps({
          portfolios: [],
          portfolioCount: 0,
          totalValue: 0,
          totalPnl: 0,
          duplicateHoldings: [{ code: '2330', name: '台積電', portfolios: ['me', '7865'] }],
          pendingItems: [
            {
              id: 'pending-2330',
              type: 'review',
              portfolioId: 'me',
              portfolioName: '我',
              code: '2330',
              title: '台積電法說會',
              date: '2026/04/30',
            },
          ],
        })}
      />
    )

    const emptyShell = screen.getByTestId('overview-empty-state')
    expect(emptyShell).toBeInTheDocument()
    // EmptyState resource card present
    expect(emptyShell.querySelector('[data-empty-state="overview"]')).not.toBeNull()
    // Audit content survives the early-return path
    expect(screen.getAllByText('台積電', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText('台積電法說會', { exact: false })).toBeInTheDocument()
  })
})
