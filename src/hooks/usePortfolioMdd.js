import { useEffect, useState } from 'react'
import { API_ENDPOINTS } from '../lib/apiEndpoints.js'

export function usePortfolioMdd(portfolioId) {
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState({ requestKey: null, data: null, error: null })
  const requestKey = portfolioId ? `${portfolioId}:${reloadKey}` : null

  useEffect(() => {
    if (!portfolioId) {
      return
    }

    const controller = new AbortController()

    fetch(`${API_ENDPOINTS.PORTFOLIO_MDD}?portfolioId=${encodeURIComponent(portfolioId)}`, {
      signal: controller.signal,
    })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))
      )
      .then((data) => {
        setResult({ requestKey, data, error: null })
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setResult({ requestKey, data: null, error })
      })

    return () => controller.abort()
  }, [portfolioId, requestKey])

  const state = !portfolioId
    ? { loading: false, data: null, error: null }
    : result.requestKey === requestKey
      ? { loading: false, data: result.data, error: result.error }
      : { loading: true, data: null, error: null }

  return {
    ...state,
    retry: () => setReloadKey((current) => current + 1),
  }
}
