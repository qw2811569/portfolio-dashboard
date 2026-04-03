import { describe, it, expect } from 'vitest'
import { predictEventDirection, predictAllEvents } from '../../src/lib/eventPredictionEngine.js'

describe('eventPredictionEngine', () => {
  describe('predictEventDirection', () => {
    it('法說會事件應回 neutral（基礎判斷）', () => {
      const result = predictEventDirection({ title: '2026 Q2 法說會', type: '法說' })
      expect(result.direction).toBe('flat')
      // 法說 bias 是 neutral，不加分也不減分，所以 reason 不會包含「法說」
      expect(result.reasons.some((r) => r.includes('訊號不足'))).toBe(true)
    })

    it('新品事件應回 positive（基礎判斷）', () => {
      const result = predictEventDirection({ title: 'AI 伺服器新品發布', type: '新品' })
      expect(result.direction).toBe('flat') // 新品 +1 但只有 1 分，需 >= 2 才 up
      expect(result.reasons.some((r) => r.includes('新品'))).toBe(true)
    })

    it('降價事件應回 negative（基礎判斷）', () => {
      const result = predictEventDirection({ title: 'DRAM 報價降價', type: '降價' })
      expect(result.direction).toBe('flat') // 降價 -1 但只有 -1 分，需 <= -2 才 down
      expect(result.reasons.some((r) => r.includes('降價'))).toBe(true)
    })

    it('擴產事件應回 positive（基礎判斷）', () => {
      const result = predictEventDirection({ title: '台積電擴產', type: '擴產' })
      expect(result.direction).toBe('flat') // 擴產 +1 但只有 1 分
      expect(result.reasons.some((r) => r.includes('擴產'))).toBe(true)
    })

    it('裁員事件應回 negative（基礎判斷）', () => {
      const result = predictEventDirection({ title: '公司裁員 500 人', type: '裁員' })
      expect(result.direction).toBe('flat') // 裁員 -1 但只有 -1 分
      expect(result.reasons.some((r) => r.includes('裁員'))).toBe(true)
    })

    it('營收 YoY +20% 應加分', () => {
      const result = predictEventDirection({ title: '法說會', type: '法說' }, { revenueYoY: 20 })
      expect(result.reasons.some((r) => r.includes('營收') && r.includes('佐證'))).toBe(true)
      // 法說 neutral(0) + 營收(+1) = 1 → flat（需 >= 2 才 up）
      expect(result.direction).toBe('flat')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('營收 YoY +20% + 外資買超 應回 up', () => {
      const result = predictEventDirection(
        { title: '法說會', type: '法說' },
        { revenueYoY: 20, foreignFlow: 5000 }
      )
      expect(result.direction).toBe('up') // 0 + 1 + 1 = 2 → up
      expect(result.confidence).toBeGreaterThanOrEqual(0.6)
      expect(result.reasons.some((r) => r.includes('營收'))).toBe(true)
      expect(result.reasons.some((r) => r.includes('外資'))).toBe(true)
    })

    it('營收 YoY -15% 應減分', () => {
      const result = predictEventDirection({ title: '法說會', type: '法說' }, { revenueYoY: -15 })
      expect(result.reasons.some((r) => r.includes('營收') && r.includes('拖累'))).toBe(true)
      // 法說 neutral(0) + 營收(-1) = -1 → flat（需 <= -2 才 down）
      expect(result.direction).toBe('flat')
    })

    it('營收 YoY -15% + 外資賣超 應回 down', () => {
      const result = predictEventDirection(
        { title: '法說會', type: '法說' },
        { revenueYoY: -15, foreignFlow: -3000 }
      )
      expect(result.direction).toBe('down') // 0 + (-1) + (-1) = -2 → down
      expect(result.confidence).toBeGreaterThanOrEqual(0.6)
    })

    it('外資買超應加分', () => {
      const result = predictEventDirection(
        { title: '新品發布', type: '新品' },
        { foreignFlow: 2000 }
      )
      expect(result.direction).toBe('up') // 新品(+1) + 外資(+1) = 2 → up
      expect(result.reasons.some((r) => r.includes('外資'))).toBe(true)
    })

    it('外資賣超應減分', () => {
      const result = predictEventDirection(
        { title: '新品發布', type: '新品' },
        { foreignFlow: -5000 }
      )
      expect(result.direction).toBe('flat') // 新品(+1) + 外資(-1) = 0 → flat
      expect(result.reasons.some((r) => r.includes('外資'))).toBe(true)
    })

    it('收盤分析看多結論應加分', () => {
      const result = predictEventDirection(
        { title: '法說會', type: '法說' },
        { lastAnalysisVerdict: '台達電看多，建議加碼' }
      )
      expect(result.reasons.some((r) => r.includes('收盤分析'))).toBe(true)
    })

    it('收盤分析看空結論應減分', () => {
      const result = predictEventDirection(
        { title: '法說會', type: '法說' },
        { lastAnalysisVerdict: '台積電看空，建議減碼停損' }
      )
      expect(result.reasons.some((r) => r.includes('收盤分析'))).toBe(true)
    })

    it('訊號不足時應回 flat 並給預設理由', () => {
      const result = predictEventDirection({ title: '股東會', type: '股東會' })
      expect(result.direction).toBe('flat')
      expect(result.reasons.some((r) => r.includes('訊號不足'))).toBe(true)
    })

    it('confidence 應在 0.2-0.9 之間', () => {
      const tests = [
        { event: { title: '法說會', type: '法說' }, ctx: {} },
        { event: { title: '法說會', type: '法說' }, ctx: { revenueYoY: 20, foreignFlow: 5000 } },
        { event: { title: '裁員', type: '裁員' }, ctx: { revenueYoY: -15, foreignFlow: -3000 } },
        {
          event: { title: '新品', type: '新品' },
          ctx: { foreignFlow: 2000, lastAnalysisVerdict: '看多加碼' },
        },
      ]
      for (const { event, ctx } of tests) {
        const result = predictEventDirection(event, ctx)
        expect(result.confidence).toBeGreaterThanOrEqual(0.2)
        expect(result.confidence).toBeLessThanOrEqual(0.9)
      }
    })

    it('多訊號疊加應提高 confidence', () => {
      const weak = predictEventDirection({ title: '法說會', type: '法說' }, {})
      const strong = predictEventDirection(
        { title: '法說會', type: '法說' },
        { revenueYoY: 25, foreignFlow: 8000, lastAnalysisVerdict: '看多加碼' }
      )
      expect(strong.confidence).toBeGreaterThan(weak.confidence)
    })
  })

  describe('predictAllEvents', () => {
    it('批次處理 3 個事件，每個都有 pred 和 predReasons', () => {
      const events = [
        { title: '2026 Q2 法說會', type: '法說', stocks: ['2308'], date: '2026-04-15' },
        { title: 'AI 伺服器新品發布', type: '新品', stocks: ['2330'], date: '2026-04-20' },
        { title: 'DRAM 報價降價', type: '降價', stocks: ['2330'], date: '2026-04-25' },
      ]
      const contextByStock = {
        2308: { revenueYoY: 20, foreignFlow: 5000 },
        2330: { revenueYoY: -15, foreignFlow: -3000 },
      }

      const results = predictAllEvents(events, contextByStock)

      expect(results).toHaveLength(3)
      for (const r of results) {
        expect(r).toHaveProperty('pred')
        expect(r).toHaveProperty('predConfidence')
        expect(r).toHaveProperty('predReasons')
        expect(r).toHaveProperty('predSource', 'knowledge-engine')
        expect(Array.isArray(r.predReasons)).toBe(true)
        expect(r.predReasons.length).toBeGreaterThan(0)
        expect(r.predConfidence).toBeGreaterThanOrEqual(0.2)
        expect(r.predConfidence).toBeLessThanOrEqual(0.9)
      }

      // 2308 法說會 + 營收正 + 外資買 → up
      expect(results[0].pred).toBe('up')
      // 2330 新品 + 營收負 + 外資賣 → flat (1 - 1 - 1 = -1)
      expect(results[1].pred).toBe('flat')
      // 2330 降價 + 營收負 + 外資賣 → down (-1 - 1 - 1 = -3)
      expect(results[2].pred).toBe('down')
    })

    it('空事件陣列應回傳空陣列', () => {
      expect(predictAllEvents([])).toEqual([])
      expect(predictAllEvents(null)).toEqual([])
      expect(predictAllEvents(undefined)).toEqual([])
    })

    it('沒有 context 的事件應使用預設判斷', () => {
      const events = [{ title: '股東會', type: '股東會', stocks: ['2308'], date: '2026-05-01' }]
      const results = predictAllEvents(events)
      expect(results).toHaveLength(1)
      expect(results[0].pred).toBe('flat')
      expect(results[0].predSource).toBe('knowledge-engine')
    })
  })
})
