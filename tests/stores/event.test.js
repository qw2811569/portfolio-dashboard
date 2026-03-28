import { describe, it, expect, beforeEach } from 'vitest'
import { useEventStore } from '../../src/stores/eventStore.js'

describe('stores/eventStore.js', () => {
  let store

  beforeEach(() => {
    // 重置 store 到初始狀態
    useEventStore.setState({
      newsEvents: [],
      reviewingEvent: null,
      reviewForm: {
        actual: 'up',
        actualNote: '',
        lessons: '',
        exitDate: null,
        priceAtExit: null,
      },
      newEvent: {
        date: '',
        title: '',
        detail: '',
        stocks: '',
        pred: 'up',
        predReason: '',
      },
      showAddEvent: false,
      calendarMonth: { year: 2026, month: 2 },
      showCalendar: false,
      reversalConditions: {},
      filterType: '全部',
      expandedNews: new Set(),
    })
    store = useEventStore.getState()
  })

  describe('setNewsEvents', () => {
    it('應該設置事件列表', () => {
      const mockEvents = [{ id: 1, title: '事件 1', status: 'pending' }]
      store.setNewsEvents(mockEvents)
      expect(useEventStore.getState().newsEvents).toEqual(mockEvents)
    })
  })

  describe('addEvent', () => {
    it('應該新增事件到列表開頭', () => {
      const newEvent = { id: 1, title: '新事件' }
      store.addEvent(newEvent)
      const state = useEventStore.getState()
      expect(state.newsEvents).toHaveLength(1)
      expect(state.newsEvents[0]).toEqual(newEvent)
    })
  })

  describe('updateEvent', () => {
    it('應該更新現有事件', () => {
      const initialEvent = { id: 1, title: '事件 1', status: 'pending' }
      store.setNewsEvents([initialEvent])

      store.updateEvent(1, { status: 'tracking' })
      const state = useEventStore.getState()
      expect(state.newsEvents[0].status).toBe('tracking')
    })
  })

  describe('deleteEvent', () => {
    it('應該移除事件', () => {
      const events = [
        { id: 1, title: '事件 1' },
        { id: 2, title: '事件 2' },
      ]
      store.setNewsEvents(events)
      store.deleteEvent(1)
      expect(useEventStore.getState().newsEvents).toHaveLength(1)
      expect(useEventStore.getState().newsEvents[0].id).toBe(2)
    })
  })

  describe('setReviewingEvent', () => {
    it('應該設置正在復盤的事件', () => {
      const event = { id: 1, title: '事件 1' }
      store.setReviewingEvent(event)
      expect(useEventStore.getState().reviewingEvent).toEqual(event)
    })
  })

  describe('setFilterType', () => {
    it('應該設置過濾器類型', () => {
      store.setFilterType('法說')
      expect(useEventStore.getState().filterType).toBe('法說')
    })
  })

  describe('toggleExpandedNews', () => {
    it('應該切換事件展開狀態', () => {
      store.toggleExpandedNews(1)
      expect(useEventStore.getState().expandedNews.has(1)).toBe(true)

      store.toggleExpandedNews(1)
      expect(useEventStore.getState().expandedNews.has(1)).toBe(false)
    })
  })
})
