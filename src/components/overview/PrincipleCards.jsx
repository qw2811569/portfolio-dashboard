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

function PrincipleCard({ label, entry }) {
  const quote = entry?.quote || ''
  const quoteEn = entry?.quoteEn || ''
  const author = entry?.author || ''
  const year = entry?.year || ''
  const authorBrief = entry?.authorBrief || ''
  const attribution = [author, year].filter(Boolean).join(' · ')

  return h(
    Card,
    {
      'data-testid': 'daily-principle-card',
      style: {
        padding: '16px 16px',
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
            borderRadius: 8,
            background: alpha(C.ink, '08'),
            border: `1px solid ${alpha(C.ink, '16')}`,
            whiteSpace: 'nowrap',
          },
        },
        '心法'
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
      `“${quote}”`
    ),
    quoteEn &&
      h(
        'details',
        {
          'data-testid': 'daily-principle-quote-en-details',
          style: {
            marginTop: 6,
          },
        },
        h(
          'summary',
          {
            style: {
              fontSize: 11,
              color: C.textMute,
              cursor: 'pointer',
              userSelect: 'none',
            },
          },
          '英文原文'
        ),
        h(
          'div',
          {
            'data-testid': 'daily-principle-quote-en',
            style: {
              marginTop: 6,
              fontSize: 12,
              lineHeight: 1.6,
              color: C.textSec,
              fontStyle: 'italic',
            },
          },
          `“${quoteEn}”`
        )
      ),
    attribution &&
      h(
        'div',
        {
          'data-testid': 'daily-principle-attribution',
          style: {
            marginTop: 8,
            fontSize: 12,
            color: C.textSec,
            fontWeight: 600,
          },
        },
        `— ${attribution}`
      ),
    authorBrief &&
      h(
        'div',
        {
          'data-testid': 'daily-principle-author-brief',
          style: {
            marginTop: 4,
            fontSize: 11,
            color: C.textMute,
            lineHeight: 1.6,
          },
        },
        authorBrief
      )
  )
}

export function PrincipleCards({ date = new Date(), context = null }) {
  const entry = getDailyPrinciple(date, context)

  return h(
    'div',
    {
      style: {
        marginBottom: 8,
      },
    },
    h(PrincipleCard, { label: '心法', entry })
  )
}
