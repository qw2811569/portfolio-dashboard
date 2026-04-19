import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
// useNavigate removed — component must work without Router context (App.jsx)
import { C, TOKENS, alpha } from '../../theme.js'
import { Card, Button, DataError, OperatingContextCard } from '../common'
import { normalizeDataError } from '../../lib/dataError.js'
import { getViewModeComplianceMessage, isViewModeEnabled } from '../../lib/viewModeContract.js'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

const PAPER = {
  bone: TOKENS.boneSoft,
  paper: TOKENS.paper,
  sand: TOKENS.sand,
  accent: C.blue,
  accentStrong: C.olive,
  ink: C.text,
  muted: C.textSec,
  mutedSoft: C.textMute,
  grey: alpha(TOKENS.iron, '18'),
  line: alpha(TOKENS.charcoal, '22'),
  lineSoft: alpha(TOKENS.charcoal, '12'),
  tangerine: TOKENS.cta,
}

const IMPACT_COPY = {
  positive: '利多',
  negative: '利空',
  neutral: '中性',
}

const PREVIEW_NEWS = [
  {
    title: '台積電 CoWoS 產能續擴，供應鏈接單能見度再往上修',
    description:
      'Google News 與經濟日報同步聚焦先進封裝需求延續，市場解讀對半導體設備與材料鏈偏正向。',
    link: 'https://example.com/news-preview/tsmc-cowos',
    pubDate: '2026-04-17T08:25:00+08:00',
    source: 'Google News',
    relatedStocks: [
      { code: '2330', name: '台積電' },
      { code: '3131', name: '弘塑' },
    ],
  },
  {
    title: 'MoneyDJ：記憶體報價震盪，模組廠短線拉貨轉保守',
    description: 'DRAM 現貨價格整理，新聞語氣偏向觀望，對高庫存持股的情緒較保守。',
    link: 'https://example.com/news-preview/dram-softness',
    pubDate: '2026-04-17T09:10:00+08:00',
    source: 'MoneyDJ',
    relatedStocks: [{ code: '2344', name: '華邦電' }],
  },
  {
    title: '經濟日報：聯發科新平台出貨升溫，AI 手機題材回到主流',
    description: '供應鏈訪查指向第二季拉貨升溫，法人認為手機 SoC 與邊緣 AI 敘事同步升級。',
    link: 'https://example.com/news-preview/mediatek-ai-phone',
    pubDate: '2026-04-17T10:05:00+08:00',
    source: '經濟日報',
    relatedStocks: [{ code: '2454', name: '聯發科' }],
  },
  {
    title: 'Google News：航運運價持平，市場等待下週報價再定方向',
    description: '運價沒有明顯上修或下修，現階段較像供需觀察點，適合交給 Daily 再判讀影響。',
    link: 'https://example.com/news-preview/shipping-flat',
    pubDate: '2026-04-17T11:15:00+08:00',
    source: 'Google News',
    relatedStocks: [{ code: '2603', name: '長榮' }],
  },
  {
    title: 'FinMind：工業電腦客戶遞延專案，法人下修短期出貨預期',
    description: '專案驗收往後遞延，雖不是結構性反轉，但短期營收節奏承壓。',
    link: 'https://example.com/news-preview/industrial-delay',
    pubDate: '2026-04-17T12:30:00+08:00',
    source: 'FinMind',
    relatedStocks: [{ code: '2395', name: '研華' }],
  },
]

