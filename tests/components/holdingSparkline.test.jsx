// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HoldingSparkline, {
  getHoldingSparklineTrend,
  normalizeHoldingSparklineHistory,
} from '../../src/components/holdings/HoldingSparkline.jsx'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="sparkline-container">{children}</div>,
  LineChart: ({ children, data }) => (
    <div data-testid="sparkline-chart" data-points={Array.isArray(data) ? data.length : 0}>
      {children}
    </div>
  ),
  Line: (props) => <div data-testid="sparkline-line" data-stroke={props.stroke} />,
  Tooltip: () => null,
}))

function buildHistory(values) {
  return values.map((close, index) => ({
    date: `2026-04-${String(index + 1).padStart(2, '0')}`,
    close,
  }))
}

describe('HoldingSparkline', () => {
  it('renders dash when there are fewer than five points', () => {
    render(<HoldingSparkline history={buildHistory([10, 11, 12, 13])} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByTestId('sparkline-line')).toBeNull()
  })

  it('renders a chart when there are at least five points', () => {
    render(<HoldingSparkline history={buildHistory([10, 11, 12, 13, 14, 15])} />)

    expect(screen.getByTestId('sparkline-chart')).toHaveAttribute('data-points', '6')
    expect(screen.getByTestId('sparkline-line')).toBeInTheDocument()
  })

  it('uses up color for an all-up trend', () => {
    expect(getHoldingSparklineTrend(buildHistory([10, 11, 12, 13, 14]))).toBe('var(--up)')
  })

  it('uses down color for an all-down trend', () => {
    expect(getHoldingSparklineTrend(buildHistory([14, 13, 12, 11, 10]))).toBe('var(--down)')
  })

  it('treats a flat trend as up color', () => {
    expect(getHoldingSparklineTrend(buildHistory([10, 10, 10, 10, 10]))).toBe('var(--up)')
  })

  it('normalizes alternate close field names and trims to 30 points', () => {
    const history = Array.from({ length: 35 }, (_, index) => ({
      trading_date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      close_price: index + 1,
    }))

    const normalized = normalizeHoldingSparklineHistory(history)

    expect(normalized).toHaveLength(30)
    expect(normalized[0]).toEqual({ date: '2026-03-06', close: 6 })
    expect(normalized[29]).toEqual({ date: '2026-03-35', close: 35 })
  })
})
