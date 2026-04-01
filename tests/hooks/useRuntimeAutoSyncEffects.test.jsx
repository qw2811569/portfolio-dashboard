import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePostCloseSelfHealSync } from '../../src/hooks/usePostCloseSelfHealSync.js'
import { useResearchAutoRefresh } from '../../src/hooks/useResearchAutoRefresh.js'

describe('runtime auto sync effects hooks', () => {
  it('runs post-close self-heal sync only once for the same heal key', async () => {
    const syncPostClosePrices = vi.fn().mockResolvedValue(undefined)
    const priceSelfHealRef = { current: {} }
    const baseProps = {
      ready: true,
      viewMode: 'portfolio',
      portfolioViewMode: 'portfolio',
      shouldTriggerPostCloseSelfHeal: true,
      activePortfolioId: 'me',
      todayMarketClock: {
        isWeekend: false,
        marketDate: '2026-03-30',
        minutes: 860,
      },
      priceSelfHealRef,
      syncPostClosePrices,
    }

    const { rerender } = renderHook((props) => usePostCloseSelfHealSync(props), {
      initialProps: baseProps,
    })

    await waitFor(() => {
      expect(syncPostClosePrices).toHaveBeenCalledTimes(1)
      expect(syncPostClosePrices).toHaveBeenCalledWith({ silent: true, force: true })
    })

    rerender({
      ...baseProps,
      todayMarketClock: {
        ...baseProps.todayMarketClock,
        minutes: 861,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(syncPostClosePrices).toHaveBeenCalledTimes(1)
  })

  it('auto refreshes analyst reports only when research tab is eligible', async () => {
    const refreshFn = vi.fn().mockResolvedValue(undefined)
    const refreshAnalystReportsRef = { current: refreshFn }

    const { rerender } = renderHook((props) => useResearchAutoRefresh(props), {
      initialProps: {
        ready: true,
        viewMode: 'portfolio',
        portfolioViewMode: 'portfolio',
        tab: 'holdings',
        reportRefreshing: false,
        reportRefreshMeta: {},
        todayRefreshKey: '2026-03-30',
        reportRefreshCandidates: [{ code: '2330' }],
        refreshAnalystReportsRef,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refreshFn).not.toHaveBeenCalled()

    rerender({
      ready: true,
      viewMode: 'portfolio',
      portfolioViewMode: 'portfolio',
      tab: 'research',
      reportRefreshing: false,
      reportRefreshMeta: {},
      todayRefreshKey: '2026-03-30',
      reportRefreshCandidates: [{ code: '2330' }],
      refreshAnalystReportsRef,
    })

    await waitFor(() => {
      expect(refreshFn).toHaveBeenCalledTimes(1)
      expect(refreshFn).toHaveBeenCalledWith({ silent: true })
    })

    rerender({
      ready: true,
      viewMode: 'portfolio',
      portfolioViewMode: 'portfolio',
      tab: 'research',
      reportRefreshing: false,
      reportRefreshMeta: { __daily: { date: '2026-03-30' } },
      todayRefreshKey: '2026-03-30',
      reportRefreshCandidates: [{ code: '2330' }],
      refreshAnalystReportsRef,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refreshFn).toHaveBeenCalledTimes(1)
  })
})
