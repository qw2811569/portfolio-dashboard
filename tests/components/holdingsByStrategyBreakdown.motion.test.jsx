// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsByStrategyBreakdown from '../../src/components/overview/HoldingsByStrategyBreakdown.jsx'

describe('HoldingsByStrategyBreakdown motion', () => {
  it('uses transform-based strategy bar fills', () => {
    render(
      <HoldingsByStrategyBreakdown
        holdings={[{ code: '2330', qty: 1, price: 60, cost: 50 }]}
        totalVal={60}
        stockMeta={{ 2330: { strategy: '成長股' } }}
      />
    )

    const fill = screen.getByTestId('strategy-bar-fill')
    expect(fill).toHaveStyle({ width: '100%' })
    expect(fill.style.transform).toBe('scaleX(1)')
  })
})
