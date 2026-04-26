import { createElement as h, useState } from 'react'
// useNavigate removed — component must work without Router context (App.jsx)
import { C, alpha } from '../../theme.js'
import { Card, Button, OperatingContextCard, StaleBadge } from '../common'
import { EmptyState } from '../common/EmptyState.jsx'
import { RELAY_PLAN } from '../../seedDataEvents.js'
import { EventsTimeline } from './EventsTimeline.jsx'
import { EventCountdownBadge } from './EventCountdownBadge.jsx'
import { calculateEventCountdown } from '../../lib/eventCountdown.js'
import { resolveTone } from '../../lib/toneResolver.js'
import {
  ALL_EVENTS_FILTER_LABEL,
  EVENT_TYPE_META,
  PRIMARY_EVENT_FILTERS,
  inferEventType,
  shouldCollapseEventByDefault,
} from '../../lib/eventTypeMeta.js'

const EVENT_TYPE_STYLE = Object.freeze({
  earnings: { color: C.positive, background: alpha(C.positive, '16') },
  'ex-dividend': { color: C.up, background: alpha(C.up, '14') },
  'shareholding-meeting': { color: C.amber, background: alpha(C.amber, '18') },
  strategic: { color: C.down, background: alpha(C.down, '12') },
  informational: { color: C.textMute, background: alpha(C.textMute, '12') },
  macro: { color: C.lavender, background: alpha(C.lavender, '18') },
  market: { color: C.choco, background: alpha(C.choco, '18') },
  technical: { color: C.text, background: alpha(C.text, '08') },
  other: { color: C.textSec, background: alpha(C.iron, '18') },
})

const CATALYST_LABELS = {
  earnings: '財報',
  corporate: '公司',
  industry: '產業',
  macro: '總經',
  technical: '技術',
}

const IMPACT_META = {
  positive: { label: '🔴 利多', color: C.textSec, bg: C.upBg },
  negative: { label: '🟢 利空', color: C.down, bg: C.downBg },
  neutral: { label: '🟡 中性', color: C.textSec, bg: alpha(C.amber, '18') },
  high: { label: '🔴 利多', color: C.textSec, bg: C.upBg },
  medium: { label: '🟡 中性', color: C.textSec, bg: alpha(C.amber, '18') },
  low: { label: '⚪ 低影響', color: C.textMute, bg: alpha(C.textMute, '14') },
}

function formatEventSource(source) {
  if (!source) return '手動'
  if (source === 'auto-calendar') return '行事曆'
  if (source === 'finmind-news') return 'FinMind'
  if (source === 'finmind-dividend') return 'FinMind'
  if (source === 'finmind-capital-reduction') return 'FinMind'
  if (source === 'mops-shareholder') return 'MOPS'
  if (source === 'shareholder-announcement') return 'MOPS'
  if (source === 'tw-events-worker') return 'Worker'
  return '手動'
}

function buildEventKey(event, index) {
  const base =
    event?.id ||
    [
      event?.date,
      event?.eventType || event?.type,
      event?.title || event?.label,
      (event?.stocks || []).join(','),
    ]
      .filter(Boolean)
      .join('|') ||
    'event'

  const titleSuffix = String(event?.title || event?.label || '')
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, '_')

  return `${base}::${titleSuffix}::${index}`
}

function getPredictionMeta(event, { insiderViewMode = false, isInsiderSelfStock = false } = {}) {
  if (insiderViewMode && isInsiderSelfStock) return null

  if (event?.pred === 'up')
    return { label: '正向催化', color: C.textSec, bg: alpha(C.charcoal, '08') }
  if (event?.pred === 'down')
    return { label: '負向風險', color: C.textSec, bg: alpha(C.charcoal, '08') }
  if (event?.pred === 'neutral')
    return { label: '中性記錄', color: C.textSec, bg: alpha(C.charcoal, '08') }
  return null
}

