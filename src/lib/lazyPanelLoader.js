import { captureClientDiagnostic } from './runtimeLogger.js'

const LAZY_PANEL_RELOAD_KEY = 'pf-lazy-panel-reload-v1'

export function isRecoverableLazyPanelError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('importing a module script failed') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('module script') ||
    message.includes('dynamically imported module')
  )
}

function getStorage(storage) {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.sessionStorage || null
}

function readReloadState(storage) {
  const target = getStorage(storage)
  if (!target) return {}
  try {
    const raw = target.getItem(LAZY_PANEL_RELOAD_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeReloadState(state, storage) {
  const target = getStorage(storage)
  if (!target) return false
  try {
    target.setItem(LAZY_PANEL_RELOAD_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearLazyPanelReloadState(panelKey, storage) {
  if (!panelKey) return
  const state = readReloadState(storage)
  if (!(panelKey in state)) return
  delete state[panelKey]
  writeReloadState(state, storage)
}

export function markLazyPanelReload(panelKey, storage) {
  if (!panelKey) return false
  const state = readReloadState(storage)
  if (state[panelKey]) return false
  state[panelKey] = Date.now()
  return writeReloadState(state, storage)
}

export function createLazyPanelLoader({
  loader,
  panelKey,
  exportName = '',
  storage,
  captureDiagnostic = captureClientDiagnostic,
  reload = () => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload()
    }
  },
} = {}) {
  return async () => {
    try {
      const module = await loader()
      clearLazyPanelReloadState(panelKey, storage)
      return exportName ? { default: module[exportName] } : module
    } catch (error) {
      captureDiagnostic('lazy-panel-load', error, {
        panelKey,
        scope: panelKey ? `${panelKey}-panel` : null,
      })

      if (isRecoverableLazyPanelError(error) && markLazyPanelReload(panelKey, storage)) {
        reload()
        return new Promise(() => {})
      }

      throw error
    }
  }
}
