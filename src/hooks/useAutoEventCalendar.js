import { useCallback } from 'react'
import { normalizeEventRecord } from '../lib/events.js'

/**
 * 自動事件行事曆 hook
 *
 * 直接呼叫 /api/event-calendar 即時 API 獲取事件資料
 * 事件來源包括：
 * 1. 月營收公布日（每月 1-10 號）
 * 2. FOMC、台灣央行等固定行事曆
 * 3. 除權息預估
 * 4. FinMind 個股新聞（篩選法說/股東會/除權息關鍵字）
 *
 * 用戶持股篩選在前端做，所以不同用戶看到不同的持股相關事件，
 * 但共用的公共事件（FOMC、央行、財報季）所有人都看到。
 */
export function useAutoEventCalendar({ setNewsEvents }) {
  const fetchAutoEvents = useCallback(
    async (stockCodes = []) => {
      try {
        // 直接呼叫 event-calendar API（不需要經過 cron endpoint）
        const params = new URLSearchParams({ range: '30' })
        if (stockCodes.length > 0) params.set('codes', stockCodes.join(','))
        const res = await fetch(`/api/event-calendar?${params}`, {
          signal: AbortSignal.timeout(8000),
        })

        if (!res.ok) {
          return []
        }

        const data = await res.json()
        const events = data.events || []

        if (events.length === 0) return []

        // Normalize 並合併到 newsEvents（去重）
        const normalized = events.map((e) => normalizeEventRecord(e)).filter(Boolean)

        if (normalized.length === 0) return []

        setNewsEvents((prev) => {
          const existingIds = new Set((prev || []).map((e) => e.id))
          const newOnes = normalized.filter((e) => !existingIds.has(e.id))
          if (newOnes.length === 0) return prev
          return [...(prev || []), ...newOnes]
        })

        return normalized
      } catch (error) {
        console.warn('自動事件行事曆載入失敗:', error)
        return []
      }
    },
    [setNewsEvents]
  )

  return { fetchAutoEvents }
}
