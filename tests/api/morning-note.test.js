import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()

vi.mock('@vercel/blob', () => ({
  get,
  put: vi.fn(),
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

function toBlobStream(payload) {
  return new Response(JSON.stringify(payload)).body
}

describe('api/morning-note', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'
  })

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
  })

  it('returns the insider snapshot when the frontend asks for 7865', async () => {
    get.mockResolvedValueOnce({
      stream: toBlobStream({
        marketDate: '2026-04-24',
        status: 'fresh',
        portfolios: {
          7865: {
            date: '2026/04/24',
            headline: '先看公開資訊節奏',
            summary: '今天以風險摘要為主。',
            staleStatus: 'fresh',
            sections: {
              todayEvents: [],
              holdingStatus: [],
              watchlistAlerts: [],
              announcements: [],
            },
          },
        },
      }),
    })

    const { default: handler } = await import('../../api/morning-note.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'GET',
        query: {
          portfolioId: '7865',
          date: '2026-04-24',
        },
        headers: {
          cookie: encodeClaimCookie({ userId: 'jinliancheng-chairwoman', role: 'user' }),
          host: 'localhost:3002',
        },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      ok: true,
      portfolioId: '7865',
      snapshotStatus: 'fresh',
      note: {
        portfolioId: '7865',
        policyId: 'jinliancheng',
        headline: '先看公開資訊節奏',
      },
    })
  })

  it('returns a renderable fallback when the snapshot is missing', async () => {
    get.mockResolvedValueOnce(null)

    const { default: handler } = await import('../../api/morning-note.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'GET',
        query: {
          portfolioId: 'me',
          date: '2026-04-26',
        },
        headers: {
          host: 'localhost:3002',
        },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      ok: false,
      portfolioId: 'me',
      snapshotStatus: 'missing',
      note: {
        portfolioId: 'me',
        staleStatus: 'missing',
        fallbackMessage: '今日無 pre-open 更新 · 請等開盤 T1',
      },
    })
  })
})
