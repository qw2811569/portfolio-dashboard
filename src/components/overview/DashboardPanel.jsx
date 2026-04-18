import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { isSkippedTargetPriceInstrumentType } from '../../lib/instrumentTypes.js'
import { Card } from '../common'
import Md from '../Md.jsx'
import HoldingsRing from './HoldingsRing.jsx'
import { PrincipleCards } from './PrincipleCards.jsx'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 500,
  marginBottom: 5,
}

const metricCard = {
  background: `linear-gradient(180deg, ${alpha(C.card, 'f0')}, ${alpha(C.subtle, 'f6')})`,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '8px 11px',
  boxShadow: `${C.insetLine}, ${C.shadow}`,
}

const heroHeadlineLabel = {
  fontSize: 14,
  color: 'var(--muted)',
  fontFamily: 'var(--font-headline)',
  letterSpacing: '0.08em',
}

function formatTaipeiDate() {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
}

function formatMetricValue(value, { signed = false, suffix = '' } = {}) {
  if (value == null) return '-'
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return '-'
  const sign = signed && value > 0 ? '+' : ''
  return `${sign}${Math.round(value).toLocaleString()}${suffix}`
}

function readMetricValue(item, keys) {
  for (const key of keys) {
    const value = Number(item?.[key])
    if (Number.isFinite(value)) return value
  }
  return null
}

function buildSubmetrics({ holdings = [], watchlist = [] }) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const safeWatchlist = Array.isArray(watchlist) ? watchlist : []

  const hasWeekPnl = safeHoldings.some(
    (holding) => readMetricValue(holding, ['week_pnl', 'weekPnl', 'weeklyPnl']) != null
  )
  const hasMonthPnl = safeHoldings.some(
    (holding) => readMetricValue(holding, ['month_pnl', 'monthPnl', 'monthlyPnl']) != null
  )
  const weekPnl = hasWeekPnl
    ? safeHoldings.reduce(
        (sum, holding) =>
          sum + (readMetricValue(holding, ['week_pnl', 'weekPnl', 'weeklyPnl']) || 0),
        0
      )
    : null
  const monthPnl = hasMonthPnl
    ? safeHoldings.reduce(
        (sum, holding) =>
          sum + (readMetricValue(holding, ['month_pnl', 'monthPnl', 'monthlyPnl']) || 0),
        0
      )
    : null
  const missingTargetCount = safeHoldings.filter((holding) => {
    if (isSkippedTargetPriceInstrumentType(holding)) return false
    const targetPrice = Number(holding?.targetPrice)
    return !Number.isFinite(targetPrice) || targetPrice <= 0
  }).length

  return [
    { label: '本週損益', value: formatMetricValue(weekPnl, { signed: true }) },
    { label: '本月損益', value: formatMetricValue(monthPnl, { signed: true }) },
    { label: '追蹤中', value: `${safeWatchlist.length}` },
    { label: '需要補充', value: `${missingTargetCount}` },
  ]
}

/**
 * Hero summary — total assets with supporting context
 */
function TodayPnlHero({
  totalVal = 0,
  todayTotalPnl = 0,
  holdings = [],
  watchlist = [],
  portfolioName = '',
}) {
  const color = todayTotalPnl > 0 ? C.up : todayTotalPnl < 0 ? C.down : C.textSec
  const sign = todayTotalPnl > 0 ? '+' : ''
  const totalText = Math.round(totalVal).toLocaleString()
  const pnlText = `${sign}${Math.round(todayTotalPnl).toLocaleString()}`
  const submetrics = buildSubmetrics({ holdings, watchlist })
  const portfolioLabel = portfolioName || '目前組合'

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        padding: '48px 24px',
        background: `linear-gradient(180deg, ${alpha(C.card, 'f4')}, ${alpha(C.subtle, 'fc')})`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 24,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 18,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'baseline',
              flexWrap: 'wrap',
            },
          },
          h('div', { style: heroHeadlineLabel }, '投資組合'),
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
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  color: C.textMute,
                  fontFamily: 'var(--font-body)',
                },
              },
              formatTaipeiDate()
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  color: C.textSec,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: alpha(C.blue, '18'),
                  border: `1px solid ${C.borderStrong}`,
                },
              },
              portfolioLabel
            )
          )
        ),
        h('div', { style: { ...lbl, fontSize: 14, marginBottom: 0 } }, '總資產'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 'clamp(48px, 7vw, 72px)',
              fontWeight: 600,
              color: C.text,
              fontFamily: 'var(--font-num)',
              letterSpacing: '-0.02em',
              lineHeight: 0.95,
            },
          },
          totalText
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
          submetrics.map((metric) =>
            h(
              'div',
              { key: metric.label, style: metricCard },
              h(
                'div',
                { style: { fontSize: 9, color: C.textMute, letterSpacing: '0.08em' } },
                metric.label
              ),
              h(
                'div',
                {
                  className: 'tn',
                  style: {
                    fontSize: 18,
                    fontWeight: 600,
                    color: C.text,
                    marginTop: 4,
                    fontFamily: 'var(--font-num)',
                  },
                },
                metric.value
              )
            )
          )
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
          },
        },
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          h(
            'div',
            {
              style: {
                fontSize: 14,
                color: C.textMute,
                fontFamily: 'var(--font-body)',
              },
            },
            '今日損益'
          ),
          h(
            'div',
            {
              className: 'tn',
              style: {
                fontSize: 22,
                fontWeight: 600,
                color,
                fontFamily: 'var(--font-num)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              },
            },
            pnlText
          )
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          h(
            'div',
            {
              style: {
                fontSize: 14,
                color: C.textMute,
                fontFamily: 'var(--font-body)',
              },
            },
            '總持倉'
          ),
          h(
            'div',
            {
              className: 'tn',
              style: {
                fontSize: 22,
                fontWeight: 600,
                color: C.textSec,
                fontFamily: 'var(--font-num)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              },
            },
            `${holdings.length} 檔`
          )
        )
      )
    )
  )
}

