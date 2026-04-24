// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsRing from '../../src/components/overview/HoldingsRing.jsx'

describe('components/HoldingsRing', () => {
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
