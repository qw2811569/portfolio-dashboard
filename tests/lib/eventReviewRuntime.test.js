import { describe, expect, it } from 'vitest'
import {
  applyReviewedEventToCollection,
  buildEventReviewBrainRequestBody,
  buildReviewedEventSnapshot,
  createReviewRecordedAt,
  parseEventReviewBrainResponse,
  shouldIntegrateEventReview,
} from '../../src/lib/eventReviewRuntime.js'
import {
  buildEventReviewDossiers,
  buildResearchHoldingDossierContext,
} from '../../src/lib/dossierUtils.js'
import {
  buildEventReviewEvidenceRefs,
  buildEventStockOutcomes,
  normalizeEventRecord,
  normalizeNewsEvents,
} from '../../src/lib/eventUtils.js'

describe('lib/eventReviewRuntime', () => {
  it('builds reviewed event snapshots and dossier context', () => {
    const event = normalizeEventRecord({
      id: 'e1',
      date: '2026/03/20',
      title: '法說會',
      stocks: ['台積電 2330'],
      pred: 'up',
      predReason: '市場預期上修',
      status: 'tracking',
      priceAtEvent: { 2330: 950 },
    })
    const reviewForm = {
      actual: 'down',
      actualNote: '法說不如預期',
      lessons: '不要只看市場預期',
      exitDate: '2026/03/28',
      priceAtExit: { 2330: 910 },
    }
    const dossierByCode = new Map([
      [
        '2330',
        {
          code: '2330',
          name: '台積電',
          position: { qty: 1000, cost: 900, price: 910, pnl: 10000, pct: 1.11 },
          stockMeta: {
            strategy: '成長股',
            industry: '半導體',
            leader: '龍頭',
            position: '核心',
            period: '中長',
            themes: ['AI 伺服器', '先進製程'],
          },
        },
      ],
    ])

    const snapshot = buildReviewedEventSnapshot({
      event,
      reviewForm,
      reviewDate: '2026/03/28',
      dossierByCode,
      normalizeEventRecord,
      buildEventStockOutcomes,
      buildEventReviewDossiers,
      buildResearchHoldingDossierContext,
      buildEventReviewEvidenceRefs,
    })

    expect(snapshot.wasCorrect).toBe(false)
    expect(snapshot.reviewedEvent).toEqual(
      expect.objectContaining({
        status: 'closed',
        actual: 'down',
        lessons: '不要只看市場預期',
      })
    )
    expect(snapshot.reviewDossiers).toHaveLength(1)
    expect(snapshot.reviewDossierContext).toContain('台積電(2330)')
    expect(snapshot.reviewDossierContext).toContain('知識:')
    expect(snapshot.reviewEvidenceRefs).toEqual([
      expect.objectContaining({ type: 'review', refId: 'e1', code: '2330' }),
    ])
  })

  it('keeps review dossier context stable when stockMeta is missing', () => {
    const event = normalizeEventRecord({
      id: 'e1',
      date: '2026/03/20',
      title: '法說會',
      stocks: ['台積電 2330'],
      pred: 'up',
      predReason: '市場預期上修',
      status: 'tracking',
      priceAtEvent: { 2330: 950 },
    })
    const reviewForm = {
      actual: 'down',
      actualNote: '法說不如預期',
      lessons: '不要只看市場預期',
      exitDate: '2026/03/28',
      priceAtExit: { 2330: 910 },
    }
    const dossierByCode = new Map([
      [
        '2330',
        {
          code: '2330',
          name: '台積電',
          position: { qty: 1000, cost: 900, price: 910, pnl: 10000, pct: 1.11 },
          stockMeta: null,
        },
      ],
    ])

    const snapshot = buildReviewedEventSnapshot({
      event,
      reviewForm,
      reviewDate: '2026/03/28',
      dossierByCode,
      normalizeEventRecord,
      buildEventStockOutcomes,
      buildEventReviewDossiers,
      buildResearchHoldingDossierContext,
      buildEventReviewEvidenceRefs,
    })

    expect(snapshot.reviewDossierContext).toContain('台積電(2330)')
    expect(typeof snapshot.reviewDossierContext).toBe('string')
    expect(snapshot.reviewDossierContext.length).toBeGreaterThan(0)
  })

  it('updates the target event in the collection and parses AI brain response', () => {
    const nextEvents = applyReviewedEventToCollection({
      events: normalizeNewsEvents([
        {
          id: 'e1',
          date: '2026/03/20',
          title: '法說會',
          stocks: ['台積電 2330'],
          pred: 'up',
          status: 'tracking',
        },
      ]),
      eventId: 'e1',
      reviewForm: {
        actual: 'down',
        actualNote: '法說不如預期',
        lessons: '不要追高',
        exitDate: '2026/03/28',
      },
      reviewDate: '2026/03/28',
      reviewedStockOutcomes: [{ code: '2330', name: '台積電', actual: 'down' }],
      normalizeNewsEvents,
    })

    expect(nextEvents[0]).toEqual(
      expect.objectContaining({
        status: 'closed',
        actual: 'down',
        lessons: '不要追高',
        reviewDate: '2026/03/28',
      })
    )

    const parsed = parseEventReviewBrainResponse({
      content: [
        {
          text: '前言\n```json\n{"reviewFeedback":"這次歸因太快","rules":[{"text":"規則A"}]}\n```\n',
        },
      ],
    })
    expect(parsed.feedback).toBe('這次歸因太快')
    expect(parsed.rawBrain).toEqual({ rules: [{ text: '規則A' }] })
  })

  it('builds request bodies and detects when review integration is needed', () => {
    const recordedAt = createReviewRecordedAt('2026/03/28', new Date('2026-03-28T07:05:00Z'))
    const body = buildEventReviewBrainRequestBody({
      event: { title: '法說會', pred: 'up', predReason: '市場預期上修', date: '2026/03/20' },
      notesContext: '風格：事件驅動',
      reviewDossierContext: '',
      actual: 'down',
      savedNote: '結果不如預期',
      wasCorrect: false,
      reviewedEvent: { eventDate: '2026/03/20', exitDate: '2026/03/28' },
      reviewDate: '2026/03/28',
      savedLessons: '',
      currentBrain: { rules: [{ text: '規則A' }] },
    })

    expect(recordedAt).toContain('2026/03/28')
    expect(body.systemPrompt).toContain('你是策略知識庫管理器')
    expect(body.userPrompt).toContain('用戶覆盤心得：（未填）')
    expect(shouldIntegrateEventReview('', '', { id: 'e1' })).toBe(false)
    expect(shouldIntegrateEventReview('有心得', '', { id: 'e1' })).toBe(true)
  })
})
