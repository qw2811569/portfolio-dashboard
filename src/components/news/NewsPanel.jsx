import { createElement as h, useEffect, useState, useRef, useMemo } from 'react'
// useNavigate removed — component must work without Router context (App.jsx)
import { C, alpha } from '../../theme.js'
import { Card, Button, OperatingContextCard } from '../common'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

// 簡化：只用三色表示方向（紅=利多/黃=中性/綠=利空）
const IMPACT_META = {
  positive: { label: '🔴 利多', color: C.up, bg: C.upBg },
  negative: { label: '🟢 利空', color: C.down, bg: C.downBg },
  neutral: { label: '🟡 中性', color: C.amber, bg: alpha(C.amber, '18') },
  high: { label: '🔴 利多', color: C.up, bg: C.upBg },
  medium: { label: '🟡 中性', color: C.amber, bg: alpha(C.amber, '18') },
  low: { label: '🟡 中性', color: C.textMute, bg: alpha(C.textMute, '14') },
}

function formatEventSource(source) {
  if (!source) return '手動'
  if (source === 'auto-calendar') return '行事曆'
  if (source === 'finmind-news') return 'FinMind'
  // 不再顯示 gemini-research
  return '手動'
}

function buildNewsEventKey(event, index) {
  const base =
    event?.id ||
    [event?.date, event?.type, event?.title || event?.label, (event?.stocks || []).join(',')]
      .filter(Boolean)
      .join('|') ||
    'news-event'

  const titleSuffix = String(event?.title || event?.label || '')
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, '_')

  return `${base}::${titleSuffix}::${index}`
}

/**
 * Log Panel - Trade history
 */
export function LogPanel({ tradeLog }) {
  if (!tradeLog || tradeLog.length === 0) {
    return h(
      Card,
      { style: { textAlign: 'center', padding: '24px 14px' } },
      h('div', { style: { fontSize: 20, marginBottom: 6, opacity: 0.3 } }, '◌'),
      h(
        'div',
        { style: { fontSize: 12, color: C.textMute, fontWeight: 400 } },
        '還沒有交易記錄',
        h('br'),
        h('span', { style: { fontSize: 10 } }, '上傳成交截圖後自動記錄在這裡')
      )
    )
  }

  return h(
    'div',
    null,
    [...tradeLog]
      .sort((a, b) => b.id - a.id)
      .map((log) =>
        h(
          Card,
          {
            key: log.id,
            style: {
              marginBottom: 8,
              borderLeft: `2px solid ${alpha(log.action === '買進' ? C.up : C.down, '40')}`,
            },
          },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 7 } },
              h(
                'span',
                {
                  style: {
                    background: log.action === '買進' ? C.upBg : C.downBg,
                    color: log.action === '買進' ? C.up : C.down,
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                  },
                },
                log.action
              ),
              h('span', { style: { fontSize: 14, fontWeight: 600, color: C.text } }, log.name),
              h('span', { style: { fontSize: 10, color: C.textMute } }, log.code)
            ),
            h('div', { style: { fontSize: 10, color: C.textMute } }, `${log.date} ${log.time}`)
          ),
          h(
            'div',
            { style: { fontSize: 11, color: C.textMute, marginBottom: 10 } },
            `${log.qty}股 @ ${log.price?.toLocaleString()}元`
          ),
          log.qa.map((item, i) =>
            h(
              'div',
              { key: i, style: { marginBottom: 8 } },
              h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 3 } }, item.q),
              h(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: C.textSec,
                    background: C.subtle,
                    borderRadius: 6,
                    padding: '7px 10px',
                    lineHeight: 1.7,
                  },
                },
                item.a || '（未填）'
              )
            )
          )
        )
      )
  )
}

/**
 * Event Card for News Analysis
 */
