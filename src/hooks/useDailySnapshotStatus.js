import { useEffect, useState } from 'react'
import { API_ENDPOINTS } from '../lib/apiEndpoints.js'

export function useDailySnapshotStatus({ fetchImpl = globalThis.fetch } = {}) {
  const [state, setState] = useState({
    status: 'idle',
    data: null,
  })

  useEffect(() => {
    if (typeof fetchImpl !== 'function') return undefined

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    let active = true

    fetchImpl(API_ENDPOINTS.DAILY_SNAPSHOT_STATUS, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller?.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!active) return
        if (!response.ok) {
          throw new Error(payload?.error || `daily snapshot status failed (${response.status})`)
        }

        setState({
          status: 'success',
          data: payload,
        })
      })
      .catch(() => {
        if (!active) return
        setState({
          status: 'error',
          data: null,
        })
      })

    return () => {
      active = false
      controller?.abort()
    }
  }, [fetchImpl])

  return state.status === 'success' ? state.data : null
}
