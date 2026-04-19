import { createElement as h, useMemo, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { buildDashboardHeadline } from '../../lib/dashboardHeadline.js'
import { isSkippedTargetPriceInstrumentType } from '../../lib/instrumentTypes.js'
import { buildMorningNoteDeepLinks } from '../../lib/morningNoteBuilder.js'
import { displayPortfolioName } from '../../lib/portfolioDisplay.js'
import { Button, Card } from '../common'
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
  color: C.textSec,
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

function isSafeExternalUrl(value) {
  if (!value) return false
  try {
    const parsed = new URL(String(value))
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function toMarketDateString(value) {
  const raw = String(value || '')
    .trim()
    .replace(/\//g, '-')
    .slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function formatMarketItemDate(value) {
  const normalized = toMarketDateString(value)
  if (!normalized) return ''
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return normalized
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
  }).format(parsed)
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
  headline = '',
  headlineTone = 'calm',
  dataRefreshRows = [],
  onRefreshReminder = null,
  onNavigate = null,
}) {
  const [isReminderOpen, setIsReminderOpen] = useState(false)
  const color = todayTotalPnl > 0 ? C.up : todayTotalPnl < 0 ? C.down : C.textSec
  const sign = todayTotalPnl > 0 ? '+' : ''
  const totalText = Math.round(totalVal).toLocaleString()
  const pnlText = `${sign}${Math.round(todayTotalPnl).toLocaleString()}`
  const submetrics = buildSubmetrics({ holdings, watchlist })
  const portfolioLabel = displayPortfolioName({ displayName: portfolioName }) || '目前組合'
  const safeRefreshRows = Array.isArray(dataRefreshRows) ? dataRefreshRows : []
  const headlineText = String(headline || '').trim() || '今日持倉 overview'
  const headlineColor =
    headlineTone === 'alert' ? C.text : headlineTone === 'watch' ? C.textSec : C.text

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
                position: 'relative',
              },
            },
            safeRefreshRows.length > 0 &&
              h(
                'div',
                { style: { position: 'relative' } },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ui-btn',
                    'data-testid': 'dashboard-reminder-toggle',
                    onClick: () => setIsReminderOpen((open) => !open),
                    title: `${safeRefreshRows.length} 檔資料待補齊`,
                    style: {
                      borderRadius: 999,
                      padding: '4px 10px',
                      border: `1px solid ${alpha(C.amber, '24')}`,
                      background: alpha(C.amber, '10'),
                      color: C.textSec,
                      fontSize: 10,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    },
                  },
                  h('span', { 'aria-hidden': 'true', style: { fontSize: 11 } }, '🔔'),
                  h(
                    'span',
                    {
                      style: {
                        borderRadius: 999,
                        padding: '2px 6px',
                        border: `1px solid ${alpha(C.amber, '26')}`,
                        background: alpha(C.amber, '18'),
                        color: C.text,
                        minWidth: 18,
                        textAlign: 'center',
                      },
                    },
                    `${safeRefreshRows.length}`
                  )
                ),
                isReminderOpen &&
                  h(
                    'div',
                    {
                      'data-testid': 'dashboard-reminder-drawer',
                      style: {
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: 'min(320px, calc(100vw - 48px))',
                        borderRadius: 14,
                        border: `1px solid ${C.border}`,
                        background: C.card,
                        boxShadow: `${C.insetLine}, ${C.shadow}`,
                        padding: '12px',
                        zIndex: 2,
                      },
                    },
                    h(
                      'div',
                      {
                        style: { fontSize: 11, fontWeight: 700, color: C.textSec, marginBottom: 8 },
                      },
                      '資料補齊提醒'
                    ),
                    h(
                      'div',
                      {
                        style: {
                          fontSize: 10,
                          color: C.textSec,
                          lineHeight: 1.7,
                          marginBottom: 8,
                        },
                      },
                      `目前有 ${safeRefreshRows.length} 檔資料還在更新中。`
                    ),
                    h(
                      'div',
                      { style: { display: 'grid', gap: 6, marginBottom: 10 } },
                      safeRefreshRows.slice(0, 5).map((item) =>
                        h(
                          'div',
                          {
                            key: item.code,
                            style: {
                              background: C.subtle,
                              border: `1px solid ${C.borderSub}`,
                              borderRadius: 10,
                              padding: '8px 9px',
                            },
                          },
                          h(
                            'div',
                            {
                              style: {
                                fontSize: 11,
                                color: C.text,
                                fontWeight: 600,
                                marginBottom: 3,
                              },
                            },
                            `${item.name} (${item.code})`
                          ),
                          h(
                            'div',
                            { style: { fontSize: 10, color: C.textSec, lineHeight: 1.6 } },
                            item.targetLabel || item.classificationNote || '資料還在補齊中'
                          )
                        )
                      )
                    ),
                    h(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: 8,
                          flexWrap: 'wrap',
                        },
                      },
                      typeof onRefreshReminder === 'function' &&
                        h(
                          Button,
                          {
                            onClick: () => {
                              onRefreshReminder()
                              setIsReminderOpen(false)
                            },
                            style: {
                              padding: '7px 12px',
                              borderRadius: 999,
                              border: `1px solid ${C.border}`,
                              background: C.subtle,
                              color: C.textSec,
                              fontSize: 10,
                              fontWeight: 600,
                            },
                          },
                          '重新整理'
                        ),
                      typeof onNavigate === 'function' &&
                        h(
                          Button,
                          {
                            onClick: () => {
                              onNavigate('research')
                              setIsReminderOpen(false)
                            },
                            style: {
                              padding: '7px 12px',
                              borderRadius: 999,
                              border: `1px solid ${alpha(C.blue, '32')}`,
                              background: alpha(C.blue, '10'),
                              color: C.textSec,
                              fontSize: 10,
                              fontWeight: 600,
                            },
                          },
                          '查看研究'
                        )
                    )
                  )
              ),
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
        h(
          'div',
          {
            'data-testid': 'dashboard-headline',
            style: {
              fontSize: 'clamp(22px, 3.2vw, 32px)',
              fontWeight: 700,
              color: headlineColor,
              fontFamily: 'var(--font-headline)',
              lineHeight: 1.28,
              letterSpacing: '-0.02em',
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

function buildTodayInMarketsItems(newsEvents = []) {
  const safeEvents = Array.isArray(newsEvents) ? newsEvents : []
  const items = safeEvents
    .map((event, index) => {
      const type = String(event?.type || '')
        .trim()
        .toLowerCase()
      const catalystType = String(event?.catalystType || '')
        .trim()
        .toLowerCase()
      const source = String(event?.source || '')
        .trim()
        .toLowerCase()
      const date = toMarketDateString(event?.eventDate || event?.date)
      const link = [event?.link, event?.url, event?.sourceUrl, event?.source_url]
        .map((value) => String(value || '').trim())
        .find((value) => isSafeExternalUrl(value))
      const isMarket =
        ['market', 'market-summary', 'index', 'indices'].includes(type) || source === 'market-cache'
      const isMacro = type === 'macro' || catalystType === 'macro'
      const isCalendar =
        source === 'auto-calendar' ||
        ['revenue', 'conference', 'earnings', 'dividend', 'shareholder'].includes(type) ||
        ['earnings', 'dividend', 'conference'].includes(catalystType)

      if (!isMarket && !isMacro && !isCalendar) return null

      return {
        id: event?.id || `market-${index}`,
        title: String(event?.title || '').trim() || '未命名市場事件',
        detail: String(event?.detail || event?.summary || '').trim(),
        date,
        link,
        category: isMarket ? '大盤' : isMacro ? '總經' : '行事曆',
        categoryOrder: isMarket ? 0 : isMacro ? 1 : 2,
      }
    })
    .filter(Boolean)

  items.sort((left, right) => {
    if (left.categoryOrder !== right.categoryOrder) {
      return left.categoryOrder - right.categoryOrder
    }
    return String(left.date || '9999-99-99').localeCompare(String(right.date || '9999-99-99'))
  })

  return items
}

function MorningNoteCard({ morningNote = null, onNavigate = null }) {
  if (!morningNote) return null

  const sections = morningNote.sections || {}
  const hasContent =
    sections.todayEvents?.length > 0 ||
    sections.holdingStatus?.length > 0 ||
    sections.watchlistAlerts?.length > 0 ||
    sections.announcements?.length > 0

  if (!hasContent) return null

  const todayEvents = Array.isArray(sections.todayEvents) ? sections.todayEvents.slice(0, 2) : []
  const holdingStatus = Array.isArray(sections.holdingStatus)
    ? sections.holdingStatus.slice(0, 2)
    : []
  const watchlistAlerts = Array.isArray(sections.watchlistAlerts) ? sections.watchlistAlerts : []
  const announcements = Array.isArray(sections.announcements) ? sections.announcements : []
  const deepLinks = buildMorningNoteDeepLinks(morningNote)

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.teal, '40')}`,
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
      h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, 'Morning Note'),
      h('span', { style: { fontSize: 9, color: C.textMute } }, morningNote.date || '')
    ),
    todayEvents.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 6, marginBottom: 8 } },
        todayEvents.map((event) =>
          h(
            'div',
            {
              key: `${event.date}-${event.title}`,
              style: {
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              },
            },
            h(
              'span',
              {
                style: {
                  fontSize: 9,
                  color: event.impactLabel === 'HIGH' ? C.down : C.teal,
                  fontWeight: 600,
                  flexShrink: 0,
                },
              },
              event.impactLabel || 'INFO'
            ),
            h(
              'div',
              { style: { fontSize: 11, color: C.text, lineHeight: 1.7 } },
              event.title,
              event.relatedPillars?.length > 0 &&
                h('span', { style: { fontSize: 9, color: C.textSec, marginLeft: 6 } }, '主軸驗證')
            )
          )
        )
      ),
    holdingStatus.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 4, marginBottom: 8 } },
        holdingStatus.map((holding) =>
          h(
            'div',
            {
              key: holding.code,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 10,
                color: C.textSec,
                lineHeight: 1.7,
              },
            },
            h('span', null, `${holding.name} ${holding.code}`),
            h(
              'span',
              { style: { color: C.textMute } },
              holding.pillarSummary || '今日先看 thesis 是否有變'
            )
          )
        )
      ),
    (watchlistAlerts.length > 0 || announcements.length > 0) &&
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 8,
          },
        },
        watchlistAlerts.length > 0 &&
          h(
            'span',
            {
              style: {
                fontSize: 9,
                color: C.textSec,
                background: alpha(C.up, '12'),
                borderRadius: 999,
                padding: '3px 8px',
              },
            },
            `觀察股 ${watchlistAlerts.length} 檔接近進場價`
          ),
        announcements.length > 0 &&
          h(
            'span',
            {
              style: {
                fontSize: 9,
                color: C.textSec,
                background: alpha(C.blue, '12'),
                borderRadius: 999,
                padding: '3px 8px',
              },
            },
            `重大訊息 ${announcements.length} 則`
          )
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
      deepLinks.map((item) =>
        h(
          Button,
          {
            key: item.key,
            onClick: () => typeof onNavigate === 'function' && onNavigate(item.target),
            style: {
              padding: '7px 12px',
              borderRadius: 999,
              border: `1px solid ${alpha(C.teal, '32')}`,
              background: alpha(C.teal, '10'),
              color: C.textSec,
              fontSize: 10,
              fontWeight: 600,
              cursor: typeof onNavigate === 'function' ? 'pointer' : 'default',
            },
            title: item.summary,
          },
          item.label
        )
      )
    )
  )
}

function TodayInMarketsCard({ newsEvents = [] }) {
  const items = buildTodayInMarketsItems(newsEvents).slice(0, 6)

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.blue, '40')}`,
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
        },
      },
      h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, 'Today in Markets'),
      h(
        'span',
        { style: { fontSize: 9, color: C.textMute } },
        items.length > 0 ? `${items.length} 則` : 'v1'
      )
    ),
    items.length === 0
      ? h(
          'div',
          {
            style: {
              fontSize: 11,
              color: C.textMute,
              marginTop: 8,
            },
          },
          '市場資訊暫無更新'
        )
      : h(
          'div',
          { style: { display: 'grid', gap: 8, marginTop: 8 } },
          items.map((item, index) =>
            h(
              'div',
              {
                key: item.id,
                style: {
                  display: 'grid',
                  gap: 4,
                  paddingBottom: index < items.length - 1 ? 8 : 0,
                  borderBottom: index < items.length - 1 ? `1px solid ${C.border}` : 'none',
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                    flexWrap: 'wrap',
                  },
                },
                h(
                  item.link ? 'a' : 'div',
                  {
                    ...(item.link
                      ? {
                          href: item.link,
                          target: '_blank',
                          rel: 'noreferrer',
                        }
                      : {}),
                    style: {
                      display: item.link ? 'inline-flex' : 'block',
                      alignItems: item.link ? 'center' : undefined,
                      minHeight: item.link ? 44 : undefined,
                      padding: item.link ? '6px 4px' : undefined,
                      fontSize: 11,
                      color: item.link ? C.blue : C.text,
                      fontWeight: 500,
                      lineHeight: 1.6,
                      textDecoration: 'none',
                    },
                  },
                  `${item.category}｜${item.title}`
                ),
                item.date &&
                  h(
                    'span',
                    {
                      style: {
                        fontSize: 9,
                        color: C.textMute,
                        flexShrink: 0,
                      },
                    },
                    formatMarketItemDate(item.date)
                  )
              ),
              item.detail &&
                h(
                  'div',
                  {
                    style: {
                      fontSize: 10,
                      color: C.textSec,
                      lineHeight: 1.7,
                    },
                  },
                  item.detail
                )
            )
          )
        )
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
              color: C.textSec,
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
            color: C.textSec,
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
  const returnColor = totalReturn > 0 ? C.text : totalReturn < 0 ? C.down : C.textSec
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
              color: C.text,
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
  holdingDossiers = [],
  dataRefreshRows = [],
  morningNote = null,
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
  viewMode = 'retail',
  onRefreshReminder = null,
  onNavigate = null,
}) {
  const dashboardHeadline = useMemo(
    () => buildDashboardHeadline(holdingDossiers, { viewMode }),
    [holdingDossiers, viewMode]
  )

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
          headline: dashboardHeadline.headline,
          headlineTone: dashboardHeadline.tone,
          dataRefreshRows,
          onRefreshReminder,
          onNavigate,
          totalVal,
          todayTotalPnl,
          portfolioName: displayPortfolioName({ displayName: portfolioName, id: portfolioId }),
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
    h(MorningNoteCard, { morningNote, onNavigate }),
    h(PrincipleCards),
    h(TodayInMarketsCard, { newsEvents }),
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
