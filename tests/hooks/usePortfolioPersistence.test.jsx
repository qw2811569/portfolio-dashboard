import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalBackupWorkflow } from '../../src/hooks/useLocalBackupWorkflow.js'
import { usePortfolioPersistence } from '../../src/hooks/usePortfolioPersistence.js'

function createPersistenceProps(overrides = {}) {
  return {
    activePortfolioId: 'me',
    canPersistPortfolioData: true,
    canUseCloud: false,
    tab: 'holdings',
    holdings: null,
    tradeLog: null,
    targets: null,
    fundamentals: null,
    watchlist: null,
    analystReports: null,
    reportRefreshMeta: null,
    holdingDossiers: [],
    newsEvents: null,
    analysisHistory: null,
    dailyReport: null,
    reversalConditions: null,
    strategyBrain: null,
    brainValidation: null,
    researchHistory: null,
    portfolioNotes: null,
    marketPriceCache: { prices: {} },
    marketPriceSync: null,
    setHoldingDossiers: vi.fn(),
    setAnalysisHistory: vi.fn(),
    setResearchHistory: vi.fn(),
    setSaved: vi.fn(),
    cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
    cloudSaveTimersRef: { current: {} },
    normalizeHoldings: vi.fn((rows) => rows),
    savePortfolioData: vi.fn(),
    buildHoldingDossiers: vi.fn(() => []),
    applyMarketQuotesToHoldings: vi.fn((rows) => rows),
    normalizeHoldingDossiers: vi.fn((rows) => rows || []),
    normalizeAnalysisHistoryEntries: vi.fn((rows) => rows),
    readSyncAt: vi.fn().mockReturnValue(0),
    writeSyncAt: vi.fn(),
    ...overrides,
  }
}

