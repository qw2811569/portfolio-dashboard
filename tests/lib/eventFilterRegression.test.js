import { describe, it, expect } from 'vitest'
import { normalizeEventRecord } from '../../src/lib/eventUtils.js'
import { filterEventsByType } from '../../src/lib/appShellRuntime.js'

describe('P0-03: Events filter type regression', () => {
  const legacyEvent = {
    id: 'legacy-1',
    title: '台積電法說會',
    date: '2026/04/10',
    type: '法說',
    stocks: ['台積電 2330'],
    pred: 'up',
    status: 'pending',
  }

  const newEventWithRecordType = {
    id: 'new-1',
    title: '營收公布',
    date: '2026/04/11',
    type: '營收',
    stocks: ['台積電 2330'],
    pred: 'up',
    status: 'pending',
  }

  const eventWithLeakedType = {
    id: 'leaked-1',
    title: '外資連續買超',
    date: '2026/04/12',
    type: 'event',
    stocks: ['台積電 2330'],
    pred: 'up',
    status: 'pending',
  }

  const newsWithLeakedType = {
    id: 'leaked-2',
    title: '產業趨勢報導',
    date: '2026/04/12',
    type: 'news',
    stocks: ['台積電 2330'],
    status: 'pending',
  }

  const eventWithNoType = {
    id: 'notype-1',
    title: '關稅政策變動',
    date: '2026/04/13',
    stocks: ['台積電 2330'],
    pred: 'up',
    status: 'pending',
  }

  it('preserves legacy categorical type through normalizeEventRecord', () => {
    const normalized = normalizeEventRecord(legacyEvent)
    expect(normalized.type).toBe('法說')
  })

  it('preserves 營收 categorical type through normalizeEventRecord', () => {
    const normalized = normalizeEventRecord(newEventWithRecordType)
    expect(normalized.type).toBe('營收')
  })

  it('strips type="event" that would break filter buttons', () => {
    const normalized = normalizeEventRecord(eventWithLeakedType)
    expect(normalized.type).not.toBe('event')
    // recordType should still carry the discriminator
    expect(normalized.recordType).toBe('event')
  })

  it('strips type="news" that would break filter buttons', () => {
    const normalized = normalizeEventRecord(newsWithLeakedType)
    expect(normalized.type).not.toBe('news')
    expect(normalized.recordType).toBe('news')
  })

  it('handles events with no type field', () => {
    const normalized = normalizeEventRecord(eventWithNoType)
    // type should be undefined (not 'event' or 'news')
    expect(normalized.type).toBeUndefined()
    // recordType correctly inferred
    expect(normalized.recordType).toBe('event')
  })

  describe('filterEventsByType with mixed old and new records', () => {
    const mixedEvents = [
      normalizeEventRecord(legacyEvent),
      normalizeEventRecord(newEventWithRecordType),
      normalizeEventRecord(eventWithLeakedType),
      normalizeEventRecord(newsWithLeakedType),
      normalizeEventRecord(eventWithNoType),
    ]

    it('全部 filter returns all events', () => {
      const result = filterEventsByType({
        newsEvents: mixedEvents,
        filterType: '全部',
      })
      expect(result).toHaveLength(5)
    })

    it('法說 filter returns only 法說 events', () => {
      const result = filterEventsByType({
        newsEvents: mixedEvents,
        filterType: '法說',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('legacy-1')
    })

    it('營收 filter returns only 營收 events', () => {
      const result = filterEventsByType({
        newsEvents: mixedEvents,
        filterType: '營收',
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('new-1')
    })

    it('leaked type="event" records do NOT appear when filtering by "event"', () => {
      // If someone tries to filter by 'event' (not a valid filter button),
      // leaked records should NOT match because we stripped that type
      const result = filterEventsByType({
        newsEvents: mixedEvents,
        filterType: 'event',
      })
      expect(result).toHaveLength(0)
    })

    it('leaked type="news" records do NOT appear when filtering by "news"', () => {
      const result = filterEventsByType({
        newsEvents: mixedEvents,
        filterType: 'news',
      })
      expect(result).toHaveLength(0)
    })
  })
})
