import { beforeEach, describe, expect, it, vi } from 'vitest'

const put = vi.fn()
const list = vi.fn()
const del = vi.fn()
const callAiText = vi.fn()
const ensureAiConfigured = vi.fn()
const buildKnowledgeEvolutionProposal = vi.fn(() => ({
  status: 'candidate',
  summary: 'knowledge proposal',
  metrics: { adjustmentCount: 0 },
  confidenceAdjustments: [],
}))

vi.mock('@vercel/blob', () => ({
  put,
  list,
  del,
}))

vi.mock('../../api/_lib/ai-provider.js', () => ({
  callAiText,
  ensureAiConfigured,
}))

vi.mock('../../src/lib/knowledgeEvolutionRuntime.js', () => ({
  buildKnowledgeEvolutionProposal,
}))

const { default: handler } = await import('../../api/research.js')

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

describe('api/research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAiConfigured.mockReturnValue({ provider: 'anthropic' })
  })

  it('returns 400 instead of silently returning empty results for invalid requests', async () => {
    const req = {
      method: 'POST',
      body: {
        mode: 'single',
        stocks: [],
      },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.payload).toMatchObject({
      error: '深度研究缺少目標股票',
    })
  })

  it('supports legacy target-only single research requests', async () => {
    callAiText
      .mockResolvedValueOnce('round1 基本面')
      .mockResolvedValueOnce('round2 風險')
      .mockResolvedValueOnce('round3 結論')

    const req = {
      method: 'POST',
      body: {
        target: {
          code: '2308',
          name: '台達電',
          price: 380,
          cost: 350,
          qty: 10,
          pnl: 300,
          pct: 8.5,
        },
        persist: false,
      },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.results).toHaveLength(1)
    expect(res.payload.results[0]).toMatchObject({
      code: '2308',
      name: '台達電',
      mode: 'single',
      rounds: [
        expect.objectContaining({ content: 'round1 基本面' }),
        expect.objectContaining({ content: 'round2 風險' }),
        expect.objectContaining({ content: 'round3 結論' }),
      ],
    })
  })
})
