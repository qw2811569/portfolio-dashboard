import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePostCloseSilentSync } from '../../src/hooks/usePostCloseSilentSync.js'

describe('hooks/usePostCloseSilentSync.js', () => {
  it('does not sync when runtime is not ready', async () => {
    const syncPostClosePrices = vi.fn().mockResolvedValue(undefined)

    renderHook(() =>
      usePostCloseSilentSync({
        ready: false,
        viewMode: 'portfolio',
        portfolioViewMode: 'portfolio',
        activePortfolioId: 'me',
        syncPostClosePrices,
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(syncPostClosePrices).not.toHaveBeenCalled()
  })

  it('syncs silently when ready and view mode matches', async () => {
    const syncPostClosePrices = vi.fn().mockResolvedValue(undefined)

    const { rerender } = renderHook((props) => usePostCloseSilentSync(props), {
      initialProps: {
        ready: true,
        viewMode: 'portfolio',
        portfolioViewMode: 'portfolio',
        activePortfolioId: 'me',
        syncPostClosePrices,
      },
    })

    await waitFor(() => {
      expect(syncPostClosePrices).toHaveBeenCalledWith({
        silent: true,
        ritualMode: 'post-close',
        reason: 'post-close-ritual',
      })
    })

    rerender({
      ready: true,
      viewMode: 'portfolio',
      portfolioViewMode: 'portfolio',
      activePortfolioId: 'p-2',
      syncPostClosePrices,
    })

    await waitFor(() => {
      expect(syncPostClosePrices).toHaveBeenCalledTimes(2)
    })
  })

  it('does not rerun the same post-close ritual twice on the same day', async () => {
    const syncPostClosePrices = vi.fn().mockResolvedValue(undefined)

    const { rerender } = renderHook((props) => usePostCloseSilentSync(props), {
      initialProps: {
        ready: true,
        viewMode: 'portfolio',
        portfolioViewMode: 'portfolio',
        activePortfolioId: 'me',
        syncPostClosePrices,
      },
    })

    await waitFor(() => {
      expect(syncPostClosePrices).toHaveBeenCalledTimes(1)
    })

    rerender({
      ready: false,
      viewMode: 'portfolio',
      portfolioViewMode: 'portfolio',
      activePortfolioId: 'me',
      syncPostClosePrices,
    })
    rerender({
      ready: true,
      viewMode: 'portfolio',
      portfolioViewMode: 'portfolio',
      activePortfolioId: 'me',
      syncPostClosePrices,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(syncPostClosePrices).toHaveBeenCalledTimes(1)
  })
})
