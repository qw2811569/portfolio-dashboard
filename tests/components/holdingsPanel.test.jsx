// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HoldingsPanel } from '../../src/components/holdings/HoldingsPanel.jsx'

function buildProps(overrides = {}) {
  return {
    holdings: [],
    totalVal: 0,
    totalCost: 0,
    todayTotalPnl: 0,
    winners: [],
    losers: [],
    top5: [],
    holdingsIntegrityIssues: [],
    latestInsight: null,
    operatingContext: null,
    ...overrides,
  }
}

describe('components/HoldingsPanel', () => {
  afterEach(() => {
    cleanup()
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
})
