import { describe, it, expect, beforeEach } from 'vitest'
import { useHoldingsStore } from '../../src/stores/holdingsStore.js'

describe('stores/holdingsStore.js', () => {
  let store

  beforeEach(() => {
    // 重置 store 到初始狀態
    useHoldingsStore.setState({
      holdings: [],
      watchlist: [],
      targets: {},
      fundamentals: {},
      analystReports: {},
      holdingDossiers: [],
      reversalConditions: {},
      scanQuery: '',
      scanFilter: '全部',
      sortBy: 'code',
      sortDir: 'asc',
      showReversal: false,
      attentionCount: 0,
      pendingCount: 0,
      targetUpdateCount: 0,
    })
    store = useHoldingsStore.getState()
  })

  describe('setHoldings', () => {
    it('應該設置持股列表', () => {
      const mockHoldings = [{ code: '2330', name: '台積電', qty: 1000, cost: 500 }]
      store.setHoldings(mockHoldings)
      expect(useHoldingsStore.getState().holdings).toEqual(mockHoldings)
    })
  })

  describe('upsertHolding', () => {
    it('應該新增持股如果不存在', () => {
      const newHolding = { code: '2330', name: '台積電', qty: 1000, cost: 500 }
      store.upsertHolding(newHolding)
      expect(useHoldingsStore.getState().holdings).toHaveLength(1)
      expect(useHoldingsStore.getState().holdings[0]).toEqual(newHolding)
    })

    it('應該更新持股如果已存在', () => {
      const initialHolding = { code: '2330', name: '台積電', qty: 1000, cost: 500 }
      store.setHoldings([initialHolding])

      const updatedHolding = { ...initialHolding, qty: 2000 }
      store.upsertHolding(updatedHolding)

      const state = useHoldingsStore.getState()
      expect(state.holdings).toHaveLength(1)
      expect(state.holdings[0].qty).toBe(2000)
    })
  })

  describe('removeHolding', () => {
    it('應該移除持股', () => {
      const holdings = [
        { code: '2330', name: '台積電', qty: 1000, cost: 500 },
        { code: '2317', name: '鴻海', qty: 2000, cost: 100 },
      ]
      store.setHoldings(holdings)
      store.removeHolding('2330')
      expect(useHoldingsStore.getState().holdings).toHaveLength(1)
      expect(useHoldingsStore.getState().holdings[0].code).toBe('2317')
    })
  })

  describe('getHoldingsSummary', () => {
    it('應該計算正確的持股摘要', () => {
      const holdings = [{ code: '2330', name: '台積電', qty: 1000, cost: 500, value: 600000 }]
      store.setHoldings(holdings)

      const summary = store.getHoldingsSummary()
      expect(summary.totalValue).toBe(600000)
      expect(summary.count).toBe(1)
    })
  })

  describe('getTopGainers', () => {
    it('應該返回漲幅前 5 名', () => {
      const holdings = [
        { code: '2330', pct: 10, value: 600000 },
        { code: '2317', pct: 20, value: 200000 },
        { code: '2454', pct: 5, value: 100000 },
      ]
      store.setHoldings(holdings)

      const topGainers = store.getTopGainers(2)
      expect(topGainers).toHaveLength(2)
      expect(topGainers[0].pct).toBe(20)
      expect(topGainers[1].pct).toBe(10)
    })
  })

  describe('getTopLosers', () => {
    it('應該返回跌幅前 5 名', () => {
      const holdings = [
        { code: '2330', pct: -10, value: 600000 },
        { code: '2317', pct: -20, value: 200000 },
        { code: '2454', pct: -5, value: 100000 },
      ]
      store.setHoldings(holdings)

      const topLosers = store.getTopLosers(2)
      expect(topLosers).toHaveLength(2)
      expect(topLosers[0].pct).toBe(-20)
      expect(topLosers[1].pct).toBe(-10)
    })
  })
})
