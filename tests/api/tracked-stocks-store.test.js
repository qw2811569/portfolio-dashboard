import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getTrackedStocksStorageMode,
  readTrackedStocks,
  writeTrackedStocksIfVersion,
} from '../../api/_lib/tracked-stocks-store.js'

function createBackend(overrides = {}) {
  return {
    read: vi.fn().mockResolvedValue({
      payload: {
        portfolioId: 'me',
        stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      },
      versionToken: 'version-1',
    }),
    readVersion: vi.fn().mockResolvedValue('version-1'),
    write: vi.fn().mockResolvedValue({
      versionToken: 'version-2',
    }),
    ...overrides,
  }
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return payload
    },
    end() {},
  }
}

function encodeClaimCookie(claim) {
  return `pf_auth_claim=${encodeURIComponent(JSON.stringify(claim))}`
}

describe('api/_lib/tracked-stocks-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS
    delete process.env.STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS
    delete process.env.STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    vi.clearAllMocks()
    vi.resetModules()
    vi.doUnmock('../../api/_lib/tracked-stocks-store.js')
  })

  it('supports the four cutover flag modes for primary/shadow routing', async () => {
    const cases = [
      {
        name: 'vercel-only',
        env: {
          STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS: 'vercel',
          STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS: 'false',
          STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS: 'false',
        },
        expectedMode: {
          primary: 'vercel',
          shadowRead: false,
          shadowWrite: false,
        },
        readCalls: { vercel: 1, gcs: 0 },
        shadowReadCalls: { vercel: 0, gcs: 0 },
        writeCalls: { vercel: 1, gcs: 0 },
        shadowWriteCalls: { vercelReadVersion: 0, gcsReadVersion: 0, vercelWrite: 1, gcsWrite: 0 },
      },
      {
        name: 'vercel-primary-gcs-shadow',
        env: {
          STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS: 'vercel',
          STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS: 'true',
          STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS: 'true',
        },
        expectedMode: {
          primary: 'vercel',
          shadowRead: true,
          shadowWrite: true,
        },
        readCalls: { vercel: 1, gcs: 1 },
        writeCalls: { vercel: 1, gcs: 1 },
        shadowWriteCalls: { vercelReadVersion: 0, gcsReadVersion: 1, vercelWrite: 1, gcsWrite: 1 },
      },
      {
        name: 'gcs-primary-vercel-shadow',
        env: {
          STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS: 'gcs',
          STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS: 'true',
          STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS: 'true',
        },
        expectedMode: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: true,
        },
        readCalls: { vercel: 1, gcs: 1 },
        writeCalls: { vercel: 1, gcs: 1 },
        shadowWriteCalls: { vercelReadVersion: 1, gcsReadVersion: 0, vercelWrite: 1, gcsWrite: 1 },
      },
      {
        name: 'gcs-only',
        env: {
          STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS: 'gcs',
          STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS: 'false',
          STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS: 'false',
        },
        expectedMode: {
          primary: 'gcs',
          shadowRead: false,
          shadowWrite: false,
        },
        readCalls: { vercel: 0, gcs: 1 },
        writeCalls: { vercel: 0, gcs: 1 },
        shadowWriteCalls: { vercelReadVersion: 0, gcsReadVersion: 0, vercelWrite: 0, gcsWrite: 1 },
      },
    ]

    for (const testCase of cases) {
      process.env.STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS =
        testCase.env.STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS
      process.env.STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS =
        testCase.env.STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS
      process.env.STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS =
        testCase.env.STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS

      const vercelBackend = createBackend()
      const gcsBackend = createBackend({
        read: vi.fn().mockResolvedValue({
          payload: {
            portfolioId: 'me',
            stocks: [{ code: '2330', name: '台積電', type: '股票' }],
          },
          versionToken: '123',
        }),
        readVersion: vi.fn().mockResolvedValue('123'),
        write: vi.fn().mockResolvedValue({
          versionToken: '124',
        }),
      })
      let readBackgroundPromise = Promise.resolve()
      let writeBackgroundPromise = Promise.resolve()

      expect(getTrackedStocksStorageMode()).toEqual(testCase.expectedMode)

      await readTrackedStocks('me', {
        vercelBackend,
        gcsBackend,
        logger: { warn: vi.fn() },
        appendMetricImpl: vi.fn().mockResolvedValue(undefined),
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logDir: '/tmp/test-logs',
        scheduleBackgroundTask(task) {
          readBackgroundPromise = Promise.resolve().then(task)
        },
      })
      await readBackgroundPromise

      await writeTrackedStocksIfVersion(
        'me',
        {
          portfolioId: 'me',
          stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
        },
        'version-1',
        {
          vercelBackend,
          gcsBackend,
          logger: { warn: vi.fn() },
          appendMetricImpl: vi.fn().mockResolvedValue(undefined),
          mkdirImpl: vi.fn().mockResolvedValue(undefined),
          logDir: '/tmp/test-logs',
          scheduleBackgroundTask(task) {
            writeBackgroundPromise = Promise.resolve().then(task)
          },
        }
      )
      await writeBackgroundPromise

      expect(vercelBackend.read).toHaveBeenCalledTimes(testCase.readCalls.vercel)
      expect(gcsBackend.read).toHaveBeenCalledTimes(testCase.readCalls.gcs)
      expect(vercelBackend.write).toHaveBeenCalledTimes(testCase.shadowWriteCalls.vercelWrite)
      expect(gcsBackend.write).toHaveBeenCalledTimes(testCase.shadowWriteCalls.gcsWrite)
      expect(vercelBackend.readVersion).toHaveBeenCalledTimes(
        testCase.shadowWriteCalls.vercelReadVersion
      )
      expect(gcsBackend.readVersion).toHaveBeenCalledTimes(testCase.shadowWriteCalls.gcsReadVersion)
    }
  })

  it('merges helper overrides with env policy and still fails fast on invalid env', () => {
    process.env.STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS = 'vercel'
    process.env.STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS = 'true'
    process.env.STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS = 'true'

    expect(getTrackedStocksStorageMode('gcs')).toEqual({
      primary: 'gcs',
      shadowRead: true,
      shadowWrite: true,
    })
    expect(
      getTrackedStocksStorageMode({
        shadowWrite: false,
      })
    ).toEqual({
      primary: 'vercel',
      shadowRead: true,
      shadowWrite: false,
    })

    process.env.STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS = 'vercell'
    expect(() => getTrackedStocksStorageMode()).toThrow(
      /STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS must be "vercel" or "gcs"/
    )
  })

  it('records shadow-read divergence without changing the primary read result', async () => {
    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        payload: {
          portfolioId: 'me',
          stocks: [{ code: '2330', name: '台積電', type: '股票' }],
        },
        versionToken: 'etag-1',
      }),
    })
    const gcsBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        payload: {
          portfolioId: 'me',
          stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
        },
        versionToken: '123',
      }),
    })
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const mkdirImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()

    const result = await readTrackedStocks('me', {
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: true,
        shadowWrite: false,
      },
      vercelBackend,
      gcsBackend,
      appendMetricImpl,
      mkdirImpl,
      logDir: '/tmp/test-logs',
      logger,
      now: new Date('2026-04-25T01:02:03.000Z'),
      scheduleBackgroundTask(task) {
        backgroundPromise = Promise.resolve().then(task)
      },
    })

    await backgroundPromise

    expect(result).toEqual({
      payload: {
        portfolioId: 'me',
        stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      },
      versionToken: 'etag-1',
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow read divergence for tracked-stocks/me/latest.json')
    )
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)

    const [, payload] = appendMetricImpl.mock.calls[0]
    expect(JSON.parse(payload.trim())).toMatchObject({
      keyspace: 'portfolio.tracked-stocks',
      key: 'tracked-stocks/me/latest.json',
      primary: 'vercel',
      shadow: 'gcs',
      op: 'read',
      result: 'mismatch',
      versionResult: 'payload-mismatch',
    })
  })

  it('does not block the primary CAS result on a slow shadow write', async () => {
    const deferredShadowReadVersion = createDeferred()
    const vercelBackend = createBackend({
      write: vi.fn().mockResolvedValue({
        versionToken: 'etag-2',
      }),
    })
    const gcsBackend = createBackend({
      readVersion: vi.fn().mockReturnValue(deferredShadowReadVersion.promise),
      write: vi.fn().mockResolvedValue({
        versionToken: '124',
      }),
    })
    let backgroundPromise = Promise.resolve()

    const resultPromise = writeTrackedStocksIfVersion(
      'me',
      {
        portfolioId: 'me',
        stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
      },
      'etag-1',
      {
        storagePolicyOverride: {
          primary: 'vercel',
          shadowRead: false,
          shadowWrite: true,
        },
        vercelBackend,
        gcsBackend,
        logger: { warn: vi.fn() },
        appendMetricImpl: vi.fn().mockResolvedValue(undefined),
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logDir: '/tmp/test-logs',
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )

    let settled = false
    resultPromise.then(() => {
      settled = true
    })

    await flushMicrotasks()

    expect(settled).toBe(true)
    await expect(resultPromise).resolves.toMatchObject({
      versionToken: 'etag-2',
    })

    deferredShadowReadVersion.resolve('123')
    await backgroundPromise

    expect(vercelBackend.write).toHaveBeenCalledTimes(1)
    expect(gcsBackend.readVersion).toHaveBeenCalledTimes(1)
    expect(gcsBackend.write).toHaveBeenCalledTimes(1)
  })

  it('reconciles one shadow version conflict so the secondary converges to the latest primary payload', async () => {
    const shadowState = {
      versionToken: 'etag-10',
      payload: {
        portfolioId: 'me',
        stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      },
    }
    const shadowVersionReads = ['etag-10', 'etag-10', 'etag-11']
    const vercelBackend = createBackend({
      readVersion: vi
        .fn()
        .mockImplementation(async () => shadowVersionReads.shift() || shadowState.versionToken),
      write: vi.fn().mockImplementation(async (_descriptor, payload, expectedVersionToken) => {
        if ((expectedVersionToken || null) !== shadowState.versionToken) {
          throw Object.assign(new Error('shadow conflict'), {
            code: 'VERSION_CONFLICT',
          })
        }

        shadowState.payload = payload
        shadowState.versionToken = `etag-${Number(shadowState.versionToken.split('-')[1]) + 1}`
        return {
          versionToken: shadowState.versionToken,
        }
      }),
    })
    const gcsBackend = createBackend({
      write: vi
        .fn()
        .mockResolvedValueOnce({ versionToken: '11' })
        .mockResolvedValueOnce({ versionToken: '12' }),
    })
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()

    await writeTrackedStocksIfVersion(
      'me',
      {
        portfolioId: 'me',
        stocks: [
          { code: '2330', name: '台積電', type: '股票' },
          { code: '2317', name: '鴻海', type: '股票' },
        ],
      },
      '10',
      {
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: false,
          shadowWrite: true,
        },
        vercelBackend,
        gcsBackend,
        logger,
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logDir: '/tmp/test-logs',
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )
    await backgroundPromise

    await writeTrackedStocksIfVersion(
      'me',
      {
        portfolioId: 'me',
        stocks: [
          { code: '2330', name: '台積電', type: '股票' },
          { code: '2317', name: '鴻海', type: '股票' },
          { code: '2454', name: '聯發科', type: '股票' },
        ],
      },
      '11',
      {
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: false,
          shadowWrite: true,
        },
        vercelBackend,
        gcsBackend,
        logger,
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logDir: '/tmp/test-logs',
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )
    await backgroundPromise

    expect(shadowState).toEqual({
      versionToken: 'etag-12',
      payload: {
        portfolioId: 'me',
        stocks: [
          { code: '2330', name: '台積電', type: '股票' },
          { code: '2317', name: '鴻海', type: '股票' },
          { code: '2454', name: '聯發科', type: '股票' },
        ],
      },
    })
    expect(vercelBackend.readVersion).toHaveBeenCalledTimes(3)
    expect(vercelBackend.write).toHaveBeenCalledTimes(3)
    expect(logger.warn).not.toHaveBeenCalled()
    expect(appendMetricImpl).not.toHaveBeenCalled()
  })

  it('propagates version conflicts from the primary CAS write', async () => {
    const conflict = Object.assign(new Error('precondition failed'), {
      code: 'VERSION_CONFLICT',
    })
    const gcsBackend = createBackend({
      write: vi.fn().mockRejectedValue(conflict),
    })

    await expect(
      writeTrackedStocksIfVersion(
        'me',
        {
          portfolioId: 'me',
          stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
        },
        '123',
        {
          storagePolicyOverride: {
            primary: 'gcs',
            shadowRead: false,
            shadowWrite: false,
          },
          vercelBackend: createBackend(),
          gcsBackend,
        }
      )
    ).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    })
  })

  it('retries in the caller after a first CAS conflict and succeeds on the second write', async () => {
    vi.resetModules()

    const readTrackedStocksMock = vi
      .fn()
      .mockResolvedValueOnce({
        payload: {
          portfolioId: 'me',
          stocks: [{ code: '2330', name: '台積電', type: '股票' }],
        },
        versionToken: 'v1',
      })
      .mockResolvedValueOnce({
        payload: {
          portfolioId: 'me',
          stocks: [
            { code: '2330', name: '台積電', type: '股票' },
            { code: '2317', name: '鴻海', type: '股票' },
          ],
        },
        versionToken: 'v2',
      })
    const writeTrackedStocksIfVersionMock = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('conflict'), {
          code: 'VERSION_CONFLICT',
        })
      )
      .mockResolvedValueOnce({
        versionToken: 'v3',
      })

    vi.doMock('../../api/_lib/tracked-stocks-store.js', () => ({
      readTrackedStocks: readTrackedStocksMock,
      writeTrackedStocksIfVersion: writeTrackedStocksIfVersionMock,
    }))

    const { default: handler } = await import('../../api/tracked-stocks.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'POST',
        headers: {
          cookie: encodeClaimCookie({ userId: 'xiaokui', role: 'user' }),
          host: 'localhost:3002',
        },
        body: {
          portfolioId: 'me',
          stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
        },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(readTrackedStocksMock).toHaveBeenCalledTimes(2)
    expect(writeTrackedStocksIfVersionMock).toHaveBeenCalledTimes(2)
    expect(writeTrackedStocksIfVersionMock.mock.calls[0][2]).toBe('v1')
    expect(writeTrackedStocksIfVersionMock.mock.calls[1][2]).toBe('v2')
    expect(writeTrackedStocksIfVersionMock.mock.calls[1][1]).toMatchObject({
      portfolioId: 'me',
      stocks: expect.arrayContaining([
        { code: '2330', name: '台積電', type: '股票' },
        { code: '2317', name: '鴻海', type: '股票' },
        { code: '2454', name: '聯發科', type: '股票' },
      ]),
    })
  })

  it('returns 500 after exhausting tracked-stocks CAS retries', async () => {
    vi.resetModules()

    const readTrackedStocksMock = vi
      .fn()
      .mockResolvedValueOnce({
        payload: { portfolioId: 'me', stocks: [] },
        versionToken: 'v1',
      })
      .mockResolvedValueOnce({
        payload: { portfolioId: 'me', stocks: [] },
        versionToken: 'v2',
      })
      .mockResolvedValueOnce({
        payload: { portfolioId: 'me', stocks: [] },
        versionToken: 'v3',
      })
    const writeTrackedStocksIfVersionMock = vi.fn().mockRejectedValue(
      Object.assign(new Error('conflict-after-retries'), {
        code: 'VERSION_CONFLICT',
      })
    )

    vi.doMock('../../api/_lib/tracked-stocks-store.js', () => ({
      readTrackedStocks: readTrackedStocksMock,
      writeTrackedStocksIfVersion: writeTrackedStocksIfVersionMock,
    }))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { default: handler } = await import('../../api/tracked-stocks.js')
      const res = createMockResponse()

      await handler(
        {
          method: 'POST',
          headers: {
            cookie: encodeClaimCookie({ userId: 'xiaokui', role: 'user' }),
            host: 'localhost:3002',
          },
          body: {
            portfolioId: 'me',
            stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
          },
        },
        res
      )

      expect(res.statusCode).toBe(500)
      expect(res.payload).toEqual({
        error: 'conflict-after-retries',
      })
      expect(readTrackedStocksMock).toHaveBeenCalledTimes(3)
      expect(writeTrackedStocksIfVersionMock).toHaveBeenCalledTimes(3)
    } finally {
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})
