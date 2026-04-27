import { createElement as h, useMemo, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { buildAnxietyMetrics } from '../../lib/anxietyMetrics.js'
import { buildDashboardHeadline } from '../../lib/dashboardHeadline.js'
import { buildMorningNoteDeepLinks } from '../../lib/morningNoteBuilder.js'
import { normalizeEventType } from '../../lib/eventTypeMeta.js'
import { displayPortfolioName } from '../../lib/portfolioDisplay.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { useUpstreamHealth } from '../../hooks/useUpstreamHealth.js'
import {
  AccuracyGateBlock,
  AnimatedNumber,
  Button,
  Card,
  MarkdownText,
  StaleBadge,
  UpstreamHealthBanner,
} from '../common'
import { EmptyState } from '../common/EmptyState.jsx'
import { AnxietyMetricsPanel } from './AnxietyMetricsPanel.jsx'
import HoldingsRing from './HoldingsRing.jsx'
import { PrincipleCards } from './PrincipleCards.jsx'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 500,
  marginBottom: 4,
}

const metricCard = {
  background: alpha(C.surface, 'f8'),
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '12px 14px',
  boxShadow: `${C.insetLine}, ${C.shadow}`,
}

const heroHeadlineLabel = {
  fontSize: 12,
  color: C.textSec,
  fontFamily: 'var(--font-headline)',
  letterSpacing: '0.08em',
}

const TODAY_IN_MARKETS_MAX_ITEMS = 6
const TODAY_IN_MARKETS_STALE_MS = 4 * 60 * 60 * 1000
const TODAY_IN_MARKETS_CATEGORY_META = {
  'central-bank': {
    label: '央行',
    order: 0,
    color: C.text,
    border: alpha(C.fillTeal, '32'),
    background: alpha(C.fillTeal, '10'),
  },
  macro: {
    label: '總經',
    order: 1,
    color: C.text,
    border: alpha(C.amber, '32'),
    background: alpha(C.amber, '10'),
  },
  calendar: {
    label: '行事曆',
    order: 2,
    color: C.text,
    border: alpha(C.up, '28'),
    background: alpha(C.up, '10'),
  },
  regulator: {
    label: '金管會',
    order: 3,
    color: C.text,
    border: alpha(C.orange, '28'),
    background: alpha(C.orange, '10'),
  },
  market: {
    label: '大盤',
    order: 4,
    color: C.text,
    border: alpha(C.ink, '22'),
    background: alpha(C.ink, '08'),
  },
}
const TODAY_IN_MARKETS_CATEGORY_PRIORITY = Object.keys(TODAY_IN_MARKETS_CATEGORY_META)
const TODAY_IN_MARKETS_SOURCE_LABELS = {
  'cbc-calendar': '央行排程',
  'cbc-news': '央行公告',
  'dgbas-calendar': '主計總處',
  'mof-calendar': '財政部',
  'fsc-rss': '金管會',
  'twse-ex-rights': 'TWSE',
  'auto-calendar': '市場行事曆',
  'market-cache': '盤面整理',
}

