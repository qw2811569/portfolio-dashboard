import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'

const TONE_META = {
  muted: {
    dot: alpha(C.textMute, 'c8'),
    border: alpha(C.textMute, '22'),
    background: alpha(C.textMute, '10'),
  },
  positive: {
    dot: C.up,
    border: alpha(C.up, '24'),
    background: C.upBg,
  },
  warning: {
    dot: C.amber,
    border: alpha(C.amber, '28'),
    background: alpha(C.amber, '10'),
  },
  negative: {
    dot: C.down,
    border: alpha(C.down, '28'),
    background: C.downBg,
  },
}

export function SoftMessage({ children, tone = 'muted', style = {} }) {
  const meta = TONE_META[tone] || TONE_META.muted

  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 11px',
        borderRadius: 12,
        border: `1px solid ${meta.border}`,
        background: meta.background,
        color: C.text,
        fontSize: 10,
        lineHeight: 1.6,
        minHeight: 42,
        ...style,
      },
    },
    h('span', {
      'aria-hidden': 'true',
      style: {
        width: 8,
        height: 8,
        marginTop: 4,
        borderRadius: '50%',
        background: meta.dot,
        flexShrink: 0,
      },
    }),
    h('span', null, children)
  )
}
