// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTrackedStocksSyncStatus } from '../../src/hooks/useTrackedStocksSyncStatus.js'

function writeSyncState(portfolioId, value) {
  window.localStorage.setItem(`pf-${portfolioId}-tracked-sync-v1`, JSON.stringify(value))
}

describe('hooks/useTrackedStocksSyncStatus', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('hydrates sync badge updates from storage events across tabs', () => {
    const { result } = renderHook(() => useTrackedStocksSyncStatus('me'))

    expect(result.current.syncState).toBe(null)
    expect(result.current.badge).toBe(null)

    const nextState = {
      portfolioId: 'me',
      status: 'fresh',
      lastAttemptAt: '2026-04-24T09:30:00.000+08:00',
      lastSyncedAt: '2026-04-24T09:30:00.000+08:00',
      totalTracked: 1,
      source: 'live-sync',
      lastError: '',
      errorStatus: null,
    }

    act(() => {
      writeSyncState('me', nextState)
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'pf-me-tracked-sync-v1',
          newValue: JSON.stringify(nextState),
        })
      )
    })

    expect(result.current.syncState).toMatchObject({
      portfolioId: 'me',
      status: 'fresh',
      totalTracked: 1,
    })
    expect(result.current.badge?.status).toBe('fresh')
    expect(result.current.badge?.label).toContain('last-synced')
  })
})
