import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildMorningNotePortfolioArtifact,
  generateMorningNoteSnapshot,
} from '../../agent-bridge-standalone/workers/morning-note-worker.mjs'

function buildAiResponse(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
    ],
  }
}

function buildPromptAwareAi(factory) {
  return vi.fn(async (payload) => {
    const prompt = JSON.parse(payload.messages[0].content)
    return buildAiResponse(factory(prompt))
  })
}

describe('morning-note-worker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hard-blocks insider notes when the AI returns buy/sell language', async () => {
    const callAiRawImpl = buildPromptAwareAi((prompt) => ({
      accuracyStatus: 'pass',
      confidence: 0.91,
      headline: '先看公開資訊節奏',
      summary: '今天先看公開資訊。',
      lead: '這裡還是可以買進一點，等量能出來再說。',
      items: prompt.items.map((item, index) => ({
        sourceId: item.id,
        tone: index === 0 ? 'watch' : 'calm',
        title: `焦點 ${index + 1}`,
        body: index === 0 ? '今天可以買進一點再觀察。' : '如果不對就停損。',
      })),
    }))

    const note = await buildMorningNotePortfolioArtifact('7865', {
      marketDate: '2026-04-24',
      events: [],
      callAiRawImpl,
    })

    expect(note.staleStatus).toBe('failed')
    expect(note.blockedReason).toContain('買賣語氣')
  })

  it('marks the snapshot stale when the calendar source is unavailable but holdings-only notes still render', async () => {
    const callAiRawImpl = buildPromptAwareAi((prompt) => ({
      accuracyStatus: 'pass',
      confidence: 0.88,
      headline: '今天先把節奏排好',
      summary: '先看主部位，再看風險節奏。',
      lead: '盤前先把主要影響組合情緒的兩三件事放前面。',
      items: prompt.items.map((item, index) => ({
        sourceId: item.id,
        tone: index === 0 ? 'watch' : 'calm',
        title: `焦點 ${index + 1}`,
        body: `先看 ${item.id} 的節奏。`,
      })),
    }))

    const snapshot = await generateMorningNoteSnapshot({
      now: new Date('2026-04-24T00:30:00.000Z'),
      fetchImpl: vi.fn(async () => {
        throw new Error('calendar offline')
      }),
      callAiRawImpl,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    })

    expect(snapshot.status).toBe('stale')
    expect(snapshot.staleReasons).toContain('calendar_fetch_failed')
    expect(snapshot.portfolios.me.staleStatus).toBe('stale')
    expect(snapshot.portfolios.me.headline).toBe('今天先把節奏排好')
    expect(snapshot.portfolios.me.staleReasons).toContain('calendar_fetch_failed')
  })
})
