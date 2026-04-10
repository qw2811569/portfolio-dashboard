import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { Badge, Card } from './Base.jsx'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

function truncate(text, max = 120) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized
}

export function OperatingContextCard({ context }) {
  if (!context) return null

  const {
    portfolioLabel,
    holdingsCount = 0,
    pendingCount = 0,
    attentionCount = 0,
    activeEventCount = 0,
    refreshBacklogCount = 0,
    lastAnalysisLabel = '',
    latestInsightSummary = '',
    nextActionLabel = '',
    nextActionReason = '',
    focus,
  } = context

  const hasSummary =
    nextActionLabel ||
    nextActionReason ||
    latestInsightSummary ||
    focus ||
    holdingsCount > 0 ||
    pendingCount > 0 ||
    activeEventCount > 0 ||
    refreshBacklogCount > 0

  if (!hasSummary) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 10,
        borderLeft: `3px solid ${alpha(C.teal, '40')}`,
        background: alpha(C.teal, '08'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { flex: 1, minWidth: 220 } },
        h('div', { style: { ...lbl, color: C.teal, marginBottom: 4 } }, '本輪操作脈絡'),
        nextActionLabel &&
          h(
            'div',
            {
              style: {
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                marginBottom: 4,
                lineHeight: 1.5,
              },
            },
            nextActionLabel
          ),
        nextActionReason &&
          h(
            'div',
            {
              style: {
                fontSize: 11,
                color: C.textSec,
                lineHeight: 1.7,
              },
            },
            truncate(nextActionReason, 120)
          )
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          },
        },
        portfolioLabel && h(Badge, { color: 'teal' }, portfolioLabel),
        holdingsCount > 0 && h(Badge, { color: 'default' }, `持股 ${holdingsCount} 檔`),
        activeEventCount > 0 && h(Badge, { color: 'amber' }, `事件 ${activeEventCount} 件`),
        pendingCount > 0 && h(Badge, { color: 'amber' }, `待處理 ${pendingCount}`),
        attentionCount > 0 && h(Badge, { color: 'olive' }, `需注意 ${attentionCount}`),
        refreshBacklogCount > 0 &&
          h(Badge, { color: 'lavender' }, `待補資料 ${refreshBacklogCount}`)
      )
    ),
    focus &&
      h(
        'div',
        {
          style: {
            marginBottom: latestInsightSummary ? 8 : 0,
            padding: '8px 10px',
            borderRadius: 8,
            background: C.card,
            border: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            },
          },
          h(
            'div',
            { style: { fontSize: 11, color: C.text, fontWeight: 600 } },
            `焦點標的：${focus.name} (${focus.code})`
          ),
          focus.upsideLabel &&
            h(
              'span',
              {
                style: {
                  fontSize: 10,
                  color: C.teal,
                  fontWeight: 600,
                },
              },
              focus.upsideLabel
            )
        ),
        focus.summary &&
          h(
            'div',
            { style: { fontSize: 10, color: C.textSec, marginTop: 4, lineHeight: 1.7 } },
            truncate(focus.summary, 90)
          )
      ),
    latestInsightSummary &&
      h(
        'div',
        {
          style: {
            fontSize: 10,
            color: C.textSec,
            lineHeight: 1.7,
          },
        },
        h('span', { style: { color: C.textMute } }, '最近收盤結論'),
        ' · ',
        truncate(latestInsightSummary, 140),
        lastAnalysisLabel ? ` (${lastAnalysisLabel})` : ''
      )
  )
}
