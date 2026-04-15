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
        setItems(
          (data.items || []).map((item) => ({
            ...item,
            recordType: 'news',
          }))
        )
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
      h('div', { style: { fontSize: 11, color: C.textMute } }, `新聞暫時打不開：${error}`)
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
  operatingContext = null,
  onNavigateDaily = () => {},
  holdingCodes = [],
}) {
  return h(
    'div',
    null,
    h(OperatingContextCard, { context: operatingContext }),
    holdingCodes.length > 0 && h(NewsFeedSection, { holdingCodes }),
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
      )
  )
}
