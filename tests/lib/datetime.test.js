import { describe, it, expect } from 'vitest'
import {
  getTaipeiClock,
  parseStoredDate,
  todayStorageDate,
  canRunPostClosePriceSync,
} from '../../src/lib/datetime.js'

describe('lib/datetime.js', () => {
  describe('todayStorageDate', () => {
    it('應該返回今天的日期字串', () => {
      const today = todayStorageDate()
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('parseStoredDate', () => {
    it('應該解析有效的日期字串', () => {
      const date = parseStoredDate('2026-03-27')
      expect(date).toBeInstanceOf(Date)
      expect(date.getFullYear()).toBe(2026)
      expect(date.getMonth() + 1).toBe(3)
      expect(date.getDate()).toBe(27)
    })

    it('應該返回 null 如果無效輸入', () => {
      expect(parseStoredDate(null)).toBe(null)
      expect(parseStoredDate('')).toBe(null)
      expect(parseStoredDate('invalid')).toBe(null)
    })
  })

  describe('getTaipeiClock', () => {
    it('應該返回台北時間資訊', () => {
      const clock = getTaipeiClock(new Date('2026-03-27T10:30:00+08:00'))
      expect(clock).toHaveProperty('marketDate')
      expect(clock).toHaveProperty('hour')
      expect(clock).toHaveProperty('minute')
      expect(clock).toHaveProperty('isWeekend')
    })
  })

  describe('canRunPostClosePriceSync', () => {
    it('應該返回正確的同步狀態', () => {
      // 測試非交易日（週末）
      const weekend = new Date('2026-03-28T15:00:00+08:00') // 星期六
      const result = canRunPostClosePriceSync(weekend)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('market-closed')
    })
  })
})
