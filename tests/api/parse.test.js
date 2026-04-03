import { beforeEach, describe, expect, it, vi } from 'vitest'

const callAiImage = vi.fn()
const ensureAiConfigured = vi.fn()

vi.mock('../../api/_lib/ai-provider.js', async () => {
  const actual = await import('../../api/_lib/ai-provider.js')
  return {
    ...actual,
    callAiImage,
    ensureAiConfigured,
  }
})

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

  it('passes base64 image payloads to Claude Vision and returns normalized OCR json', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    callAiImage.mockResolvedValueOnce({
      id: 'msg_parse_1',
      content: [
        {
          type: 'text',
          text: '{"tradeDate":"2026/04/02","trades":[{"action":"買進","code":"2330","name":"台積電","qty":"1000","price":"952","time":"09:01"}]}',
        },
      ],
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
        system: expect.stringContaining('parse prompt'),
        base64: 'ZmFrZS1pbWFnZQ==',
        mediaType: 'image/png',
        prompt: expect.stringContaining('股票代碼、買賣方向、價格、數量、時間'),
        maxTokens: 900,
      })
      expect(res.payload).toMatchObject({
        tradeDate: '2026/04/02',
        trades: [
          expect.objectContaining({
            action: '買進',
            code: '2330',
            name: '台積電',
            qty: 1000,
            price: 952,
            time: '09:01',
          }),
        ],
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
