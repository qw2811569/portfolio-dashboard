import { createElement as h } from 'react'
import { displayPortfolioName } from '../../lib/portfolioDisplay.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { C, alpha } from '../../theme.js'
import { Card, Button, MetricCard, Skeleton, StaleBadge } from '../common'
import { STOCK_META } from '../../seedData.js'
import { ConcentrationDashboard } from './ConcentrationDashboard.jsx'
import { KpiCards } from './KpiCards.jsx'
import { PrincipleCards } from './PrincipleCards.jsx'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
}

const ghostBtn = {
  borderRadius: C.radii.lg,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.18s ease',
}

const pc = (p) => (p == null ? C.textMute : p >= 0 ? C.text : C.down)

function formatSignedWholeNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${Math.round(number).toLocaleString()}`
}

function resolvePendingEventsCount(portfolio) {
  const explicitCount = Number(portfolio?.pendingEventsCount)
  if (Number.isFinite(explicitCount)) return explicitCount

  if (Array.isArray(portfolio?.pendingEvents)) return portfolio.pendingEvents.length

  const fallbackCount = Number(portfolio?.pendingEvents)
  return Number.isFinite(fallbackCount) ? fallbackCount : 0
}

function flattenPortfolioHoldings(portfolios = []) {
  return (Array.isArray(portfolios) ? portfolios : []).flatMap((portfolio) =>
    Array.isArray(portfolio?.holdings) ? portfolio.holdings : []
  )
}

function formatTaipeiDate() {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
}

function OverviewPanelSkeleton() {
  return h(
    'div',
    { 'data-testid': 'overview-panel-skeleton' },
    h(
      Card,
      { style: { marginBottom: 8, padding: '24px 16px' } },
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, marginBottom: 12 } },
        '跨組合脈絡整理中'
      ),
      h(Skeleton, { variant: 'text', count: 2 }),
      h('div', { style: { height: 16 } }),
      h(Skeleton, { variant: 'card', count: 2 })
    ),
    h(
      Card,
      { style: { marginBottom: 8, padding: '20px 16px' } },
      h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 12 } }, '組合摘要載入中'),
      h(Skeleton, { variant: 'row', count: 3 })
    )
  )
}

/**
 * Overview Header
 */
export function OverviewHeader({
  portfolioCount,
  totalValue,
  totalPnl,
  watchlistCount = 0,
  missingTargetCount = 0,
  staleStatus = 'fresh',
  dashboardHeadline = null,
  onExit,
}) {
  const isMobile = useIsMobile()
  const headlineText = String(dashboardHeadline?.headline || '').trim()
  const headlineTone = String(dashboardHeadline?.tone || 'calm')
    .trim()
    .toLowerCase()
  const headlineColor =
    headlineTone === 'alert' ? C.text : headlineTone === 'watch' ? C.textSec : C.text
  const heroMetrics = [
    { label: '本週損益', value: '-' },
    { label: '本月損益', value: '-' },
    { label: '追蹤中', value: `${watchlistCount}` },
    { label: '需要補充', value: `${missingTargetCount}` },
  ]

  return h(
    'div',
    null,
    h(
      Card,
      {
        style: {
          marginBottom: 8,
          padding: '24px 24px',
          background: alpha(C.card, 'f6'),
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 16,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            },
          },
          h(
            'div',
            null,
            h(
              'div',
              {
                style: {
                  fontSize: 14,
                  color: C.textSec,
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                },
              },
              '投資組合'
            ),
            h(
              'div',
              { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } },
              '跨組合檢視目前持倉、重複部位與待處理事件'
            )
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              },
            },
            h('span', { style: { fontSize: 11, color: C.textMute } }, formatTaipeiDate()),
            h(StaleBadge, { status: staleStatus, title: 'overview panel freshness' }),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  color: C.textSec,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: alpha(C.ink, '10'),
                  border: `1px solid ${C.borderStrong}`,
                },
              },
              '全部總覽'
            ),
            h(
              Button,
              {
                onClick: onExit,
                style: {
                  background: C.cardBlue,
                  color: C.textSec,
                  border: `1px solid ${alpha(C.ink, '2a')}`,
                  ...ghostBtn,
                },
              },
              '返回目前組合'
            )
          )
        ),
        headlineText &&
          h(
            'div',
            {
              'data-testid': 'overview-dashboard-headline',
              style: {
                fontSize: 'clamp(28px, 4.4vw, 38px)',
                fontWeight: 700,
                color: headlineColor,
                fontFamily: 'var(--font-headline)',
                lineHeight: 1.14,
                letterSpacing: '-0.02em',
                maxWidth: '18ch',
              },
            },
            headlineText
          ),
        h('div', { style: { ...lbl, fontSize: 14, marginBottom: 0 } }, '總資產'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 'clamp(40px, 6vw, 56px)',
              fontWeight: 600,
              color: C.text,
              letterSpacing: '-0.02em',
              lineHeight: 1.02,
            },
          },
          Math.round(totalValue).toLocaleString()
        ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
            },
          },
          heroMetrics.map((metric) =>
            h(MetricCard, {
              key: metric.label,
              label: metric.label,
              value: metric.value,
              tone: 'muted',
            })
          )
        )
      ),
      h(
        Card,
        { style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.ink, '40')}` } },
        h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, '全部總覽'),
        h(
          'div',
          {
            'data-testid': 'overview-summary-metrics-grid',
            style: {
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '1fr 1fr 1fr',
              gap: 4,
            },
          },
          h(MetricCard, {
            label: '組合數',
            value: portfolioCount,
            tone: 'muted',
          }),
          h(MetricCard, {
            label: '總市值',
            value: Math.round(totalValue).toLocaleString(),
            tone: 'info',
          }),
          h(MetricCard, {
            label: '總損益',
            value: `${totalPnl >= 0 ? '+' : ''}${Math.round(totalPnl).toLocaleString()}`,
            tone: totalPnl >= 0 ? 'up' : 'down',
          })
        ),
        h(
          'div',
          { style: { fontSize: 12, color: C.textMute, marginTop: 8, lineHeight: 1.7 } },
          '這裡只做彙總，不會修改任何組合資料。'
        )
      )
    )
  )
}

