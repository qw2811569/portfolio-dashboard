import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'

const BADGE_META = {
  fresh: {
    color: C.up,
    background: C.upBg,
    border: alpha(C.up, '24'),
    title: '資料狀態良好',
  },
  stale: {
    color: C.amber,
    background: alpha(C.amber, '16'),
    border: alpha(C.amber, '28'),
    title: '資料需要更新',
  },
  missing: {
    color: C.textMute,
    background: alpha(C.textMute, '12'),
    border: alpha(C.textMute, '20'),
    title: '資料缺失',
  },
  failed: {
    color: C.down,
    background: C.downBg,
    border: alpha(C.down, '28'),
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

export function StaleBadge({
  status = '',
  dossier = null,
  field = '',
  label = '',
  title = '',
  style = {},
}) {
  const resolvedStatus = resolveStatus({ status, dossier, field })
  if (!resolvedStatus) return null

  const meta = BADGE_META[resolvedStatus] || BADGE_META.missing

  return h(
    'span',
    {
      title: title || meta.title,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.background,
        color: meta.color,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: 1.2,
        textTransform: 'lowercase',
        ...style,
      },
    },
    label || resolvedStatus
  )
}
