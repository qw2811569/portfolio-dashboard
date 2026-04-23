import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { buildAccuracyGateBlockModel } from '../../lib/accuracyGateUi.js'
import { Button, Card } from './Base.jsx'

const lbl = {
  fontSize: 11,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 600,
  marginBottom: 4,
}

export function AccuracyGateBlock({
  reason,
  resource,
  onRetry,
  onDismiss,
  context = {},
  retryDisabled = false,
}) {
  const copy = buildAccuracyGateBlockModel({
    reason,
    resource,
    context: {
      ...context,
      retryDisabled: retryDisabled || context.retryDisabled,
    },
  })

  return h(
    Card,
    {
      'data-testid': 'accuracy-gate-block',
      'data-reason': copy.reason,
      'data-resource': copy.resource,
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '60')}`,
        background: `linear-gradient(180deg, ${alpha(C.card, 'f6')}, ${alpha(C.amber, '0c')})`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h(
          'div',
          { style: { ...lbl, color: C.textSec } },
          `${copy.resourceLabel} · ${copy.reasonLabel}`
        ),
        h(
          'div',
          {
            style: {
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.5,
            },
          },
          copy.headline
        )
      )
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.8,
          marginBottom: 12,
        },
      },
      copy.body
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        },
      },
      h(
        Button,
        {
          'data-testid': 'accuracy-gate-dismiss',
          onClick: () => onDismiss?.(),
          variant: 'ghost',
          color: 'default',
          size: 'sm',
          style: {
            minHeight: 44,
            padding: '10px 14px',
          },
        },
        '晚一點再看'
      ),
      h(
        Button,
        {
          'data-testid': 'accuracy-gate-retry',
          onClick: () => onRetry?.(),
          disabled: copy.retryDisabled || typeof onRetry !== 'function',
          variant: 'ghost',
          color: 'amber',
          size: 'sm',
          style: {
            minHeight: 44,
            padding: '10px 14px',
          },
        },
        copy.retryDisabled ? '稍後再試' : '重試'
      )
    )
  )
}