function formatTaipeiDate() {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
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

function formatMarketItemDateTime(value, time = '') {
  const dateLabel = formatMarketItemDate(value)
  const timeLabel = String(time || '').trim()
  return [dateLabel, timeLabel].filter(Boolean).join(' ')
}

function formatTodayInMarketsRelativeLabel(value) {
  const parsed = parseEventTimestamp(value)
  if (!parsed) return ''

  const diffMs = Math.max(0, Date.now() - parsed.getTime())
  const hourMs = 60 * 60 * 1000
  const dayMs = 24 * hourMs
  if (diffMs < hourMs) return '剛剛'
  if (diffMs < dayMs) return `${Math.max(1, Math.floor(diffMs / hourMs))} 小時前`
  return `${Math.max(1, Math.floor(diffMs / dayMs))} 天前`
}

function parseEventTimestamp(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveTodayInMarketsCategory(event = {}) {
  const eventType = normalizeEventType(event?.eventType || event?.type)
  const type = String(event?.type || '')
    .trim()
    .toLowerCase()
  const catalystType = String(event?.catalystType || '')
    .trim()
    .toLowerCase()
  const source = String(event?.source || '')
    .trim()
    .toLowerCase()
  const segment = String(event?.marketSegment || '')
    .trim()
    .toLowerCase()
  const combinedText = `${event?.title || ''} ${event?.detail || ''}`.toLowerCase()

  if (
    segment === 'central-bank' ||
    source === 'cbc-news' ||
    source === 'cbc-calendar' ||
    /央行|外匯存底|匯率/.test(combinedText)
  ) {
    return { key: 'central-bank', ...TODAY_IN_MARKETS_CATEGORY_META['central-bank'] }
  }

  if (
    segment === 'macro' ||
    source === 'dgbas-calendar' ||
    source === 'mof-calendar' ||
    type === 'macro' ||
    catalystType === 'macro'
  ) {
    return { key: 'macro', ...TODAY_IN_MARKETS_CATEGORY_META.macro }
  }

  if (segment === 'regulator' || source === 'fsc-rss') {
    return { key: 'regulator', ...TODAY_IN_MARKETS_CATEGORY_META.regulator }
  }

  if (
    segment === 'calendar' ||
    source === 'auto-calendar' ||
    [
      'twse-ex-rights',
      'finmind-dividend',
      'finmind-capital-reduction',
      'mops-shareholder',
    ].includes(source) ||
    ['revenue', 'conference', 'earnings', 'dividend', 'shareholder'].includes(type) ||
    ['earnings', 'ex-dividend', 'shareholding-meeting', 'strategic'].includes(
      String(eventType || '')
    ) ||
    ['earnings', 'dividend', 'conference'].includes(catalystType)
  ) {
    return { key: 'calendar', ...TODAY_IN_MARKETS_CATEGORY_META.calendar }
  }

  if (
    ['market', 'market-summary', 'index', 'indices'].includes(type) ||
    source === 'market-cache'
  ) {
    return { key: 'market', ...TODAY_IN_MARKETS_CATEGORY_META.market }
  }

  return null
}

function resolveTodayInMarketsCopy(event, category) {
  const text = `${event?.title || ''} ${event?.detail || ''}`

  if (category?.key === 'central-bank') {
    if (/理監事|利率|信用管制/.test(text)) {
      return '央行今天會定調利率與信用管制，金融、營建與高股息族群通常會先被拿出來看。'
    }
    if (/外匯存底|匯率|外匯/.test(text)) {
      return '央行下午會更新外匯數字，台幣、壽險與金控題材常會先有討論。'
    }
    return '央行這週有新訊息，金融與匯率敏感族群通常會先看市場怎麼接。'
  }

  if (category?.key === 'regulator') {
    return '金管會本週有新公告，金融股、券商與保險題材可能先反映情緒。'
  }

  if (category?.key === 'macro') {
    if (/CPI|PPI|物價/.test(text)) {
      return '物價數字一更新，利率敏感與內需股通常會先被重新估值。'
    }
    if (/GDP|國民所得|經濟成長/.test(text)) {
      return 'GDP 與展望更新時，出口鏈和景氣循環股通常會先被重新比較。'
    }
    if (/出口|進出口|海關/.test(text)) {
      return '出口數字一公布，電子鏈、航運與景氣循環股通常會很快被重估。'
    }
    return '今天有總經節點，市場通常會先重排成長、內需與利率敏感族群的節奏。'
  }

  if (category?.key === 'calendar') {
    if (normalizeEventType(event?.eventType || event?.type) === 'strategic') {
      return '策略變動這類新聞若真的牽動管理層或資本配置，通常要立刻回頭重看投資理由。'
    }
    if (/除權|除息/.test(text)) {
      return '除權息時程靠近時，殖利率與填息題材通常會重新回到盤面。'
    }
    if (/股東會|紀念品/.test(text)) {
      return '股東會本身是時間點事件；若只是紀念品資訊，通常偏資訊備查，不直接改投資理由。'
    }
    if (/營收/.test(text)) {
      return '營收公布日靠近時，市場通常會先看強勢股能不能把節奏延續下去。'
    }
    return '今天的行事曆偏密，市場通常會先挑最接近催化的個股出來反應。'
  }

  return String(event?.detail || '').trim() || '市場焦點先整理到這裡，後續看盤面怎麼接。'
}

function resolveTodayInMarketsSourceLabel(source = '') {
  return (
    TODAY_IN_MARKETS_SOURCE_LABELS[
      String(source || '')
        .trim()
        .toLowerCase()
    ] || '官方來源'
  )
}

function resolveTodayInMarketsWindowLabel(dateValue = '') {
  const normalized = toMarketDateString(dateValue)
  if (!normalized) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(target.getTime())) return ''

  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return '今天'
  if (diffDays > 0 && diffDays <= 6) return '本週'
  if (diffDays < 0 && diffDays >= -6) return '近一週'
  return ''
}

function selectTodayInMarketsItems(items = [], limit = TODAY_IN_MARKETS_MAX_ITEMS) {
  const grouped = new Map()
  for (const key of TODAY_IN_MARKETS_CATEGORY_PRIORITY) grouped.set(key, [])
  for (const item of items) {
    if (!grouped.has(item.categoryKey)) grouped.set(item.categoryKey, [])
    grouped.get(item.categoryKey).push(item)
  }

  const selected = []
  const selectedIds = new Set()

  for (const key of TODAY_IN_MARKETS_CATEGORY_PRIORITY) {
    const firstItem = grouped.get(key)?.[0]
    if (!firstItem) continue
    selected.push(firstItem)
    selectedIds.add(firstItem.id)
    if (selected.length >= limit) return selected
  }

  for (const key of TODAY_IN_MARKETS_CATEGORY_PRIORITY) {
    for (const item of grouped.get(key) || []) {
      if (selectedIds.has(item.id)) continue
      selected.push(item)
      selectedIds.add(item.id)
      if (selected.length >= limit) return selected
    }
  }

  return selected
}

function resolveTodayInMarketsFreshness(items = []) {
  const timestamps = items
    .map((item) => parseEventTimestamp(item.updatedAt))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())

  if (timestamps.length === 0) return { staleStatus: '', updatedAt: '', label: '' }

  const latest = timestamps[0]
  return {
    staleStatus: Date.now() - latest.getTime() > TODAY_IN_MARKETS_STALE_MS ? 'stale' : '',
    updatedAt: latest.toISOString(),
    label: formatTodayInMarketsRelativeLabel(latest),
  }
}

function DashboardCompareStrip({ compareStrip = null, onNavigate = null }) {
  if (!compareStrip) return null

  const accentColor = compareStrip.tone === 'watch' ? C.amber : C.up
  const toneColor = compareStrip.tone === 'watch' ? C.textSec : C.text
  const isClickable = typeof onNavigate === 'function'
  const showStaleBadge =
    compareStrip.staleStatus && ['stale', 'missing', 'failed'].includes(compareStrip.staleStatus)
  const RootTag = isClickable ? 'button' : 'div'

  return h(
    Card,
    {
      'data-testid': 'dashboard-compare-strip',
      style: {
        marginTop: 8,
        marginBottom: 8,
        padding: '12px 14px',
        border: `1px solid ${alpha(accentColor, compareStrip.tone === 'watch' ? '22' : '18')}`,
        background: compareStrip.tone === 'watch' ? alpha(C.amber, '08') : alpha(C.up, '08'),
      },
    },
    h(
      RootTag,
      isClickable
        ? {
            type: 'button',
            onClick: () => onNavigate('overview'),
            style: {
              width: '100%',
              display: 'grid',
              gap: 6,
              border: 'none',
              background: 'transparent',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            },
          }
        : {
            style: {
              display: 'grid',
              gap: 6,
            },
          },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          },
        },
        h(
          'span',
          {
            style: {
              fontSize: 11,
              color: C.textMute,
              letterSpacing: '0.08em',
              lineHeight: 1.4,
            },
          },
          `先看 ${compareStrip.primary.label} 和 ${compareStrip.secondary.label}`
        ),
        showStaleBadge &&
          h(StaleBadge, {
            status: compareStrip.staleStatus,
            title: 'dashboard compare freshness',
          })
      ),
      h(
        'div',
        {
          'data-testid': 'dashboard-compare-summary',
          style: {
            fontSize: 'clamp(15px, 2.6vw, 18px)',
            fontWeight: 600,
            color: C.text,
            lineHeight: 1.5,
          },
        },
        compareStrip.summaryText
      ),
      h(
        'div',
        {
          'data-testid': 'dashboard-compare-insight',
          style: {
            fontSize: 12,
            color: toneColor,
            lineHeight: 1.6,
          },
        },
        compareStrip.insightText
      )
    )
  )
}

/**
 * Hero summary — total assets with supporting context
 */
