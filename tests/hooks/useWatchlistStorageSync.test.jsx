// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWatchlistStorageSync } from '../../src/hooks/useWatchlistStorageSync.js'
import { __resetWatchlistBroadcastChannelForTests } from '../../src/lib/watchlistSync.js'

class FakeBroadcastChannel {
  static instances = []

  constructor(name) {
    this.name = name
    this.listeners = new Set()
    FakeBroadcastChannel.instances.push(this)
  }

  addEventListener(_type, listener) {
    this.listeners.add(listener)
  }

  removeEventListener(_type, listener) {
    this.listeners.delete(listener)
  }

  postMessage(payload) {
    for (const listener of this.listeners) {
      listener({ data: payload })
    }
  }
}

function installStorage(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]))

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
      setItem: vi.fn((key, value) => {
        store.set(key, String(value))
      }),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
      key: vi.fn((index) => Array.from(store.keys())[index] || null),
      get length() {
        return store.size
      },
    },
    configurable: true,
    writable: true,
  })
}

describe('hooks/useWatchlistStorageSync.js', () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = []
    __resetWatchlistBroadcastChannelForTests()
    Object.defineProperty(window, 'BroadcastChannel', {
      value: FakeBroadcastChannel,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      value: FakeBroadcastChannel,
      configurable: true,
      writable: true,
    })
    installStorage({
      'pf-me-watchlist-v1': [
        { code: '2454', name: '聯發科', price: 1250, target: 1500, status: '觀察中' },
      ],
    })
  })

  afterEach(() => {
    __resetWatchlistBroadcastChannelForTests()
    vi.restoreAllMocks()
  })

  it('applies matching storage events to the current portfolio watchlist', async () => {
    const onWatchlistSync = vi.fn()
    renderHook(() => useWatchlistStorageSync({ portfolioId: 'me', onWatchlistSync }))

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'pf-me-watchlist-v1',
        newValue: JSON.stringify([{ code: '2330', name: '台積電', status: '觀察中' }]),
      })
    )

    await waitFor(() => {
      expect(onWatchlistSync).toHaveBeenCalledWith([
        {
          code: '2330',
          name: '台積電',
          price: 0,
          target: 0,
          status: '觀察中',
          catalyst: '',
          note: '',
          scKey: 'info',
        },
      ])
    })
  })

  it('applies BroadcastChannel updates for the active portfolio', async () => {
    const onWatchlistSync = vi.fn()
    renderHook(() => useWatchlistStorageSync({ portfolioId: 'me', onWatchlistSync }))

    await waitFor(() => {
      expect(FakeBroadcastChannel.instances).toHaveLength(1)
    })

    FakeBroadcastChannel.instances[0].postMessage({
      portfolioId: 'me',
      watchlist: [{ code: '2303', name: '聯電', status: '觀察中' }],
    })

    await waitFor(() => {
      expect(onWatchlistSync).toHaveBeenCalledWith([
        {
          code: '2303',
          name: '聯電',
          price: 0,
          target: 0,
          status: '觀察中',
          catalyst: '',
          note: '',
          scKey: 'info',
        },
      ])
    })
  })
})
