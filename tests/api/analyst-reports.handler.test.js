import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callAiRaw = vi.fn()
const callGeminiGrounded = vi.fn()
const ensureAiConfigured = vi.fn()
const extractGeminiText = vi.fn()
const collectCmoneyNotes = vi.fn()
const fetchCnyesAggregate = vi.fn()

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

vi.mock('../../api/cmoney-notes.js', async () => {
  const actual = await import('../../api/cmoney-notes.js')
  return {
    ...actual,
    collectCmoneyNotes,
  }
})

vi.mock('../../api/_lib/cnyes-target-price.js', async () => {
  const actual = await import('../../api/_lib/cnyes-target-price.js')
  return {
    ...actual,
    fetchCnyesAggregate,
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
    collectCmoneyNotes.mockResolvedValue({ reports: [], aggregate: null, source: 'cmoney' })
    fetchCnyesAggregate.mockResolvedValue({
      source: 'cnyes',
      aggregate: null,
      reason: 'no_target_data',
    })
    delete process.env.USE_GEMINI_GROUNDING
    delete process.env.USE_CMONEY_NOTES
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.USE_GEMINI_GROUNDING
    delete process.env.USE_CMONEY_NOTES
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

  it('appends cnyes aggregate into a successful RSS payload', async () => {
    extractGeminiText.mockReturnValue('{"reports":[]}')
    callAiRaw.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"items":[{"id":"rss-1","summary":"券商上修目標價","target":2288,"targetType":"price-target","targetEvidence":"目標價 2288 元","firm":"摩根士丹利","stance":"bullish","tags":["投顧"],"confidence":0.92}]}',
        },
      ],
    })
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
          <item>
            <title>2330 台積電 目標價上修至 2288 元</title>
            <link>https://example.com/rss-1</link>
            <pubDate>Wed, 15 Apr 2026 01:00:00 GMT</pubDate>
            <description>摩根士丹利看好台積電，目標價 2288 元</description>
            <source>經濟日報</source>
          </item>
        </channel></rss>`,
    })
    fetchCnyesAggregate.mockResolvedValue({
      source: 'cnyes',
      aggregate: {
        medianTarget: 2352.5,
        meanTarget: 2390.17,
        min: 1900,
        max: 3030,
        firmsCount: 36,
        numEst: 36,
        rateDate: '2026-04-13',
      },
      rawHtml: null,
    })

    const { default: handler } = await import('../../api/analyst-reports.js')
    const req = { method: 'POST', body: { code: '2330', name: '台積電' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.headers['x-target-price-source']).toBe('rss')
    expect(res.headers['x-target-price-count']).toBe('1')
    expect(res.payload).toMatchObject({
      targetPriceSource: 'rss',
      targetPriceCount: 1,
      aggregate: {
        medianTarget: 2352.5,
        firmsCount: 36,
      },
      items: [
        expect.objectContaining({
          target: 2288,
          targetType: 'price-target',
        }),
        expect.objectContaining({
          source: 'cnyes_aggregate',
          targetType: 'aggregate',
        }),
      ],
    })
  })

  it('falls back to CMoney notes when Gemini and RSS both return no target rows', async () => {
    process.env.USE_CMONEY_NOTES = '1'
    extractGeminiText.mockReturnValue('{"reports":[]}')
    callAiRaw.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"items":[{"id":"rss-1","summary":"沒有明確目標價","target":null,"targetType":"none","targetEvidence":"","firm":"","stance":"unknown","tags":["投顧"],"confidence":0.2}]}',
        },
      ],
    })
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
          <item>
            <title>3491 昇達科 法說重點</title>
            <link>https://example.com/rss-1</link>
            <pubDate>Wed, 15 Apr 2026 01:00:00 GMT</pubDate>
            <description>只有法說摘要，沒有明確目標價</description>
            <source>經濟日報</source>
          </item>
        </channel></rss>`,
    })
    collectCmoneyNotes.mockResolvedValue({
      reports: [
        {
          firm: '元大投顧',
          target: 980,
          stance: 'buy',
          date: '2026-04-15',
          source_url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=1',
          evidence: '昇達科(3491)今日僅元大投顧發布績效評等報告，評價為看多，目標價為980元。',
        },
      ],
      aggregate: null,
      source: 'cmoney',
    })

    const { default: handler } = await import('../../api/analyst-reports.js')
    const req = { method: 'POST', body: { code: '3491', name: '昇達科' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(collectCmoneyNotes).toHaveBeenCalledTimes(1)
    expect(res.headers['x-target-price-source']).toBe('cmoney')
    expect(res.headers['x-target-price-count']).toBe('1')
    expect(res.payload).toMatchObject({
      targetPriceSource: 'cmoney',
      targetPriceCount: 1,
      items: [
        expect.objectContaining({
          firm: '元大投顧',
          target: 980,
          targetType: 'price-target',
          url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=1',
        }),
      ],
    })
  })

  it('falls back to cnyes aggregate when Gemini, RSS, and CMoney have no target rows', async () => {
    process.env.USE_CMONEY_NOTES = '1'
    extractGeminiText.mockReturnValue('{"reports":[]}')
    callAiRaw.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"items":[{"id":"rss-1","summary":"沒有明確目標價","target":null,"targetType":"none","targetEvidence":"","firm":"","stance":"unknown","tags":[],"confidence":0.2}]}',
        },
      ],
    })
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
          <item>
            <title>2330 台積電 法說重點</title>
            <link>https://example.com/rss-1</link>
            <pubDate>Wed, 15 Apr 2026 01:00:00 GMT</pubDate>
            <description>只有法說摘要，沒有明確目標價</description>
            <source>經濟日報</source>
          </item>
        </channel></rss>`,
    })
    collectCmoneyNotes.mockResolvedValue({
      reports: [],
      aggregate: null,
      source: 'cmoney',
    })
    fetchCnyesAggregate.mockResolvedValue({
      source: 'cnyes',
      aggregate: {
        medianTarget: 2352.5,
        meanTarget: 2390.17,
        min: 1900,
        max: 3030,
        firmsCount: 36,
        numEst: 36,
        rateDate: '2026-04-13',
      },
      rawHtml: null,
    })

    const { default: handler } = await import('../../api/analyst-reports.js')
    const req = { method: 'POST', body: { code: '2330', name: '台積電' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(fetchCnyesAggregate).toHaveBeenCalledTimes(1)
    expect(res.headers['x-target-price-source']).toBe('cnyes')
    expect(res.headers['x-target-price-count']).toBe('0')
    expect(res.payload).toMatchObject({
      targetPriceSource: 'cnyes',
      targetPriceCount: 0,
      aggregate: {
        medianTarget: 2352.5,
        meanTarget: 2390.17,
        firmsCount: 36,
        numEst: 36,
      },
      items: [
        expect.objectContaining({
          source: 'cnyes_aggregate',
          targetType: 'aggregate',
        }),
      ],
    })
  })
})