function TodayPnlHero({
  totalVal = 0,
  todayTotalPnl = 0,
  todayPnlHasPriceData = true,
  todayPnlIsStale = false,
  marketPriceSync = null,
  holdings = [],
  portfolioName = '',
  headline = '',
  headlineTone = 'calm',
  headlineGate = null,
  collapseUpstreamBanners = false,
  dataRefreshRows = [],
  stockMeta = null,
  holdingDossiers = [],
  onRefreshReminder = null,
  onNavigate = null,
}) {
  const isMobileFold = useIsMobile('(max-width: 600px)')
  const [isReminderOpen, setIsReminderOpen] = useState(false)
  const [dismissedGateKey, setDismissedGateKey] = useState('')
  const showStalePnl = Boolean(
    holdings.length > 0 &&
    (todayPnlIsStale ||
      !todayPnlHasPriceData ||
      todayTotalPnl == null ||
      (marketPriceSync?.status === 'failed' && Number(todayTotalPnl || 0) === 0))
  )
  const color = showStalePnl
    ? C.textMute
    : todayTotalPnl > 0
      ? C.up
      : todayTotalPnl < 0
        ? C.down
        : C.textSec
  const sign = showStalePnl ? '' : todayTotalPnl > 0 ? '+' : ''
  const totalText = Math.round(totalVal).toLocaleString()
  const pnlText = showStalePnl ? '—' : `${sign}${Math.round(todayTotalPnl).toLocaleString()}`
  const portfolioLabel = displayPortfolioName({ displayName: portfolioName }) || '目前組合'
  const safeRefreshRows = Array.isArray(dataRefreshRows) ? dataRefreshRows : []
  const headlineText = String(headline || '').trim() || '今日持倉 overview'
  const headlineGateKey = headlineGate
    ? [headlineGate.resource, headlineGate.reason, portfolioLabel].filter(Boolean).join(':')
    : ''
  const showHeadlineGate = Boolean(
    headlineGate && !collapseUpstreamBanners && dismissedGateKey !== headlineGateKey
  )
  const safeHeadlineText = headlineGate ? '首頁 headline 稍後再補' : headlineText
  const headlineColor =
    headlineTone === 'alert' ? C.text : headlineTone === 'watch' ? C.textSec : C.text
  const heroMetrics = [
    {
      label: '總資產',
      value: totalText,
      helper: '把市值先放大，其他訊號都只是判斷順序。',
      testId: 'dashboard-total-assets-value',
      color: C.text,
    },
    {
      label: '今日損益',
      value: pnlText,
      helper: showStalePnl ? '資料補齊中' : '看方向，也看它有沒有改變投資理由。',
      testId: 'dashboard-today-pnl-value',
      color,
    },
    {
      label: '持倉檔數',
      value: `${holdings.length} 檔`,
      helper: '檔數是節奏指標，不是越多越好。',
      testId: 'dashboard-holdings-count-value',
      color: C.text,
    },
  ]

  return h(
    Card,
    {
      'data-testid': 'dashboard-poster-hero',
      style: {
        marginBottom: 8,
        padding: isMobileFold ? '18px 14px' : '40px 28px',
        background: alpha(C.surface, 'f4'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: isMobileFold ? 16 : 24,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: isMobileFold ? 14 : 18,
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
              !collapseUpstreamBanners &&
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
                      borderRadius: 8,
                      padding: '4px 8px',
                      border: `1px solid ${alpha(C.amber, '24')}`,
                      background: alpha(C.amber, '10'),
                      color: C.textSec,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    },
                  },
                  h('span', { style: { fontSize: 11, fontWeight: 700 } }, '提醒'),
                  h(
                    'span',
                    {
                      style: {
                        borderRadius: 8,
                        padding: '4px 8px',
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
                        borderRadius: C.radii.md,
                        border: `1px solid ${C.border}`,
                        background: C.raised,
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
                          fontSize: 12,
                          color: C.textSec,
                          lineHeight: 1.7,
                          marginBottom: 8,
                        },
                      },
                      `目前有 ${safeRefreshRows.length} 檔資料還在更新中。`
                    ),
                    h(
                      'div',
                      { style: { display: 'grid', gap: 4, marginBottom: 8 } },
                      safeRefreshRows.slice(0, 5).map((item) =>
                        h(
                          'div',
                          {
                            key: item.code,
                            style: {
                              background: C.subtle,
                              border: `1px solid ${C.borderSub}`,
                              borderRadius: C.radii.md,
                              padding: '8px 8px',
                            },
                          },
                          h(
                            'div',
                            {
                              style: {
                                fontSize: 11,
                                color: C.text,
                                fontWeight: 600,
                                marginBottom: 4,
                              },
                            },
                            `${item.name} (${item.code})`
                          ),
                          h(
                            'div',
                            { style: { fontSize: 12, color: C.textSec, lineHeight: 1.6 } },
                            item.targetLabel || item.classificationNote || '尚未取得目標價'
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
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              background: C.subtle,
                              color: C.textSec,
                              fontSize: 12,
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
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: `1px solid ${C.cta}`,
                              background: C.cta,
                              color: C.onFill,
                              fontSize: 12,
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
                  fontFamily: 'Inter, system-ui, var(--font-body)',
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
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: alpha(C.ink, '10'),
                  border: `1px solid ${C.borderStrong}`,
                },
              },
              portfolioLabel
            )
          )
        ),
        showHeadlineGate
          ? h(AccuracyGateBlock, {
              reason: headlineGate.reason,
              resource: headlineGate.resource,
              context: headlineGate.context,
              onRetry: typeof onRefreshReminder === 'function' ? onRefreshReminder : null,
              onDismiss: () => setDismissedGateKey(headlineGateKey),
            })
          : h(
              // R156 #6 + #9 hero · poster style · headline 用 bold sans 不再霸王 serif
              // Mobile clamp 24-32 / desktop 32-40 · 不再 56px 撐爆 fold 1
              'div',
              {
                'data-testid': 'dashboard-headline',
                style: {
                  fontSize: isMobileFold ? 24 : 'clamp(28px, 3.2vw, 36px)',
                  fontWeight: 700,
                  color: headlineColor,
                  fontFamily: 'Inter, system-ui, var(--font-body)',
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  maxWidth: '20ch',
                },
              },
              safeHeadlineText
            ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: isMobileFold ? 8 : 12,
            },
          },
          heroMetrics.map((metric) =>
            h(
              'div',
              {
                key: metric.label,
                className: 'card-hover-lift',
                style: {
                  ...metricCard,
                  display: 'grid',
                  alignContent: 'space-between',
                  minHeight: isMobileFold ? 104 : 164,
                  padding: isMobileFold ? '12px 10px' : '22px 24px',
                  borderRadius: 8,
                  background: alpha(C.surface, 'f8'),
                },
              },
              h(
                'div',
                {
                  style: {
                    fontSize: 12,
                    color: C.textMute,
                    letterSpacing: '0.08em',
                    lineHeight: 1.4,
                  },
                },
                metric.label
              ),
              h(AnimatedNumber, {
                'data-testid': metric.testId,
                value: metric.value,
                as: 'div',
                className: 'tn',
                style: {
                  fontSize: isMobileFold ? 26 : 'clamp(42px, 4.8vw, 58px)',
                  fontWeight: 800,
                  color: metric.color,
                  marginTop: isMobileFold ? 12 : 18,
                  fontFamily: 'Inter, system-ui, var(--font-body)',
                  lineHeight: 0.98,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: 0,
                  whiteSpace: 'nowrap',
                },
              }),
              !isMobileFold &&
                h(
                  'div',
                  {
                    style: {
                      fontSize: 12,
                      color: C.textSec,
                      lineHeight: 1.65,
                      marginTop: 14,
                    },
                  },
                  metric.helper
                )
            )
          )
        ),
        showStalePnl &&
          h(
            'div',
            {
              'data-testid': 'dashboard-today-pnl-stale-copy',
              style: {
                fontSize: 11,
                color: C.textMute,
                lineHeight: 1.6,
              },
            },
            '資料補齊中'
          ),
        h(
          'div',
          {
            style: {
              borderTop: `1px solid ${C.border}`,
              paddingTop: isMobileFold ? 12 : 18,
            },
          },
          h(HoldingsRing, { holdings, totalVal, stockMeta, holdingDossiers, compact: true })
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
    { style: { marginBottom: 8, borderLeft: `3px solid ${C.neutralIron}` } },
    h(
      'div',
      {
        style: {
          ...lbl,
          color: C.neutralIron,
          marginBottom: 4,
        },
      },
      'AI 快評'
    ),
    h(MarkdownText, { text: summary, color: C.textSec })
  )
}

