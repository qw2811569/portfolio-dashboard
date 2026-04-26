// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TradeWizard from '../../src/components/trade/TradeWizard.jsx'
import TradeWizardStep3Preview from '../../src/components/trade/TradeWizardStep3Preview.jsx'

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

  it('blocks Step 2 advance until every unspecified trade action is explicitly confirmed', () => {
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

    const nextButton = screen.getByTestId('trade-wizard-to-preview')
    expect(screen.getByTestId('trade-action-warning')).toHaveTextContent('未指定動作')
    expect(nextButton).toBeDisabled()
    expect(nextButton).toHaveAttribute('title', '請先確認所有未指定動作的交易')

    fireEvent.change(screen.getByLabelText('第 1 筆方向'), { target: { value: '買進' } })

    expect(screen.queryByTestId('trade-action-warning')).not.toBeInTheDocument()
    expect(nextButton).toBeEnabled()
  })

  it('disables Step 3 confirm when a defensive block reason is present', () => {
    const onApply = vi.fn()

    render(
      <TradeWizardStep3Preview
        preview={{
          trades: [{ code: 'TSMC', action: '買進' }],
          changes: [
            {
              code: 'TSMC',
              name: 'TSMC',
              beforeQty: 0,
              afterQty: 100,
              beforeValue: 0,
              afterValue: 95000,
            },
          ],
        }}
        onBack={vi.fn()}
        onApply={onApply}
        blockReason="有未確認動作"
      />
    )

    expect(screen.getByTestId('trade-preview-block-reason')).toHaveTextContent('有未確認動作')
    expect(screen.getByTestId('trade-confirm-btn')).toBeDisabled()

    fireEvent.click(screen.getByTestId('trade-confirm-btn'))
    expect(onApply).not.toHaveBeenCalled()
  })

  it('disables confirm while applying after confirmed unspecified actions advance', async () => {
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
    expect(screen.getByTestId('trade-wizard-to-preview')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('第 1 筆方向'), { target: { value: '買進' } })

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