function getItemId(item, index = 0) {
  return item.id || item.link || `${item.title || 'news'}-${item.pubDate || index}`
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function normalizeSourceLabel(source = '') {
  if (!source) return 'Google News'
  if (/moneydj/i.test(source)) return 'MoneyDJ'
  if (/google/i.test(source)) return 'Google News'
  if (/finmind/i.test(source)) return 'FinMind'
  return source
}

function inferImpact(item) {
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
  const positiveWords = ['成長', '上修', '擴', '回溫', '升溫', '樂觀', '接單', '受惠', '創高']
  const negativeWords = ['下修', '衰退', '震盪', '保守', '遞延', '壓力', '疲弱', '下滑', '調降']
  if (negativeWords.some((word) => text.includes(word.toLowerCase()))) return 'negative'
  if (positiveWords.some((word) => text.includes(word.toLowerCase()))) return 'positive'
  return 'neutral'
}

function summarizeItem(item) {
  return (
    item.description ||
    `${normalizeSourceLabel(item.source)} 聚焦 ${item.relatedStocks?.[0]?.name || '持股'}，適合交給 Daily 做下一步影響判讀。`
  )
}

function buildPreviewNewsItems(holdingCodes = []) {
  if (!holdingCodes.length) return PREVIEW_NEWS
  const filtered = PREVIEW_NEWS.filter((item) =>
    (item.relatedStocks || []).some((stock) => holdingCodes.includes(stock.code))
  )
  return filtered.length ? filtered : PREVIEW_NEWS.slice(0, 4)
}

function buildTrendSummary(items) {
  const positives = items.filter((item) => inferImpact(item) === 'positive').length
  const negatives = items.filter((item) => inferImpact(item) === 'negative').length
  if (positives > negatives) return '正向敘事集中在 AI 供應鏈，短線偏向接單與出貨能見度提升。'
  if (negatives > positives)
    return '負面訊號來自短期遞延與報價整理，今晚重點是確認是否只是節奏放慢。'
  return '目前 headline 偏整理盤語氣，多數新聞更適合進 Daily 做脈絡判讀，而不是直接升格成事件。'
}

function buildAggregateNewsClusters(items = []) {
  const safeItems = Array.isArray(items) ? items : []
  const impactCounts = safeItems.reduce(
    (counts, item) => {
      counts[inferImpact(item)] += 1
      return counts
    },
    { positive: 0, negative: 0, neutral: 0 }
  )
  const sourceCounts = safeItems.reduce((counts, item) => {
    const label = normalizeSourceLabel(item?.source)
    counts.set(label, (counts.get(label) || 0) + 1)
    return counts
  }, new Map())
  const leadingSource = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0] || null
  const relatedStockCount = new Set(
    safeItems.flatMap((item) => (item.relatedStocks || []).map((stock) => stock?.code))
  ).size

  return [
    relatedStockCount > 0 ? `${relatedStockCount} 檔持股訊號已壓縮為組合層級觀察。` : null,
    impactCounts.positive > 0 ? `利多 headline ${impactCounts.positive} 則` : null,
    impactCounts.negative > 0 ? `利空 headline ${impactCounts.negative} 則` : null,
    impactCounts.neutral > 0 ? `中性 headline ${impactCounts.neutral} 則` : null,
    leadingSource ? `主來源 ${leadingSource[0]} · ${leadingSource[1]} 則` : null,
  ].filter(Boolean)
}