function buildTodayInMarketsItems(newsEvents = []) {
  const safeEvents = Array.isArray(newsEvents) ? newsEvents : []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const items = safeEvents
    .map((event, index) => {
      const category = resolveTodayInMarketsCategory(event)
      if (!category) return null

      const source = String(event?.source || '')
        .trim()
        .toLowerCase()
      const date = toMarketDateString(event?.eventDate || event?.date)
      const time = String(event?.time || '').trim()
      const link = [event?.link, event?.url, event?.sourceUrl, event?.source_url]
        .map((value) => String(value || '').trim())
        .find((value) => isSafeExternalUrl(value))
      const parsedDate = date ? new Date(`${date}T00:00:00`) : null
      const dateDistance =
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? Math.abs(Math.round((parsedDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
          : Number.POSITIVE_INFINITY
      const title = String(event?.title || '').trim() || '未命名市場事件'
      const detail = String(event?.detail || event?.summary || '').trim()

      return {
        id: event?.id || `market-${index}`,
        title,
        detail,
        copy: resolveTodayInMarketsCopy({ ...event, title, detail }, category),
        date,
        time,
        dateLabel: formatMarketItemDateTime(date, time),
        link,
        sourceLabel: resolveTodayInMarketsSourceLabel(source),
        windowLabel: resolveTodayInMarketsWindowLabel(date),
        updatedAt: String(event?.sourceUpdatedAt || event?.updatedAt || '').trim(),
        categoryKey: category.key,
        categoryLabel: category.label,
        categoryMeta: category,
        categoryOrder: category.order,
        dateDistance,
      }
    })
    .filter(Boolean)

  items.sort((left, right) => {
    if (left.categoryOrder !== right.categoryOrder) {
      return left.categoryOrder - right.categoryOrder
    }
    if (left.dateDistance !== right.dateDistance) {
      return left.dateDistance - right.dateDistance
    }
    return String(left.date || '9999-99-99').localeCompare(String(right.date || '9999-99-99'))
  })

  return selectTodayInMarketsItems(items, TODAY_IN_MARKETS_MAX_ITEMS)
}

function MorningNoteCard({ morningNote = null, onNavigate = null, onMorningNoteHandoff = null }) {
  if (!morningNote) return null

  const sections = morningNote.sections || {}
  const focusPoints = Array.isArray(morningNote.focusPoints) ? morningNote.focusPoints : []
  const hasContent =
    Boolean(morningNote.headline) ||
    Boolean(morningNote.summary) ||
    Boolean(morningNote.lead) ||
    Boolean(morningNote.fallbackMessage) ||
    Boolean(morningNote.blockedReason) ||
    focusPoints.length > 0 ||
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
  const staleStatus = ['stale', 'missing', 'failed'].includes(morningNote.staleStatus)
    ? morningNote.staleStatus
    : ''
  const handleMorningNoteHandoff = ({ target = 'daily', code = '' } = {}) => {
    if (typeof onMorningNoteHandoff === 'function') {
      onMorningNoteHandoff({ target, code, handoffSource: 'morning-note' })
      return
    }
    if (typeof onNavigate === 'function') onNavigate(target)
  }

  return h(
    Card,
    {
      variant: 'hero',
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.ink, '40')}`,
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
      h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, '今晨速報'),
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
        staleStatus &&
          h(StaleBadge, {
            status: staleStatus,
            title: 'morning note freshness',
          }),
        h('span', { style: { fontSize: 11, color: C.textMute } }, morningNote.date || '')
      )
    ),
    morningNote.headline &&
      h(
        'div',
        {
          'data-testid': 'morning-note-headline',
          style: {
            fontSize: 16,
            fontWeight: 700,
            color: C.text,
            lineHeight: 1.55,
            marginBottom: 8,
          },
        },
        h(MarkdownText, { text: morningNote.headline, color: C.text })
      ),
    (morningNote.summary || morningNote.lead) &&
      h(
        'div',
        {
          'data-testid': 'morning-note-lead',
          style: {
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.8,
            marginBottom: 8,
          },
        },
        h(MarkdownText, {
          text: [morningNote.summary, morningNote.lead].filter(Boolean).join('\n\n'),
          color: C.textSec,
        })
      ),
    morningNote.blockedReason &&
      h(
        'div',
        {
          'data-testid': 'morning-note-blocked-reason',
          style: {
            marginBottom: 8,
            fontSize: 12,
            lineHeight: 1.7,
            color: C.down,
            background: C.downBg,
            border: `1px solid ${alpha(C.down, '24')}`,
            borderRadius: 12,
            padding: '10px 12px',
          },
        },
        `準確度檢查：${morningNote.blockedReason}`
      ),
    morningNote.fallbackMessage &&
      h(
        'div',
        {
          'data-testid': 'morning-note-fallback',
          style: {
            marginBottom: 8,
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.7,
            background: alpha(C.subtle, 'f0'),
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '10px 12px',
          },
        },
        h(MarkdownText, { text: morningNote.fallbackMessage, color: C.textSec })
      ),
    focusPoints.length > 0 &&
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 6,
            marginBottom: 8,
          },
        },
        focusPoints.slice(0, 3).map((item) =>
          h(
            'div',
            {
              key: item.id || item.title,
              role: 'button',
              tabIndex: 0,
              onClick: () => handleMorningNoteHandoff({ target: 'daily' }),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleMorningNoteHandoff({ target: 'daily' })
                }
              },
              style: {
                borderRadius: 12,
                border: `1px solid ${
                  item.tone === 'watch' ? alpha(C.amber, '32') : alpha(C.fillTeal, '24')
                }`,
                background: item.tone === 'watch' ? alpha(C.amber, '08') : alpha(C.fillTeal, '08'),
                padding: '10px 12px',
                cursor: 'pointer',
              },
            },
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  lineHeight: 1.6,
                  marginBottom: 4,
                },
              },
              item.title
            ),
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  color: C.textSec,
                  lineHeight: 1.7,
                },
              },
              h(MarkdownText, { text: item.body, color: C.textSec })
            )
          )
        )
      ),
    todayEvents.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 4, marginBottom: 8 } },
        todayEvents.map((event) =>
          h(
            'div',
            {
              key: `${event.date}-${event.title}`,
              role: 'button',
              tabIndex: 0,
              onClick: () =>
                handleMorningNoteHandoff({
                  target: 'events',
                  code: event.stocks?.[0] || event.stockCode || '',
                }),
              onKeyDown: (keyboardEvent) => {
                if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                  keyboardEvent.preventDefault()
                  handleMorningNoteHandoff({
                    target: 'events',
                    code: event.stocks?.[0] || event.stockCode || '',
                  })
                }
              },
              style: {
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                cursor: 'pointer',
              },
            },
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  color: event.impactLabel === 'HIGH' ? C.down : C.positive,
                  fontWeight: 600,
                  flexShrink: 0,
                },
              },
              event.impactLabel || '一般'
            ),
            h(
              'div',
              { style: { fontSize: 11, color: C.text, lineHeight: 1.7 } },
              event.title,
              event.relatedPillars?.length > 0 &&
                h('span', { style: { fontSize: 11, color: C.textSec, marginLeft: 4 } }, '主軸驗證')
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
              role: 'button',
              tabIndex: 0,
              onClick: () => handleMorningNoteHandoff({ target: 'holdings', code: holding.code }),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleMorningNoteHandoff({ target: 'holdings', code: holding.code })
                }
              },
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 12,
                color: C.textSec,
                lineHeight: 1.7,
                cursor: 'pointer',
              },
            },
            h('span', null, `${holding.name} ${holding.code}`),
            h(
              'span',
              { style: { color: C.textMute } },
              holding.pillarSummary || '今日先看投資理由是否有變'
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
                fontSize: 11,
                color: C.textSec,
                background: alpha(C.up, '12'),
                borderRadius: 8,
                padding: '4px 8px',
              },
            },
            `觀察股 ${watchlistAlerts.length} 檔接近進場價`
          ),
        announcements.length > 0 &&
          h(
            'span',
            {
              style: {
                fontSize: 11,
                color: C.textSec,
                background: alpha(C.ink, '10'),
                borderRadius: 8,
                padding: '4px 8px',
              },
            },
            `重大訊息 ${announcements.length} 則`
          )
      ),
    deepLinks.length > 0 &&
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
              onClick: () => handleMorningNoteHandoff({ target: item.target }),
              style: {
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${alpha(C.fillTeal, '32')}`,
                background: alpha(C.fillTeal, '10'),
                color: C.textSec,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              },
              title: item.summary,
            },
            item.label
          )
        )
      )
  )
}