/**
 * Portfolio Summary List
 */
export function PortfolioSummaryList({ portfolios, activePortfolioId, onSwitch }) {
  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '組合摘要'),
    h(
      'div',
      { style: { display: 'grid', gap: 8 } },
      portfolios.map((portfolio) => {
        const noteSummary = [
          portfolio.notes?.riskProfile,
          portfolio.notes?.preferences,
          portfolio.notes?.customNotes,
        ]
          .filter(Boolean)
          .join(' · ')

        return h(
          'div',
          {
            key: portfolio.id,
            style: {
              background: portfolio.id === activePortfolioId ? C.subtleElev : C.subtle,
              border: `1px solid ${portfolio.id === activePortfolioId ? C.borderStrong : C.border}`,
              borderRadius: 8,
              padding: '8px 12px',
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
              null,
              h(
                'div',
                { style: { fontSize: 12, fontWeight: 600, color: C.text } },
                displayPortfolioName(portfolio),
                portfolio.id === 'me' &&
                  h('span', { style: { fontSize: 11, color: C.textMute, marginLeft: 4 } }, '本人')
              ),
              h(
                'div',
                { style: { fontSize: 12, color: C.textMute, marginTop: 4 } },
                `${portfolio.holdingCount} 檔 · 待處理事件 ${resolvePendingEventsCount(portfolio)} 件 · 報酬 ${portfolio.retPct >= 0 ? '+' : ''}${portfolio.retPct.toFixed(1)}%`
              ),
              noteSummary &&
                h(
                  'div',
                  { style: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.7 } },
                  noteSummary
                )
            ),
            h(
              'div',
              { style: { textAlign: 'right' } },
              h(
                'div',
                {
                  className: 'tn',
                  style: { fontSize: 16, fontWeight: 700, color: pc(portfolio.totalPnl) },
                },
                formatSignedWholeNumber(portfolio.totalPnl)
              ),
              h(
                Button,
                {
                  onClick: () => onSwitch(portfolio.id),
                  style: {
                    marginTop: 4,
                    background: C.cardBlue,
                    color: C.textSec,
                    border: `1px solid ${alpha(C.ink, '2a')}`,
                    ...ghostBtn,
                  },
                },
                '打開這組'
              )
            )
          )
        )
      })
    )
  )
}

/**
 * Duplicate Holdings Display
 */
