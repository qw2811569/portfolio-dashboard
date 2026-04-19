import { createElement as h } from 'react'
import { displayPortfolioName } from '../../lib/portfolioDisplay.js'
import { C, alpha } from '../../theme.js'
import { Badge, Card } from './Base.jsx'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
}

function truncate(text, max = 120) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized
}

export function OperatingContextCard({ context, variant = 'default' }) {
  if (!context) return null

  const {
    portfolio,
    portfolioLabel,
    holdingsCount = 0,
    pendingCount = 0,
    attentionCount = 0,
    activeEventCount = 0,
    autoReviewedCount = 0,
    autoReviewedCorrect = 0,
    autoReviewedWrong = 0,
    refreshBacklogCount = 0,
    refreshBacklogItems = [],
    headline = '',
    headlineTone = 'calm',
    lastAnalysisLabel = '',
    latestInsightSummary = '',
    nextActionLabel = '',
    nextActionReason = '',
    focus,
  } = context
  const resolvedPortfolioLabel = displayPortfolioName(portfolio || { displayName: portfolioLabel })

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

  if (variant === 'home') {
    const headlineText = String(headline || nextActionLabel || '').trim() || '今日持倉 overview'
    const supportingText = String(
      latestInsightSummary || nextActionReason || focus?.summary || ''
    ).trim()
    const headlineColor =
      headlineTone === 'alert' ? C.text : headlineTone === 'watch' ? C.textSec : C.text

    return h(
      Card,
      {
        style: {
          marginBottom: 8,
          background: `linear-gradient(180deg, ${alpha(C.card, 'f4')}, ${alpha(C.subtle, 'fc')})`,
          border: `1px solid ${C.border}`,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 8,
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
            },
          },
          h(
            'div',
            { style: { flex: 1, minWidth: 220 } },
            h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, '今日狀態'),
            h(
              'div',
              {
                'data-testid': 'holdings-home-headline',
                style: {
                  fontSize: 22,
                  fontWeight: 700,
                  color: headlineColor,
                  lineHeight: 1.3,
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '-0.01em',
                },
              },
              headlineText
            ),
            supportingText &&
              h(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: C.textSec,
                    lineHeight: 1.7,
                    marginTop: 4,
                  },
                },
                truncate(supportingText, 140)
              )
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              },
            },
            resolvedPortfolioLabel && h(Badge, { color: 'teal' }, resolvedPortfolioLabel),
            holdingsCount > 0 && h(Badge, { color: 'default' }, `持股 ${holdingsCount} 檔`),
            activeEventCount > 0 && h(Badge, { color: 'amber' }, `事件 ${activeEventCount} 件`),
            pendingCount > 0 && h(Badge, { color: 'amber' }, `待驗證 ${pendingCount}`),
            attentionCount > 0 && h(Badge, { color: 'olive' }, `需注意 ${attentionCount}`),
            autoReviewedCount > 0 &&
              h(Badge, { color: 'teal' }, `自動復盤 ${autoReviewedCorrect}✓ ${autoReviewedWrong}✗`)
          )
        ),
        focus &&
          h(
            'div',
            {
              style: {
                padding: '8px 8px',
                borderRadius: 10,
                background: C.subtle,
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
                `${focus.name} (${focus.code})`
              ),
              focus.upsideLabel &&
                h(
                  'span',
                  {
                    style: {
                      fontSize: 10,
                      color: C.textSec,
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
                truncate(focus.summary, 96)
              )
          ),
        refreshBacklogCount > 0 &&
          Array.isArray(refreshBacklogItems) &&
          refreshBacklogItems.length > 0 &&
          h(
            'div',
            {
              style: {
                fontSize: 10,
                color: C.textMute,
                lineHeight: 1.7,
              },
            },
            `目前有 ${refreshBacklogCount} 檔資料還在補齊中，右上角鈴鐺可以查看明細。`
          )
      )
    )
  }

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
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
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { flex: 1, minWidth: 220 } },
        h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, '現在先看這裡'),
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
            gap: 4,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          },
        },
        resolvedPortfolioLabel && h(Badge, { color: 'teal' }, resolvedPortfolioLabel),
        holdingsCount > 0 && h(Badge, { color: 'default' }, `持股 ${holdingsCount} 檔`),
        activeEventCount > 0 && h(Badge, { color: 'amber' }, `事件 ${activeEventCount} 件`),
        pendingCount > 0 && h(Badge, { color: 'amber' }, `先看 ${pendingCount}`),
        attentionCount > 0 && h(Badge, { color: 'olive' }, `需注意 ${attentionCount}`),
        refreshBacklogCount > 0 &&
          h(Badge, { color: 'lavender' }, `還有 ${refreshBacklogCount} 檔資料沒補齊`),
        autoReviewedCount > 0 &&
          h(Badge, { color: 'teal' }, `自動復盤 ${autoReviewedCorrect}✓ ${autoReviewedWrong}✗`)
      )
    ),
    focus &&
      h(
        'div',
        {
          style: {
            marginBottom: latestInsightSummary ? 8 : 0,
            padding: '8px 8px',
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
            `先盯這檔：${focus.name} (${focus.code})`
          ),
          focus.upsideLabel &&
            h(
              'span',
              {
                style: {
                  fontSize: 10,
                  color: C.textSec,
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
        h('span', { style: { color: C.textMute } }, '上次收盤怎麼看'),
        ' · ',
        truncate(latestInsightSummary, 140),
        lastAnalysisLabel ? ` (${lastAnalysisLabel})` : ''
      )
  )
}
