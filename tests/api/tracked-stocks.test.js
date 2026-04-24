import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const head = vi.fn()
const list = vi.fn()
const put = vi.fn()

vi.mock('@vercel/blob', () => ({
  head,
  list,
  put,
}))

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

describe('api/tracked-stocks', () => {
  const originalFetch = global.fetch
  const blobStore = new Map()
  const blobEtags = new Map()
  let etagCounter = 0

  function setBlob(key, payload) {
    etagCounter += 1
    blobStore.set(key, payload)
    blobEtags.set(key, `etag-${etagCounter}`)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'

    head.mockImplementation(async (pathname) => {
      if (!blobStore.has(pathname)) {
        const error = new Error(`blob not found: ${pathname}`)
        error.name = 'BlobNotFoundError'
        throw error
      }

      return {
        pathname,
        etag: blobEtags.get(pathname) || null,
      }
    })

    list.mockImplementation(async ({ prefix }) => {
      if (blobStore.has(prefix)) {
        return {
          blobs: [{ pathname: prefix, uploadedAt: '2026-04-19T06:00:00.000Z' }],
        }
      }
      return { blobs: [] }
    })

    put.mockImplementation(async (key, body, options = {}) => {
      const currentEtag = blobEtags.get(key) || null

      if (options.ifMatch != null) {
        if (currentEtag !== options.ifMatch) {
          const error = new Error(`etag mismatch for ${key}`)
          error.name = 'BlobPreconditionFailedError'
          throw error
        }
      } else if (currentEtag && options.allowOverwrite !== true) {
        const error = new Error(`blob already exists: ${key}`)
        error.name = 'BlobAlreadyExistsError'
        throw error
      }

      setBlob(key, JSON.parse(body))
    })

    global.fetch = vi.fn(async (input) => {
      const url = new URL(String(input))
      const pathname = url.searchParams.get('path')
      const payload = blobStore.get(pathname)

      if (!payload) {
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => 'not found',
        }
      }

      return {
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      }
    })
  })

  afterEach(() => {
    blobStore.clear()
    blobEtags.clear()
    etagCounter = 0
    global.fetch = originalFetch
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
  })

  it('keeps pid-scoped tracked stocks isolated between portfolios', async () => {
    setBlob('tracked-stocks/me/latest.json', {
      portfolioId: 'me',
      stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      lastSyncedAt: '2026-04-18T06:00:00.000Z',
    })
    setBlob('tracked-stocks/jinliancheng/latest.json', {
      portfolioId: 'jinliancheng',
      stocks: [{ code: '2454', name: '聯發科', type: '股票' }],
      lastSyncedAt: '2026-04-18T06:00:00.000Z',
    })

    const { default: handler } = await import('../../api/tracked-stocks.js')

    const meRes = createMockResponse()
    await handler(
      {
        method: 'POST',
        headers: {
          cookie: encodeClaimCookie({ userId: 'xiaokui', role: 'user' }),
          host: 'localhost:3002',
        },
        body: {
          portfolioId: 'me',
          stocks: [
            { code: '2330', name: '台積電', type: '股票' },
            { code: '2317', name: '鴻海', type: '股票' },
          ],
        },
      },
      meRes
    )

    const jinRes = createMockResponse()
    await handler(
      {
        method: 'POST',
        headers: {
          cookie: encodeClaimCookie({ userId: 'jinliancheng-chairwoman', role: 'user' }),
          host: 'localhost:3002',
        },
        body: {
          portfolioId: 'jinliancheng',
          stocks: [{ code: '2603', name: '長榮', type: '股票' }],
        },
      },
      jinRes
    )

    expect(meRes.statusCode).toBe(200)
    expect(jinRes.statusCode).toBe(200)
    expect(blobStore.get('tracked-stocks/me/latest.json')).toMatchObject({
      portfolioId: 'me',
      stocks: [
        { code: '2330', name: '台積電', type: '股票' },
        { code: '2317', name: '鴻海', type: '股票' },
      ],
    })
    expect(blobStore.get('tracked-stocks/jinliancheng/latest.json')).toMatchObject({
      portfolioId: 'jinliancheng',
      stocks: [
        { code: '2454', name: '聯發科', type: '股票' },
        { code: '2603', name: '長榮', type: '股票' },
      ],
    })
  })

  it('merges incoming stocks without duplicating existing codes', async () => {
    setBlob('tracked-stocks/me/latest.json', {
      portfolioId: 'me',
      stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      lastSyncedAt: '2026-04-18T06:00:00.000Z',
    })

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
          stocks: [
            { code: '2330', name: '台積電', type: '股票' },
            { code: '2454', name: '聯發科', type: '股票' },
          ],
        },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      updated: true,
      totalTracked: 2,
      portfolioId: 'me',
    })
    expect(blobStore.get('tracked-stocks/me/latest.json').stocks).toEqual([
      { code: '2330', name: '台積電', type: '股票' },
      { code: '2454', name: '聯發科', type: '股票' },
    ])
  })

  it('retries optimistic writes so concurrent sync requests do not drop stocks', async () => {
    const trackedKey = 'tracked-stocks/me/latest.json'
    setBlob(trackedKey, {
      portfolioId: 'me',
      stocks: [{ code: '2330', name: '台積電', type: '股票' }],
      lastSyncedAt: '2026-04-18T06:00:00.000Z',
    })

    const initialEtag = blobEtags.get(trackedKey)
    let initialPutCount = 0
    let releaseInitialWrites = null
    const initialWritesReady = new Promise((resolve) => {
      releaseInitialWrites = resolve
    })

    put.mockImplementation(async (key, body, options = {}) => {
      if (key === trackedKey && options.ifMatch === initialEtag) {
        initialPutCount += 1
        if (initialPutCount === 1) {
          await initialWritesReady
        } else {
          releaseInitialWrites()
        }
      }

      const currentEtag = blobEtags.get(key) || null
      if (options.ifMatch != null) {
        if (currentEtag !== options.ifMatch) {
          const error = new Error(`etag mismatch for ${key}`)
          error.name = 'BlobPreconditionFailedError'
          throw error
        }
      } else if (currentEtag && options.allowOverwrite !== true) {
        const error = new Error(`blob already exists: ${key}`)
        error.name = 'BlobAlreadyExistsError'
        throw error
      }

      setBlob(key, JSON.parse(body))
    })

    const { default: handler } = await import('../../api/tracked-stocks.js')
    const firstRes = createMockResponse()
    const secondRes = createMockResponse()

    await Promise.all([
      handler(
        {
          method: 'POST',
          headers: {
            cookie: encodeClaimCookie({ userId: 'xiaokui', role: 'user' }),
            host: 'localhost:3002',
          },
          body: {
            portfolioId: 'me',
            stocks: [{ code: '2317', name: '鴻海', type: '股票' }],
          },
        },
        firstRes
      ),
      handler(
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
        secondRes
      ),
    ])

    expect(firstRes.statusCode).toBe(200)
    expect(secondRes.statusCode).toBe(200)
    expect(blobStore.get(trackedKey).stocks).toHaveLength(3)
    expect(blobStore.get(trackedKey).stocks).toEqual(
      expect.arrayContaining([
        { code: '2330', name: '台積電', type: '股票' },
        { code: '2317', name: '鴻海', type: '股票' },
        { code: '2454', name: '聯發科', type: '股票' },
      ])
    )
    expect(put).toHaveBeenCalledTimes(3)
  })

  it('allows unknown pid in local dev by synthesizing a retail portfolio', async () => {
    const { default: handler } = await import('../../api/tracked-stocks.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'POST',
        headers: {
          host: 'localhost:3002',
        },
        body: {
          pid: 'ajoe734',
          stocks: [{ code: '2330', name: '台積電', type: 'listed' }],
        },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      updated: true,
      totalTracked: 1,
      portfolioId: 'ajoe734',
    })
    expect(blobStore.get('tracked-stocks/ajoe734/latest.json')).toMatchObject({
      portfolioId: 'ajoe734',
      stocks: [{ code: '2330', name: '台積電', type: 'listed' }],
    })
  })

  it('returns 401 when auth claim is missing', async () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    const { default: handler } = await import('../../api/tracked-stocks.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'POST',
        headers: { host: 'localhost:3002' },
        body: {
          portfolioId: 'me',
          stocks: [{ code: '2330', name: '台積電', type: '股票' }],
        },
      },
      res
    )

    expect(res.statusCode).toBe(401)
    expect(res.payload).toMatchObject({
      error: 'Missing or invalid auth claim',
      code: 'missing_auth_claim',
    })

    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
  })
})