/**
 * AI Quick Summary — latest closing analysis excerpt
 */
function AiQuickSummary({ latestInsight }) {
  if (!latestInsight) return null
  const full = String(latestInsight || '')
  const firstBreak = full.search(/\n#{1,3}\s|\n---/)
  const summary = firstBreak > 0 ? full.slice(0, firstBreak).trim() : full.slice(0, 200).trim()
  if (!summary) return null

  return h(
    Card,
    { style: { marginBottom: 8, borderLeft: `3px solid ${C.lavender}` } },
    h(
      'div',
      {
        style: {
          ...lbl,
          color: C.lavender,
          marginBottom: 4,
        },
      },
      'AI 快評'
    ),
    h(Md, { text: summary, color: C.textSec })
  )
}

/**
 * Pending Events — stocks with events today/tomorrow
 */
function PendingEventsCard({ newsEvents = [], urgentCount = 0, todayAlertSummary }) {
  const today = new Date()
  const todayStr = formatDateStr(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = formatDateStr(tomorrow)

  const upcoming = (Array.isArray(newsEvents) ? newsEvents : []).filter((event) => {
    const d = String(event.eventDate || event.date || '')
      .replace(/\//g, '-')
      .slice(0, 10)
    return d === todayStr || d === tomorrowStr
  })

  const hasContent = upcoming.length > 0 || urgentCount > 0 || todayAlertSummary

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: urgentCount > 0 ? `3px solid ${alpha(C.amber, '60')}` : undefined,
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { ...lbl, marginBottom: 0 } }, '待處理事件'),
      urgentCount > 0 &&
        h(
          'span',
          {
            style: {
              fontSize: 9,
              fontWeight: 600,
              color: C.amber,
              background: C.amberBg,
              border: `1px solid ${alpha(C.amber, '20')}`,
              borderRadius: 999,
              padding: '2px 8px',
            },
          },
          `${urgentCount} 件緊急`
        )
    ),
    todayAlertSummary &&
      h(
        'div',
        {
          style: {
            fontSize: 10,
            color: C.amber,
            marginTop: 6,
            lineHeight: 1.7,
          },
        },
        todayAlertSummary
      ),
    !hasContent &&
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, marginTop: 6 } },
        '今明兩日沒有待處理事件。'
      ),
    upcoming.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 6, marginTop: 8 } },
        upcoming.slice(0, 8).map((event, i) => {
          const d = String(event.eventDate || event.date || '')
            .replace(/\//g, '-')
            .slice(0, 10)
          const isToday = d === todayStr
          const dayLabel = isToday ? '今天' : '明天'
          const codes = getEventStockCodes(event)
          return h(
            'div',
            {
              key: event.id || `ev-${i}`,
              style: {
                background: C.subtle,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '6px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              },
            },
            h(
              'div',
              { style: { flex: 1, minWidth: 0 } },
              h(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: C.text,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                event.title || '未命名事件'
              ),
              codes.length > 0 &&
                h(
                  'div',
                  { style: { fontSize: 9, color: C.textMute, marginTop: 2 } },
                  codes.join('、')
                )
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 9,
                  fontWeight: 600,
                  color: isToday ? C.amber : C.textMute,
                  background: isToday ? alpha(C.amber, '10') : 'transparent',
                  borderRadius: 999,
                  padding: isToday ? '2px 8px' : 0,
                  flexShrink: 0,
                },
              },
              dayLabel
            )
          )
        })
      ),
    upcoming.length > 8 &&
      h(
        'div',
        { style: { fontSize: 10, color: C.textMute, marginTop: 4, textAlign: 'right' } },
        `...還有 ${upcoming.length - 8} 件`
      )
  )
}

