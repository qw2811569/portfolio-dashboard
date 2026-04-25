import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HoldingsPanelChunk from '../../src/components/holdings/HoldingsPanelChunk.jsx'

function buildProps(activePortfolioId, { holdings, dossiers, events } = {}) {
  const safeHoldings = Array.isArray(holdings)
    ? holdings
    : [
        {
          code: '2308',
          name: '台達電',
          qty: 2,
          cost: 1287.5,
          price: 1440,
          value: 2880,
          type: '股票',
        },
      ]
  const safeDossiers = Array.isArray(dossiers)
    ? dossiers
    : [
        {
          code: '2308',
          name: '台達電',
          stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI'] },
          thesis: {
            statement: 'AI 電源主線還在',
            pillars: [{ id: 'p1', label: 'AI 電源', status: 'on_track' }],
          },
          freshness: { fundamentals: 'fresh', targets: 'fresh' },
          position: { price: 1440 },
        },
      ]

  return {
    panelProps: {
      activePortfolioId,
      holdings: safeHoldings,
      holdingDossiers: safeDossiers,
      newsEvents: Array.isArray(events) ? events : [],
      holdingsFilterBar: null,
      operatingContext: null,
      latestInsight: null,
      reportRefreshMeta: {},
      marketPriceSync: null,
    },
    tableProps: {
      holdings: safeHoldings,
      dossierByCode: new Map(safeDossiers.map((item) => [item.code, item])),
      detailStockCode: null,
      detailDossier: null,
      onOpenDetail: () => {},
      onCloseDetail: () => {},
      setExpandedStock: () => {},
      onUpdateTarget: () => {},
      onUpdateAlert: () => {},
      onAddHoldings: null,
    },
  }
}

describe('components/HoldingsPanelChunk', () => {
  it('does not leak the previous portfolio filter into the next portfolio storage key', async () => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/portfolio/me/holdings')

    const firstRender = render(<HoldingsPanelChunk {...buildProps('me')} />)

    await waitFor(() => {
      expect(screen.getByTestId('holdings-filter-primary-all')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    await act(async () => {
      screen.getByTestId('holdings-filter-primary-attention').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('holdings-filter-primary-attention')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    await act(async () => {
      firstRender.rerender(<HoldingsPanelChunk {...buildProps('7865')} />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('holdings-filter-primary-all')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByTestId('holdings-filter-primary-attention')).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })
  })
})
