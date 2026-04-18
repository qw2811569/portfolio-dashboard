import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { writePendingDecisionsFixture } from '../../api/_lib/pending-decisions-store.js'

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    ended: false,
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
    end(payload = '') {
      this.ended = true
      this.payload = payload
      return payload
    },
  }
}

function createRequest({ method = 'GET', query = {}, headers = {}, body = {} } = {}) {
  return {
    method,
    query,
    headers,
    body,
  }
}

describe('pending decisions api handlers', () => {
  let tmpDir
  let storePath

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-decisions-'))
    storePath = path.join(tmpDir, 'pending-decisions.jsonl')
    process.env.PENDING_DECISIONS_PATH = storePath
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'
    process.env.BRIDGE_INTERNAL_TOKEN = 'secret-token'

    writePendingDecisionsFixture(
      [
        {
          id: 'r121g-fantexualize',
          createdAt: '2026-04-18T21:20:00Z',
          askedBy: 'claude',
          context: 'R121g · dashboard PM review',
          question: '要去橋化嗎？',
          options: [
            { key: 'A', label: '去橋化' },
            { key: 'B', label: '保留' },
          ],
          recommendation: 'A',
          recommendationReason: '比喻落空',
          status: 'pending',
          nextExpectedDecisionAt: '預計 3 天後 · L8 signoff 前',
        },
      ],
      storePath
    )
  })

  afterEach(() => {
    delete process.env.PENDING_DECISIONS_PATH
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    delete process.env.BRIDGE_INTERNAL_TOKEN
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects unauthorized GET requests', async () => {
    const originalVitest = process.env.VITEST
    delete process.env.VITEST
    try {
      const { default: handler } = await import('../../api/pending-decisions.js')
      const req = createRequest({
        method: 'GET',
        headers: {
          host: 'bridge.example.com',
          origin: 'https://evil.example.com',
        },
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.payload).toEqual({ error: 'Unauthorized' })
    } finally {
      process.env.VITEST = originalVitest
    }
  })

  it('returns pending decisions for same-origin dashboard requests', async () => {
    const { default: handler } = await import('../../api/pending-decisions.js')
    const req = createRequest({
      method: 'GET',
      headers: {
        host: 'bridge.example.com',
        origin: 'https://bridge.example.com',
      },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.summary).toEqual({
      pendingCount: 1,
      nextExpectedDecisionAt: '預計 3 天後 · L8 signoff 前',
    })
    expect(res.payload.decisions).toHaveLength(1)
    expect(res.payload.decisions[0]).toMatchObject({
      id: 'r121g-fantexualize',
      recommendation: 'A',
    })
  })

  it('appends an answer and hides it from the default list', async () => {
    const { default: listHandler } = await import('../../api/pending-decisions.js')
    const { default: answerHandler } = await import('../../api/pending-decisions/[id]/answer.js')
    const answerReq = createRequest({
      method: 'POST',
      query: { id: 'r121g-fantexualize' },
      headers: {
        host: 'bridge.example.com',
        authorization: 'Bearer secret-token',
      },
      body: {
        answer: 'A',
        notes: 'keep poster deck intact',
      },
    })
    const answerRes = createMockResponse()

    await answerHandler(answerReq, answerRes)

    expect(answerRes.statusCode).toBe(200)
    expect(answerRes.payload.ok).toBe(true)
    expect(answerRes.payload.decision).toMatchObject({
      id: 'r121g-fantexualize',
      answer: 'A',
      status: 'answered',
    })

    const listReq = createRequest({
      method: 'GET',
      headers: {
        host: 'bridge.example.com',
        origin: 'https://bridge.example.com',
      },
    })
    const listRes = createMockResponse()

    await listHandler(listReq, listRes)

    expect(listRes.statusCode).toBe(200)
    expect(listRes.payload.decisions).toEqual([])
    expect(listRes.payload.summary.pendingCount).toBe(0)

    const raw = fs.readFileSync(storePath, 'utf-8')
    expect(raw).toContain('"status":"answered"')
    expect(raw).toContain('"answer":"A"')
  })

  it('returns answered items when history=1', async () => {
    const { default: listHandler } = await import('../../api/pending-decisions.js')
    const { default: answerHandler } = await import('../../api/pending-decisions/[id]/answer.js')

    await answerHandler(
      createRequest({
        method: 'POST',
        query: { id: 'r121g-fantexualize' },
        headers: {
          host: 'bridge.example.com',
          authorization: 'Bearer secret-token',
        },
        body: { answer: 'B' },
      }),
      createMockResponse()
    )

    const historyReq = createRequest({
      method: 'GET',
      query: { history: '1' },
      headers: {
        host: 'bridge.example.com',
        origin: 'https://bridge.example.com',
      },
    })
    const historyRes = createMockResponse()

    await listHandler(historyReq, historyRes)

    expect(historyRes.statusCode).toBe(200)
    expect(historyRes.payload.decisions).toHaveLength(1)
    expect(historyRes.payload.decisions[0]).toMatchObject({
      id: 'r121g-fantexualize',
      status: 'answered',
      answer: 'B',
    })
  })
})
