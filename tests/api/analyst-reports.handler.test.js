import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callAiRaw = vi.fn()
const callGeminiGrounded = vi.fn()
const ensureAiConfigured = vi.fn()
const extractGeminiText = vi.fn()

vi.mock('../../api/_lib/ai-provider.js', async () => {
  const actual = await import('../../api/_lib/ai-provider.js')
  return {
    ...actual,
    callAiRaw,
    callGeminiGrounded,
    ensureAiConfigured,
    extractGeminiText,
  }
})

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

describe('api/analyst-reports handler', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    global.fetch = vi.fn()
    ensureAiConfigured.mockReturnValue({ provider: 'anthropic' })
    extractGeminiText.mockReturnValue('')
    delete process.env.USE_GEMINI_GROUNDING
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.USE_GEMINI_GROUNDING
  })

  it('uses grounded Gemini results when valid target rows exist', async () => {
    process.env.USE_GEMINI_GROUNDING = '1'
    extractGeminiText.mockReturnValue(
      '{"reports":[{"firm":"凱基投顧","target":1680,"stance":"outperform","date":"2026-04-15","source_url":"https://example.com/kgi","evidence":"凱基投顧給 1680 元"}]}'
    )

    const { default: handler } = await import('../../api/analyst-reports.js')
    const req = { method: 'POST', body: { code: '3491', name: '昇達科' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(callGeminiGrounded).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-target-price-source']).toBe('gemini')
    expect(res.headers['x-target-price-count']).toBe('1')
    expect(res.payload).toMatchObject({
      targetPriceSource: 'gemini',
      targetPriceCount: 1,
      items: [
        expect.objectContaining({
          firm: '凱基投顧',
          target: 1680,
          targetType: 'price-target',
          url: 'https://example.com/kgi',
        }),
      ],
    })
  })

  it('falls back to RSS extraction when grounded Gemini returns no valid rows', async () => {
    process.env.USE_GEMINI_GROUNDING = '1'
    extractGeminiText.mockReturnValue('{"reports":[]}')
    callAiRaw.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"items":[{"id":"rss-1","summary":"券商上修目標價","target":980,"targetType":"price-target","targetEvidence":"目標價 980 元","firm":"元大投顧","stance":"bullish","tags":["投顧"],"confidence":0.92}]}',
        },
      ],
    })
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
          <item>
            <title>3491 昇達科 目標價上修至 980 元</title>
            <link>https://example.com/rss-1</link>
            <pubDate>Wed, 15 Apr 2026 01:00:00 GMT</pubDate>
            <description>元大投顧看好昇達科，目標價 980 元</description>
            <source>經濟日報</source>
          </item>
        </channel></rss>`,
    })

    const { default: handler } = await import('../../api/analyst-reports.js')
    const req = { method: 'POST', body: { code: '3491', name: '昇達科' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(callGeminiGrounded).toHaveBeenCalledTimes(1)
    expect(callAiRaw).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalled()
    expect(res.headers['x-target-price-source']).toBe('rss')
    expect(res.headers['x-target-price-count']).toBe('1')
    expect(res.payload).toMatchObject({
      targetPriceSource: 'rss',
      targetPriceCount: 1,
      items: [
        expect.objectContaining({
          target: 980,
          targetType: 'price-target',
          url: 'https://example.com/rss-1',
        }),
      ],
    })
  })
})
