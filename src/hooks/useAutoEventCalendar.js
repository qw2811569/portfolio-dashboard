import { useCallback } from 'react'
import { normalizeEventRecord } from '../lib/events.js'

/**
 * 自動事件行事曆 hook
 *
 * 兩層架構：
 * 1. Vercel Cron 每日 08:00 蒐集公共事件 → 寫入 Vercel Blob
 * 2. 前端 boot 時讀取 Blob 快照 + 即時 API fallback → 合併到 newsEvents
 *
 * 用戶持股篩選在前端做，所以不同用戶看到不同的持股相關事件，
 * 但共用的公共事件（FOMC、央行、財報季）所有人都看到。
 */
export function useAutoEventCalendar({ setNewsEvents }) {
  const fetchAutoEvents = useCallback(
    async (stockCodes = []) => {
      try {
        const codesSet = new Set(stockCodes)

        // 1. 嘗試讀取 Vercel Blob 的每日快照（cron 產生的）
        let snapshot = null
        try {
          const today = new Date().toISOString().slice(0, 10)
          const blobUrl = `/api/cron/collect-daily-events`
          const blobRes = await fetch(blobUrl, { signal: AbortSignal.timeout(5000) })
          if (blobRes.ok) {
            snapshot = await blobRes.json()
          }
        } catch {
          // Blob 讀取失敗，用 fallback API
        }

        // 2. Fallback: 即時呼叫 event-calendar API
        if (!snapshot) {
          try {
            const params = new URLSearchParams({ range: '30' })
            if (stockCodes.length > 0) params.set('codes', stockCodes.join(','))
            const res = await fetch(`/api/event-calendar?${params}`, {
              signal: AbortSignal.timeout(8000),
            })
            if (res.ok) {
              const data = await res.json()
              snapshot = { events: { fixed: data.events || [], mops: [] } }
            }
          } catch {
            // 全部失敗，靜默返回
            return []
          }
        }

        if (!snapshot?.events) return []

        // 3. 組裝事件：公共事件全部顯示，MOPS 事件按持股篩選
        const allEvents = []

        // 固定行事曆（所有用戶都看到）
        for (const event of snapshot.events.fixed || []) {
          allEvents.push({
            id: event.id,
            date: event.date,
            title: event.title,
            detail: '',
            type: event.type,
            source: 'auto-calendar',
            status: 'pending',
            pred: 'neutral',
            predReason: '',
            impact: event.impact || 'medium',
          })
        }

        // MOPS 事件（只顯示跟用戶持股相關的）
        for (const event of snapshot.events.mops || []) {
          const eventStocks = event.stocks || []
          const isRelevant = codesSet.size === 0 || eventStocks.some((c) => codesSet.has(c))
          if (!isRelevant) continue

          allEvents.push({
            id: event.id,
            date: event.date,
            title: event.title,
            detail: '',
            stocks: eventStocks.join(', '),
            type: event.type,
            source: 'mops',
            status: 'pending',
            pred: 'neutral',
            predReason: '',
            impact: event.impact || 'medium',
          })
        }

        // 4. Normalize 並合併到 newsEvents（去重）
        const normalized = allEvents.map((e) => normalizeEventRecord(e)).filter(Boolean)

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
