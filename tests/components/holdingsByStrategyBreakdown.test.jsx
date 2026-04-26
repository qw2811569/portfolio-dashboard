// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsByStrategyBreakdown from '../../src/components/overview/HoldingsByStrategyBreakdown.jsx'
import { C } from '../../src/theme.js'

function strategyFill(row) {
  return row.querySelector('[aria-hidden="true"] > div')
}

describe('components/HoldingsByStrategyBreakdown', () => {
  it('uses cta only for the dominant strategy bar', () => {
    render(
      <HoldingsByStrategyBreakdown
        holdings={[
          { code: '2330', name: '台積電', value: 600000 },
          { code: '0050', name: '元大台灣50', value: 300000 },
          { code: '權證A', name: '權證A', value: 100000, type: '權證' },
        ]}
        stockMeta={{
          2330: { strategy: '成長股' },
          '0050': { strategy: 'ETF/指數' },
        }}
      />
    )

    const rows = screen.getAllByTestId('holdings-strategy-row')
    expect(rows).toHaveLength(3)
    expect(strategyFill(rows[0])).toHaveStyle({ background: C.cta })
    expect(strategyFill(rows[1])).toHaveStyle({ background: C.charcoal })
    expect(strategyFill(rows[2])).toHaveStyle({ background: C.charcoal })
  })

  it('highlights every strategy tied for the max value', () => {
    render(
      <HoldingsByStrategyBreakdown
        holdings={[
          { code: '2330', name: '台積電', value: 500000 },
          { code: '0050', name: '元大台灣50', value: 500000 },
        ]}
        stockMeta={{
          2330: { strategy: '成長股' },
          '0050': { strategy: 'ETF/指數' },
        }}
      />
    )

    const rows = screen.getAllByTestId('holdings-strategy-row')
    expect(rows).toHaveLength(2)
    expect(strategyFill(rows[0])).toHaveStyle({ background: C.cta })
    expect(strategyFill(rows[1])).toHaveStyle({ background: C.cta })
  })

  it('does not render any cta bar when all rows have zero value', () => {
    render(
      <HoldingsByStrategyBreakdown
        holdings={[
          { code: '2330', name: '台積電', value: 0 },
          { code: '0050', name: '元大台灣50', value: 0 },
        ]}
        stockMeta={{
          2330: { strategy: '成長股' },
          '0050': { strategy: 'ETF/指數' },
        }}
      />
    )

    expect(screen.getByText('尚無可計算市值的持倉。')).toBeInTheDocument()
    expect(screen.queryAllByTestId('holdings-strategy-row')).toEqual([])
  })
})
