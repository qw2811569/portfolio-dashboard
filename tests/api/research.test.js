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
    delete process.env.VERCEL_ENV
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

  it('uses a single fast round outside production and includes knowledge/finmind context', async () => {
    callAiText.mockResolvedValueOnce('single pass 結論')

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
        holdingDossiers: [
          {
            code: '2308',
            name: '台達電',
            position: { qty: 10, cost: 350, price: 380, pnl: 300, pct: 8.5, type: 'stock' },
            stockMeta: { strategy: '成長股', industry: '電源管理' },
            fundamentals: { revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3, eps: 4.2 },
            finmind: {
              institutional: [{ foreign: 100, investment: 10, dealer: -5 }],
              valuation: [{ per: 18.2, pbr: 3.1 }],
              margin: [{ marginBalance: 1200 }, { marginBalance: 1180 }],
              revenue: [{ revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3 }],
              balanceSheet: [{ totalAssets: 120000, totalLiabilities: 52000, debtRatio: 43.3 }],
              cashFlow: [{ operatingCF: 18000, investingCF: -3200, financingCF: -1400 }],
              shareholding: [{ foreignShareRatio: 61.5 }, { foreignShareRatio: 61.1 }],
            },
          },
        ],
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
      roundMode: 'local-fast',
      rounds: [expect.objectContaining({ content: 'single pass 結論' })],
    })
    expect(callAiText).toHaveBeenCalledTimes(1)
    const [{ user }] = callAiText.mock.calls[0]
    expect(user).toContain('知識庫參考')
    expect(user).toContain('月營收')
    expect(user).toContain('資產負債表')
    expect(user).toContain('現金流量表')
    expect(user).toContain('外資持股比')
  })

  it('keeps the full three-round flow in production', async () => {
    process.env.VERCEL_ENV = 'production'
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

    expect(callAiText).toHaveBeenCalledTimes(3)
    expect(res.payload.results[0]).toMatchObject({
      roundMode: 'full',
      rounds: [
        expect.objectContaining({ content: 'round1 基本面' }),
        expect.objectContaining({ content: 'round2 風險' }),
        expect.objectContaining({ content: 'round3 結論' }),
      ],
    })
  })

  it('keeps portfolio research in four rounds locally while using a single stock-scan AI call', async () => {
    callAiText
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            code: '2308',
            name: '台達電',
            thesisStatus: 'thesis 成立',
            actionBias: '續抱觀察',
            validationPoint: '法說會指引',
            confidence: 7,
          },
          {
            code: '2330',
            name: '台積電',
            thesisStatus: '需求穩健',
            actionBias: '續抱',
            validationPoint: '資本支出',
            confidence: 8,
          },
        ])
      )
      .mockResolvedValueOnce('diag 系統診斷')
      .mockResolvedValueOnce('advice 進化建議')
      .mockResolvedValueOnce(
        JSON.stringify({
          rules: [],
          candidateRules: [
            {
              text: '事件後量縮先減碼',
              when: '事件後量縮',
              action: '減碼 1/3',
              confidence: 7,
              evidenceRefs: [{ type: 'analysis', label: 'round4' }],
              status: 'candidate',
            },
          ],
          lessons: [{ date: '2026/04/02', text: '控制事件追價' }],
          stats: { hitRate: '1/1' },
          lastUpdate: '2026/04/02',
          evolution: '收斂事件風險規則',
        })
      )

    const req = {
      method: 'POST',
      body: {
        mode: 'evolve',
        stocks: [
          { code: '2308', name: '台達電', price: 380, cost: 350, qty: 10, pnl: 300, pct: 8.5 },
          { code: '2330', name: '台積電', price: 980, cost: 930, qty: 5, pnl: 250, pct: 5.4 },
        ],
        holdings: [
          { code: '2308', name: '台達電', price: 380, cost: 350, qty: 10, pnl: 300, pct: 8.5 },
          { code: '2330', name: '台積電', price: 980, cost: 930, qty: 5, pnl: 250, pct: 5.4 },
        ],
        holdingDossiers: [
          {
            code: '2308',
            name: '台達電',
            position: { qty: 10, cost: 350, price: 380, pnl: 300, pct: 8.5, type: 'stock' },
            thesis: { summary: 'AI 電源需求續增' },
            finmind: { revenue: [{ revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3 }] },
          },
          {
            code: '2330',
            name: '台積電',
            position: { qty: 5, cost: 930, price: 980, pnl: 250, pct: 5.4, type: 'stock' },
            thesis: { summary: '先進製程需求穩健' },
            finmind: { revenue: [{ revenueMonth: '2026/03', revenueYoY: 18, revenueMoM: 4 }] },
          },
        ],
        meta: {
          '2308': { industry: '電源管理', position: '核心', strategy: '成長股' },
          '2330': { industry: '半導體', position: '核心', strategy: '龍頭股' },
        },
        persist: false,
      },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(callAiText).toHaveBeenCalledTimes(4)
    expect(res.payload.results[0]).toMatchObject({
      mode: 'evolve',
      roundMode: 'local-fast',
      stockSummaries: expect.arrayContaining([
        expect.objectContaining({ code: '2308', summary: expect.stringContaining('thesis 成立') }),
        expect.objectContaining({ code: '2330', summary: expect.stringContaining('需求穩健') }),
      ]),
      rounds: expect.arrayContaining([
        expect.objectContaining({ title: '個股快掃', content: expect.stringContaining('台達電(2308)') }),
        expect.objectContaining({ title: '系統診斷', content: 'diag 系統診斷' }),
        expect.objectContaining({ title: '進化建議 + 組合調整', content: 'advice 進化建議' }),
      ]),
    })
  })
})
