import { useMemo } from 'react'
import { resolveDashboardAccuracyGate, resolveHoldingsAccuracyGate } from '../lib/accuracyGateUi.js'
import { normalizeSoftErrorStatus } from '../lib/dataError.js'
import { useTrackedStocksSyncStatus } from './useTrackedStocksSyncStatus.js'

const AUTH_BANNER = {
  kind: 'auth',
  headline: '需要重新登入 · 前往登入',
  body: '這輪登入 session 沒帶上，我先沿用前一版數字，重新登入後會自動補正。',
  action: 'login',
  actionLabel: '前往登入',
}

const SERVICE_BANNER = {
  kind: 'service',
  headline: '資料源暫時卡住 · 系統先用前一版數字撐 · 稍後自動補正',
  body: '',
  action: 'retry',
  actionLabel: '重試全部',
}

function getHoldingTargetError(holdingDossiers = []) {
  return (Array.isArray(holdingDossiers) ? holdingDossiers : []).find(
    (dossier) => dossier?.targetFetchError?.status
  )?.targetFetchError
}

function getReportRefreshFailure(reportRefreshMeta = {}) {
  return Object.entries(reportRefreshMeta || {}).find(([code, entry]) => {
    if (String(code || '').trim() === '__daily') return false
    return entry?.lastStatus === 'failed' && entry?.errorStatus
  })?.[1]
}

function resolveFailureCategory({ reason = '', status = null } = {}) {
  if (reason === 'auth-required') return 'auth'

  const normalizedStatus = normalizeSoftErrorStatus(status)
  if (normalizedStatus === 401) return 'auth'
  if (normalizedStatus === 'offline') return 'offline'
  return 'service'
}

function buildBanner(failures = []) {
  const authCount = failures.filter((failure) => failure.category === 'auth').length
  return authCount > 0 && authCount >= failures.length - authCount ? AUTH_BANNER : SERVICE_BANNER
}

export function useUpstreamHealth({
  panel = 'holdings',
  activePortfolioId = '',
  holdingDossiers = [],
  dataRefreshRows = [],
  marketPriceSync = null,
  reportRefreshMeta = {},
} = {}) {
  const { syncState, badge } = useTrackedStocksSyncStatus(activePortfolioId)

  const accuracyGate = useMemo(
    () =>
      panel === 'dashboard'
        ? resolveDashboardAccuracyGate({ holdingDossiers, dataRefreshRows })
        : resolveHoldingsAccuracyGate({ holdingDossiers }),
    [dataRefreshRows, holdingDossiers, panel]
  )

  const failures = useMemo(() => {
    const nextFailures = []

    if (accuracyGate?.reason) {
      nextFailures.push({
        source: 'accuracy-gate',
        category: resolveFailureCategory({ reason: accuracyGate.reason }),
        reason: accuracyGate.reason,
      })
    }

    const targetFetchError = getHoldingTargetError(holdingDossiers)
    if (targetFetchError?.status) {
      nextFailures.push({
        source: 'target-prices',
        category: resolveFailureCategory({ status: targetFetchError.status }),
        status: targetFetchError.status,
      })
    }

    if (syncState?.status === 'failed' && syncState?.errorStatus) {
      nextFailures.push({
        source: 'tracked-stocks',
        category: resolveFailureCategory({ status: syncState.errorStatus }),
        status: syncState.errorStatus,
      })
    }

    const reportRefreshFailure = getReportRefreshFailure(reportRefreshMeta)
    if (reportRefreshFailure?.errorStatus) {
      nextFailures.push({
        source: 'analyst-reports',
        category: resolveFailureCategory({ status: reportRefreshFailure.errorStatus }),
        status: reportRefreshFailure.errorStatus,
      })
    }

    if (marketPriceSync?.status === 'failed') {
      nextFailures.push({
        source: 'market-prices',
        category: 'service',
        status: '5xx',
      })
    }

    return nextFailures
  }, [accuracyGate, holdingDossiers, marketPriceSync, reportRefreshMeta, syncState])

  const shouldCollapseBanners = failures.length >= 2

  return {
    accuracyGate,
    badge,
    banner: shouldCollapseBanners ? buildBanner(failures) : null,
    failures,
    failureCount: failures.length,
    shouldCollapseBanners,
    syncState,
  }
}
