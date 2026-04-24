// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoldingsTable } from '../../src/components/holdings/HoldingsTable.jsx'
import { buildHoldingDetailDossier } from '../../src/lib/holdingDetailDossier.js'

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

function HoldingsTableHarness(props) {
  const [expandedStock, setExpandedStock] = useState(null)
  const [detailStockCode, setDetailStockCode] = useState(null)
  const detailDossier = buildHoldingDetailDossier({
    code: detailStockCode,
    holdings: props.holdings,
    holdingDossiers: Array.from((props.dossierByCode || new Map()).values()),
    dailyReport: props.dailyReport || null,
    analysisHistory: props.analysisHistory || [],
    researchHistory: props.researchHistory || [],
    newsEvents: props.newsEvents || [],
    strategyBrain: props.strategyBrain || null,
  })

  return (
    <HoldingsTable
      {...props}
      expandedStock={expandedStock}
      setExpandedStock={setExpandedStock}
      detailStockCode={detailStockCode}
      detailDossier={detailDossier}
      onOpenDetail={setDetailStockCode}
      onCloseDetail={() => setDetailStockCode(null)}
    />
  )
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
      <HoldingsTableHarness
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

  it('opens a quick thesis form from the row CTA and saves the minimal draft', async () => {
    mockMatchMedia(false)
    const onUpsertThesis = vi.fn(async () => ({ success: true }))

    render(
      <HoldingsTableHarness
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
        ]}
        dossierByCode={
          new Map([
            [
              '2330',
              {
                code: '2330',
                name: '台積電',
                thesis: null,
                fundamentals: { updatedAt: '2026-04-24T01:00:00.000Z' },
              },
            ],
          ])
        }
        thesisWriteEnabled
        onUpsertThesis={onUpsertThesis}
      />
    )

    fireEvent.click(screen.getByTestId('holding-write-thesis-2330'))

    expect(screen.getByTestId('holding-thesis-quick-form-2330')).toBeInTheDocument()
    expect(screen.queryByText('當初買進理由')).not.toBeInTheDocument()

    fireEvent.change(
      screen.getByPlaceholderText('核心投資邏輯，例如：月營收連續成長、新產品放量...'),
      {
        target: { value: 'AI 需求延續' },
      }
    )
    fireEvent.change(
      screen.getByPlaceholderText('破壞條件，例如：月營收轉負、毛利率下滑超過 5%...'),
      {
        target: { value: '若先進封裝需求轉弱，就重看 thesis。' },
      }
    )
    fireEvent.click(screen.getByText('存成 thesis'))

    await waitFor(() =>
      expect(onUpsertThesis).toHaveBeenCalledWith('2330', {
        reason: 'AI 需求延續',
        expectation: '',
        invalidation: '若先進封裝需求轉弱，就重看 thesis。',
      })
    )
    await waitFor(() =>
      expect(screen.queryByTestId('holding-thesis-quick-form-2330')).not.toBeInTheDocument()
    )
  })

  it('opens the detail pane and returns focus to the trigger when closed', async () => {
    mockMatchMedia(false)

    render(
      <HoldingsTableHarness
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
        ]}
        dossierByCode={
          new Map([
            [
              '2330',
              {
                code: '2330',
                name: '台積電',
                thesis: { summary: 'AI 需求延續' },
                fundamentals: { updatedAt: '2026-04-24T01:00:00.000Z' },
                freshness: { targets: 'fresh', fundamentals: 'fresh' },
              },
            ],
          ])
        }
        dailyReport={{
          date: '2026-04-24',
          changes: [{ code: '2330', price: 950, changePct: 1.2 }],
        }}
      />
    )

    const openButton = screen.getByTestId('holding-open-detail-2330')
    openButton.focus()
    fireEvent.click(openButton)

    expect(screen.getByRole('dialog', { name: '台積電' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('holding-detail-pane-close-top'))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '台積電' })).not.toBeInTheDocument()
    )
    await waitFor(() => expect(openButton).toHaveFocus())
  })

  it('closes the detail pane on Escape', async () => {
    mockMatchMedia(false)

    render(
      <HoldingsTableHarness
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
        ]}
        dossierByCode={
          new Map([
            [
              '2330',
              {
                code: '2330',
                name: '台積電',
                thesis: { summary: 'AI 需求延續' },
                fundamentals: { updatedAt: '2026-04-24T01:00:00.000Z' },
                freshness: { targets: 'fresh', fundamentals: 'fresh' },
              },
            ],
          ])
        }
      />
    )

    fireEvent.click(screen.getByTestId('holding-open-detail-2330'))
    expect(screen.getByRole('dialog', { name: '台積電' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '台積電' })).not.toBeInTheDocument()
    )
  })
})