export function DuplicateHoldings({ holdings }) {
  if (!holdings || holdings.length === 0) {
    return h(
      Card,
      { style: { marginBottom: 8 } },
      h('div', { style: lbl }, '重複持股'),
      h('div', { style: { fontSize: 11, color: C.textMute } }, '目前沒有跨組合重複持有同一檔股票。')
    )
  }

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '重複持股'),
    h(
      'div',
      { style: { display: 'grid', gap: 8 } },
      holdings.map((item) =>
        h(
          'div',
          {
            key: item.code,
            style: { paddingBottom: 8, borderBottom: `1px solid ${C.borderSub}` },
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
              },
            },
            h(
              'div',
              null,
              h('span', { style: { fontSize: 12, color: C.text, fontWeight: 600 } }, item.name),
              h('span', { style: { fontSize: 12, color: C.textMute, marginLeft: 4 } }, item.code)
            ),
            h(
              'span',
              {
                className: 'tn',
                style: { fontSize: 12, color: C.textSec },
              },
              `合計市值 ${Math.round(item.totalValue).toLocaleString()}`
            )
          ),
          h(
            'div',
            { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 } },
            item.portfolios.map((portfolio) =>
              h(
                'span',
                {
                  key: `${item.code}-${portfolio.id}`,
                  style: {
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: C.subtle,
                    border: `1px solid ${C.border}`,
                    color: C.textSec,
                  },
                },
                `${displayPortfolioName(portfolio)} · ${portfolio.qty}股 · ${portfolio.pnl >= 0 ? '+' : ''}${Math.round(portfolio.pnl)}`
              )
            )
          )
        )
      )
    )
  )
}

/**
 * Pending Items Display
 */
export function PendingItems({ items, onSwitch }) {
  if (!items || items.length === 0) {
    return h(
      Card,
      { style: { marginBottom: 8 } },
      h('div', { style: lbl }, '待處理事項'),
      h('div', { style: { fontSize: 11, color: C.textMute } }, '目前所有組合都沒有待處理事件。')
    )
  }

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '待處理事項'),
    h(
      'div',
      { style: { display: 'grid', gap: 8 } },
      items.slice(0, 16).map((item) =>
        h(
          'div',
          {
            key: `${item.portfolioId}-${item.id}`,
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              minWidth: 0,
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
                minWidth: 0,
              },
            },
            h(
              'div',
              { style: { flex: '1 1 220px', minWidth: 0, maxWidth: '100%' } },
              h(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: C.text,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                item.title
              ),
              h(
                'div',
                {
                  style: {
                    fontSize: 12,
                    color: C.textMute,
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                `${displayPortfolioName({ displayName: item.portfolioName, id: item.portfolioId })} · ${item.date || '未排日期'} · 預測${item.pred === 'up' ? '看漲' : item.pred === 'down' ? '看跌' : '中性'}`
              ),
              item.predReason &&
                h(
                  'div',
                  {
                    style: {
                      fontSize: 12,
                      color: C.textSec,
                      marginTop: 4,
                      lineHeight: 1.7,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  },
                  item.predReason
                )
            ),
            h(
              Button,
              {
                onClick: () => onSwitch(item.portfolioId),
                style: {
                  background: C.cardBlue,
                  color: C.textSec,
                  border: `1px solid ${alpha(C.ink, '2a')}`,
                  ...ghostBtn,
                },
              },
              '去處理'
            )
          )
        )
      )
    )
  )
}

/**
 * Main Overview Panel
 */
export function OverviewPanel({
  portfolioCount,
  totalValue,
  totalPnl,
  portfolios,
  activePortfolioId,
  duplicateHoldings,
  pendingItems,
  watchlistCount,
  missingTargetCount,
  staleStatus = 'fresh',
  dashboardHeadline = null,
  compareStrip = null,
  loading = false,
  onExit,
  onSwitch,
}) {
  if (loading) return h(OverviewPanelSkeleton)

  const overviewHoldings = flattenPortfolioHoldings(portfolios)
  const resolvedDashboardHeadline =
    dashboardHeadline?.headline || compareStrip?.insightText
      ? {
          headline: dashboardHeadline?.headline || compareStrip?.insightText || '',
          tone: dashboardHeadline?.tone || compareStrip?.tone || 'calm',
        }
      : null

  return h(
    'div',
    null,
    h(OverviewHeader, {
      portfolioCount,
      totalValue,
      totalPnl,
      watchlistCount,
      staleStatus,
      missingTargetCount,
      dashboardHeadline: resolvedDashboardHeadline,
      onExit,
    }),
    h(KpiCards, { portfolios }),
    h(ConcentrationDashboard, { holdings: overviewHoldings, stockMeta: STOCK_META }),
    h(PrincipleCards),
    h(PortfolioSummaryList, {
      portfolios,
      activePortfolioId,
      onSwitch,
    }),
    h(DuplicateHoldings, { holdings: duplicateHoldings }),
    h(PendingItems, { items: pendingItems, onSwitch })
  )
}
