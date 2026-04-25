import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { resolveStaleBadgeResourceState } from '../../lib/staleBadge.js'

const BADGE_META = {
  fresh: {
    label: '最新',
    color: C.textSec,
    background: C.upBg,
    border: alpha(C.up, '24'),
    dot: C.up,
    title: '資料狀態良好',
  },
  stale: {
    label: '偏舊',
    color: C.textSec,
    background: alpha(C.amber, '16'),
    border: alpha(C.amber, '28'),
    dot: C.amber,
    title: '資料需要更新',
  },
  missing: {
    label: '待補',
    color: C.textMute,
    background: alpha(C.textMute, '12'),
    border: alpha(C.textMute, '20'),
    title: '資料缺失',
  },
  failed: {
    label: '失敗',
    color: C.down,
    background: C.downBg,
    border: alpha(C.down, '28'),
    dot: C.down,
    title: '資料同步失敗',
  },
}

export function normalizeStaleBadgeStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
  if (normalized === 'aging') return 'stale'
  if (normalized === 'fresh') return 'fresh'
  if (normalized === 'stale') return 'stale'
  if (normalized === 'missing') return 'missing'
  if (normalized === 'failed') return 'failed'
  return ''
}

function resolveStatus({ status, dossier, field }) {
  if (status) return normalizeStaleBadgeStatus(status)
  if (!dossier || !field) return ''
  return normalizeStaleBadgeStatus(dossier?.freshness?.[field])
}

function resolveResourceDates({ resource, updatedAt, dossier, field }) {
  if (updatedAt != null) return updatedAt

  const normalizedField = String(field || resource || '')
    .trim()
    .toLowerCase()

  if (!dossier || !normalizedField) return null

  if (normalizedField === 'targets') {
    const reportDates = Array.isArray(dossier?.targets)
      ? dossier.targets.map((report) => report?.date)
      : []
    return [dossier?.targets?.updatedAt, dossier?.targetAggregate?.rateDate, ...reportDates]
  }

  if (normalizedField === 'fundamentals') {
    return [dossier?.fundamentals?.updatedAt]
  }

  if (normalizedField === 'restore') {
    return [dossier?.lastSuccessAt, dossier?.updatedAt]
  }

  return null
}

export function StaleBadge({
  status = '',
  dossier = null,
  field = '',
  resource = '',
  updatedAt = null,
  showFresh = false,
  label = '',
  title = '',
  style = {},
  ...restProps
}) {
  let resolvedStatus = ''
  let resolvedText = ''

  if (resource) {
    const resourceState = resolveStaleBadgeResourceState({
      resource,
      updatedAt: resolveResourceDates({ resource, updatedAt, dossier, field }),
      status: normalizeStaleBadgeStatus(status),
    })
    resolvedStatus = normalizeStaleBadgeStatus(resourceState.status)
    resolvedText = resourceState.text
    if (!resolvedStatus) return null
    if (resolvedStatus === 'fresh' && !showFresh) return null
  } else {
    resolvedStatus = resolveStatus({ status, dossier, field })
    if (!resolvedStatus) return null
  }

  const meta = BADGE_META[resolvedStatus] || BADGE_META.missing
  const badgeText =
    label && resolvedText ? `${label} · ${resolvedText}` : label || resolvedText || meta.label

  return h(
    'span',
    {
      title: title || meta.title,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.background,
        color: meta.color,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.2,
        textTransform: 'none',
        ...style,
      },
      ...restProps,
    },
    meta.dot &&
      h('span', {
        'aria-hidden': 'true',
        style: {
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: meta.dot,
          flexShrink: 0,
        },
      }),
    badgeText
  )
}
