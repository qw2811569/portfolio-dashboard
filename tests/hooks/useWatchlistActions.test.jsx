import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWatchlistActions } from '../../src/hooks/useWatchlistActions.js'

describe('useWatchlistActions', () => {
  let mockSetWatchlist
  let watchlistState

  beforeEach(() => {
    watchlistState = [
      {
        code: '2330',
        name: '台積電',
        price: 600,
        target: 700,
        status: '觀察',
        catalyst: 'AI 趨勢',
        scKey: 'info',
        note: '',
      },
      {
        code: '2382',
        name: '廣達',
        price: 1500,
        target: 1800,
        status: '買進',
        catalyst: 'AI 伺服器',
        scKey: 'warning',
        note: '',
      },
    ]
    mockSetWatchlist = vi.fn((updater) => {
      if (typeof updater === 'function') {
        watchlistState = updater(watchlistState)
      } else {
        watchlistState = updater
      }
    })
  })

  describe('upsertWatchlist', () => {
    it('should add new watchlist item', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const newItem = {
        code: '2454',
        name: '聯發科',
        price: 1200,
        target: 1400,
        status: '觀察',
        catalyst: '5G 趨勢',
        scKey: 'blue',
        note: '測試',
      }

      const success = result.current.upsertWatchlist(newItem)

      expect(success).toBe(true)
      expect(mockSetWatchlist).toHaveBeenCalled()
      expect(watchlistState).toHaveLength(3)
      expect(watchlistState.find((i) => i.code === '2454')).toMatchObject({ scKey: 'info' })
    })

    it('should update existing watchlist item', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const updatedItem = {
        code: '2330',
        name: '台積電',
        price: 650,
        target: 750,
        status: '買進',
        catalyst: 'AI 伺服器爆發',
        scKey: 'teal',
        note: '更新',
      }

      const success = result.current.upsertWatchlist(updatedItem)

      expect(success).toBe(true)
      expect(watchlistState).toHaveLength(2)
      const updated = watchlistState.find((i) => i.code === '2330')
      expect(updated.price).toBe(650)
      expect(updated.target).toBe(750)
      expect(updated.scKey).toBe('positive')
    })

    it('should update with editingCode parameter', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const updatedItem = {
        code: '2330-updated',
        name: '台積電（更新）',
        price: 700,
        target: 800,
      }

      result.current.upsertWatchlist(updatedItem, '2330')

      expect(watchlistState).toHaveLength(2)
      expect(watchlistState.find((i) => i.code === '2330')).toBeUndefined()
      expect(watchlistState.find((i) => i.code === '2330-updated')).toBeDefined()
    })

    it('should reject item without code', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const invalidItem = { name: 'No Code', price: 100 }

      const success = result.current.upsertWatchlist(invalidItem)

      expect(success).toBe(false)
      expect(mockSetWatchlist).not.toHaveBeenCalled()
    })

    it('should reject item without name', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const invalidItem = { code: '9999', price: 100 }

      const success = result.current.upsertWatchlist(invalidItem)

      expect(success).toBe(false)
      expect(mockSetWatchlist).not.toHaveBeenCalled()
    })

    it('should handle zero price and target', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const newItem = {
        code: '1234',
        name: 'Test',
        price: 0,
        target: 0,
      }

      result.current.upsertWatchlist(newItem)

      expect(watchlistState.find((i) => i.code === '1234').price).toBe(0)
      expect(watchlistState.find((i) => i.code === '1234').target).toBe(0)
    })

    it('should normalize watchlist after upsert', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const newItem = {
        code: '5678',
        name: 'Normalization Test',
        price: 100,
        target: 120,
      }

      result.current.upsertWatchlist(newItem)

      expect(watchlistState).toBeDefined()
      expect(Array.isArray(watchlistState)).toBe(true)
    })

    it('normalizes invalid scKey values to the canonical info fallback', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))

      result.current.upsertWatchlist({
        code: '6789',
        name: 'Fallback Test',
        price: 88,
        target: 100,
        scKey: 'green',
      })

      expect(watchlistState.find((item) => item.code === '6789')).toMatchObject({ scKey: 'info' })
    })
  })

  describe('removeWatchlist', () => {
    it('should remove existing item', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))

      result.current.removeWatchlist('2330')

      expect(watchlistState).toHaveLength(1)
      expect(watchlistState.find((i) => i.code === '2330')).toBeUndefined()
    })

    it('should handle non-existent code', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))
      const initialLength = watchlistState.length

      result.current.removeWatchlist('9999')

      expect(watchlistState).toHaveLength(initialLength)
    })

    it('should normalize watchlist after remove', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))

      result.current.removeWatchlist('2330')

      expect(Array.isArray(watchlistState)).toBe(true)
    })

    it('should handle empty watchlist', () => {
      watchlistState = []
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))

      result.current.removeWatchlist('2330')

      expect(watchlistState).toHaveLength(0)
    })
  })

  describe('hook interface', () => {
    it('should return upsertWatchlist and removeWatchlist', () => {
      const { result } = renderHook(() => useWatchlistActions({ setWatchlist: mockSetWatchlist }))

      expect(result.current.upsertWatchlist).toBeDefined()
      expect(result.current.removeWatchlist).toBeDefined()
      expect(typeof result.current.upsertWatchlist).toBe('function')
      expect(typeof result.current.removeWatchlist).toBe('function')
    })
  })
})