function formatSnapshotTimestamp(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function resolveSnapshotCopy(status, lastSuccessAt = '') {
  const lastLabel = formatSnapshotTimestamp(lastSuccessAt)

  if (status === 'failed') {
    return lastLabel
      ? `最近一次 snapshot 沒有順利落盤，若臨時要回復，時間點大概會停在 ${lastLabel} 那一版。`
      : '最近一次 snapshot 沒有順利落盤，若臨時要回復，會更依賴前一份已保存版本。'
  }

  if (status === 'missing') {
    return '目前還沒看到每日快照的成功紀錄，還原演練會更依賴本機備份點。'
  }

  return lastLabel
    ? `最近一份每日快照已超過 36 小時，若臨時要回復，時間點大概會停在 ${lastLabel} 那一版。`
    : '最近一份每日快照已超過 36 小時，若臨時要回復，時間點會更接近前一版。'
}

function DailySnapshotStatusCard({ dailySnapshotStatus = null }) {
  if (!dailySnapshotStatus?.stale) return null

  const badgeStatus = ['stale', 'missing', 'failed'].includes(dailySnapshotStatus.badgeStatus)
    ? dailySnapshotStatus.badgeStatus
    : 'stale'
  const copy = resolveSnapshotCopy(badgeStatus, dailySnapshotStatus.lastSuccessAt)
  const lastLabel = formatSnapshotTimestamp(dailySnapshotStatus.lastSuccessAt)

  return h(
    Card,
    {
      'data-testid': 'daily-snapshot-status-card',
      style: {
        marginBottom: 8,
        border: `1px solid ${alpha(
          badgeStatus === 'failed' ? C.down : badgeStatus === 'missing' ? C.border : C.amber,
          badgeStatus === 'missing' ? '70' : '32'
        )}`,
        background:
          badgeStatus === 'failed'
            ? alpha(C.down, '08')
            : badgeStatus === 'missing'
              ? alpha(C.card, 'f5')
              : alpha(C.amber, '0a'),
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
      h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, '還原快照'),
      h(StaleBadge, {
        status: badgeStatus,
        title: '當日資料新鮮度',
      })
    ),
    h(
      'div',
      {
        'data-testid': 'daily-snapshot-status-copy',
        style: {
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.8,
        },
      },
      copy
    ),
    lastLabel &&
      h(
        'div',
        {
          style: {
            marginTop: 8,
            fontSize: 11,
            color: C.textMute,
          },
        },
        `最近一次成功 · ${lastLabel}`
      )
  )
}

function TodayInMarketsCard({ newsEvents = [] }) {
  const isMobile = useIsMobile()
  const items = buildTodayInMarketsItems(newsEvents)
  const freshness = resolveTodayInMarketsFreshness(items)
  const updatedAtLabel = formatSnapshotTimestamp(freshness.updatedAt)

  return h(
    Card,
    {
      'data-testid': 'today-in-markets-card',
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.fillTeal, '42')}`,
        background: alpha(C.surface, 'f6'),
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
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 4,
          },
        },
        h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, '今日市場'),
        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textSec,
              lineHeight: 1.7,
            },
          },
          '今天先看總經、央行與行事曆節點，挑最接近台股節奏的幾條整理給你。'
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
        freshness.staleStatus &&
          h(StaleBadge, {
            status: freshness.staleStatus,
            label: freshness.label,
            title: 'today in markets freshness',
            'data-testid': 'today-in-markets-stale-badge',
          }),
        updatedAtLabel &&
          h(
            'span',
            {
              'data-testid': 'today-in-markets-updated-at',
              style: { fontSize: 11, color: C.textMute },
            },
            `更新 ${updatedAtLabel}`
          ),
        h(
          'span',
          { style: { fontSize: 11, color: C.textMute } },
          items.length > 0 ? `${items.length} 則` : 'v1'
        )
      )
    ),
    items.length === 0
      ? h(
          'div',
          {
            'data-testid': 'today-in-markets-empty',
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
          {
            'data-testid': 'today-in-markets-list',
            'data-layout': isMobile ? 'mobile-single-column' : 'desktop-stack',
            style: {
              display: 'grid',
              gap: 10,
              marginTop: 12,
            },
          },
          items.map((item) =>
            h(
              'div',
              {
                key: item.id,
                'data-testid': 'today-in-markets-item',
                style: {
                  display: 'grid',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: C.radii.md,
                  border: `1px solid ${item.categoryMeta.border}`,
                  background: item.categoryMeta.background,
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'start',
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
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      },
                    },
                    h(
                      'span',
                      {
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: 8,
                          border: `1px solid ${item.categoryMeta.border}`,
                          background: item.categoryMeta.background,
                          color: item.categoryMeta.color,
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          letterSpacing: '0.04em',
                        },
                      },
                      item.categoryLabel
                    ),
                    item.windowLabel
                      ? h(
                          'span',
                          {
                            style: {
                              fontSize: 11,
                              color: C.textMute,
                            },
                          },
                          item.windowLabel
                        )
                      : null,
                    h(
                      'span',
                      {
                        style: {
                          fontSize: 11,
                          color: C.textMute,
                        },
                      },
                      item.sourceLabel
                    )
                  ),
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
                        color: C.text,
                        fontSize: 14,
                        fontWeight: 700,
                        lineHeight: 1.6,
                        textDecoration: 'none',
                      },
                    },
                    item.title
                  ),
                  h(
                    'div',
                    {
                      style: {
                        fontSize: 12,
                        color: C.textSec,
                        lineHeight: 1.8,
                      },
                    },
                    item.copy
                  )
                ),
                item.dateLabel || item.windowLabel
                  ? h(
                      'span',
                      {
                        style: {
                          fontSize: 11,
                          color: C.textMute,
                          flexShrink: 0,
                          justifySelf: isMobile ? 'start' : 'end',
                          whiteSpace: 'nowrap',
                        },
                      },
                      item.dateLabel || item.windowLabel
                    )
                  : null
              )
            )
          )
        )
  )
}

const FOCUS_TONE_ORDER = {
  alert: 0,
  warn: 1,
  warning: 1,
  ok: 2,
  calm: 2,
  muted: 3,
}

const FOCUS_METRIC_ORDER = {
  x5: 0,
  x2: 1,
  x4: 2,
  x1: 3,
  x3: 4,
}

function cleanFocusCopy(value = '') {
  return String(value || '')
    .replace(/[#*_`>|-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildMorningFocusItem(morningNote = null) {
  if (!morningNote) return null
  const focusPoints = Array.isArray(morningNote.focusPoints) ? morningNote.focusPoints : []
  const firstFocus = focusPoints.find((item) => item?.title || item?.body)
  if (firstFocus) {
    return {
      id: `morning-${firstFocus.id || firstFocus.title || 'focus'}`,
      eyebrow: '今晨速報',
      title: cleanFocusCopy(firstFocus.title) || '盤前重點先放到前面',
      body: cleanFocusCopy(firstFocus.body) || '今天先看這件事有沒有改變持倉節奏。',
      tone: firstFocus.tone === 'watch' ? 'warn' : 'ok',
      routeTab: 'daily',
      routeLabel: '盤後接續',
    }
  }

  const title = cleanFocusCopy(morningNote.headline || morningNote.summary || morningNote.lead)
  if (!title) return null
  return {
    id: 'morning-note',
    eyebrow: '今晨速報',
    title,
    body:
      cleanFocusCopy(morningNote.lead || morningNote.summary) ||
      '先把今天最容易影響情緒的事放在前面。',
    tone: morningNote.staleStatus === 'failed' ? 'alert' : 'ok',
    routeTab: 'daily',
    routeLabel: '盤後接續',
  }
}

function buildDashboardFocusItems({
  anxietyMetrics = null,
  holdings = [],
  holdingDossiers = [],
  newsEvents = [],
  dailyReport = null,
  morningNote = null,
  stockMeta = null,
}) {
  const panelState =
    anxietyMetrics ||
    buildAnxietyMetrics({
      holdings,
      holdingDossiers,
      newsEvents,
      dailyReport,
      stockMeta,
    })
  const metrics = Array.isArray(panelState?.metrics) ? panelState.metrics : []
  const metricItems = metrics
    .filter((metric) => metric?.availability === 'ready')
    .map((metric) => ({
      id: metric.id,
      eyebrow: metric.question,
      title: cleanFocusCopy(metric.currentValue) || metric.question,
      body: cleanFocusCopy(metric.supportingValue || metric.detail) || '今天先把這題放進檢查順序。',
      detail: cleanFocusCopy(metric.detail),
      eventCount: metric.eventCount,
      tone: metric.tone,
      routeTab: metric.routeTab,
      routeLabel: metric.routeLabel,
    }))
    .sort((left, right) => {
      const toneDelta = (FOCUS_TONE_ORDER[left.tone] ?? 4) - (FOCUS_TONE_ORDER[right.tone] ?? 4)
      if (toneDelta !== 0) return toneDelta
      return (FOCUS_METRIC_ORDER[left.id] ?? 10) - (FOCUS_METRIC_ORDER[right.id] ?? 10)
    })

  const morningItem = buildMorningFocusItem(morningNote)
  const items = morningItem ? [morningItem, ...metricItems] : metricItems
  const selected = []
  const seenIds = new Set()

  for (const item of items) {
    const key = item.id || item.title
    if (seenIds.has(key)) continue
    selected.push(item)
    seenIds.add(key)
    if (selected.length >= 3) break
  }

  if (selected.length > 0) return selected

  return [
    {
      id: 'quiet-day',
      eyebrow: '今日焦點',
      title: '今天先把節奏放慢',
      body: '五個焦慮題沒有出現明確警訊，先照投資理由和部位結構走。',
      tone: 'ok',
      routeTab: 'holdings',
      routeLabel: '查看持倉',
    },
  ]
}

function resolveMobileActionCopy(item = {}) {
  if (item.id === 'x5' && item.title !== '這三天安靜') {
    return {
      title: '先確認最近一件事件',
      body: item.body,
      chip: Number(item.eventCount) > 0 ? `3 天內 ${item.eventCount} 件` : '',
    }
  }

  return {
    title: item.title,
    body: item.body,
    chip: '',
  }
}

function resolveDashboardFocusCopy(item = {}) {
  if (item.id === 'x5' && item.title !== '這三天安靜') {
    return {
      eyebrow: '最近一件需要復盤的事？',
      title: item.body || '先確認最近一件事件',
      body: item.detail || '先看最近一件是否需要調整投資理由。',
    }
  }

  return {
    eyebrow: item.eyebrow,
    title: item.title,
    body: item.body,
  }
}

function DashboardFocusCard({ items = [], onNavigate = null }) {
  const isMobile = useIsMobile('(max-width: 600px)')
  const safeItems = Array.isArray(items) ? items.slice(0, 3) : []

  return h(
    Card,
    {
      'data-testid': 'dashboard-focus-card',
      'data-variant': 'dark-panel',
      variant: 'hero',
      className: 'dashboard-focus-card',
      style: {
        marginTop: 8,
        marginBottom: 8,
        padding: isMobile ? '28px 22px' : '34px 30px',
        borderRadius: 8,
        border: `1px solid ${alpha(C.bone, '24')}`,
        background: C.darkPanel,
        boxShadow: `${C.insetLine}, 0 24px 60px ${alpha(C.ink, '24')}`,
        color: C.bone,
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
            display: isMobile ? 'grid' : 'flex',
            alignItems: isMobile ? 'start' : 'baseline',
            justifyContent: isMobile ? 'start' : 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          },
        },
        h(
          'div',
          {
            style: {
              color: C.bone,
              fontSize: 'clamp(30px, 4vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: 0,
              fontFamily: 'Inter, system-ui, var(--font-body)',
            },
          },
          '今日焦點'
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 0,
          },
        },
        safeItems.map((item, index) =>
          (() => {
            const copy = resolveDashboardFocusCopy(item)
            return h(
              'div',
              {
                key: item.id || item.title,
                'data-testid': 'dashboard-focus-item',
                style: {
                  display: 'grid',
                  gap: 8,
                  padding: index === 0 ? '0 0 20px' : '20px 0',
                  borderTop: index === 0 ? 'none' : `1px solid ${alpha(C.bone, '22')}`,
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  },
                },
                h(
                  'div',
                  {
                    style: {
                      color: alpha(C.bone, 'c8'),
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      lineHeight: 1.4,
                    },
                  },
                  copy.eyebrow
                ),
                item.routeTab &&
                  typeof onNavigate === 'function' &&
                  h(
                    'button',
                    {
                      type: 'button',
                      'aria-label': item.routeLabel || '查看',
                      title: item.routeLabel || '查看',
                      onClick: () => onNavigate(item.routeTab),
                      style: {
                        border: 'none',
                        background: 'transparent',
                        color: alpha(C.bone, 'd8'),
                        fontSize: 11,
                        fontWeight: 700,
                        padding: 0,
                        cursor: 'pointer',
                      },
                    },
                    '>'
                  )
              ),
              h(
                'div',
                {
                  style: {
                    color: C.bone,
                    fontSize: 22,
                    lineHeight: 1.25,
                    fontWeight: 800,
                  },
                },
                copy.title
              ),
              h(
                'div',
                {
                  style: {
                    color: alpha(C.bone, 'c8'),
                    fontSize: 13,
                    lineHeight: 1.75,
                  },
                },
                copy.body
              )
            )
          })()
        )
      )
    )
  )
}