function getReviewMeta(event) {
  if (event?.status === 'closed' || event?.status === 'past') {
    if (event?.correct === true)
      return { label: '復盤命中', color: C.textSec, bg: alpha(C.positive, '16') }
    if (event?.correct === false) return { label: '復盤失準', color: C.down, bg: C.downBg }
    return { label: '已復盤', color: C.textMute, bg: alpha(C.textMute, '12') }
  }
  if (event?.status === 'tracking') {
    return { label: '追蹤中', color: C.textSec, bg: alpha(C.positive, '16') }
  }
  return { label: '待觀察', color: C.textSec, bg: alpha(C.amber, '16') }
}

function getEventStyle(event) {
  const eventType = inferEventType(event)
  return EVENT_TYPE_STYLE[eventType] || EVENT_TYPE_STYLE.other
}

function formatShortDate(value) {
  const raw = String(value || '')
    .trim()
    .replace(/\//g, '-')
  const matched = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!matched) return raw || '--/--'
  return `${matched[2].padStart(2, '0')}/${matched[3].padStart(2, '0')}`
}

function extractPrimaryCode(event) {
  const stocks = Array.isArray(event?.stocks) ? event.stocks : []
  const matched = stocks
    .map((stock) => String(stock || '').match(/\d{4,6}[A-Z]?L?/i)?.[0] || '')
    .find(Boolean)
  return matched || String(event?.code || event?.ticker || '').trim()
}

function formatDividendSummary(event) {
  const cashDividend = Number(event?.cashDividend)
  const stockDividend = Number(event?.stockDividend)
  const labels = []
  if (Number.isFinite(cashDividend) && cashDividend > 0) {
    labels.push(`預計配息 ${cashDividend.toFixed(1)} 元 / 股`)
  }
  if (Number.isFinite(stockDividend) && stockDividend > 0) {
    labels.push(`預計配股 ${stockDividend.toFixed(2)} 股 / 股`)
  }
  if (labels.length > 0) return labels.join(' · ')
  return event?.detail || '持股當日價格會依參考價調整。'
}

function renderEventContext(event) {
  const eventType = inferEventType(event)
  const code = extractPrimaryCode(event)
  const dateLabel = formatShortDate(event?.date || event?.eventDate)
  const blockStyle = {
    marginTop: 8,
    padding: '8px 8px',
    borderRadius: 8,
    border: `1px solid ${C.borderSub}`,
    background: C.surface,
    fontSize: 12,
    color: C.textSec,
    lineHeight: 1.65,
  }

  if (eventType === 'earnings') {
    return h(
      'div',
      { style: blockStyle },
      `${code || '全市場'} · ${dateLabel} 財報 / 法說窗口`,
      h('br'),
      '這類事件通常直接牽動 thesis 驗證，結果出來後應該回頭重看。'
    )
  }

  if (eventType === 'ex-dividend') {
    const scheduleLabel =
      event?.eventSubType === 'ex-rights'
        ? '除權'
        : event?.eventSubType === 'capital-reduction'
          ? '減資恢復買賣'
          : '除息'
    return h(
      'div',
      { style: blockStyle },
      `${code || '持股'} · ${dateLabel} ${scheduleLabel} · ${formatDividendSummary(event)}`,
      h('br'),
      '持股當日價格會按參考價調整；若 thesis 依賴殖利率或填息敘事，這天值得重看。'
    )
  }

  if (eventType === 'shareholding-meeting') {
    const souvenir = String(event?.souvenir || event?.gift || '').trim()
    return h(
      'div',
      { style: blockStyle },
      `${code || '公司'} · ${dateLabel} 股東會`,
      souvenir ? ` · 紀念品 ${souvenir}` : '',
      h('br'),
      '股東會屬時間點事件；若只是紀念品資訊，不直接等於 thesis 改變。'
    )
  }

  if (eventType === 'strategic') {
    return h(
      'div',
      { style: blockStyle },
      '新聞驅動的策略節點。',
      h('br'),
      '只有真的牽動管理層、資本配置、產品方向或政策框架時，才應升級成 thesis review event。'
    )
  }

  if (eventType === 'informational') {
    return h(
      'div',
      { style: blockStyle },
      '資訊型提醒，預設摺疊。',
      h('br'),
      '保留時間點與備查資訊，但不主張重看 thesis，也不輸出買賣語氣。'
    )
  }

  return null
}

