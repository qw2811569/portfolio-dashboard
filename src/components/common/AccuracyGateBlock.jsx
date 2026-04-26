import { createElement as h, useMemo } from 'react'
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
  onLogin,
  onDismiss,
  context = {},
  retryDisabled = false,
  loginHref = '',
}) {
  const copy = buildAccuracyGateBlockModel({
    reason,
    resource,
    context: {
      ...context,
      retryDisabled: retryDisabled || context.retryDisabled,
    },
  })
  const resolvedLoginHref = useMemo(() => {
    if (loginHref) return loginHref
    if (typeof window === 'undefined') return ''
    return window.location.href
  }, [loginHref])

  return h(
    Card,
    {
      'data-testid': 'accuracy-gate-block',
      'data-reason': copy.reason,
      'data-resource': copy.resource,
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '60')}`,
        background: alpha(C.card, 'f6'),
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
      copy.requiresLogin
        ? resolvedLoginHref
          ? h(
              'a',
              {
                'data-testid': 'accuracy-gate-login',
                href: resolvedLoginHref,
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 44,
                  minHeight: 44,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${alpha(C.amber, '2a')}`,
                  background: alpha(C.amber, '12'),
                  color: C.textSec,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                },
              },
              '前往登入'
            )
          : h(
              Button,
              {
                'data-testid': 'accuracy-gate-login',
                onClick: () => onLogin?.(),
                variant: 'ghost',
                color: 'amber',
                size: 'sm',
                style: {
                  minHeight: 44,
                  padding: '10px 14px',
                },
              },
              '前往登入'
            )
        : h(
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
