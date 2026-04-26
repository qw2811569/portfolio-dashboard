// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsRightRail from '../../src/components/holdings/HoldingsRightRail.jsx'
import { C } from '../../src/theme.js'

function hexToRgb(hex) {
  const normalized = String(hex).replace('#', '')
  return `rgb(${parseInt(normalized.slice(0, 2), 16)}, ${parseInt(
    normalized.slice(2, 4),
    16
  )}, ${parseInt(normalized.slice(4, 6), 16)})`
}

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
    expect(screen.getByText('心法卡摘要').closest('div[style]')).toBeTruthy()
  })

  it('differentiates the mindset quote from the only cta-bordered do card', () => {
    render(<HoldingsRightRail holdings={[]} holdingDossiers={[]} />)
    const principleCard = screen.getByText('心法卡摘要').parentElement
    const doCard = screen.getByText('今天先做').parentElement
    const dontCard = screen.getByText('今天不做').parentElement
    const riskCard = screen.getByText('風險提醒').parentElement
    const ctaBorderColor = hexToRgb(C.cta)

    expect(principleCard).toHaveStyle({ borderLeft: `3px solid ${C.charcoal}` })
    expect(doCard).toHaveStyle({ borderLeft: `3px solid ${C.cta}` })
    expect(principleCard.style.borderLeft).not.toBe(doCard.style.borderLeft)
    expect(
      [principleCard, doCard, dontCard, riskCard].filter(
        (card) => getComputedStyle(card).borderLeftColor === ctaBorderColor
      )
    ).toHaveLength(1)
    expect(principleCard.getAttribute('style')).not.toContain('undefined')
    expect(doCard.getAttribute('style')).not.toContain('undefined')
  })
})