/**
 * Relay Plan Card
 */
export function RelayPlanCard({ expanded, onToggle }) {
  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        background: C.cardBlue,
        borderLeft: `3px solid ${alpha(C.positive, '40')}`,
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
        { style: { flex: 1, minWidth: 0 } },
        h(
          'div',
          {
            style: {
              fontSize: 11,
              color: C.textSec,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            },
          },
          '接力計畫'
        ),
        h(
          'div',
          { style: { fontSize: 15, fontWeight: 600, color: C.text, marginTop: 4 } },
          RELAY_PLAN.title
        ),
        h(
          'div',
          { style: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.7 } },
          RELAY_PLAN.summary
        )
      ),
      h(
        Button,
        {
          onClick: onToggle,
          style: {
            borderRadius: C.radii.lg,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.18s ease',
            background: expanded ? C.surfaceMuted : alpha(C.positive, '08'),
            color: C.textSec,
            border: `1px solid ${expanded ? C.borderStrong : alpha(C.positive, '2a')}`,
          },
        },
        expanded ? '收合' : '展開完整計畫'
      )
    ),

    // Quick states
    h(
      'div',
      { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 } },
      RELAY_PLAN.quickStates.map((item) =>
        h(
          'span',
          {
            key: item.label,
            style: {
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: C.radii.lg,
              background: alpha(resolveTone(item.tone), '15'),
              color: C.textSec,
              border: `1px solid ${alpha(resolveTone(item.tone), '20')}`,
            },
          },
          `${item.label} · ${item.text}`
        )
      )
    ),

    // Legs grid
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))',
          gap: 8,
          marginTop: 8,
        },
      },
      RELAY_PLAN.legs.map((leg) =>
        h(
          'div',
          {
            key: leg.code,
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderLeft: `2px solid ${alpha(resolveTone(leg.tone), '40')}`,
              borderRadius: 9,
              padding: '8px 8px',
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
              },
            },
            h(
              'div',
              null,
              h(
                'div',
                { style: { fontSize: 12, fontWeight: 600, color: C.text } },
                leg.name,
                h(
                  'span',
                  { style: { fontSize: 11, color: C.textMute, fontWeight: 400 } },
                  ` ${leg.code}`
                )
              ),
              h(
                'div',
                { style: { fontSize: 11, color: C.textMute, marginTop: 4 } },
                `${leg.role} · ${leg.window}`
              )
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: C.radii.lg,
                  background: alpha(resolveTone(leg.tone), '15'),
                  color: C.textSec,
                },
              },
              leg.status
            )
          ),
          h(
            'div',
            {
              style: {
                fontSize: 11,
                color: C.text,
                marginTop: 8,
                fontWeight: 500,
                lineHeight: 1.6,
              },
            },
            leg.action
          ),
          h(
            'div',
            {
              style: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.7 },
            },
            `觸發：${leg.trigger}`,
            h('br'),
            `防守：${leg.stop}`
          )
        )
      )
    ),

    // Expanded content
    expanded &&
      h(
        'div',
        {
          style: {
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'div',
          { style: { fontSize: 12, color: C.textMute, fontWeight: 600, marginBottom: 4 } },
          '核心邏輯'
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          RELAY_PLAN.thesis.map((item) =>
            h(
              'div',
              {
                key: item,
                style: {
                  fontSize: 12,
                  color: C.textSec,
                  lineHeight: 1.7,
                  background: C.subtle,
                  border: `1px solid ${C.borderSub}`,
                  borderRadius: 8,
                  padding: '8px 8px',
                },
              },
              item
            )
          )
        ),

        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textMute,
              fontWeight: 600,
              marginTop: 8,
              marginBottom: 4,
            },
          },
          '關鍵觀察'
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          RELAY_PLAN.indicators.map((item) =>
            h(
              'div',
              {
                key: `${item.code}-${item.when}`,
                style: {
                  background: C.subtle,
                  border: `1px solid ${C.borderSub}`,
                  borderRadius: 8,
                  padding: '8px 8px',
                },
              },
              h(
                'div',
                { style: { fontSize: 12, color: C.text, fontWeight: 500 } },
                `${item.name} · ${item.when}`
              ),
              h(
                'div',
                { style: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.7 } },
                item.what
              )
            )
          )
        ),

        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textMute,
              fontWeight: 600,
              marginTop: 8,
              marginBottom: 4,
            },
          },
          '情境矩陣'
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          RELAY_PLAN.riskMatrix.map((item) =>
            h(
              'div',
              {
                key: item.scenario,
                style: {
                  background: C.subtle,
                  border: `1px solid ${C.borderSub}`,
                  borderRadius: 8,
                  padding: '8px 8px',
                },
              },
              h('div', { style: { fontSize: 12, color: C.text, fontWeight: 500 } }, item.scenario),
              h(
                'div',
                { style: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.7 } },
                item.action
              )
            )
          )
        ),

        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textMute,
              fontWeight: 600,
              marginTop: 8,
              marginBottom: 4,
            },
          },
          '資金配置'
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 4 } },
          RELAY_PLAN.allocations.map((item) =>
            h(
              'div',
              {
                key: `${item.phase}-${item.target}`,
                style: {
                  background: C.subtle,
                  border: `1px solid ${C.borderSub}`,
                  borderRadius: 8,
                  padding: '8px 8px',
                },
              },
              h(
                'div',
                { style: { fontSize: 12, color: C.text, fontWeight: 500 } },
                `${item.phase} · ${item.target}`
              ),
              h(
                'div',
                { style: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.7 } },
                item.plan
              )
            )
          )
        )
      )
  )
}

