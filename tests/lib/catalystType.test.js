import { describe, it, expect } from 'vitest'
import { inferCatalystType, inferImpact, normalizeEventRecord } from '../../src/lib/eventUtils.js'
import { inferEventType } from '../../src/lib/eventTypeMeta.js'

describe('inferCatalystType', () => {
  it('detects earnings events', () => {
    expect(inferCatalystType({ title: '台積電3月營收公布' })).toBe('earnings')
    expect(inferCatalystType({ title: 'Q4財報發布' })).toBe('earnings')
    expect(inferCatalystType({ title: '法說會' })).toBe('earnings')
    expect(inferCatalystType({ title: '季報公告' })).toBe('earnings')
    expect(inferCatalystType({ title: 'EPS超預期' })).toBe('earnings')
    expect(inferCatalystType({ title: '年報' })).toBe('earnings')
  })

  it('detects corporate events', () => {
    expect(inferCatalystType({ title: '董事會通過配息' })).toBe('corporate')
    expect(inferCatalystType({ title: '庫藏股買回' })).toBe('corporate')
    expect(inferCatalystType({ title: '除權除息' })).toBe('corporate')
    expect(inferCatalystType({ title: '併購案公告' })).toBe('corporate')
    expect(inferCatalystType({ title: '現金增資' })).toBe('corporate')
  })

  it('detects industry events', () => {
    expect(inferCatalystType({ title: 'CoWoS產能擴張' })).toBe('industry')
    expect(inferCatalystType({ title: 'AI伺服器訂單增加' })).toBe('industry')
    expect(inferCatalystType({ title: '供應鏈調整' })).toBe('industry')
    expect(inferCatalystType({ title: '新製程量產' })).toBe('industry')
  })

  it('detects macro events', () => {
    expect(inferCatalystType({ title: 'Fed升息' })).toBe('macro')
    expect(inferCatalystType({ title: '央行利率決策' })).toBe('macro')
    expect(inferCatalystType({ title: 'CPI數據公布' })).toBe('macro')
    expect(inferCatalystType({ title: '關稅政策變動' })).toBe('macro')
    expect(inferCatalystType({ title: '匯率波動' })).toBe('macro')
    expect(inferCatalystType({ title: 'GDP成長率' })).toBe('macro')
  })

  it('detects technical events', () => {
    expect(inferCatalystType({ title: '外資連續買超' })).toBe('technical')
    expect(inferCatalystType({ title: '融資餘額大增' })).toBe('technical')
    expect(inferCatalystType({ title: '成交量暴增' })).toBe('technical')
    expect(inferCatalystType({ title: '突破前高' })).toBe('technical')
  })

  it('returns null for unclassifiable events', () => {
    expect(inferCatalystType({ title: '今天天氣不錯' })).toBeNull()
    expect(inferCatalystType({ title: '' })).toBeNull()
    expect(inferCatalystType({})).toBeNull()
  })
})

describe('inferEventType', () => {
  it('maps TW-specific event categories into canonical eventType values', () => {
    expect(inferEventType({ title: '台積電法說會' })).toBe('earnings')
    expect(inferEventType({ title: '2330 5/15 除息' })).toBe('ex-dividend')
    expect(inferEventType({ title: '2330 股東常會 6 月 10 日召開' })).toBe('shareholding-meeting')
    expect(inferEventType({ title: '2330 宣布策略轉型與併購' })).toBe('strategic')
    expect(inferEventType({ title: '2330 股東會紀念品公告' })).toBe('shareholding-meeting')
  })
})

describe('inferImpact', () => {
  it('returns high for earnings type', () => {
    expect(inferImpact({ catalystType: 'earnings', eventType: 'earnings' })).toBe('high')
  })

  it('returns medium for corporate type', () => {
    expect(inferImpact({ catalystType: 'corporate' })).toBe('medium')
  })

  it('returns medium for industry type', () => {
    expect(inferImpact({ catalystType: 'industry' })).toBe('medium')
  })

  it('returns medium for macro type', () => {
    expect(inferImpact({ catalystType: 'macro' })).toBe('medium')
  })

  it('returns low for technical type', () => {
    expect(inferImpact({ catalystType: 'technical' })).toBe('low')
  })

  it('returns low for informational type', () => {
    expect(inferImpact({ eventType: 'informational' })).toBe('low')
  })

  it('returns null for unknown type', () => {
    expect(inferImpact({ catalystType: null })).toBeNull()
    expect(inferImpact({})).toBeNull()
  })
})

describe('normalizeEventRecord catalyst fields', () => {
  const baseEvent = {
    id: 'evt-1',
    title: '台積電3月營收公布',
    date: '2026/03/28',
    stocks: ['台積電 2330'],
    pred: 'up',
    status: 'pending',
  }

  it('auto-infers catalystType from title', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.catalystType).toBe('earnings')
    expect(result.eventType).toBe('earnings')
  })

  it('auto-infers impact from catalystType', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.impact).toBe('high')
  })

  it('preserves explicit catalystType over inference', () => {
    const result = normalizeEventRecord({ ...baseEvent, catalystType: 'corporate' })
    expect(result.catalystType).toBe('corporate')
  })

  it('preserves explicit impact over inference', () => {
    const result = normalizeEventRecord({ ...baseEvent, impact: 'low' })
    expect(result.impact).toBe('low')
  })

  it('defaults relatedThesisIds to empty array', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.relatedThesisIds).toEqual([])
  })

  it('preserves provided relatedThesisIds', () => {
    const result = normalizeEventRecord({ ...baseEvent, relatedThesisIds: ['thesis-2330-001'] })
    expect(result.relatedThesisIds).toEqual(['thesis-2330-001'])
  })

  it('defaults pillarImpact to null', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.pillarImpact).toBeNull()
  })

  it('fills label/sub from title/detail for legacy event cards', () => {
    const result = normalizeEventRecord({
      ...baseEvent,
      title: '台積電3月營收公布',
      detail: '關鍵觀察 3 月營收是否優於市場預期',
    })
    expect(result.label).toBe('台積電3月營收公布')
    expect(result.sub).toBe('關鍵觀察 3 月營收是否優於市場預期')
  })

  it('keeps informational events out of thesis-review flow by default', () => {
    const result = normalizeEventRecord({
      id: 'evt-info',
      title: '2330 股東會紀念品公告',
      date: '2026/04/28',
      detail: '紀念品 超商禮券',
      recordType: 'event',
    })

    expect(result.eventType).toBe('shareholding-meeting')
    expect(result.needsThesisReview).toBe(true)
  })

  it('marks pure informational rows as info-only when explicitly typed', () => {
    const result = normalizeEventRecord({
      id: 'evt-info-2',
      title: '2330 紀念品領取提醒',
      date: '2026/04/28',
      eventType: 'informational',
      recordType: 'event',
    })

    expect(result.eventType).toBe('informational')
    expect(result.needsThesisReview).toBe(false)
  })

  it('sets catalystType to null for unclassifiable events', () => {
    const result = normalizeEventRecord({ ...baseEvent, title: '今天天氣不錯' })
    expect(result.catalystType).toBeNull()
  })
})
