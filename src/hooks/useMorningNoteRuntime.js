import { useEffect, useMemo, useState } from 'react'
import { API_ENDPOINTS } from '../lib/apiEndpoints.js'
import { buildMorningNote } from '../lib/morningNoteBuilder.js'

function buildLocalFallbackNote({ holdings, theses, newsEvents, watchlist }) {
  return {
    ...buildMorningNote({
      holdings: holdings || [],
      theses,
      events: newsEvents || [],
      watchlist: watchlist || [],
      institutional: null,
      announcements: [],
    }),
    staleStatus: 'stale',
    source: 'local-runtime-fallback',
  }
}

export function useMorningNoteRuntime({
  portfolioId = '',
  portfolioName = '',
  viewMode = '',
  holdings,
  theses,
  newsEvents,
  watchlist,
  fetchImpl = globalThis.fetch,
}) {
  const localFallbackNote = useMemo(
    () => buildLocalFallbackNote({ holdings, theses, newsEvents, watchlist }),
    [holdings, theses, newsEvents, watchlist]
  )
  const [remoteState, setRemoteState] = useState({
    requestKey: '',
    status: 'idle',
    note: null,
  })

  useEffect(() => {
    const normalizedPortfolioId = String(portfolioId || '').trim()

    if (!normalizedPortfolioId || typeof fetchImpl !== 'function') return undefined

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    let active = true
    const url = new URL(API_ENDPOINTS.MORNING_NOTE, window.location.origin)
    url.searchParams.set('portfolioId', normalizedPortfolioId)
    if (String(portfolioName || '').trim()) {
      url.searchParams.set('portfolioName', String(portfolioName || '').trim())
    }
    if (String(viewMode || '').trim()) {
      url.searchParams.set('viewMode', String(viewMode || '').trim())
    }

    fetchImpl(url.pathname + url.search, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller?.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!active) return

        if (!response.ok) {
          throw new Error(payload?.error || `morning note fetch failed (${response.status})`)
        }

        setRemoteState({
          requestKey: normalizedPortfolioId,
          status: 'success',
          note: payload?.note || null,
        })
      })
      .catch(() => {
        if (!active) return
        setRemoteState({
          requestKey: normalizedPortfolioId,
          status: 'error',
          note: null,
        })
      })

    return () => {
      active = false
      controller?.abort()
    }
  }, [portfolioId, portfolioName, viewMode, fetchImpl])

  if (!String(portfolioId || '').trim()) return localFallbackNote
  if (remoteState.requestKey !== String(portfolioId || '').trim()) return null
  if (remoteState.status === 'success') return remoteState.note
  if (remoteState.status === 'error') return localFallbackNote
  return null
}
