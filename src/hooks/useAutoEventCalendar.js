import { useCallback } from 'react'
import { normalizeEventRecord } from '../lib/events.js'

/**
 * 自動事件行事曆 hook
 * 從 /api/event-calendar 取得自動產生的事件（月營收、FOMC、央行、法說會等）
 * 合併到現有 newsEvents，避免重複
 */
export function useAutoEventCalendar({ setNewsEvents }) {
  const fetchAutoEvents = useCallback(
    async (stockCodes = []) => {
      try {
        const params = new URLSearchParams({ range: '30' })
        if (stockCodes.length > 0) {
          params.set('codes', stockCodes.join(','))
        }
        const res = await fetch(`/api/event-calendar?${params}`)
        if (!res.ok) return []

        const data = await res.json()
        const autoEvents = (data.events || [])
          .map((event) =>
            normalizeEventRecord({
              ...event,
              id: event.id || `auto-${event.date}-${event.type}`,
              date: event.date,
              title: event.title,
              detail: event.detail || '',
              stocks: Array.isArray(event.stocks) ? event.stocks.join(', ') : '',
              pred: event.pred || 'neutral',
              predReason: event.predReason || '',
              status: event.status || 'pending',
            })
          )
          .filter(Boolean)

        if (autoEvents.length === 0) return []

        // 合併到 newsEvents，用 id 去重
        setNewsEvents((prev) => {
          const existingIds = new Set((prev || []).map((e) => e.id))
          const newOnes = autoEvents.filter((e) => !existingIds.has(e.id))
          if (newOnes.length === 0) return prev
          return [...(prev || []), ...newOnes]
        })

        return autoEvents
      } catch (error) {
        console.warn('自動事件行事曆載入失敗:', error)
        return []
      }
    },
    [setNewsEvents]
  )

  return { fetchAutoEvents }
}
