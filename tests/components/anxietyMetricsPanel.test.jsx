// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnxietyMetricsPanel } from '../../src/components/overview/AnxietyMetricsPanel.jsx'
import { buildAnxietyMetrics } from '../../src/lib/anxietyMetrics.js'

const originalMatchMedia = window.matchMedia

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function buildPanelState() {
  return buildAnxietyMetrics({
    holdings: [
      { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 },
      { code: '2454', name: '聯發科', qty: 5, cost: 1200, price: 1220, value: 6100 },
    ],
    holdingDossiers: [
      {
        code: '2330',
        name: '台積電',
        thesis: {
          statement: 'AI 需求延續',
          pillars: [{ id: 'p1', text: 'CoWoS 產能續開', status: 'broken' }],
        },
        finmind: {
          institutional: [
            { date: '2026-04-24', foreign: 100, investment: 30, dealer: -10 },
            { date: '2026-04-23', foreign: -20, investment: 10, dealer: 0 },
          ],
        },
      },
    ],
    newsEvents: [
      {
        id: 'evt-1',
        title: '台積電法說',
        status: 'pending',
        eventDate: '2026-04-25',
        stocks: ['台積電 2330'],
      },
    ],
    x1Benchmark: {
      status: 'ready',
      data: {
        zScore: 1.2,
        interpretation: 'outperform',
        marketDate: '2026-04-24',
        latestPortfolioReturnPct: 1.1,
        latestBenchmarkReturnPct: 0.4,
        benchmark: { code: '0050' },
      },
    },
    now: new Date('2026-04-24T09:00:00+08:00'),
  })
}

describe('components/AnxietyMetricsPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (typeof originalMatchMedia === 'function') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    } else {
      delete window.matchMedia
    }
  })

  it('renders all five anxiety cards and supports drill + handoff', () => {
    mockMatchMedia(false)
    const onNavigate = vi.fn()

    render(<AnxietyMetricsPanel anxietyMetrics={buildPanelState()} onNavigate={onNavigate} />)

    expect(screen.getByTestId('anxiety-metrics-panel')).toBeInTheDocument()
    expect(screen.getByTestId('anxiety-metric-card-x1')).toBeInTheDocument()
    expect(screen.getByTestId('anxiety-metric-card-x2')).toBeInTheDocument()
    expect(screen.getByTestId('anxiety-metric-card-x3')).toBeInTheDocument()
    expect(screen.getByTestId('anxiety-metric-card-x4')).toBeInTheDocument()
    expect(screen.getByTestId('anxiety-metric-card-x5')).toBeInTheDocument()
    expect(screen.getByText('+1.2σ')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('anxiety-metric-toggle-x5'))

    expect(screen.getByTestId('anxiety-metric-detail-x5')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('anxiety-metric-handoff-x5'))
    expect(onNavigate).toHaveBeenCalledWith('events')
  })

  it('uses the mobile 2-column layout and lets the last card span full width', () => {
    mockMatchMedia(true)

    render(<AnxietyMetricsPanel anxietyMetrics={buildPanelState()} />)

    expect(screen.getByTestId('anxiety-metric-card-x5')).toHaveStyle({
      gridColumn: '1 / -1',
    })
  })
})
