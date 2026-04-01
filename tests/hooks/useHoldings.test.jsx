import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHoldings } from '../../src/hooks/useHoldings.js'

describe('useHoldings', () => {
  const mockHoldings = [
    { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600 },
    { code: '2382', name: '廣達', qty: 500, cost: 1400, price: 1500 },
  ]

  let hook

  beforeEach(() => {
    hook = renderHook(() => useHoldings({ initialHoldings: mockHoldings }))
  })

  describe('initialization', () => {
    it('should initialize with provided holdings', () => {
      const { result } = hook
      expect(result.current.holdings).toHaveLength(2)
      expect(result.current.holdings[0].code).toBe('2330')
    })

    it('should initialize with empty holdings if not provided', () => {
      const { result } = renderHook(() => useHoldings())
      expect(result.current.holdings).toHaveLength(0)
    })
  })

  describe('upsertHolding', () => {
    it('should add new holding', () => {
      const { result } = hook
      const newHolding = { code: '2454', name: '聯發科', qty: 200, cost: 1200 }

      act(() => {
        result.current.upsertHolding(newHolding)
      })

      expect(result.current.holdings).toHaveLength(3)
      expect(result.current.holdings.find(h => h.code === '2454')).toBeDefined()
    })

    it('should update existing holding', () => {
      const { result } = hook
      const updatedHolding = { code: '2330', name: '台積電', qty: 1500, cost: 550 }

      act(() => {
        result.current.upsertHolding(updatedHolding)
      })

      const updated = result.current.holdings.find(h => h.code === '2330')
      expect(updated.qty).toBe(1500)
    })

    it('should not add holding without code', () => {
      const { result } = hook
      const initialLength = result.current.holdings.length

      act(() => {
        result.current.upsertHolding({ name: 'No Code', qty: 100 })
      })

      expect(result.current.holdings).toHaveLength(initialLength)
    })
  })

  describe('removeHolding', () => {
    it('should remove existing holding', () => {
      const { result } = hook

      act(() => {
        result.current.removeHolding('2330')
      })

      expect(result.current.holdings).toHaveLength(1)
    })

    it('should handle non-existent code', () => {
      const { result } = hook
      const initialLength = result.current.holdings.length

      act(() => {
        result.current.removeHolding('9999')
      })

      expect(result.current.holdings).toHaveLength(initialLength)
    })
  })

  describe('applyTrade', () => {
    it('should not apply trade without code', () => {
      const { result } = hook
      const initialHoldings = [...result.current.holdings]

      act(() => {
        result.current.applyTrade({ action: 'buy', qty: 100 })
      })

      expect(result.current.holdings).toEqual(initialHoldings)
    })

    it('should not apply trade without action', () => {
      const { result } = hook
      const initialHoldings = [...result.current.holdings]

      act(() => {
        result.current.applyTrade({ code: '2330', qty: 100 })
      })

      expect(result.current.holdings).toEqual(initialHoldings)
    })
  })

  describe('updateTargetPrice', () => {
    it('should update target price for holding', () => {
      const { result } = hook

      act(() => {
        result.current.updateTargetPrice('2330', 700)
      })

      const updated = result.current.holdings.find(h => h.code === '2330')
      expect(updated.targetPrice).toBe(700)
    })
  })

  describe('updateAlert', () => {
    it('should update alert for holding', () => {
      const { result } = hook

      act(() => {
        result.current.updateAlert('2330', '650')
      })

      const updated = result.current.holdings.find(h => h.code === '2330')
      expect(updated.alert).toBe('650')
    })
  })

  describe('state setters', () => {
    it('should set watchlist', () => {
      const { result } = hook
      const watchlist = [{ code: '2454', name: '聯發科' }]

      act(() => {
        result.current.setWatchlist(watchlist)
      })

      expect(result.current.watchlist).toHaveLength(1)
    })

    it('should set targets', () => {
      const { result } = hook
      const targets = { '2330': { reports: [] } }

      act(() => {
        result.current.setTargets(targets)
      })

      expect(result.current.targets).toEqual(targets)
    })

    it('should set fundamentals', () => {
      const { result } = hook
      const fundamentals = { '2330': { revenueMonth: '100B' } }

      act(() => {
        result.current.setFundamentals(fundamentals)
      })

      expect(result.current.fundamentals).toEqual(fundamentals)
    })

    it('should set holdingDossiers', () => {
      const { result } = hook
      const dossiers = [{ code: '2330', name: '台積電' }]

      act(() => {
        result.current.setHoldingDossiers(dossiers)
      })

      expect(result.current.holdingDossiers).toHaveLength(1)
    })
  })
})