export function NewsEventCard({ event, onReview, onToggle }) {
  const impactInfo = IMPACT_META[event.impact] || IMPACT_META.neutral
  const tc = impactInfo.color || C.textMute
  const impactMeta = IMPACT_META[event.impact] || IMPACT_META.neutral

  return h(
    Card,
    {
      style: {
        marginBottom: 7,
        borderLeft: `2px solid ${event.urgent ? C.up : alpha(tc, '40')}`,
        cursor: onToggle ? 'pointer' : 'default',
      },
      onClick: onToggle,
    },
    h(
      'div',
      { style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
      h(
        'div',
        { style: { minWidth: 48 } },
        h(
          'div',
          {
            style: {
              background: event.urgent ? C.upBg : alpha(tc, '15'),
              color: event.urgent ? C.up : tc,
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 5px',
              borderRadius: 4,
              textAlign: 'center',
              marginBottom: 3,
            },
          },
          event.type
        ),
        h(
          'div',
          { style: { fontSize: 9, color: C.textMute, textAlign: 'center', lineHeight: 1.4 } },
          event.date
        )
      ),
      h(
        'div',
        { style: { flex: 1 } },
        h(
          'div',
          { style: { fontSize: 12, fontWeight: 500, color: event.urgent ? C.up : C.text } },
          event.label
        ),
        h(
          'div',
          { style: { fontSize: 10, color: C.textMute, marginTop: 3, lineHeight: 1.6 } },
          event.sub
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginTop: 6,
              alignItems: 'center',
            },
          },
          h(
            'span',
            {
              style: {
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 999,
                background: impactMeta.bg,
                color: impactMeta.color,
                fontWeight: 600,
              },
            },
            impactMeta.label
          ),
          h(
            'span',
            {
              style: {
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 999,
                background: alpha(C.textMute, '12'),
                color: C.textMute,
                fontWeight: 600,
              },
            },
            formatEventSource(event.source)
          )
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
                marginTop: 6,
                padding: '4px 10px',
                borderRadius: 5,
                border: `1px solid ${alpha(C.olive, '2a')}`,
                background: 'transparent',
                color: C.olive,
                fontSize: 10,
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
 * Single news feed item card — pure info style, no direction arrows
 */
function NewsFeedCard({ item }) {
  const pubDate = item.pubDate ? new Date(item.pubDate) : null
  const dateStr =
    pubDate && !Number.isNaN(pubDate.getTime())
      ? `${pubDate.getMonth() + 1}/${pubDate.getDate()} ${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`
      : ''

  return h(
    Card,
    {
      style: {
        marginBottom: 6,
        borderLeft: `2px solid ${alpha(C.blue, '30')}`,
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
        },
      },
      h(
        'div',
        { style: { flex: 1, minWidth: 0 } },
        h(
          'a',
          {
            href: item.link,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
              fontSize: 12,
              fontWeight: 500,
              color: C.text,
              textDecoration: 'none',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            },
          },
          item.title
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginTop: 4,
              alignItems: 'center',
            },
          },
          item.source &&
            h(
              'span',
              {
                style: {
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 999,
                  background: alpha(C.blue, '14'),
                  color: C.blue,
                  fontWeight: 600,
                },
              },
              item.source
            ),
          ...(item.relatedStocks || []).map((s) =>
            h(
              'span',
              {
                key: s.code,
                style: {
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 999,
                  background: alpha(C.teal, '14'),
                  color: C.teal,
                  fontWeight: 600,
                },
              },
              `${s.name}`
            )
          )
        )
      ),
      dateStr &&
        h(
          'div',
          {
            style: {
              fontSize: 9,
              color: C.textMute,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginTop: 2,
            },
          },
          dateStr
        )
    )
  )
}

/**
 * Section that fetches and displays news feed from /api/news-feed
 */
export function NewsFeedSection({ holdingCodes = [] }) {
  const codesKey = useMemo(() => [...holdingCodes].sort().join(','), [holdingCodes])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(() => codesKey.length > 0)
  const [error, setError] = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!codesKey || fetchedRef.current) return
    fetchedRef.current = true

    fetch(`/api/news-feed?codes=${encodeURIComponent(codesKey)}&days=3`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setItems(data.items || [])
      })
      .catch((err) => {
        setError(err.message || 'fetch failed')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [codesKey])

  if (loading) {
    return h(
      Card,
      { style: { padding: '16px 14px', textAlign: 'center' } },
      h('div', { style: { fontSize: 11, color: C.textMute } }, '載入新聞中...')
    )
  }

  if (error) {
    return h(
      Card,
      { style: { padding: '12px 14px' } },
      h('div', { style: { fontSize: 11, color: C.textMute } }, `新聞載入失敗：${error}`)
    )
  }

  if (items.length === 0) return null

  return h(
    'div',
    null,
    h('div', { style: { ...lbl, color: C.blue } }, `新聞脈絡 (${items.length})`),
    items.map((item, i) => h(NewsFeedCard, { key: item.link || i, item }))
  )
}

/**
 * News Analysis Panel
 */
