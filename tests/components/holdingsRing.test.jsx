// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HoldingsRing from '../../src/components/overview/HoldingsRing.jsx'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => (
    <div data-testid="holdings-ring-container">{children}</div>
  ),
  PieChart: (props) => (
    <div
      data-testid="holdings-ring-pie-chart"
      data-accessibility-layer={String(props.accessibilityLayer)}
      data-aria-hidden={String(props['aria-hidden'])}
      data-tab-index={String(props.tabIndex)}
    >
      {props.children}
    </div>
  ),
  Pie: ({ children }) => <div data-testid="holdings-ring-pie">{children}</div>,
  Cell: () => <div data-testid="holdings-ring-cell" />,
}))

describe('components/HoldingsRing.jsx', () => {
  it('marks the recharts pie chart as decorative so it stays out of keyboard focus order', () => {
    render(
      <HoldingsRing
        holdings={[
          { code: '2330', name: '台積電', value: 9500 },
          { code: '2454', name: '聯發科', value: 6100 },
        ]}
        totalVal={15600}
      />
    )

    const chart = screen.getByTestId('holdings-ring-pie-chart')
    expect(chart.dataset.accessibilityLayer).toBe('false')
    expect(chart.dataset.ariaHidden).toBe('true')
    expect(chart.dataset.tabIndex).toBe('-1')
  })

  it('aggregates duplicate stock codes before rendering the legend', () => {
    render(
      <HoldingsRing
        holdings={[
          { code: '2330', name: '台積電', value: 100000 },
          { code: '2330', name: '台積電', value: 50000 },
          { code: '2454', name: '聯發科', value: 200000 },
        ]}
        totalVal={350000}
      />
    )

    expect(screen.getAllByText('2330')).toHaveLength(1)
    expect(screen.getByText('42.9%')).toBeInTheDocument()
  })
})
