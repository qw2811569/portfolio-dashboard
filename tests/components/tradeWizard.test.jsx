// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TradeWizard from '../../src/components/trade/TradeWizard.jsx'

describe('components/TradeWizard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  })

  it('runs manual upload to parse to preview to apply', async () => {
    const setHoldings = vi.fn()
    const setTradeLog = vi.fn()

    render(
      <TradeWizard
        portfolioId="me"
        holdings={[{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 }]}
        tradeLog={[]}
        setHoldings={setHoldings}
        setTradeLog={setTradeLog}
        toSlashDate={() => '2026-04-26'}
      />
    )

    fireEvent.change(screen.getByTestId('manual-trade-code-input'), { target: { value: '2454' } })
    fireEvent.change(screen.getByTestId('manual-trade-name-input'), { target: { value: '聯發科' } })
    fireEvent.change(screen.getByTestId('manual-trade-qty-input'), { target: { value: '2' } })
    fireEvent.change(screen.getByTestId('manual-trade-price-input'), { target: { value: '1250' } })
    fireEvent.click(screen.getByTestId('manual-trade-submit-btn'))

    expect(screen.getByTestId('trade-parse-results')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('trade-wizard-to-preview'))

    expect(screen.getByTestId('trade-preview-panel')).toBeInTheDocument()
    expect(screen.getByText('聯發科')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('trade-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('trade-wizard-applied')).toBeInTheDocument()
    })
    expect(setHoldings).toHaveBeenCalled()
    expect(setTradeLog).toHaveBeenCalled()
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'pf-me-log-v2',
      expect.stringContaining('2454')
    )
  })

  it('warns on unspecified trade actions and disables confirm while applying', async () => {
    let resolveAudit
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveAudit = () => resolve({ ok: true, json: () => Promise.resolve({}) })
        })
    )

    render(
      <TradeWizard
        portfolioId="me"
        holdings={[{ code: 'TSMC', name: 'TSMC', qty: 10, cost: 900, price: 950, value: 9500 }]}
        tradeLog={[]}
        setHoldings={vi.fn()}
        setTradeLog={vi.fn()}
        toSlashDate={() => '2026-04-26'}
      />
    )

    fireEvent.change(screen.getByTestId('trade-wizard-text-input'), {
      target: { value: 'TSMC 100 @ 950' },
    })
    fireEvent.click(screen.getByTestId('trade-wizard-parse-text-btn'))

    expect(screen.getByTestId('trade-action-warning')).toHaveTextContent('未指定動作')

    fireEvent.click(screen.getByTestId('trade-wizard-to-preview'))
    fireEvent.click(screen.getByTestId('trade-confirm-btn'))

    expect(screen.getByTestId('trade-confirm-btn')).toBeDisabled()
    expect(screen.getByTestId('trade-confirm-btn')).toHaveAttribute('data-applying', 'true')

    resolveAudit()
    await waitFor(() => {
      expect(screen.getByTestId('trade-wizard-applied')).toBeInTheDocument()
    })
  })
})
