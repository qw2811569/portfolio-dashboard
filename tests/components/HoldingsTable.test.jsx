// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoldingsTable } from '../../src/components/holdings/HoldingsTable.jsx'

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

describe('components/HoldingsTable', () => {
  afterEach(() => {
    cleanup()
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

  it('renders a readable mobile card list instead of the compressed table grid', () => {
    mockMatchMedia(true)

    render(
      <HoldingsTable
        holdings={[
          {
            code: '2330',
            name: '台積電',
            qty: 10,
            cost: 900,
            price: 950,
            value: 9500,
            type: '股票',
          },
          {
            code: '2454',
            name: '聯發科',
            qty: 2,
            cost: 1200,
            price: 1280,
            value: 2560,
            type: '股票',
          },
        ]}
        dossierByCode={new Map()}
      />
    )

    expect(screen.getByTestId('holdings-mobile-card-list')).toBeInTheDocument()
    expect(screen.getAllByTestId('holdings-mobile-card')).toHaveLength(2)
    expect(screen.getByText('台積電')).toBeInTheDocument()
    expect(screen.getByText('聯發科')).toBeInTheDocument()
  })
})
