import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { calculateEventCountdown } from '../../lib/eventCountdown.js'

const BADGE_STYLE = {
  today: {
    color: C.down,
    background: alpha(C.down, '12'),
    border: alpha(C.down, '30'),
    fontWeight: 700,
  },
  imminent: {
    color: C.textSec,
    background: alpha(C.amber, '12'),
    border: alpha(C.amber, '30'),
    fontWeight: 600,
    dot: C.amber,
  },
  soon: {
    color: C.textSec,
    background: alpha(C.iron, '10'),
    border: alpha(C.iron, '24'),
    fontWeight: 600,
    dot: C.iron,
  },
  far: {
    color: C.textSec,
    background: alpha(C.iron, '10'),
    border: alpha(C.iron, '24'),
    fontWeight: 500,
    dot: C.iron,
  },
  past: {
    color: C.choco,
    background: alpha(C.choco, '12'),
    border: alpha(C.choco, '2c'),
    fontWeight: 600,
  },
}

export function EventCountdownBadge({ event, now }) {
  const countdown = calculateEventCountdown(event, now)
  const tone = BADGE_STYLE[countdown.urgency] || BADGE_STYLE.far
  const label = countdown.autoReviewReady ? `${countdown.label} · 待復盤` : countdown.label

  return h(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 11,
        lineHeight: 1.2,
        color: tone.color,
        background: tone.background,
        border: `1px solid ${tone.border}`,
        fontWeight: tone.fontWeight,
        whiteSpace: 'nowrap',
      },
      title: countdown.autoReviewReady ? '事件已過 3 天，進入自動復盤視窗' : label,
    },
    tone.dot &&
      h('span', {
        'aria-hidden': 'true',
        style: {
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: tone.dot,
          flexShrink: 0,
        },
      }),
    label
  )
}
