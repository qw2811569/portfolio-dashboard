import { useEffect, useState } from 'react'
import { C, alpha } from '../../theme.js'
import {
  getErrorRetryDelayMs,
  getSoftErrorCopy,
  isRetryableDataErrorStatus,
  normalizeSoftErrorStatus,
} from '../../lib/dataError.js'
import { Button } from './Base.jsx'

const toneByStatus = {
  401: {
    dot: C.amber,
    border: alpha(C.amber, '30'),
    background: alpha(C.amber, '10'),
    color: C.textSec,
  },
  404: {
    dot: C.textMute,
    border: alpha(C.textMute, '22'),
    background: alpha(C.textMute, '10'),
    color: C.textSec,
  },
  '5xx': {
    dot: C.down,
    border: alpha(C.down, '28'),
    background: alpha(C.down, '10'),
    color: C.textSec,
  },
  offline: {
    dot: C.ink,
    border: alpha(C.ink, '26'),
    background: alpha(C.ink, '10'),
    color: C.textSec,
  },
}

function resolveRetryLabel(status) {
  return normalizeSoftErrorStatus(status) === 401 ? '重新整理' : '再試一次'
}

export function DataError({
  status,
  resource = '',
  onRetry = null,
  onDismiss = null,
  retryBehavior = 'auto',
  maxAutoRetries = 3,
  style = {},
}) {
  const normalizedStatus = normalizeSoftErrorStatus(status) || '5xx'
  const tone = toneByStatus[normalizedStatus] || toneByStatus['5xx']
  const copy = getSoftErrorCopy(normalizedStatus, resource)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (retryBehavior !== 'auto' || typeof onRetry !== 'function') return undefined
    if (!isRetryableDataErrorStatus(normalizedStatus)) return undefined
    if (attempt >= Math.max(0, Number(maxAutoRetries) || 0)) return undefined

    const timer = window.setTimeout(() => {
      onRetry()
      setAttempt((current) => current + 1)
    }, getErrorRetryDelayMs(attempt))

    return () => window.clearTimeout(timer)
  }, [attempt, maxAutoRetries, normalizedStatus, onRetry, retryBehavior])

  return (
    <div
      data-error={resource}
      data-error-status={String(normalizedStatus)}
      style={{
        display: 'grid',
        gap: 8,
        padding: '8px 12px',
        borderRadius: C.radii.md,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        boxShadow: `inset 0 1px 0 ${alpha('#ffffff', '8a')}`,
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '10px minmax(0, 1fr)',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tone.dot,
            boxShadow: `0 0 0 3px ${alpha(tone.dot, '18')}`,
          }}
        />
        <span style={{ color: tone.color, fontSize: 12, lineHeight: 1.7, fontWeight: 600 }}>
          {copy}
        </span>
      </div>

      {(typeof onRetry === 'function' || typeof onDismiss === 'function') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {typeof onRetry === 'function' && (
            <Button
              color="amber"
              size="sm"
              style={{ textTransform: 'none' }}
              onClick={() => onRetry()}
            >
              {resolveRetryLabel(normalizedStatus)}
            </Button>
          )}
          {typeof onDismiss === 'function' && (
            <Button size="sm" style={{ textTransform: 'none' }} onClick={() => onDismiss()}>
              先收起
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