export function NewsEventCard({
  event,
  onReview,
  onToggle,
  insiderViewMode = false,
  isInsiderSelfStock = false,
}) {
  const eventType = inferEventType(event)
  const eventMeta = EVENT_TYPE_META[eventType] || EVENT_TYPE_META.other
  const typeStyle = getEventStyle(event)
  const impactMeta = IMPACT_META[event.impact] || IMPACT_META.neutral
  const predictionMeta = getPredictionMeta(event, { insiderViewMode, isInsiderSelfStock })
  const reviewMeta = getReviewMeta(event)
  const countdown = calculateEventCountdown(event)
  const title = event.label || event.title || '未命名事件'
  const subtitle = event.sub || event.detail || ''
  const reviewSummary = [event.actualNote, event.lessons].filter(Boolean).join('｜')

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        border: `1px solid ${C.border}`,
        borderLeft: `2px solid ${event.urgent ? C.textSec : alpha(C.charcoal, '32')}`,
        cursor: onToggle ? 'pointer' : 'default',
      },
      onClick: onToggle,
    },
    h(
      'div',
      {
        style: { display: 'flex', gap: 8, alignItems: 'flex-start' },
      },
      h(
        'div',
        { style: { minWidth: 48 } },
        h(
          'div',
          {
            style: {
              background: event.urgent ? C.upBg : typeStyle.background,
              color: C.textSec,
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 4,
              textAlign: 'center',
              marginBottom: 4,
            },
          },
          eventMeta.label
        ),
        h(
          'div',
          { style: { fontSize: 11, color: C.textMute, textAlign: 'center', lineHeight: 1.4 } },
          event.date
        )
      ),
      h(
        'div',
        { style: { flex: 1 } },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            },
          },
          h('div', { style: { fontSize: 12, fontWeight: 500, color: C.text } }, title),
          h(
            'div',
            { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
            event?.needsThesisReview &&
              h(
                'span',
                {
                  style: {
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: alpha(C.charcoal, '08'),
                    color: C.textSec,
                    fontWeight: 700,
                  },
                },
                '重看投資理由'
              ),
            !event?.needsThesisReview &&
              h(
                'span',
                {
                  style: {
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: alpha(C.charcoal, '08'),
                    color: C.textSec,
                    fontWeight: 700,
                  },
                },
                '資訊備查'
              ),
            h(EventCountdownBadge, { event })
          )
        ),
        subtitle
          ? h(
              'div',
              { style: { fontSize: 12, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
              subtitle
            )
          : null,
        renderEventContext(event),
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              marginTop: 4,
              alignItems: 'center',
            },
          },
          h(
            'span',
            {
              style: {
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 8,
                background: impactMeta.bg,
                color: impactMeta.color,
                fontWeight: 600,
              },
            },
            impactMeta.label
          ),
          predictionMeta &&
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: predictionMeta.bg,
                  color: predictionMeta.color,
                  fontWeight: 600,
                },
              },
              predictionMeta.label
            ),
          h(
            'span',
            {
              style: {
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 8,
                background: reviewMeta.bg,
                color: reviewMeta.color,
                fontWeight: 600,
              },
            },
            reviewMeta.label
          ),
          countdown.autoReviewReady &&
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: alpha(C.choco, '12'),
                  color: C.choco,
                  fontWeight: 600,
                },
              },
              '待復盤'
            ),
          h(
            'span',
            {
              style: {
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 8,
                background: alpha(C.textMute, '12'),
                color: C.textMute,
                fontWeight: 600,
              },
            },
            formatEventSource(event.source)
          )
        ),
        predictionMeta &&
          h(
            'div',
            {
              style: {
                marginTop: 8,
                padding: '8px 0 0',
                borderTop: `1px solid ${C.borderSub}`,
                fontSize: 12,
                color: C.textSec,
                lineHeight: 1.6,
              },
            },
            `預測：${predictionMeta.label.replace('預測', '')}`,
            event.predReason ? `｜${event.predReason}` : ''
          ),
        reviewSummary &&
          h(
            'div',
            {
              style: {
                marginTop: 8,
                padding: '8px 0 0',
                borderTop: `1px solid ${C.borderSub}`,
                fontSize: 12,
                color: C.textSec,
                lineHeight: 1.6,
              },
            },
            `復盤：${reviewSummary}`
          ),
        onReview &&
          h(
            Button,
            {
              onClick: (e) => {
                e.stopPropagation()
                onReview(event)
              },
              style: {
                marginTop: 4,
                padding: '4px 8px',
                borderRadius: 5,
                border: `1px solid ${alpha(C.iron, '2a')}`,
                background: 'transparent',
                color: C.textSec,
                fontSize: 12,
                cursor: 'pointer',
              },
            },
            '復盤'
          )
      )
    )
  )
}

