import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { get, head, list, put } = vi.hoisted(() => ({
  get: vi.fn(),
  head: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  get,
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

describe('api/daily-snapshot-status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T16:00:00.000Z'))
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.BLOB_READ_WRITE_TOKEN
  })

  it('returns stale when the last success is older than 36 hours', async () => {
    get.mockResolvedValue({
      stream: new Response(
        JSON.stringify({
          job: 'daily-snapshot',
          lastSuccessAt: '2026-04-22T00:00:00.000Z',
          lastAttemptAt: '2026-04-22T00:00:00.000Z',
          lastAttemptStatus: 'success',
        })
      ).body,
    })

    const { default: handler } = await import('../../api/daily-snapshot-status.js')
    const res = createMockResponse()

    await handler({ method: 'GET', headers: {} }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      stale: true,
      badgeStatus: 'stale',
    })
  })

  it('prioritizes failed when the last attempt failed after the last success', async () => {
    get.mockResolvedValue({
      stream: new Response(
        JSON.stringify({
          job: 'daily-snapshot',
          lastSuccessAt: '2026-04-24T03:00:00.000Z',
          lastAttemptAt: '2026-04-24T04:00:00.000Z',
          lastAttemptStatus: 'failed',
        })
      ).body,
    })

    const { default: handler } = await import('../../api/daily-snapshot-status.js')
    const res = createMockResponse()

    await handler({ method: 'GET', headers: {} }, res)

    expect(res.payload).toMatchObject({
      stale: true,
      badgeStatus: 'failed',
      lastAttemptStatus: 'failed',
    })
  })

  it('returns 500 when the marker backend is unavailable', async () => {
    get.mockRejectedValue(new Error('blob down'))

    const { default: handler } = await import('../../api/daily-snapshot-status.js')
    const res = createMockResponse()

    await handler({ method: 'GET', headers: {} }, res)

    expect(res.statusCode).toBe(500)
    expect(res.payload).toMatchObject({
      ok: false,
      code: 'STORAGE_OUTAGE',
    })
  })
})