export function NewsAnalysisPanel({
  newsEvents,
  reviewingEvent,
  reviewForm,
  setReviewForm,
  submitReview,
  cancelReview,
  setExpandedNews,
  expandedNews,
  setReviewingEvent,
  createDefaultReviewForm,
  operatingContext = null,
  onNavigateDaily = () => {},
  holdingCodes = [],
}) {
  const NE = newsEvents || []
  const past = NE.filter((e) => e.status === 'closed' || e.status === 'past').sort(
    (a, b) => b.id - a.id
  )
  const tracking = NE.filter((e) => e.status === 'tracking').sort((a, b) => a.id - b.id)
  const pending = NE.filter((e) => e.status === 'pending').sort((a, b) => a.id - b.id)

  const hasAnyEvents = past.length > 0 || tracking.length > 0 || pending.length > 0

  return h(
    'div',
    null,
    h(OperatingContextCard, { context: operatingContext }),
    // News feed from RSS pipeline
    holdingCodes.length > 0 && h(NewsFeedSection, { holdingCodes }),
    // Empty state — only if no events AND no holdings to fetch news for
    !hasAnyEvents &&
      holdingCodes.length === 0 &&
      h(
        Card,
        {
          style: {
            textAlign: 'center',
            padding: '40px 20px',
          },
        },
        h('div', { style: { fontSize: 40, marginBottom: 12, opacity: 0.5 } }, '📰'),
        h(
          'div',
          {
            style: {
              fontSize: 16,
              fontWeight: 600,
              color: C.text,
              marginBottom: 8,
            },
          },
          '情報脈絡'
        ),
        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: C.textSec,
              lineHeight: 1.7,
              maxWidth: 320,
              margin: '0 auto 16px',
            },
          },
          '這裡顯示與持股相關的市場脈絡和背景資訊，幫助你理解大環境。'
        ),
        h(
          Button,
          {
            onClick: onNavigateDaily,
            style: {
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: C.cardBlue,
              color: C.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: C.shadow,
            },
          },
          '🔍 前往收盤分析'
        )
      ),

    // Review modal
    reviewingEvent &&
      h(
        Card,
        {
          style: { marginBottom: 10, borderLeft: `3px solid ${alpha(C.up, '40')}` },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            },
          },
          h(
            'div',
            { style: { ...lbl, color: C.up, marginBottom: 0 } },
            `事件復盤：${reviewingEvent.title}`
          ),
          h(Button, { onClick: cancelReview, style: { padding: '4px 10px', fontSize: 10 } }, '取消')
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 8 } },
          h(
            'div',
            null,
            h('div', { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, '實際結果'),
            h(
              'select',
              {
                value: reviewForm.actual,
                onChange: (e) => setReviewForm((prev) => ({ ...prev, actual: e.target.value })),
                style: {
                  width: '100%',
                  background: C.subtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: '8px 10px',
                  color: C.text,
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: 'inherit',
                },
              },
              h('option', { value: 'up' }, '看漲 ✓'),
              h('option', { value: 'down' }, '看跌 ✗'),
              h('option', { value: 'neutral' }, '中性')
            )
          ),
          h(
            'div',
            null,
            h('div', { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, '結果說明'),
            h('textarea', {
              value: reviewForm.actualNote,
              onChange: (e) => setReviewForm((prev) => ({ ...prev, actualNote: e.target.value })),
              placeholder: '實際漲跌幅、關鍵原因...',
              style: {
                width: '100%',
                background: C.subtle,
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                padding: '8px 10px',
                color: C.text,
                fontSize: 12,
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: 68,
                lineHeight: 1.6,
              },
            })
          ),
          h(
            'div',
            null,
            h('div', { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, '教訓 / 收穫'),
            h('textarea', {
              value: reviewForm.lessons,
              onChange: (e) => setReviewForm((prev) => ({ ...prev, lessons: e.target.value })),
              placeholder: '這筆事件教會了我們什麼？',
              style: {
                width: '100%',
                background: C.subtle,
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                padding: '8px 10px',
                color: C.text,
                fontSize: 12,
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: 68,
                lineHeight: 1.6,
              },
            })
          ),
          h(
            Button,
            {
              onClick: submitReview,
              style: {
                width: '100%',
                padding: '12px',
                border: 'none',
                borderRadius: 8,
                background: alpha(C.fillTeal, '40'),
                color: C.onFill,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              },
            },
            '完成復盤'
          )
        )
      ),

    // Pending events
    pending.length > 0 &&
      h(
        Card,
        { style: { marginBottom: 10, borderLeft: `3px solid ${alpha(C.amber, '40')}` } },
        h('div', { style: { ...lbl, color: C.amber } }, `待處理 (${pending.length})`),
        pending.map((e, index) =>
          h(NewsEventCard, {
            key: buildNewsEventKey(e, index),
            event: e,
            onReview: (ev) => {
              setReviewingEvent(ev)
              setReviewForm(
                createDefaultReviewForm({
                  actual: ev.actual || 'up',
                  actualNote: ev.actualNote || '',
                  lessons: ev.lessons || '',
                })
              )
            },
          })
        )
      ),

    // Tracking events
    tracking.length > 0 &&
      h(
        Card,
        { style: { marginBottom: 10, borderLeft: `3px solid ${alpha(C.teal, '40')}` } },
        h('div', { style: { ...lbl, color: C.teal } }, `追蹤中 (${tracking.length})`),
        tracking.map((e, index) => h(NewsEventCard, { key: buildNewsEventKey(e, index), event: e }))
      ),

    // Past events
    past.length > 0 &&
      h(
        Card,
        { style: { marginBottom: 10 } },
        h('div', { style: { ...lbl } }, `歷史事件 (${past.length})`),
        past.map((e, index) =>
          h(NewsEventCard, {
            key: buildNewsEventKey(e, index),
            event: e,
            isExpanded: expandedNews?.has(e.id),
            onToggle: () => {
              const next = new Set(expandedNews || [])
              if (next.has(e.id)) next.delete(e.id)
              else next.add(e.id)
              setExpandedNews(next)
            },
          })
        )
      )
  )
}
