import { createElement as h, useEffect } from 'react'
import { Button } from '../common/Base.jsx'
import { OverlayPortal } from '../common/AppOverlay.jsx'
import { C, alpha } from '../../theme.js'
import {
  TRADE_DISCLAIMER_DOC_HREF,
  TRADE_DISCLAIMER_LEGAL_SUMMARY,
  TRADE_DISCLAIMER_POINTS,
} from '../../lib/tradeCompliance.js'

function getSubtitle(mode) {
  if (mode === 'confirm') {
    return '送出前，再一起確認一次這段交易說明。完成後就能回到確認寫入。'
  }
  return '進入交易頁前，先快速確認這段使用提醒。'
}

export function TradeDisclaimerModal({
  open,
  checked = false,
  onCheckedChange = () => {},
  onConfirm = () => {},
  mode = 'entry',
  docHref = TRADE_DISCLAIMER_DOC_HREF,
}) {
  useEffect(() => {
    if (!open) return undefined

    const getDialogElement = () => document.querySelector('[data-testid="trade-disclaimer-dialog"]')
    const focusPreferredControl = () => {
      const dialogElement = getDialogElement()
      if (!dialogElement) return

      const preferredTarget =
        dialogElement.querySelector('[data-testid="trade-disclaimer-checkbox"]') ||
        dialogElement.querySelector('[data-testid="trade-disclaimer-enter-btn"]')

      const fallbackTarget = resolveFocusable()[0]
      const target = preferredTarget || fallbackTarget
      if (!target || typeof target.focus !== 'function') return

      try {
        target.focus({ preventScroll: true })
      } catch {
        target.focus()
      }
    }

    const resolveFocusable = () => {
      const dialogElement = getDialogElement()
      if (!dialogElement) return []
      return Array.from(
        dialogElement.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          Boolean(element) &&
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true' &&
          (element.offsetWidth > 0 ||
            element.offsetHeight > 0 ||
            element.getClientRects().length > 0)
      )
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        focusPreferredControl()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = resolveFocusable()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      const isInsideDialog = getDialogElement()?.contains(activeElement)

      if (event.shiftKey) {
        if (activeElement === first || !isInsideDialog) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last || !isInsideDialog) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)

    const frame = window.requestAnimationFrame(() => {
      focusPreferredControl()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  if (!open) return null

  return h(
    OverlayPortal,
    {
      id: 'trade-disclaimer',
      kind: 'blocking',
      'data-testid': 'trade-disclaimer-modal',
      style: {
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: alpha(C.text, '70'),
      },
    },
    h(
      'div',
      {
        'data-testid': 'trade-disclaimer-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'trade-disclaimer-title',
        'aria-describedby': 'trade-disclaimer-copy',
        style: {
          width: 'min(560px, 100%)',
          maxHeight: 'min(92vh, 720px)',
          overflowY: 'auto',
          background: alpha(C.card, 'fc'),
          border: `1px solid ${alpha(C.amber, '32')}`,
          borderRadius: 12,
          boxShadow: `${C.insetLine}, ${C.shadow}, 0 24px 64px ${alpha(C.text, '1f')}`,
          padding: 20,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '0 12px',
            borderRadius: 8,
            background: C.amberBg,
            border: `1px solid ${alpha(C.amber, '28')}`,
            color: C.textSec,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 12,
          },
        },
        '交易頁提醒'
      ),
      h(
        'div',
        {
          id: 'trade-disclaimer-title',
          style: {
            fontSize: 20,
            lineHeight: 1.35,
            color: C.text,
            fontWeight: 700,
            marginBottom: 8,
          },
        },
        '交易記錄僅供參考'
      ),
      h(
        'div',
        {
          id: 'trade-disclaimer-copy',
          style: {
            fontSize: 13,
            lineHeight: 1.8,
            color: C.textSec,
            marginBottom: 16,
          },
        },
        getSubtitle(mode)
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 10,
            marginBottom: 16,
          },
        },
        TRADE_DISCLAIMER_POINTS.map((point, index) =>
          h(
            'div',
            {
              key: `trade-disclaimer-point-${index}`,
              style: {
                display: 'grid',
                gridTemplateColumns: '20px 1fr',
                gap: 10,
                alignItems: 'start',
                padding: '12px 14px',
                borderRadius: 12,
                background: index === 2 ? alpha(C.amber, '14') : C.card,
                border: `1px solid ${index === 2 ? alpha(C.amber, '24') : C.border}`,
              },
            },
            h(
              'span',
              {
                'aria-hidden': 'true',
                style: {
                  color: index === 2 ? C.amber : C.orange,
                  fontSize: 16,
                  lineHeight: 1.4,
                  fontWeight: 700,
                },
              },
              '•'
            ),
            h(
              'span',
              {
                style: {
                  color: C.textSec,
                  fontSize: 13,
                  lineHeight: 1.8,
                },
              },
              point
            )
          )
        )
      ),
      h(
        'label',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 52,
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${checked ? alpha(C.orange, '34') : C.border}`,
            background: checked ? alpha(C.orange, '12') : C.subtle,
            cursor: 'pointer',
            marginBottom: 16,
          },
        },
        h('input', {
          type: 'checkbox',
          checked,
          autoFocus: true,
          onChange: (event) => onCheckedChange(Boolean(event.target.checked)),
          'data-testid': 'trade-disclaimer-checkbox',
          style: {
            width: 20,
            height: 20,
            accentColor: C.orange,
            margin: 0,
            flexShrink: 0,
          },
        }),
        h(
          'span',
          {
            style: {
              color: C.text,
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: 600,
            },
          },
          '我已了解，進入交易頁'
        )
      ),
      h(
        'div',
        {
          style: {
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
            fontSize: 12,
            lineHeight: 1.75,
            color: C.textMute,
            marginBottom: 16,
          },
        },
        TRADE_DISCLAIMER_LEGAL_SUMMARY,
        ' ',
        h(
          'a',
          {
            href: docHref,
            target: '_blank',
            rel: 'noreferrer',
            style: {
              color: C.textSec,
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            },
          },
          '法律相關詳情'
        )
      ),
      h(
        Button,
        {
          'data-testid': 'trade-disclaimer-enter-btn',
          onClick: onConfirm,
          disabled: !checked,
          variant: 'filled',
          color: 'blue',
          size: 'lg',
          style: {
            width: '100%',
            minHeight: 48,
            borderRadius: 12,
            boxShadow: checked ? `${C.insetLine}, ${C.shadow}, ${C.focusRing}` : 'none',
          },
        },
        mode === 'confirm' ? '我已了解，回到確認' : '進入交易頁'
      )
    )
  )
}