/**
 * Backward-compatible export name for existing tests/imports.
 */
export const EventCard = NewsEventCard

/**
 * Events Filter Buttons
 */
export function EventsFilter({ filterType, setFilterType }) {
  return h(
    'div',
    { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 } },
    [ALL_EVENTS_FILTER_LABEL, ...PRIMARY_EVENT_FILTERS].map((t) =>
      h(
        Button,
        {
          key: t,
          onClick: () => setFilterType(t),
          'data-testid': `events-filter-${t}`,
          style: {
            background: filterType === t ? C.subtleElev : 'transparent',
            color: filterType === t ? C.text : C.textMute,
            border: `1px solid ${filterType === t ? C.borderStrong : C.border}`,
            borderRadius: C.radii.lg,
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          },
        },
        t === ALL_EVENTS_FILTER_LABEL ? '全部' : EVENT_TYPE_META[t]?.filterLabel || t
      )
    )
  )
}

/**
 * Catalyst Type Filter Buttons
 */
export function CatalystFilter({ catalystFilter, setCatalystFilter }) {
  return h(
    'div',
    { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 } },
    ['全部', ...Object.keys(CATALYST_LABELS)].map((t) =>
      h(
        Button,
        {
          key: t,
          onClick: () => setCatalystFilter(t),
          style: {
            background: catalystFilter === t ? C.subtleElev : 'transparent',
            color: catalystFilter === t ? C.text : C.textSec,
            border: `1px solid ${catalystFilter === t ? C.borderStrong : C.border}`,
            borderRadius: C.radii.lg,
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          },
        },
        t === '全部' ? '全部主題' : CATALYST_LABELS[t]
      )
    )
  )
}

/**
 * Main Events Panel
 */
