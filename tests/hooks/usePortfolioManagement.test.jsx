// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePortfolioManagement } from '../../src/hooks/usePortfolioManagement.js'

function createDeferred() {
  let resolve
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('hooks/usePortfolioManagement', () => {
  it('replays the latest queued portfolio switch after an in-flight switch finishes', async () => {
    const flushCurrentPortfolio = vi.fn().mockResolvedValue(undefined)
    const restoreTabForPortfolio = vi.fn()
    const notifySaved = vi.fn()
    const deferredByPid = new Map()
    let hookApi = null

    const loadPortfolio = vi.fn((pid) => {
      const deferred = createDeferred()
      deferredByPid.set(pid, deferred)
      return deferred.promise.then(() => {
        hookApi?.setActivePortfolioId(pid)
      })
    })

    const { result } = renderHook(() => {
      const runtime = usePortfolioManagement({
        initialPortfolios: [
          { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' },
          { id: '7865', name: '金聯成', isOwner: false, createdAt: '2026-04-24' },
        ],
        initialActivePortfolioId: 'me',
        initialViewMode: 'portfolio',
        flushCurrentPortfolio,
        restoreTabForPortfolio,
        loadPortfolio,
        notifySaved,
      })
      hookApi = runtime
      return runtime
    })

    await act(async () => {
      void result.current.switchPortfolio('7865')
    })

    await waitFor(() => {
      expect(result.current.portfolioSwitching).toBe(true)
    })

    await act(async () => {
      void result.current.switchPortfolio('me')
    })

    expect(loadPortfolio).toHaveBeenCalledTimes(1)
    expect(loadPortfolio).toHaveBeenNthCalledWith(1, '7865', 'portfolio')

    await act(async () => {
      deferredByPid.get('7865')?.resolve()
    })

    await waitFor(() => {
      expect(loadPortfolio).toHaveBeenCalledTimes(2)
    })
    expect(loadPortfolio).toHaveBeenNthCalledWith(2, 'me', 'portfolio')

    await act(async () => {
      deferredByPid.get('me')?.resolve()
    })

    await waitFor(() => {
      expect(result.current.portfolioSwitching).toBe(false)
    })

    expect(result.current.activePortfolioId).toBe('me')
    expect(restoreTabForPortfolio).toHaveBeenNthCalledWith(1, '7865')
    expect(restoreTabForPortfolio).toHaveBeenNthCalledWith(2, 'me')
  })
})