/**
 * Portfolio Health — winners/losers count + overall return
 */
function PortfolioHealthCard({
  holdings = [],
  winners = [],
  losers = [],
  totalVal = 0,
  totalCost = 0,
}) {
  const totalReturn = totalCost > 0 ? ((totalVal - totalCost) / totalCost) * 100 : 0
  const returnColor = totalReturn > 0 ? C.up : totalReturn < 0 ? C.down : C.textSec
  const flat = holdings.length - winners.length - losers.length

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '組合健康度'),
    h(
      'div',
      {
        style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 },
      },
      h(
        'div',
        { style: metricCard },
        h('div', { style: { fontSize: 9, color: C.textMute, letterSpacing: '0.08em' } }, '獲利'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: C.up,
              marginTop: 2,
              fontFamily: 'var(--font-num)',
            },
          },
          `${winners.length}檔`
        )
      ),
      h(
        'div',
        { style: metricCard },
        h('div', { style: { fontSize: 9, color: C.textMute, letterSpacing: '0.08em' } }, '虧損'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: C.down,
              marginTop: 2,
              fontFamily: 'var(--font-num)',
            },
          },
          `${losers.length}檔`
        )
      ),
      h(
        'div',
        { style: metricCard },
        h('div', { style: { fontSize: 9, color: C.textMute, letterSpacing: '0.08em' } }, '持平'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: C.textSec,
              marginTop: 2,
              fontFamily: 'var(--font-num)',
            },
          },
          `${flat}檔`
        )
      ),
      h(
        'div',
        { style: metricCard },
        h(
          'div',
          { style: { fontSize: 9, color: C.textMute, letterSpacing: '0.08em' } },
          '整體報酬'
        ),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: returnColor,
              marginTop: 2,
              fontFamily: 'var(--font-num)',
            },
          },
          `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`
        )
      )
    ),
    // Win/loss bar
    holdings.length > 0 &&
      h(
        'div',
        {
          style: {
            display: 'flex',
            borderRadius: 4,
            overflow: 'hidden',
            height: 6,
          },
        },
        winners.length > 0 &&
          h('div', {
            style: {
              width: `${(winners.length / holdings.length) * 100}%`,
              height: '100%',
              background: C.up,
            },
          }),
        flat > 0 &&
          h('div', {
            style: {
              width: `${(flat / holdings.length) * 100}%`,
              height: '100%',
              background: C.textMute,
            },
          }),
        losers.length > 0 &&
          h('div', {
            style: {
              width: `${(losers.length / holdings.length) * 100}%`,
              height: '100%',
              background: C.down,
            },
          })
      )
  )
}

/**
 * Main Dashboard Panel — first-glance overview for retail investors
 */
export function DashboardPanel({
  holdings = [],
  watchlist = [],
  todayTotalPnl = 0,
  totalVal = 0,
  totalCost = 0,
  winners = [],
  losers = [],
  latestInsight = null,
  newsEvents = [],
  urgentCount = 0,
  todayAlertSummary = '',
  portfolioName = '',
  portfolioId = '',
}) {
  return h(
    'div',
    null,
    h(
      'div',
      { className: 'dashboard-hero' },
      h(
        'div',
        { className: 'dashboard-hero-main' },
        h(TodayPnlHero, {
          holdings,
          watchlist,
          totalVal,
          todayTotalPnl,
          portfolioName: portfolioName || portfolioId,
        })
      ),
      h(
        Card,
        {
          className: 'dashboard-hero-ring',
          style: {
            marginBottom: 8,
            padding: 24,
          },
        },
        h(HoldingsRing, { holdings, totalVal })
      )
    ),
    h(PrincipleCards),
    h(AiQuickSummary, { latestInsight }),
    h(PendingEventsCard, { newsEvents, urgentCount, todayAlertSummary }),
    h(PortfolioHealthCard, { holdings, winners, losers, totalVal, totalCost })
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getEventStockCodes(event) {
  if (Array.isArray(event.stockCodes)) return event.stockCodes
  if (typeof event.stockCode === 'string' && event.stockCode) return [event.stockCode]
  if (Array.isArray(event.stocks)) return event.stocks.map((s) => s.code || s).filter(Boolean)
  return []
}
