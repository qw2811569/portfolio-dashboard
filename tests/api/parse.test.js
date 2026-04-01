import { beforeEach, describe, expect, it, vi } from 'vitest'

const callAiImage = vi.fn()
const ensureAiConfigured = vi.fn()

vi.mock('../../api/_lib/ai-provider.js', () => ({
  callAiImage,
  ensureAiConfigured,
}))

const { default: handler } = await import('../../api/parse.js')

function createMockResponse() {
  const headers = {}

  return {
    headers,
    statusCode: 200,
    payload: null,
    setHeader(key, value) {
      headers[key] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return payload
    },
    end() {
      return null
    },
  }
}

describe('api/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAiConfigured.mockReturnValue({ provider: 'anthropic' })
  })

  it('passes base64 image payloads to the AI OCR adapter and logs the raw response', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    callAiImage.mockResolvedValueOnce({
      id: 'msg_parse_1',
      content: [{ type: 'text', text: '{"tradeDate":"2026/04/02","trades":[]}' }],
    })

    const req = {
      method: 'POST',
      body: {
        systemPrompt: 'parse prompt',
        base64: 'ZmFrZS1pbWFnZQ==',
        mediaType: 'image/png',
      },
    }
    const res = createMockResponse()

    try {
      await handler(req, res)

      expect(callAiImage).toHaveBeenCalledWith({
        system: 'parse prompt',
        base64: 'ZmFrZS1pbWFnZQ==',
        mediaType: 'image/png',
        prompt: '解析這張成交截圖',
        maxTokens: 600,
      })
      expect(res.payload).toMatchObject({
        id: 'msg_parse_1',
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[api/parse] OCR AI raw response:',
        expect.stringContaining('"base64Length":16')
      )
    } finally {
      consoleLogSpy.mockRestore()
    }
  })

  it('rejects parse requests without base64 image content', async () => {
    const req = {
      method: 'POST',
      body: {
        systemPrompt: 'parse prompt',
      },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(callAiImage).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(400)
    expect(res.payload).toEqual({ error: '缺少圖片內容(base64)' })
  })
})
