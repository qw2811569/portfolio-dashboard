// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsRightRail from '../../src/components/holdings/HoldingsRightRail.jsx'

describe('components/HoldingsRightRail', () => {
  it('renders the four fixed right-rail cards for desktop holdings work', () => {
    render(
      <HoldingsRightRail
        holdings={[
          {
            code: '2308',
            name: '台達電',
            price: 96,
            targetPrice: 100,
            value: 600000,
            pct: 12,
            alert: '⚡ 法說會後確認毛利率',
          },
        ]}
        holdingDossiers={[]}
      />
    )

    expect(screen.getByTestId('holdings-right-rail')).toBeInTheDocument()
    expect(screen.getByText('心法卡摘要')).toBeInTheDocument()
    expect(screen.getByText('今天先做')).toBeInTheDocument()
    expect(screen.getByText('今天不做')).toBeInTheDocument()
    expect(screen.getByText('風險提醒')).toBeInTheDocument()
    expect(screen.getByText('法說會後確認毛利率')).toBeInTheDocument()
  })
})
