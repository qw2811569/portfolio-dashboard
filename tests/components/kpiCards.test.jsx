// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KpiCards } from '../../src/components/overview/KpiCards.jsx'

function buildPortfolios() {
  return [
    {
      id: 'me',
      name: '主組合',
      isOwner: true,
      holdings: [
        {
          code: '2330',
          name: '台積電',
          costBasis: 100,
          marketValue: 110,
          quantity: 1,
          buyDate: '2026-02-01',
        },
      ],
    },
  ]
}

describe('components/overview/KpiCards.jsx', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loading state while portfolio MDD is fetching', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))

    render(<KpiCards portfolios={buildPortfolios()} />)

    expect(screen.getByText('正在讀取歷史 snapshot')).toBeInTheDocument()
    expect(screen.getByLabelText('最大回撤-loading')).toBeInTheDocument()
  })

  it('renders insufficient history progress when MDD is unavailable', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          portfolioId: 'me',
          mdd: null,
          reason: 'insufficient_history',
          snapshots: 3,
          peak: null,
          trough: null,
        }),
      })
    )

    render(<KpiCards portfolios={buildPortfolios()} />)

    await screen.findByText('需要歷史 snapshot')
    expect(screen.getByText('已累積 3/7 天 snapshot，至少 7 天才顯示最大回撤')).toBeInTheDocument()
  })

  it('renders MDD value and peak/trough hover details when data exists', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          portfolioId: 'me',
          mdd: 0.124,
          snapshots: 8,
          peak: 0.18,
          trough: 0.056,
          peakDate: '2026-04-01',
          troughDate: '2026-04-08',
        }),
      })
    )

    render(<KpiCards portfolios={buildPortfolios()} />)

    const mddValue = await screen.findByText('-12.4%')
    const mddCard = mddValue.closest('[data-kpi-label="最大回撤"]')

    expect(mddValue).toBeInTheDocument()
    expect(mddCard).toHaveAttribute('title', '峰值 2026/04/01（18.0%）→ 谷底 2026/04/08（5.6%）')
  })

  it('renders error state and retries fetch when request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          portfolioId: 'me',
          mdd: null,
          reason: 'insufficient_history',
          snapshots: 4,
          peak: null,
          trough: null,
        }),
      })
    global.fetch = fetchMock

    render(<KpiCards portfolios={buildPortfolios()} />)

    await screen.findByText('無法載入')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByText('已累積 4/7 天 snapshot，至少 7 天才顯示最大回撤')).toBeInTheDocument()
  })
})
