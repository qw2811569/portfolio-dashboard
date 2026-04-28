import { useEffect, useState } from 'react'
import { API_ENDPOINTS } from '../lib/apiEndpoints.js'

export function usePortfolioBenchmarkZScore(portfolioId) {
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState({
    requestKey: null,
    status: 'idle',
    data: null,
    error: null,
  })
  const requestKey = portfolioId ? `${portfolioId}:${reloadKey}` : null

  useEffect(() => {
    if (!portfolioId) return undefined

    const controller = new AbortController()
    const url = `${API_ENDPOINTS.PORTFOLIO_BENCHMARK_ZSCORE}?portfolioId=${encodeURIComponent(portfolioId)}`

    fetch(url, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`)
        }

        setResult({
          requestKey,
          status: payload?.status === 'ready' ? 'ready' : 'unavailable',
          data: payload,
          error: null,
        })
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setResult({
          requestKey,
          status: 'error',
          data: null,
          error,
        })
      })

    return () => controller.abort()
  }, [portfolioId, requestKey])

  if (!portfolioId) {
    return {
      status: 'idle',
      data: null,
      error: null,
      loading: false,
      retry: () => {},
    }
  }

  if (result.requestKey !== requestKey) {
    return {
      status: 'loading',
      data: null,
      error: null,
      loading: true,
      retry: () => setReloadKey((current) => current + 1),
    }
  }

  return {
    status: result.status,
    data: result.data,
    error: result.error,
    loading: result.status === 'idle',
    retry: () => setReloadKey((current) => current + 1),
  }
}