export function EventsPanel({
  showRelayPlan,
  relayPlanExpanded,
  setRelayPlanExpanded,
  filterType,
  setFilterType,
  filteredEvents,
  catalystFilter,
  setCatalystFilter,
  staleStatus = 'fresh',
  operatingContext = null,
  viewMode = 'retail',
  insiderStockCodes = [],
}) {
  const insiderViewMode = viewMode === 'insider-compressed' || viewMode === 'insider'
  const normalizedInsiderCodes = (Array.isArray(insiderStockCodes) ? insiderStockCodes : [])
    .map((code) => String(code || '').trim())
    .filter(Boolean)
  function isInsiderSelfStock(event) {
    if (!insiderViewMode || !normalizedInsiderCodes.length) return false
    const stocks = Array.isArray(event?.stocks) ? event.stocks : []
    return stocks.some((stock) => {
      const stockCode = String(stock || '')
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase()
      return normalizedInsiderCodes.some((code) => stockCode.includes(code.toUpperCase()))
    })
  }
  const [showInformational, setShowInformational] = useState(false)
  const eventCards = (Array.isArray(filteredEvents) ? filteredEvents : []).filter(
    (event) => event?.recordType !== 'news'
  )
  const informationalCards = eventCards.filter((event) => shouldCollapseEventByDefault(event))
  const primaryCards =
    filterType === ALL_EVENTS_FILTER_LABEL
      ? eventCards.filter((event) => !shouldCollapseEventByDefault(event))
      : eventCards

  return h(
    'div',
    { 'data-testid': 'events-panel' },
    h(OperatingContextCard, { context: operatingContext }),
    h(
      'div',
      {
        style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
      },
      h('div', { style: { fontSize: 12, color: C.textMute, fontWeight: 600 } }, '資料狀態'),
      h(StaleBadge, { status: staleStatus, title: 'events panel freshness' })
    ),
    // Relay Plan
    showRelayPlan &&
      h(RelayPlanCard, {
        expanded: relayPlanExpanded,
        onToggle: () => setRelayPlanExpanded((v) => !v),
      }),

    // Filter buttons
    h(EventsFilter, { filterType, setFilterType }),

    // Catalyst type filter buttons (only shown if props provided)
    setCatalystFilter && h(CatalystFilter, { catalystFilter, setCatalystFilter }),

    h(EventsTimeline, { events: eventCards }),

    // Events list — empty state
    primaryCards.length === 0 &&
      informationalCards.length === 0 &&
      h(EmptyState, { resource: 'events' }),

    filterType === ALL_EVENTS_FILTER_LABEL &&
      informationalCards.length > 0 &&
      h(
        Card,
        {
          style: {
            marginBottom: 8,
            borderLeft: `2px solid ${alpha(C.textMute, '38')}`,
            background: alpha(C.raised, 'f6'),
          },
          'data-testid': 'events-informational-collapse',
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
            h(
              'div',
              { style: { fontSize: 12, fontWeight: 600, color: C.text } },
              `⚪ informational · ${informationalCards.length} 則`
            ),
            h(
              'div',
              { style: { fontSize: 12, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
              '資訊型提醒預設摺疊，因為它們通常只需要備查，不需要重看 thesis。'
            )
          ),
          h(
            Button,
            {
              onClick: () => setShowInformational((value) => !value),
              style: {
                borderRadius: C.radii.lg,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${C.border}`,
                background: showInformational ? C.surfaceMuted : 'transparent',
                color: C.textSec,
              },
            },
            showInformational ? '收合資訊型' : '展開資訊型'
          )
        )
      ),

    // Events list
    primaryCards.map((event, index) =>
      h(EventCard, {
        key: buildEventKey(event, index),
        event,
        insiderViewMode,
        isInsiderSelfStock: isInsiderSelfStock(event),
      })
    ),

    filterType === ALL_EVENTS_FILTER_LABEL &&
      showInformational &&
      informationalCards.map((event, index) =>
        h(EventCard, {
          key: `${buildEventKey(event, index)}::informational`,
          event,
        })
      )
  )
}
