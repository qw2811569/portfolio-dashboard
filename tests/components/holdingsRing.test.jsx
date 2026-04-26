// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsRing from '../../src/components/overview/HoldingsRing.jsx'

describe('components/HoldingsRing.jsx', () => {
  it('renders first-fold holdings as strategy bars instead of ticker pie slices', () => {
    render(
      <HoldingsRing
        holdings={[
          {
            code: '2330',
            name: '台積電',
            value: 600000,
            classification: { strategy: { value: '成長股' } },
          },
          { code: '2454', name: '聯發科', value: 300000 },
          { code: '0050', name: '元大台灣50', value: 100000 },
        ]}
        stockMeta={{
          2454: { strategy: '事件驅動' },
          '0050': { strategy: 'ETF/指數' },
        }}
        totalVal={1000000}
      />
    )

    expect(screen.getByText('持倉結構')).toBeInTheDocument()
    expect(screen.getByText('成長股')).toBeInTheDocument()
    expect(screen.getByText('事件驅動')).toBeInTheDocument()
    expect(screen.getByText('ETF / 防守')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.queryByText('台積電')).not.toBeInTheDocument()
  })

  it('can read strategy classification from holding dossiers', () => {
    render(
      <HoldingsRing
        holdings={[{ code: '3037', name: '欣興', value: 100000 }]}
        holdingDossiers={[{ code: '3037', classification: { strategy: { value: '事件驅動' } } }]}
      />
    )

    expect(screen.getByText('事件驅動')).toBeInTheDocument()
    expect(screen.getByText('100.0%')).toBeInTheDocument()
  })
})