function MobileTodayActionCard({ items = [], onNavigate = null }) {
  const primaryItem = Array.isArray(items) && items.length > 0 ? items[0] : null
  if (!primaryItem) return null
  const actionCopy = resolveMobileActionCopy(primaryItem)

  const handlePrimaryAction = () => {
    if (primaryItem.routeTab && typeof onNavigate === 'function') onNavigate(primaryItem.routeTab)
  }

  return h(
    Card,
    {
      'data-testid': 'dashboard-mobile-today-action',
      style: {
        marginBottom: 8,
        padding: '16px 14px',
        borderRadius: 8,
        border: `1px solid ${alpha(C.cta, '28')}`,
        background: C.raised,
        boxShadow: `${C.insetLine}, 0 12px 28px ${alpha(C.ink, '08')}`,
      },
    },
    h(
      'div',
      { style: { display: 'grid', gap: 12 } },
      h(
        'div',
        {
          style: {
            fontSize: 12,
            color: C.textSec,
            fontWeight: 800,
            letterSpacing: '0.04em',
          },
        },
        '今天先做 1 件事'
      ),
      h(
        'div',
        { style: { display: 'grid', gap: 6, minWidth: 0 } },
        actionCopy.chip &&
          h(
            'div',
            {
              'data-testid': 'dashboard-mobile-event-window-chip',
              style: {
                justifySelf: 'start',
                border: `1px solid ${alpha(C.amber, '28')}`,
                borderRadius: 8,
                background: C.amberBg,
                color: C.textSec,
                fontSize: 11,
                fontWeight: 800,
                padding: '4px 8px',
                lineHeight: 1.2,
              },
            },
            actionCopy.chip
          ),
        h(
          'div',
          {
            style: {
              fontSize: 20,
              lineHeight: 1.25,
              fontWeight: 800,
              color: C.text,
              letterSpacing: 0,
              overflowWrap: 'anywhere',
            },
          },
          actionCopy.title
        ),
        h(
          'div',
          {
            style: {
              fontSize: 13,
              lineHeight: 1.65,
              color: C.textSec,
              overflowWrap: 'anywhere',
            },
          },
          actionCopy.body
        )
      ),
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'dashboard-mobile-primary-cta',
          onClick: handlePrimaryAction,
          style: {
            width: '100%',
            minHeight: 48,
            border: 'none',
            borderRadius: 8,
            background: C.cta,
            color: C.onFill,
            fontSize: 14,
            fontWeight: 800,
            cursor:
              primaryItem.routeTab && typeof onNavigate === 'function' ? 'pointer' : 'default',
            boxShadow: `0 10px 18px ${alpha(C.cta, '22')}`,
          },
        },
        primaryItem.routeLabel || '查看這件事'
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
      variant: urgentCount > 0 ? 'hero' : 'primary',
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
              fontSize: 11,
              fontWeight: 600,
              color: C.textSec,
              background: C.amberBg,
              border: `1px solid ${alpha(C.amber, '20')}`,
              borderRadius: 8,
              padding: '4px 8px',
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
            fontSize: 12,
            color: C.textSec,
            marginTop: 4,
            lineHeight: 1.7,
          },
        },
        todayAlertSummary
      ),
    !hasContent &&
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, marginTop: 4 } },
        '今明兩日沒有待處理事件。'
      ),
    upcoming.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 4, marginTop: 8, minWidth: 0, maxWidth: '100%' } },
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
                borderRadius: C.radii.md,
                padding: '4px 8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
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
                  { style: { fontSize: 11, color: C.textMute, marginTop: 4 } },
                  codes.join('、')
                )
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  fontWeight: 600,
                  color: isToday ? C.textSec : C.textMute,
                  background: isToday ? C.amberBg : 'transparent',
                  border: isToday ? `1px solid ${alpha(C.amber, '24')}` : 'none',
                  borderRadius: 8,
                  padding: isToday ? '4px 8px' : 0,
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
        { style: { fontSize: 12, color: C.textMute, marginTop: 4, textAlign: 'right' } },
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
    { variant: 'subtle', style: { marginBottom: 8 } },
    h('div', { style: lbl }, '組合健康度'),
    h(
      'div',
      {
        style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 8 },
      },
      h(
        'div',
        { style: metricCard },
        h('div', { style: { fontSize: 11, color: C.textMute, letterSpacing: '0.08em' } }, '獲利'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              marginTop: 4,
              fontFamily: 'var(--font-num)',
            },
          },
          `${winners.length}檔`
        )
      ),
      h(
        'div',
        { style: metricCard },
        h('div', { style: { fontSize: 11, color: C.textMute, letterSpacing: '0.08em' } }, '虧損'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: C.down,
              marginTop: 4,
              fontFamily: 'var(--font-num)',
            },
          },
          `${losers.length}檔`
        )
      ),
      h(
        'div',
        { style: metricCard },
        h('div', { style: { fontSize: 11, color: C.textMute, letterSpacing: '0.08em' } }, '持平'),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: C.textSec,
              marginTop: 4,
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
          { style: { fontSize: 11, color: C.textMute, letterSpacing: '0.08em' } },
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
              marginTop: 4,
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
  holdingDossiers = [],
  dataRefreshRows = [],
  morningNote = null,
  dailySnapshotStatus = null,
  dailyReport = null,
  todayTotalPnl = 0,
  todayPnlHasPriceData = true,
  todayPnlIsStale = false,
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
  compareStrip = null,
  anxietyMetrics = null,
  stockMeta = null,
  reportRefreshMeta = {},
  marketPriceSync = null,
  onRefreshReminder = null,
  onNavigate = null,
  onMorningNoteHandoff = null,
}) {
  const isMobile = useIsMobile('(max-width: 600px)')
  const dashboardHeadline = useMemo(
    () => buildDashboardHeadline(holdingDossiers, { viewMode }),
    [holdingDossiers, viewMode]
  )
  const dashboardFocusItems = useMemo(
    () =>
      buildDashboardFocusItems({
        anxietyMetrics,
        holdings,
        holdingDossiers,
        newsEvents,
        dailyReport,
        morningNote,
        stockMeta,
      }),
    [anxietyMetrics, dailyReport, holdingDossiers, holdings, morningNote, newsEvents, stockMeta]
  )
  const upstreamHealth = useUpstreamHealth({
    panel: 'dashboard',
    activePortfolioId: portfolioId,
    holdingDossiers,
    dataRefreshRows,
    marketPriceSync,
    reportRefreshMeta,
  })
  const dashboardHeadlineGate = upstreamHealth.accuracyGate
  const showHoldingsEmptyState =
    holdings.length === 0 && totalVal === 0 && totalCost === 0 && todayTotalPnl === 0
  const handleRetryAll = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
      return
    }
    onRefreshReminder?.()
  }

  if (showHoldingsEmptyState) {
    return h(
      'div',
      null,
      h(EmptyState, {
        resource: 'holdings',
        onAction:
          typeof onNavigate === 'function'
            ? () => {
                onNavigate('trade')
              }
            : null,
      }),
      h(PrincipleCards),
      h(TodayInMarketsCard, { newsEvents })
    )
  }

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
          headline: dashboardHeadline.headline,
          headlineTone: dashboardHeadline.tone,
          headlineGate: dashboardHeadlineGate,
          collapseUpstreamBanners: upstreamHealth.shouldCollapseBanners,
          dataRefreshRows,
          stockMeta,
          holdingDossiers,
          onRefreshReminder,
          onNavigate,
          totalVal,
          todayTotalPnl,
          todayPnlHasPriceData,
          todayPnlIsStale,
          marketPriceSync,
          portfolioName: displayPortfolioName({ displayName: portfolioName, id: portfolioId }),
        })
      ),
      !isMobile &&
        h(
          'div',
          { className: 'dashboard-hero-side' },
          h(DashboardFocusCard, { items: dashboardFocusItems, onNavigate })
        )
    ),
    isMobile && h(MobileTodayActionCard, { items: dashboardFocusItems, onNavigate }),
    h(UpstreamHealthBanner, {
      banner: upstreamHealth.banner,
      onRetryAll: handleRetryAll,
    }),
    h(DashboardCompareStrip, { compareStrip, onNavigate }),
    h(AnxietyMetricsPanel, {
      anxietyMetrics,
      holdings,
      holdingDossiers,
      newsEvents,
      dailyReport,
      stockMeta,
      onNavigate,
    }),
    h(PrincipleCards),
    h(DailySnapshotStatusCard, { dailySnapshotStatus }),
    h(MorningNoteCard, { morningNote, onNavigate, onMorningNoteHandoff }),
    h(TodayInMarketsCard, { newsEvents }),
    h(AiQuickSummary, { latestInsight }),
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
