import { useCallback } from 'react'
import { normalizeToneKey } from '../lib/toneResolver.js'
import { normalizeWatchlist } from '../lib/watchlistUtils.js'

export function useWatchlistActions({ setWatchlist = () => {} }) {
  const upsertWatchlist = useCallback(
    (draft, editingCode = null) => {
      const code = String(draft?.code || '').trim()
      const name = String(draft?.name || '').trim()
      if (!code || !name) return false

      const price = parseFloat(draft?.price) || 0
      const target = parseFloat(draft?.target) || 0
      const now = new Date().toISOString()
      const nextItem = {
        code,
        name,
        price: price > 0 ? price : 0,
        target: target > 0 ? target : 0,
        status: String(draft?.status || '').trim(),
        catalyst: String(draft?.catalyst || '').trim(),
        scKey: normalizeToneKey(draft?.scKey, 'info'),
        note: String(draft?.note || '').trim(),
        createdAt: String(draft?.createdAt || '').trim() || now,
        updatedAt: now,
      }

      setWatchlist((prev) => {
        const current = Array.isArray(prev) ? [...prev] : []
        const nextRows = editingCode
          ? current.map((item) =>
              item.code === editingCode
                ? {
                    ...nextItem,
                    createdAt: String(item?.createdAt || nextItem.createdAt).trim(),
                  }
                : item
            )
          : [...current.filter((item) => item.code !== nextItem.code), nextItem]
        return normalizeWatchlist(nextRows)
      })
      return true
    },
    [setWatchlist]
  )

  const removeWatchlist = useCallback(
    (code) => {
      setWatchlist((prev) => normalizeWatchlist((prev || []).filter((item) => item.code !== code)))
    },
    [setWatchlist]
  )

  return {
    upsertWatchlist,
    removeWatchlist,
  }
}
