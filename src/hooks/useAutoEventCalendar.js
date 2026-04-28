import { useCallback } from 'react'
import { API_ENDPOINTS } from '../lib/apiEndpoints.js'
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
        const res = await fetch(`${API_ENDPOINTS.EVENT_CALENDAR}?${params}`, {
          signal: AbortSignal.timeout(8000),
        })

        if (!res.ok) {
          return []
        }

        const data = await res.json()
        const events = data.events || []
        const sourceUpdatedAt = String(data.generatedAt || '').trim() || new Date().toISOString()

        if (events.length === 0) return []

        // Normalize 並合併到 newsEvents（去重）
        const normalized = events
          .map((event) =>
            normalizeEventRecord({
              ...event,
              eventDate: event?.eventDate || event?.date || null,
              sourceUpdatedAt: event?.sourceUpdatedAt || sourceUpdatedAt,
            })
          )
          .filter(Boolean)

        if (normalized.length === 0) return []

        setNewsEvents((prev) => {
          const current = Array.isArray(prev) ? [...prev] : []
          const indexById = new Map(current.map((event, index) => [event?.id, index]))
          let changed = false

          for (const nextEvent of normalized) {
            const existingIndex = indexById.get(nextEvent.id)
            if (existingIndex == null) {
              current.push(nextEvent)
              indexById.set(nextEvent.id, current.length - 1)
              changed = true
              continue
            }

            const existing = current[existingIndex]
            const merged = normalizeEventRecord({
              ...existing,
              ...nextEvent,
              status: existing?.status || nextEvent.status,
              trackingStart: existing?.trackingStart || nextEvent.trackingStart,
              exitDate: existing?.exitDate || nextEvent.exitDate,
              reviewDate: existing?.reviewDate || nextEvent.reviewDate,
              actual: existing?.actual || nextEvent.actual,
              actualNote: existing?.actualNote || nextEvent.actualNote,
              lessons: existing?.lessons || nextEvent.lessons,
              correct:
                typeof existing?.correct === 'boolean' ? existing.correct : nextEvent.correct,
              stockOutcomes:
                Array.isArray(existing?.stockOutcomes) && existing.stockOutcomes.length > 0
                  ? existing.stockOutcomes
                  : nextEvent.stockOutcomes,
            })

            if (JSON.stringify(existing) !== JSON.stringify(merged)) {
              current[existingIndex] = merged
              changed = true
            }
          }

          return changed ? current : prev
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
