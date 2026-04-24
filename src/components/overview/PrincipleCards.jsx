import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { Card } from '../common'
import { getDailyPrinciple } from '../../lib/dailyPrinciples.js'

const CARD_LABEL_STYLE = {
  fontSize: 12,
  color: C.textSec,
  letterSpacing: '0.08em',
  fontWeight: 500,
  marginBottom: 8,
}

function PrincipleCard({ label, text }) {
  return h(
    Card,
    {
      'data-testid': 'daily-principle-card',
      style: {
        padding: '16px 16px',
        background: `linear-gradient(180deg, ${alpha(C.card, 'f6')}, ${alpha(C.cardBlue, 'e0')})`,
        minHeight: 118,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h('div', { style: CARD_LABEL_STYLE }, label),
      h(
        'span',
        {
          style: {
            fontSize: 11,
            color: C.text,
            padding: '4px 8px',
            borderRadius: 999,
            background: alpha(C.ink, '08'),
            border: `1px solid ${alpha(C.ink, '16')}`,
            whiteSpace: 'nowrap',
          },
        },
        'daily principle'
      )
    ),
    h(
      'div',
      {
        'data-testid': 'daily-principle-copy',
        style: {
          fontSize: 24,
          lineHeight: 1.45,
          color: C.text,
          fontFamily: 'var(--font-headline)',
          letterSpacing: '-0.01em',
        },
      },
      `“${text}”`
    ),
    h(
      'div',
      {
        style: {
          marginTop: 8,
          fontSize: 11,
          color: C.textSec,
          lineHeight: 1.7,
        },
      },
      '今天只提醒一句，節奏放慢一點就好。'
    )
  )
}

export function PrincipleCards({ date = new Date() }) {
  const principle = getDailyPrinciple(date)

  return h(
    'div',
    {
      style: {
        marginBottom: 8,
      },
    },
    h(PrincipleCard, { label: '心法', text: principle })
  )
}
