import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEvents } from '../../src/hooks/useEvents.js'

describe('useEvents', () => {
  const mockEvents = [
    {
      id: 'evt-001',
      date: '2026-04-15',
      title: '台積電法說會',
      detail: 'Q1 財報公布',
      stocks: '2330',
      type: '法說會',
      status: 'pending',
      pred: 'up',
    },
    {
      id: 'evt-002',
      date: '2026-04-20',
      title: '廣達法說會',
      detail: 'AI 伺服器展望',
      stocks: '2382',
      type: '法說會',
      status: 'pending',
      pred: 'neutral',
    },
  ]

  let hook

  beforeEach(() => {
    hook = renderHook(() => useEvents({ initialEvents: mockEvents }))
  })

  describe('initialization', () => {
    it('should initialize with provided events', () => {
      const { result } = hook
      expect(result.current.newsEvents).toHaveLength(2)
      expect(result.current.newsEvents[0].id).toBe('evt-001')
    })

    it('should initialize with empty events if not provided', () => {
      const { result } = renderHook(() => useEvents())
      expect(result.current.newsEvents).toHaveLength(0)
    })
  })

  describe('addEvent', () => {
    it('should add a new event', () => {
      const { result } = hook
      const newEvent = {
        date: '2026-05-01',
        title: '聯發科法說會',
        detail: 'Q2 展望',
        stocks: '2454',
        type: '法說會',
        pred: 'up',
      }

      act(() => {
        result.current.addEvent(newEvent)
      })

      expect(result.current.newsEvents).toHaveLength(3)
      expect(result.current.newsEvents[0].title).toBe('聯發科法說會')
    })

    it('should not add event if data is missing', () => {
      const { result } = hook
      const initialLength = result.current.newsEvents.length

      act(() => {
        result.current.addEvent(null)
      })

      expect(result.current.newsEvents).toHaveLength(initialLength)
    })
  })

  describe('deleteEvent', () => {
    it('should delete an event', () => {
      const { result } = hook

      act(() => {
        result.current.deleteEvent('evt-001')
      })

      expect(result.current.newsEvents).toHaveLength(1)
      expect(result.current.newsEvents.find(e => e.id === 'evt-001')).toBeUndefined()
    })

    it('should not delete if event not found', () => {
      const { result } = hook
      const initialLength = result.current.newsEvents.length

      act(() => {
        result.current.deleteEvent('non-existent')
      })

      expect(result.current.newsEvents).toHaveLength(initialLength)
    })
  })

  describe('review workflow', () => {
    it('should set reviewing event', () => {
      const { result } = hook

      act(() => {
        result.current.setReviewingEvent(mockEvents[0])
      })

      expect(result.current.reviewingEvent).toEqual(mockEvents[0])
    })

    it('should update review form', () => {
      const { result } = hook

      act(() => {
        result.current.setReviewForm({ actual: 'down', actualNote: 'Test note' })
      })

      expect(result.current.reviewForm.actual).toBe('down')
      expect(result.current.reviewForm.actualNote).toBe('Test note')
    })

    it('should create default review form with overrides', () => {
      const { result } = hook
      const defaultForm = result.current.createDefaultReviewForm({ actual: 'neutral' })

      expect(defaultForm.actual).toBe('neutral')
      expect(defaultForm.lessons).toBe('')
    })
  })

  describe('calendar state', () => {
    it('should update calendar month', () => {
      const { result } = hook

      act(() => {
        result.current.setCalendarMonth({ year: 2026, month: 5 })
      })

      expect(result.current.calendarMonth).toEqual({ year: 2026, month: 5 })
    })

    it('should toggle calendar visibility', () => {
      const { result } = hook

      act(() => {
        result.current.setShowCalendar(true)
      })

      expect(result.current.showCalendar).toBe(true)
    })
  })
})
