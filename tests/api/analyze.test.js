import { beforeEach, describe, expect, it, vi } from 'vitest'

const callAiRaw = vi.fn()
const callAiRawStream = vi.fn()
const ensureAiConfigured = vi.fn()

vi.mock('../../api/_lib/ai-provider.js', () => ({
  callAiRaw,
  callAiRawStream,
  ensureAiConfigured,
}))

const { default: handler } = await import('../../api/analyze.js')

function createMockResponse() {
  const headers = {}
  const writes = []

  return {
    headers,
    writes,
    statusCode: 200,
    ended: false,
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
    write(chunk) {
      writes.push(String(chunk))
      return true
    },
    end(chunk = '') {
      if (chunk) writes.push(String(chunk))
      this.ended = true
    },
  }
}

describe('api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAiConfigured.mockReturnValue({ provider: 'anthropic' })
  })

  it('returns non-streaming JSON responses by default', async () => {
    callAiRaw.mockResolvedValueOnce({
      id: 'msg_1',
      content: [{ type: 'text', text: '完成分析' }],
    })

    const req = {
      method: 'POST',
      query: {},
      body: {
        systemPrompt: 'system',
        userPrompt: 'user',
      },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(callAiRaw).toHaveBeenCalledWith({
      system: 'system',
      maxTokens: 2200,
      allowThinking: false,
      messages: [{ role: 'user', content: 'user' }],
    })
    expect(res.payload).toEqual({
      id: 'msg_1',
      content: [{ type: 'text', text: '完成分析' }],
    })
  })

  it('streams text deltas when stream=1 is requested', async () => {
    callAiRawStream.mockResolvedValueOnce(
      (async function* () {
        yield { type: 'message-start', message: { id: 'msg_2', model: 'claude-sonnet' } }
        yield { type: 'text-delta', text: '第一段' }
        yield { type: 'text-delta', text: '第二段' }
      })()
    )

    const req = {
      method: 'POST',
      query: { stream: '1' },
      body: {
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 1800,
      },
    }
    const res = createMockResponse()

    await handler(req, res)

    const streamText = res.writes.join('')
    expect(callAiRawStream).toHaveBeenCalledWith({
      system: 'system',
      maxTokens: 1800,
      allowThinking: false,
      messages: [{ role: 'user', content: 'user' }],
    })
    expect(res.headers['Content-Type']).toContain('text/event-stream')
    expect(streamText).toContain('event: meta')
    expect(streamText).toContain('"model":"claude-sonnet"')
    expect(streamText).toContain('event: delta')
    expect(streamText).toContain('第一段')
    expect(streamText).toContain('第二段')
    expect(streamText).toContain('event: done')
    expect(streamText).toContain('"text":"第一段第二段"')
    expect(res.ended).toBe(true)
  })
})