describe('hooks/usePortfolioPersistence.js', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('persists holdings locally and debounces cloud save', async () => {
    vi.useFakeTimers()

    const props = createPersistenceProps({
      holdings: [{ code: '2330', name: '台積電', type: '股票', qty: 1 }],
      normalizeHoldings: vi.fn(() => [
        { code: '2330', name: '台積電', type: '股票', qty: 1, normalized: true },
      ]),
      cloudSyncStateRef: { current: { enabled: true, syncedAt: 0 } },
    })

    global.fetch = vi.fn().mockResolvedValue({})

    renderHook(() => usePortfolioPersistence(props))

    // holdings 已在 setHoldings 時 normalize，persistence effect 直接存原值
    expect(props.savePortfolioData).toHaveBeenCalledWith('me', 'holdings-v2', [
      { code: '2330', name: '台積電', type: '股票', qty: 1 },
    ])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })

    const brainCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/brain')
    const trackedStocksCalls = global.fetch.mock.calls.filter(
      ([url]) => url === '/api/tracked-stocks'
    )

    expect(trackedStocksCalls).toHaveLength(1)
    expect(trackedStocksCalls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId: 'me',
        pid: 'me',
        stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      }),
    })

    expect(brainCalls).toHaveLength(1)
    expect(brainCalls[0][1]).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-holdings',
        data: [{ code: '2330', name: '台積電', type: '股票', qty: 1 }],
      }),
    })
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-cloud-sync-at', expect.any(Number))
    expect(props.cloudSyncStateRef.current.syncedAt).toBeTypeOf('number')
  })

  it('pulls analysis history from cloud when TTL expires on daily tab', async () => {
    const props = createPersistenceProps({
      canPersistPortfolioData: false,
      canUseCloud: true,
      tab: 'daily',
      analysisHistory: [{ id: 1, date: '2026-03-26' }],
      setAnalysisHistory: vi.fn((updater) => {
        if (typeof updater === 'function') updater([{ id: 1, date: '2026-03-26' }])
      }),
      normalizeAnalysisHistoryEntries: vi.fn(() => [
        { id: 2, date: '2026-03-27', normalized: true },
      ]),
    })

    global.fetch = vi.fn(async (input) => {
      if (String(input) === '/api/brain?action=history') {
        return { json: async () => ({ history: [{ id: 2, date: '2026-03-27' }] }) }
      }
      throw new Error(`unexpected fetch: ${String(input)}`)
    })

    renderHook(() => usePortfolioPersistence(props))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/brain?action=history')
    })

    expect(props.setAnalysisHistory).toHaveBeenCalled()
    expect(props.savePortfolioData).toHaveBeenCalledWith('me', 'analysis-history-v1', [
      { id: 2, date: '2026-03-27', normalized: true },
    ])
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-analysis-cloud-sync-at', expect.any(Number))
  })

  it('pulls research history from cloud with dedupe and recency ordering', async () => {
    const props = createPersistenceProps({
      canPersistPortfolioData: false,
      canUseCloud: true,
      tab: 'research',
      researchHistory: [
        { timestamp: 3, title: 'keep-newest' },
        { timestamp: 1, title: 'old-existing' },
      ],
    })

    global.fetch = vi.fn(async (input) => {
      if (String(input) === '/api/research') {
        return {
          json: async () => ({
            reports: [
              { timestamp: 2, title: 'cloud-middle' },
              { timestamp: 1, title: 'duplicate-ignored' },
            ],
          }),
        }
      }
      throw new Error(`unexpected fetch: ${String(input)}`)
    })

    renderHook(() => usePortfolioPersistence(props))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/research')
    })

    expect(props.setResearchHistory).toHaveBeenCalledWith([
      { timestamp: 3, title: 'keep-newest' },
      { timestamp: 2, title: 'cloud-middle' },
      { timestamp: 1, title: 'old-existing' },
    ])
    expect(props.savePortfolioData).toHaveBeenCalledWith('me', 'research-history-v1', [
      { timestamp: 3, title: 'keep-newest' },
      { timestamp: 2, title: 'cloud-middle' },
      { timestamp: 1, title: 'old-existing' },
    ])
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-research-cloud-sync-at', expect.any(Number))
  })

  it('keeps local persistence healthy when cloud save fails', async () => {
    vi.useFakeTimers()

    const props = createPersistenceProps({
      holdings: [{ code: '2330', name: '台積電', type: '股票', qty: 1 }],
      normalizeHoldings: vi.fn(() => [
        { code: '2330', name: '台積電', type: '股票', qty: 1, normalized: true },
      ]),
      cloudSyncStateRef: { current: { enabled: true, syncedAt: 0 } },
    })

    global.fetch = vi.fn().mockRejectedValue(new Error('cloud down'))

    renderHook(() => usePortfolioPersistence(props))

    expect(props.savePortfolioData).toHaveBeenCalledWith('me', 'holdings-v2', [
      { code: '2330', name: '台積電', type: '股票', qty: 1 },
    ])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })

    expect(global.fetch.mock.calls.filter(([url]) => url === '/api/tracked-stocks')).toHaveLength(1)
    expect(global.fetch.mock.calls.filter(([url]) => url === '/api/brain')).toHaveLength(1)
    expect(props.writeSyncAt).not.toHaveBeenCalled()
    expect(props.cloudSyncStateRef.current.syncedAt).toBe(0)
  })

  it('cleans up pending cloud save timers on unmount', async () => {
    vi.useFakeTimers()

    const props = createPersistenceProps({
      holdings: [{ code: '2330', name: '台積電', type: '股票', qty: 1 }],
      normalizeHoldings: vi.fn(() => [
        { code: '2330', name: '台積電', type: '股票', qty: 1, normalized: true },
      ]),
      cloudSyncStateRef: { current: { enabled: true, syncedAt: 0 } },
    })

    global.fetch = vi.fn().mockResolvedValue({})

    const { unmount } = renderHook(() => usePortfolioPersistence(props))
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(props.writeSyncAt).not.toHaveBeenCalled()
  })

  it('rebuilds holding dossiers only when derived payload changes', async () => {
    const nextDossiers = [{ code: '2330', score: 80 }]
    const stableProps = createPersistenceProps({
      holdings: [{ code: '2330', qty: 1 }],
      holdingDossiers: [{ code: '2330', score: 80 }],
      buildHoldingDossiers: vi.fn(() => nextDossiers),
      normalizeHoldingDossiers: vi.fn((rows) => rows || []),
    })

    renderHook(() => usePortfolioPersistence(stableProps))
    expect(stableProps.setHoldingDossiers).not.toHaveBeenCalled()

    const changedProps = createPersistenceProps({
      holdings: [{ code: '2330', qty: 1 }],
      holdingDossiers: [{ code: '2330', score: 60 }],
      buildHoldingDossiers: vi.fn(() => nextDossiers),
      normalizeHoldingDossiers: vi.fn((rows) => rows || []),
    })

    renderHook(() => usePortfolioPersistence(changedProps))
    expect(changedProps.setHoldingDossiers).toHaveBeenCalledWith(nextDossiers)
  })

  it('ignores malformed analysis history payloads', async () => {
    const props = createPersistenceProps({
      canPersistPortfolioData: false,
      canUseCloud: true,
      tab: 'daily',
    })

    global.fetch = vi.fn(async (input) => {
      if (String(input) === '/api/brain?action=history') {
        return { json: async () => ({ history: 'oops-not-an-array' }) }
      }
      throw new Error(`unexpected fetch: ${String(input)}`)
    })

    renderHook(() => usePortfolioPersistence(props))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/brain?action=history')
    })

    expect(props.setAnalysisHistory).not.toHaveBeenCalled()
    expect(props.savePortfolioData).not.toHaveBeenCalledWith(
      'me',
      'analysis-history-v1',
      expect.anything()
    )
    expect(props.writeSyncAt).not.toHaveBeenCalledWith(
      'pf-analysis-cloud-sync-at',
      expect.any(Number)
    )
  })

  it('ignores malformed research payloads', async () => {
    const props = createPersistenceProps({
      canPersistPortfolioData: false,
      canUseCloud: true,
      tab: 'research',
      researchHistory: [{ timestamp: 1, title: 'existing' }],
    })

    global.fetch = vi.fn(async (input) => {
      if (String(input) === '/api/research') {
        return { json: async () => ({ reports: { bad: true } }) }
      }
      throw new Error(`unexpected fetch: ${String(input)}`)
    })

    renderHook(() => usePortfolioPersistence(props))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/research')
    })

    expect(props.setResearchHistory).not.toHaveBeenCalled()
    expect(props.savePortfolioData).not.toHaveBeenCalledWith(
      'me',
      'research-history-v1',
      expect.anything()
    )
    expect(props.writeSyncAt).not.toHaveBeenCalledWith(
      'pf-research-cloud-sync-at',
      expect.any(Number)
    )
  })

  it('rejects backup imports that do not carry schemaVersion', async () => {
    const requestConfirmation = vi.fn(async () => true)
    const flashSaved = vi.fn()
    const setPortfolios = vi.fn()
    const applyPortfolioSnapshot = vi.fn()

    const { result } = renderHook(() =>
      useLocalBackupWorkflow({
        portfolios: [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
        requestConfirmation,
        flashSaved,
        setPortfolios,
        applyPortfolioSnapshot,
      })
    )

    const file = new File(
      [
        JSON.stringify({
          version: 1,
          app: 'portfolio-dashboard',
          storage: {
            'pf-portfolios-v1': [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
          },
        }),
      ],
      'backup-missing-schema.json',
      { type: 'application/json' }
    )

    await act(async () => {
      await result.current.importLocalBackup({
        target: {
          files: [file],
          value: 'picked',
        },
      })
    })

    expect(requestConfirmation).toHaveBeenCalledTimes(1)
    expect(setPortfolios).not.toHaveBeenCalled()
    expect(applyPortfolioSnapshot).not.toHaveBeenCalled()
    expect(flashSaved).toHaveBeenCalledWith(
      expect.stringContaining('schemaVersion'),
      expect.any(Number)
    )
  })

  it('requires a second confirmation after backup schema validation before mutating state', async () => {
    const requestConfirmation = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const flashSaved = vi.fn()
    const setPortfolios = vi.fn()
    const applyPortfolioSnapshot = vi.fn()

    const { result } = renderHook(() =>
      useLocalBackupWorkflow({
        portfolios: [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
        requestConfirmation,
        flashSaved,
        setPortfolios,
        applyPortfolioSnapshot,
      })
    )

    const file = new File(
      [
        JSON.stringify({
          version: 1,
          app: 'portfolio-dashboard',
          storage: {
            'pf-portfolios-v1': [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
            'pf-active-portfolio-v1': 'me',
            'pf-view-mode-v1': 'portfolio',
            'pf-schema-version': 3,
            'pf-me-holdings-v2': [{ code: '2330', name: '台積電', qty: 1, cost: 950, price: 980 }],
          },
        }),
      ],
      'backup-valid.json',
      { type: 'application/json' }
    )

    await act(async () => {
      await result.current.importLocalBackup({
        target: {
          files: [file],
          value: 'picked',
        },
      })
    })

    expect(requestConfirmation).toHaveBeenCalledTimes(2)
    expect(requestConfirmation.mock.calls[1][0]).toMatchObject({
      title: '再次確認匯入內容',
      message: expect.stringContaining('schemaVersion'),
      confirmLabel: '確認匯入',
    })
    expect(setPortfolios).not.toHaveBeenCalled()
    expect(applyPortfolioSnapshot).not.toHaveBeenCalled()
    expect(flashSaved).not.toHaveBeenCalledWith(
      expect.stringContaining('已匯入'),
      expect.any(Number)
    )
  })

  it('rejects oversized backup files before schemaVersion validation runs', async () => {
    const requestConfirmation = vi.fn(async () => true)
    const flashSaved = vi.fn()
    const setPortfolios = vi.fn()
    const applyPortfolioSnapshot = vi.fn()

    const { result } = renderHook(() =>
      useLocalBackupWorkflow({
        portfolios: [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
        requestConfirmation,
        flashSaved,
        setPortfolios,
        applyPortfolioSnapshot,
      })
    )

    const oversizedBackup = new File(['x'.repeat(2 * 1024 * 1024 + 64)], 'oversized-backup.json', {
      type: 'application/json',
    })

    await act(async () => {
      await result.current.importLocalBackup({
        target: {
          files: [oversizedBackup],
          value: 'picked',
        },
      })
    })

    expect(requestConfirmation).not.toHaveBeenCalled()
    expect(setPortfolios).not.toHaveBeenCalled()
    expect(applyPortfolioSnapshot).not.toHaveBeenCalled()
    expect(flashSaved).toHaveBeenCalledWith(
      expect.stringContaining('備份檔過大'),
      expect.any(Number)
    )
  })

  it('rejects corrupt backup JSON without mutating runtime state', async () => {
    const requestConfirmation = vi.fn(async () => true)
    const flashSaved = vi.fn()
    const setPortfolios = vi.fn()
    const applyPortfolioSnapshot = vi.fn()

    const { result } = renderHook(() =>
      useLocalBackupWorkflow({
        portfolios: [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
        requestConfirmation,
        flashSaved,
        setPortfolios,
        applyPortfolioSnapshot,
      })
    )

    const corruptBackup = new File(['{"storage": invalid-json'], 'corrupt-backup.json', {
      type: 'application/json',
    })

    await act(async () => {
      await result.current.importLocalBackup({
        target: {
          files: [corruptBackup],
          value: 'picked',
        },
      })
    })

    expect(requestConfirmation).toHaveBeenCalledTimes(1)
    expect(setPortfolios).not.toHaveBeenCalled()
    expect(applyPortfolioSnapshot).not.toHaveBeenCalled()
    expect(flashSaved).toHaveBeenCalledWith(
      expect.stringContaining('JSON 格式不正確'),
      expect.any(Number)
    )
  })
})
