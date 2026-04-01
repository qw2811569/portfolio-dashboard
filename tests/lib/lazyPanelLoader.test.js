import { describe, expect, it, vi } from 'vitest'
import {
  clearLazyPanelReloadState,
  createLazyPanelLoader,
  isRecoverableLazyPanelError,
  markLazyPanelReload,
} from '../../src/lib/lazyPanelLoader.js'

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

describe('lazyPanelLoader', () => {
  it('recognizes recoverable lazy import failures', () => {
    expect(isRecoverableLazyPanelError(new TypeError('Importing a module script failed.'))).toBe(
      true
    )
    expect(
      isRecoverableLazyPanelError(new TypeError('Failed to fetch dynamically imported module'))
    ).toBe(true)
    expect(isRecoverableLazyPanelError(new Error('普通 render error'))).toBe(false)
  })

  it('reloads once on recoverable chunk errors and then clears state on success', async () => {
    const storage = createMemoryStorage()
    const reload = vi.fn()
    const captureDiagnostic = vi.fn()

    const failingLoader = createLazyPanelLoader({
      loader: async () => {
        throw new TypeError('Importing a module script failed.')
      },
      panelKey: 'daily',
      storage,
      reload,
      captureDiagnostic,
    })

    void failingLoader()
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(captureDiagnostic).toHaveBeenCalledWith(
      'lazy-panel-load',
      expect.any(TypeError),
      expect.objectContaining({ panelKey: 'daily', scope: 'daily-panel' })
    )

    const successLoader = createLazyPanelLoader({
      loader: async () => ({ DailyReportPanel: 'ok' }),
      panelKey: 'daily',
      exportName: 'DailyReportPanel',
      storage,
      reload,
      captureDiagnostic,
    })

    await expect(successLoader()).resolves.toEqual({ default: 'ok' })

    expect(markLazyPanelReload('daily', storage)).toBe(true)
    clearLazyPanelReloadState('daily', storage)
    expect(markLazyPanelReload('daily', storage)).toBe(true)
  })

  it('throws non-recoverable errors without reloading', async () => {
    const storage = createMemoryStorage()
    const reload = vi.fn()

    const loader = createLazyPanelLoader({
      loader: async () => {
        throw new Error('named export missing')
      },
      panelKey: 'news',
      storage,
      reload,
      captureDiagnostic: vi.fn(),
    })

    await expect(loader()).rejects.toThrow('named export missing')
    expect(reload).not.toHaveBeenCalled()
  })
})