function ViewModeNotice({ note }) {
  if (!note) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 14,
        borderRadius: 28,
        borderLeft: `3px solid ${alpha(PAPER.tangerine, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: PAPER.muted } }, '合規顯示模式'),
    h('div', { style: { fontSize: 12, color: PAPER.ink, lineHeight: 1.7 } }, note)
  )
}

function renderChip(text, style = {}, key = text) {
  return h(
    'span',
    {
      key,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 999,
        border: `1px solid ${PAPER.lineSoft}`,
        background: PAPER.paper,
        color: PAPER.muted,
        fontSize: 11,
        letterSpacing: '0.04em',
        ...style,
      },
    },
    text
  )
}

function NewsFeedCard({
  item,
  isRead = false,
  onToggleRead = () => {},
  onNavigateDaily = () => {},
}) {
  const impact = inferImpact(item)
  const impactTone =
    impact === 'positive'
      ? {
          label: IMPACT_COPY.positive,
          bg: alpha(PAPER.accentStrong, '20'),
          color: PAPER.ink,
          border: alpha(PAPER.accentStrong, '32'),
        }
      : impact === 'negative'
        ? {
            label: `▼ ${IMPACT_COPY.negative}`,
            bg: alpha(PAPER.ink, '12'),
            color: PAPER.ink,
            border: alpha(PAPER.ink, '24'),
          }
        : {
            label: IMPACT_COPY.neutral,
            bg: PAPER.grey,
            color: PAPER.muted,
            border: alpha(PAPER.muted, '20'),
          }

  return h(
    Card,
    {
      style: {
        marginBottom: 14,
        padding: '18px 18px 16px',
        borderRadius: 28,
        background: `linear-gradient(180deg, ${alpha(PAPER.paper, 'fc')}, ${alpha(PAPER.bone, 'f0')})`,
        border: `1px solid ${PAPER.lineSoft}`,
        boxShadow: '0 18px 30px rgba(91,84,72,0.06)',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        },
      },
      h(
        'div',
        { style: { flex: 1, minWidth: 280 } },
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 12,
            },
          },
          renderChip(normalizeSourceLabel(item.source), {
            background: alpha(PAPER.accent, '26'),
            color: PAPER.ink,
          }),
          renderChip(impactTone.label, {
            background: impactTone.bg,
            color: impactTone.color,
            border: `1px solid ${impactTone.border}`,
          })
        ),
        h(
          'a',
          {
            href: item.link,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
              fontSize: 26,
              fontWeight: 600,
              color: PAPER.ink,
              textDecoration: 'none',
              lineHeight: 1.08,
              fontFamily: 'var(--font-headline)',
              display: 'block',
              textDecorationLine: isRead ? 'line-through' : 'none',
              opacity: isRead ? 0.62 : 1,
            },
          },
          item.title
        ),
        h(
          'div',
          {
            style: {
              marginTop: 10,
              fontSize: 13,
              lineHeight: 1.7,
              color: PAPER.muted,
              maxWidth: 560,
              textDecorationLine: isRead ? 'line-through' : 'none',
              opacity: isRead ? 0.72 : 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            },
          },
          summarizeItem(item)
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 14,
            },
          },
          ...(item.relatedStocks || []).map((stock) =>
            renderChip(
              `${stock.code} ${stock.name}`,
              {
                background: alpha(PAPER.accentStrong, '18'),
                color: PAPER.ink,
                border: `1px solid ${alpha(PAPER.accentStrong, '20')}`,
              },
              stock.code
            )
          )
        )
      ),
      h(
        'div',
        {
          style: {
            width: 170,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: PAPER.mutedSoft,
            },
          },
          formatDateTime(item.pubDate)
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ui-btn',
            onClick: () => onToggleRead(item),
            style: {
              border: `1px solid ${PAPER.line}`,
              background: isRead ? PAPER.grey : PAPER.paper,
              color: PAPER.muted,
              borderRadius: 999,
              padding: '10px 12px',
              fontSize: 11,
              cursor: 'pointer',
            },
          },
          isRead ? '已看' : '標記已看'
        ),
        h(
          Button,
          {
            onClick: () => onNavigateDaily(item),
            style: {
              background: PAPER.tangerine,
              border: `1px solid ${alpha(PAPER.tangerine, '40')}`,
              color: PAPER.ink,
              textTransform: 'none',
              letterSpacing: '0.02em',
              padding: '10px 14px',
              width: '100%',
              justifyContent: 'center',
            },
          },
          '→ 判讀影響'
        )
      )
    )
  )
}

/**
 * Section that fetches and displays news feed from /api/news-feed
 */
export function NewsFeedSection({
  holdingCodes = [],
  onNavigateDaily = () => {},
  viewMode = 'retail',
}) {
  const codesKey = useMemo(() => [...holdingCodes].sort().join(','), [holdingCodes])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(() => codesKey.length > 0)
  const [error, setError] = useState(null)
  const [requestNonce, setRequestNonce] = useState(0)
  const [sourceFilter, setSourceFilter] = useState('全部來源')
  const [impactFilter, setImpactFilter] = useState('全部影響')
  const [tickerFilter, setTickerFilter] = useState('全部持股')
  const [readIds, setReadIds] = useState(() => new Set())
  const fetchedRef = useRef(false)

  useEffect(() => {
    fetchedRef.current = false
  }, [codesKey, requestNonce])

  useEffect(() => {
    if (!codesKey || fetchedRef.current) return
    fetchedRef.current = true

    fetch(`/api/news-feed?codes=${encodeURIComponent(codesKey)}&days=3`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const remoteItems = (data.items || []).map((item) => ({
          ...item,
          recordType: 'news',
        }))
        setItems(remoteItems.length ? remoteItems : buildPreviewNewsItems(holdingCodes))
      })
      .catch((err) => {
        setError(normalizeDataError(err, { resource: 'news' }))
        setItems(buildPreviewNewsItems(holdingCodes))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [codesKey, holdingCodes, requestNonce])

  if (loading) {
    return h(
      Card,
      { style: { padding: '16px 14px', textAlign: 'center' } },
      h('div', { style: { fontSize: 11, color: C.textMute } }, '載入新聞中...')
    )
  }

  if (items.length === 0) return null

  const sources = ['全部來源', ...new Set(items.map((item) => normalizeSourceLabel(item.source)))]
  const impacts = ['全部影響', '利多', '利空', '中性']
  const tickers = [
    '全部持股',
    ...new Set(
      items.flatMap((item) =>
        (item.relatedStocks || []).map((stock) => `${stock.code} ${stock.name}`)
      )
    ),
  ]

  const filteredItems = items.filter((item) => {
    const sourceLabel = normalizeSourceLabel(item.source)
    const impactLabel = IMPACT_COPY[inferImpact(item)]
    const itemTickers = (item.relatedStocks || []).map((stock) => `${stock.code} ${stock.name}`)
    const sourceOk = sourceFilter === '全部來源' || sourceFilter === sourceLabel
    const impactOk = impactFilter === '全部影響' || impactFilter === impactLabel
    const tickerOk = tickerFilter === '全部持股' || itemTickers.includes(tickerFilter)
    return sourceOk && impactOk && tickerOk
  })

  const unreadCount = filteredItems.filter(
    (item, index) => !readIds.has(getItemId(item, index))
  ).length
  const showTickerSideNotes = isViewModeEnabled('showTickerSideNotes', viewMode)
  const aggregateClusters = buildAggregateNewsClusters(filteredItems)

  const handleToggleRead = (item, index) => {
    const itemId = getItemId(item, index)
    setReadIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const heroTitle = holdingCodes.length > 0 ? '這些新聞跟你組合有關' : '今天市場在說什麼'

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.9fr) minmax(280px, 0.9fr)',
        gap: 18,
        alignItems: 'start',
      },
    },
    h(
      'div',
      null,
      error &&
        h(DataError, {
          status: error.status,
          resource: 'news',
          onRetry: () => {
            setLoading(true)
            setError(null)
            setRequestNonce((current) => current + 1)
          },
          style: { marginBottom: 12 },
        }),
      h(
        Card,
        {
          style: {
            marginBottom: 16,
            padding: '24px 26px',
            borderRadius: 30,
            background: `radial-gradient(circle at 16% 18%, ${alpha(PAPER.sand, '90')}, transparent 28%), linear-gradient(180deg, ${alpha(PAPER.paper, 'fb')}, ${alpha(PAPER.bone, 'ee')})`,
            position: 'relative',
            overflow: 'hidden',
          },
        },
        h('div', {
          style: {
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(rgba(32,40,35,0.035) 0.7px, transparent 0.7px), radial-gradient(rgba(32,40,35,0.025) 0.7px, transparent 0.7px)',
            backgroundPosition: '0 0, 12px 12px',
            backgroundSize: '24px 24px',
            opacity: 0.38,
            pointerEvents: 'none',
          },
        }),
        h(
          'div',
          {
            style: {
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 16,
              alignItems: 'end',
            },
          },
          h(
            'div',
            null,
            h(
              'div',
              { style: { ...lbl, color: PAPER.mutedSoft, marginBottom: 10 } },
              '情報脈絡 / News preview'
            ),
            h(
              'div',
              {
                style: {
                  fontFamily: 'var(--font-headline)',
                  fontSize: 52,
                  lineHeight: 0.94,
                  color: PAPER.ink,
                  maxWidth: 520,
                },
              },
              heroTitle
            ),
            h(
              'div',
              {
                style: {
                  marginTop: 14,
                  maxWidth: 520,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: PAPER.muted,
                },
              },
              'Google News RSS 與 FinMind headline 先進來，先標已看、先收斂脈絡，再 handoff 給 Daily 判讀影響，不在這頁直接產事件。'
            ),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 18,
                },
              },
              renderChip(`${filteredItems.length} 則相關新聞`, {
                background: alpha(PAPER.accent, '22'),
                color: PAPER.ink,
              }),
              renderChip(`Ticker filter: ${holdingCodes.length || 'Auto'}`, {
                background: PAPER.paper,
              })
            )
          ),
          h(
            'div',
            {
              style: {
                textAlign: 'right',
                minWidth: 120,
              },
            },
            h(
              'div',
              {
                style: {
                  fontSize: 14,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: PAPER.mutedSoft,
                  marginBottom: 4,
                },
              },
              'today'
            ),
            h(
              'div',
              {
                style: {
                  fontFamily: 'var(--font-headline)',
                  fontSize: 104,
                  lineHeight: 0.82,
                  color: PAPER.ink,
                },
              },
              filteredItems.length
            ),
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  color: PAPER.muted,
                },
              },
              '新增新聞數 N'
            )
          )
        )
      ),
      error &&
        h(
          'div',
          {
            style: {
              marginBottom: 12,
              fontSize: 11,
              color: PAPER.mutedSoft,
            },
          },
          '新聞源暫時打不開，以下先用 preview fallback 撐住畫面。'
        ),
      filteredItems.map((item, i) =>
        h(NewsFeedCard, {
          key: getItemId(item, i),
          item,
          isRead: readIds.has(getItemId(item, i)),
          onToggleRead: () => handleToggleRead(item, i),
          onNavigateDaily,
        })
      )
    ),
    h(
      'div',
      null,
      h(
        Card,
        {
          style: {
            borderRadius: 28,
            padding: '18px 18px 20px',
            position: 'sticky',
            top: 16,
          },
        },
        h(
          'div',
          { style: { ...lbl, color: PAPER.mutedSoft, marginBottom: 10 } },
          'Filter / Side notes'
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            },
          },
          h(
            'div',
            null,
            h(
              'div',
              { style: { fontSize: 13, fontWeight: 600, color: PAPER.ink, marginBottom: 8 } },
              showTickerSideNotes ? '依 ticker' : 'Aggregate clusters'
            ),
            showTickerSideNotes
              ? h(
                  'div',
                  { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                  ...tickers.map((option) =>
                    h(
                      'button',
                      {
                        key: option,
                        type: 'button',
                        className: 'ui-btn',
                        onClick: () => setTickerFilter(option),
                        style: {
                          borderRadius: 999,
                          border: `1px solid ${tickerFilter === option ? alpha(PAPER.accentStrong, '28') : PAPER.lineSoft}`,
                          background:
                            tickerFilter === option ? alpha(PAPER.accentStrong, '18') : PAPER.paper,
                          color: PAPER.ink,
                          padding: '10px 12px',
                          fontSize: 11,
                          cursor: 'pointer',
                        },
                      },
                      option
                    )
                  )
                )
              : h(
                  'div',
                  {
                    'data-testid': 'news-aggregate-clusters',
                    style: { display: 'grid', gap: 8 },
                  },
                  ...aggregateClusters.map((cluster) =>
                    h(
                      'div',
                      {
                        key: cluster,
                        style: {
                          borderRadius: 18,
                          border: `1px solid ${PAPER.lineSoft}`,
                          background: alpha(PAPER.accentStrong, '10'),
                          padding: '10px 12px',
                          fontSize: 11,
                          color: PAPER.ink,
                          lineHeight: 1.6,
                        },
                      },
                      cluster
                    )
                  )
                )
          ),
          h(
            'div',
            null,
            h(
              'div',
              { style: { fontSize: 13, fontWeight: 600, color: PAPER.ink, marginBottom: 8 } },
              '依來源'
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              ...sources.map((option) =>
                h(
                  'button',
                  {
                    key: option,
                    type: 'button',
                    className: 'ui-btn',
                    onClick: () => setSourceFilter(option),
                    style: {
                      borderRadius: 999,
                      border: `1px solid ${sourceFilter === option ? alpha(PAPER.accent, '38') : PAPER.lineSoft}`,
                      background: sourceFilter === option ? alpha(PAPER.accent, '22') : PAPER.paper,
                      color: PAPER.ink,
                      padding: '10px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                    },
                  },
                  option
                )
              )
            )
          ),
          h(
            'div',
            null,
            h(
              'div',
              { style: { fontSize: 13, fontWeight: 600, color: PAPER.ink, marginBottom: 8 } },
              '依 impact'
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              ...impacts.map((option) =>
                h(
                  'button',
                  {
                    key: option,
                    type: 'button',
                    className: 'ui-btn',
                    onClick: () => setImpactFilter(option),
                    style: {
                      borderRadius: 999,
                      border: `1px solid ${impactFilter === option ? PAPER.line : PAPER.lineSoft}`,
                      background: impactFilter === option ? PAPER.sand : PAPER.paper,
                      color: PAPER.ink,
                      padding: '10px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                    },
                  },
                  option
                )
              )
            )
          ),
          h(
            'div',
            {
              style: {
                padding: '12px 14px',
                borderRadius: 22,
                background: alpha(PAPER.sand, '90'),
                color: PAPER.ink,
              },
            },
            h('div', { style: { fontSize: 11, color: PAPER.muted, marginBottom: 6 } }, 'Notice'),
            renderChip(`未讀 ${unreadCount} 則`, {
              background: PAPER.sand,
              color: PAPER.ink,
              border: `1px solid ${alpha(PAPER.tangerine, '22')}`,
            })
          ),
          h(
            'div',
            {
              style: {
                padding: '14px',
                borderRadius: 22,
                background: alpha(PAPER.accentStrong, '16'),
                border: `1px solid ${alpha(PAPER.accentStrong, '22')}`,
              },
            },
            h(
              'div',
              {
                style: {
                  marginBottom: 8,
                },
              },
              renderChip('今日趨勢摘要', {
                background: alpha(PAPER.accentStrong, '22'),
                color: PAPER.ink,
              })
            ),
            h(
              'div',
              {
                style: {
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: PAPER.ink,
                },
              },
              buildTrendSummary(filteredItems)
            )
          )
        )
      )
    )
  )
}

/**
 * News Analysis Panel
 */
export function NewsAnalysisPanel({
  operatingContext = null,
  onNavigateDaily = () => {},
  holdingCodes = [],
  viewMode = 'retail',
}) {
  const complianceNote = getViewModeComplianceMessage(viewMode, operatingContext?.portfolioLabel)

  return h(
    'div',
    { 'data-testid': 'news-panel' },
    h(OperatingContextCard, { context: operatingContext }),
    isViewModeEnabled('showComplianceNote', viewMode) &&
      h(ViewModeNotice, { note: complianceNote }),
    holdingCodes.length > 0 &&
      h(NewsFeedSection, {
        holdingCodes,
        onNavigateDaily,
        viewMode,
      }),
    holdingCodes.length === 0 &&
      h(
        Card,
        {
          style: {
            textAlign: 'left',
            padding: '28px 26px',
            borderRadius: 30,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.textMute,
              marginBottom: 10,
            },
          },
          '情報脈絡 / News'
        ),
        h(
          'div',
          {
            style: {
              fontSize: 38,
              fontFamily: 'var(--font-headline)',
              color: C.text,
              lineHeight: 1,
              marginBottom: 12,
            },
          },
          '今天市場在說什麼'
        ),
        h(
          'div',
          {
            style: {
              fontSize: 14,
              color: C.textSec,
              lineHeight: 1.8,
              maxWidth: 520,
              marginBottom: 18,
            },
          },
          '這頁先聚合 headline，再 handoff 給 Daily 判讀影響。加入持股後，ticker filter、impact tag 與已看機制會一起啟用。'
        ),
        h(
          Button,
          {
            onClick: onNavigateDaily,
            style: {
              padding: '10px 18px',
              background: PAPER.tangerine,
              border: `1px solid ${alpha(PAPER.tangerine, '40')}`,
              color: '#fff8f0',
              textTransform: 'none',
              letterSpacing: '0.02em',
            },
          },
          '→ 前往收盤分析'
        )
      )
  )
}
