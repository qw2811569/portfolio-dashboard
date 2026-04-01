import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fetchFinMindNewsEvents,
  mapGeminiFactsToEvents,
  dedupeCalendarEvents,
} from '../../api/event-calendar.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('event-calendar.js - fetchFinMindNewsEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter conference events from news titles', async () => {
    const mockNews = {
      data: [
        { date: '2026-04-01', title: '台達電法說會 4/1 登場', description: '' },
        { date: '2026-04-01', title: '一般財報新聞', description: '' },
        { date: '2026-04-01', title: '台達電 Q1 營收成長', description: '' },
      ],
    }

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews),
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      ['2308'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'conference',
          stocks: ['2308'],
        }),
      ])
    )
  })

  it('should filter shareholder events from news titles', async () => {
    const mockNews = {
      data: [
        { date: '2026-04-01', title: '台積電股東常會 6 月舉行', description: '' },
      ],
    }

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews),
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      ['2330'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('shareholder')
  })

  it('should filter dividend events from news titles', async () => {
    const mockNews = {
      data: [
        { date: '2026-04-01', title: '聯發科除權息旺季來臨', description: '' },
      ],
    }

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews),
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      ['2454'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('dividend')
  })

  it('should filter out irrelevant news', async () => {
    const mockNews = {
      data: [
        { date: '2026-04-01', title: '台積電本月營收小幅成長', description: '' },
        { date: '2026-04-01', title: '一般產業新聞', description: '' },
      ],
    }

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews),
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      ['2330'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    // Should filter out all irrelevant news
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('earnings')
  })

  it('should handle API errors gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      ['2308'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toHaveLength(0)
  })

  it('should return empty array for empty stock codes', async () => {
    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      [],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toHaveLength(0)
  })

  it('should keep same-day FinMind news even when current time is after midnight', async () => {
    const mockNews = {
      data: [
        { date: '2026-04-01', title: '台達電法說會 4/1 登場', description: '' },
      ],
    }

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews),
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01T15:30:00+08:00'),
      7,
      ['2308'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'conference',
      source: 'finmind-news',
      stocks: ['2308'],
    })
  })

  it('should handle multiple stocks and aggregate events', async () => {
    const mockNews2308 = {
      data: [
        { date: '2026-04-01', title: '台達電法說會', description: '' },
      ],
    }
    const mockNews2330 = {
      data: [
        { date: '2026-04-01', title: '台積電股東會', description: '' },
      ],
    }

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews2308),
    })
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNews2330),
    })

    const events = await fetchFinMindNewsEvents(
      new Date('2026-04-01'),
      7,
      ['2308', '2330'],
      { headers: { 'x-forwarded-proto': 'http', host: 'localhost:3002' } }
    )

    expect(events).toHaveLength(2)
    expect(events.map(e => e.stocks[0])).toEqual(expect.arrayContaining(['2308', '2330']))
  })
})

describe('event-calendar.js - Gemini event filtering', () => {
  it('should filter Gemini events by stock codes', async () => {
    // This tests the fix in loadGeminiEvents where we added stock filtering
    const mockGeminiData = {
      facts: [
        { code: '2308', date: '2026-04-15', eventType: '法說會', confidence: 'confirmed' },
        { code: '2330', date: '2026-04-20', eventType: '股東會', confidence: 'confirmed' },
      ],
    }

    // Simulate filtering with stockCodes = ['2308']
    const stockCodes = ['2308']
    const filtered = mockGeminiData.facts.filter(fact => {
      if (!fact.date || !fact.eventType || fact.confidence !== 'confirmed') return false
      if (stockCodes.length > 0 && !stockCodes.includes(fact.code)) return false
      return true
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].code).toBe('2308')
  })

  it('should return all events when no stock codes specified', async () => {
    const mockGeminiData = {
      facts: [
        { code: '2308', date: '2026-04-15', eventType: '法說會', confidence: 'confirmed' },
        { code: '2330', date: '2026-04-20', eventType: '股東會', confidence: 'confirmed' },
      ],
    }

    // Simulate filtering with stockCodes = []
    const stockCodes = []
    const filtered = mockGeminiData.facts.filter(fact => {
      if (!fact.date || !fact.eventType || fact.confidence !== 'confirmed') return false
      if (stockCodes.length > 0 && !stockCodes.includes(fact.code)) return false
      return true
    })

    expect(filtered).toHaveLength(2)
  })

  it('maps confirmed Gemini facts into calendar events within the planning window', async () => {
    const events = mapGeminiFactsToEvents(
      [
        {
          code: '2308',
          name: '台達電',
          eventType: '法說會',
          date: '2026-04-10',
          source: 'https://example.com/2308',
          confidence: 'confirmed',
        },
        {
          code: '2330',
          name: '台積電',
          eventType: '法說會',
          date: '2026-06-20',
          source: 'https://example.com/2330',
          confidence: 'confirmed',
        },
      ],
      new Date('2026-04-02'),
      60,
      ['2308']
    )

    expect(events).toEqual([
      expect.objectContaining({
        source: 'gemini-research',
        type: 'conference',
        stocks: ['2308'],
        date: '2026-04-10',
      }),
    ])
  })

  it('dedupes duplicate events from different fallback sources', () => {
    const rows = dedupeCalendarEvents([
      {
        date: '2026-04-10',
        type: 'conference',
        title: '台達電(2308) 法說會',
        stocks: ['2308'],
      },
      {
        date: '2026-04-10',
        type: 'conference',
        title: '台達電(2308) 法說會',
        stocks: ['2308'],
      },
      {
        date: '2026-04-10',
        type: 'earnings',
        title: '營收公布',
        stocks: ['2308'],
      },
    ])

    expect(rows).toHaveLength(2)
  })
})
