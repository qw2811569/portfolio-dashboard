import { useEffect, useRef } from 'react'

function getTaipeiDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export function usePostCloseSilentSync({
  ready,
  viewMode,
  portfolioViewMode,
  activePortfolioId,
  syncPostClosePrices,
  ritualMode = 'post-close',
}) {
  const ritualSyncRef = useRef({})

  useEffect(() => {
    if (!ready || viewMode !== portfolioViewMode) return

    const ritualKey = `${activePortfolioId}:${ritualMode}:${getTaipeiDateKey()}`
    if (ritualSyncRef.current[ritualKey]) return
    ritualSyncRef.current[ritualKey] = 'pending'

    syncPostClosePrices({
      silent: true,
      ritualMode,
      reason: 'post-close-ritual',
    })
      .then(() => {
        ritualSyncRef.current[ritualKey] = 'done'
      })
      .catch((err) => {
        delete ritualSyncRef.current[ritualKey]
        console.warn('收盤價靜默同步失敗:', err)
      })
  }, [ready, viewMode, portfolioViewMode, activePortfolioId, ritualMode, syncPostClosePrices])
}
