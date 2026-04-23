import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('api/trade-audit', () => {
  let workspaceRoot = ''

  beforeEach(() => {
    vi.resetModules()
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-audit-'))
    process.env.WORKSPACE_ROOT = workspaceRoot
  })

  afterEach(() => {
    delete process.env.WORKSPACE_ROOT
    fs.rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('appends a compliance audit entry into the monthly jsonl file', async () => {
    const { default: handler } = await import('../../api/trade-audit.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'POST',
        headers: { host: 'localhost:3002' },
        body: {
          portfolioId: '7865',
          action: 'trade.confirm',
          disclaimerAckedAt: '2026-04-24T08:30:00.000Z',
          before: {
            holdings: [{ code: '2330', qty: 1 }],
            tradeLogCount: 4,
          },
          after: {
            holdings: [{ code: '2330', qty: 3 }],
            tradeLogCount: 5,
            appendedTradeLogEntries: [{ code: '2330', action: '買進', qty: 2, price: 950 }],
          },
        },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      saved: true,
      portfolioId: '7865',
    })

    const auditFilePath = path.join(
      workspaceRoot,
      'logs',
      `trade-audit-${new Date().toISOString().slice(0, 7)}.jsonl`
    )
    const lines = fs.readFileSync(auditFilePath, 'utf8').trim().split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)

    const entry = JSON.parse(lines[0])
    expect(entry).toMatchObject({
      portfolioId: '7865',
      userId: 'jinliancheng-chairwoman',
      action: 'trade.confirm',
      disclaimerAckedAt: '2026-04-24T08:30:00.000Z',
      before: {
        tradeLogCount: 4,
      },
      after: {
        tradeLogCount: 5,
      },
    })
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
