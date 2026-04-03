import { describe, expect, it, vi } from 'vitest'
import {
  buildAnalyzeHttpError,
  parseAnalyzeJsonResponse,
  requestAnalyzeWithFallback,
} from '../../src/lib/analyzeRequest.js'

function createJsonResponse(
  payload,
  { ok = true, status = 200, contentType = 'application/json' } = {}
) {
  const bodyText = JSON.stringify(payload)
  return {
    ok,
    status,
    body: {},
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'content-type') return contentType
        return null
      },
    },
    clone() {
      return {
        text: async () => bodyText,
      }
    },
    async json() {
      return payload
    },
  }
}

describe('lib/analyzeRequest', () => {
  it('uses streaming response when SSE succeeds', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse(
        {},
        {
          contentType: 'text/event-stream; charset=utf-8',
        }
      )
    )
    const consumeStream = vi.fn(async () => '第一段分析\n第二段分析')

    const result = await requestAnalyzeWithFallback({
      requestBody: { systemPrompt: 'system', userPrompt: 'user' },
      fetchImpl,
      consumeStream,
      localRuntime: false,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(consumeStream).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      rawText: '第一段分析\n第二段分析',
      mode: 'stream',
      streamError: null,
    })
  })

  it('falls back to non-streaming JSON when streaming request fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce(
        createJsonResponse({
          content: [{ type: 'text', text: 'fallback 分析內容' }],
        })
      )
    const onFallback = vi.fn()

    const result = await requestAnalyzeWithFallback({
      requestBody: { systemPrompt: 'system', userPrompt: 'user' },
      fetchImpl,
      consumeStream: vi.fn(),
      onFallback,
      localRuntime: false,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/analyze?stream=1')
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/analyze')
    expect(onFallback).toHaveBeenCalledWith(expect.any(TypeError))
    expect(result).toMatchObject({
      rawText: 'fallback 分析內容',
      mode: 'fallback',
    })
  })

  it('converts timeout-like analyze error payloads into readable messages', async () => {
    const error = await buildAnalyzeHttpError(
      createJsonResponse(
        {
          error: 'FUNCTION_INVOCATION_TIMEOUT',
          detail: 'AI 分析逾時，請稍後再試（Vercel function timeout）',
        },
        {
          ok: false,
          status: 504,
        }
      )
    )

    expect(error.message).toContain('AI 分析逾時')
  })

  it('throws a readable error when non-streaming analyze returns invalid JSON', async () => {
    const response = {
      ok: true,
      status: 200,
      clone() {
        return {
          text: async () => 'Load failed upstream',
        }
      },
      async json() {
        throw new Error('invalid json')
      },
    }

    await expect(parseAnalyzeJsonResponse(response)).rejects.toThrow('AI 回應格式錯誤')
  })
})
