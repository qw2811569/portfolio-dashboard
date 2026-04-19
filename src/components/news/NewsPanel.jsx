import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
// useNavigate removed — component must work without Router context (App.jsx)
import { TOKENS, alpha } from '../../theme.js'
import { Card, Button, DataError, OperatingContextCard } from '../common'
import { Skeleton } from '../common/Skeleton.jsx'
import { normalizeDataError } from '../../lib/dataError.js'
import { getViewModeComplianceMessage, isViewModeEnabled } from '../../lib/viewModeContract.js'

const lbl = {
  fontSize: 12,
  color: TOKENS.iron,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
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
        marginBottom: 12,
        borderRadius: 28,
        borderLeft: `3px solid ${alpha(TOKENS.cta, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: TOKENS.iron } }, '合規顯示模式'),
    h('div', { style: { fontSize: 12, color: TOKENS.ink, lineHeight: 1.7 } }, note)
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
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${TOKENS.boneDeep}`,
        background: alpha(TOKENS.bone, 'eb'),
        color: TOKENS.charcoal,
        fontSize: 11,
        letterSpacing: '0.04em',
        fontFamily: TOKENS.fontBody,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      },
    },
    text
  )
}

function NewsFeedCard({
  item,
  isRead = false,
  isLast = false,
  onToggleRead = () => {},
  onNavigateDaily = () => {},
}) {
  const impact = inferImpact(item)
  const impactTone =
    impact === 'positive'
      ? {
          label: IMPACT_COPY.positive,
          bg: alpha(TOKENS.positive, '16'),
          color: TOKENS.ink,
          border: alpha(TOKENS.positive, '28'),
        }
      : impact === 'negative'
        ? {
            label: `▼ ${IMPACT_COPY.negative}`,
            bg: alpha(TOKENS.charcoal, '10'),
            color: TOKENS.ink,
            border: alpha(TOKENS.charcoal, '24'),
          }
        : {
            label: IMPACT_COPY.neutral,
            bg: alpha(TOKENS.boneDeep, 'd6'),
            color: TOKENS.iron,
            border: alpha(TOKENS.charcoal, '16'),
          }

  return h(
    'article',
    {
      style: {
        padding: '20px 0 18px',
        borderBottom: isLast ? 'none' : `1px solid ${TOKENS.boneDeep}`,
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
            background: alpha(TOKENS.warning, '18'),
            border: `1px solid ${alpha(TOKENS.warning, '24')}`,
            color: TOKENS.ink,
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
              color: TOKENS.ink,
              textDecoration: 'none',
              lineHeight: 1.08,
              fontFamily: TOKENS.fontSection,
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
              marginTop: 8,
              fontSize: 13,
              lineHeight: 1.7,
              color: TOKENS.charcoal,
              fontFamily: TOKENS.fontBody,
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
              marginTop: 12,
            },
          },
          ...(item.relatedStocks || []).map((stock) =>
            renderChip(
              `${stock.code} ${stock.name}`,
              {
                background: alpha(TOKENS.bone, 'f2'),
                color: TOKENS.charcoal,
                border: `1px solid ${TOKENS.boneDeep}`,
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
            gap: 8,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: TOKENS.iron,
              fontFamily: TOKENS.fontCaption,
              fontVariantNumeric: 'tabular-nums',
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
              border: `1px solid ${TOKENS.boneDeep}`,
              background: isRead ? alpha(TOKENS.boneDeep, 'b8') : alpha(TOKENS.bone, 'ed'),
              color: isRead ? TOKENS.charcoal : TOKENS.iron,
              borderRadius: 999,
              padding: '8px 12px',
              fontSize: 11,
              fontFamily: TOKENS.fontBody,
              fontVariantNumeric: 'tabular-nums',
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
              background: TOKENS.cta,
              border: `1px solid ${alpha(TOKENS.cta, '40')}`,
              color: TOKENS.ink,
              textTransform: 'none',
              letterSpacing: '0.02em',
              padding: '8px 12px',
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
      { style: { padding: '20px 16px' } },
      h('div', { style: { fontSize: 11, color: TOKENS.iron, marginBottom: 12 } }, '新聞脈絡整理中'),
      h(Skeleton, { variant: 'card', count: 2 })
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
        gap: 16,
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
            padding: '24px 24px',
            borderRadius: 30,
            border: `1px solid ${TOKENS.boneDeep}`,
            background: `radial-gradient(circle at 16% 18%, ${alpha(TOKENS.warning, '18')}, transparent 28%), linear-gradient(180deg, ${alpha(TOKENS.bone, 'fa')}, ${alpha(TOKENS.bone, 'ec')})`,
            position: 'relative',
            overflow: 'hidden',
          },
        },
        h('div', {
          style: {
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(${alpha(TOKENS.charcoal, '09')} 0.7px, transparent 0.7px), radial-gradient(${alpha(TOKENS.charcoal, '06')} 0.7px, transparent 0.7px)`,
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
              { style: { ...lbl, color: TOKENS.iron, marginBottom: 8 } },
              '新聞聚合 / News preview'
            ),
            h(
              'div',
              {
                style: {
                  fontFamily: TOKENS.fontSection,
                  fontSize: 52,
                  lineHeight: 0.96,
                  color: TOKENS.ink,
                  maxWidth: 520,
                },
              },
              heroTitle
            ),
            h(
              'div',
              {
                style: {
                  marginTop: 12,
                  maxWidth: 520,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: TOKENS.charcoal,
                  fontFamily: TOKENS.fontBody,
                },
              },
              'Google News RSS 與 FinMind headline 先進來，先標已看、先聚合重點，再 handoff 給 Daily 判讀影響，不在這頁直接產事件。'
            ),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 16,
                },
              },
              renderChip(`${filteredItems.length} 則相關新聞`, {
                background: alpha(TOKENS.warning, '18'),
                border: `1px solid ${alpha(TOKENS.warning, '24')}`,
                color: TOKENS.ink,
              }),
              renderChip(`Ticker filter: ${holdingCodes.length || 'Auto'}`, {
                background: alpha(TOKENS.bone, 'f0'),
                border: `1px solid ${TOKENS.boneDeep}`,
                color: TOKENS.charcoal,
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
                  color: TOKENS.iron,
                  fontFamily: TOKENS.fontCaption,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 4,
                },
              },
              'today'
            ),
            h(
              'div',
              {
                style: {
                  fontFamily: TOKENS.fontSection,
                  fontSize: 56,
                  lineHeight: 1,
                  color: TOKENS.ink,
                  fontVariantNumeric: 'tabular-nums',
                },
              },
              filteredItems.length
            ),
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  color: TOKENS.charcoal,
                  fontFamily: TOKENS.fontBody,
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
              color: TOKENS.iron,
            },
          },
          '新聞源暫時打不開，以下先用 preview fallback 撐住畫面。'
        ),
      h(
        Card,
        {
          style: {
            borderRadius: 30,
            padding: '0 24px',
            border: `1px solid ${TOKENS.boneDeep}`,
            background: `linear-gradient(180deg, ${alpha(TOKENS.bone, 'f7')}, ${alpha(TOKENS.bone, 'ee')})`,
            overflow: 'hidden',
          },
        },
        filteredItems.map((item, i) =>
          h(NewsFeedCard, {
            key: getItemId(item, i),
            item,
            isRead: readIds.has(getItemId(item, i)),
            isLast: i === filteredItems.length - 1,
            onToggleRead: () => handleToggleRead(item, i),
            onNavigateDaily,
          })
        )
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
            padding: '16px 16px 16px',
            border: `1px solid ${TOKENS.boneDeep}`,
            background: `linear-gradient(180deg, ${alpha(TOKENS.bone, 'f5')}, ${alpha(TOKENS.bone, 'ec')})`,
            position: 'sticky',
            top: 16,
          },
        },
        h('div', { style: { ...lbl, color: TOKENS.iron, marginBottom: 8 } }, 'Filter / Side notes'),
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
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: TOKENS.ink,
                  marginBottom: 8,
                  fontFamily: TOKENS.fontSection,
                },
              },
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
                          border: `1px solid ${tickerFilter === option ? alpha(TOKENS.positive, '2a') : TOKENS.boneDeep}`,
                          background:
                            tickerFilter === option
                              ? alpha(TOKENS.positive, '12')
                              : alpha(TOKENS.bone, 'ed'),
                          color: TOKENS.ink,
                          padding: '8px 12px',
                          fontSize: 11,
                          fontFamily: TOKENS.fontBody,
                          fontVariantNumeric: 'tabular-nums',
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
                          border: `1px solid ${TOKENS.boneDeep}`,
                          borderLeft: `2px solid ${alpha(TOKENS.warning, '32')}`,
                          background: alpha(TOKENS.bone, 'ef'),
                          padding: '8px 12px',
                          fontSize: 11,
                          color: TOKENS.ink,
                          lineHeight: 1.6,
                          fontFamily: TOKENS.fontBody,
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
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: TOKENS.ink,
                  marginBottom: 8,
                  fontFamily: TOKENS.fontSection,
                },
              },
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
                      border: `1px solid ${sourceFilter === option ? alpha(TOKENS.warning, '2e') : TOKENS.boneDeep}`,
                      background:
                        sourceFilter === option
                          ? alpha(TOKENS.warning, '14')
                          : alpha(TOKENS.bone, 'ed'),
                      color: TOKENS.ink,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontFamily: TOKENS.fontBody,
                      fontVariantNumeric: 'tabular-nums',
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
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: TOKENS.ink,
                  marginBottom: 8,
                  fontFamily: TOKENS.fontSection,
                },
              },
              '依 impact'
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              ...impacts.map((option) =>
                (() => {
                  const tone =
                    option === '利多'
                      ? TOKENS.positive
                      : option === '利空'
                        ? TOKENS.negative
                        : option === '中性'
                          ? TOKENS.charcoal
                          : TOKENS.warning

                  return h(
                    'button',
                    {
                      key: option,
                      type: 'button',
                      className: 'ui-btn',
                      onClick: () => setImpactFilter(option),
                      style: {
                        borderRadius: 999,
                        border: `1px solid ${impactFilter === option ? alpha(tone, '2a') : TOKENS.boneDeep}`,
                        background:
                          impactFilter === option ? alpha(tone, '12') : alpha(TOKENS.bone, 'ed'),
                        color: TOKENS.ink,
                        padding: '8px 12px',
                        fontSize: 11,
                        fontFamily: TOKENS.fontBody,
                        fontVariantNumeric: 'tabular-nums',
                        cursor: 'pointer',
                      },
                    },
                    option
                  )
                })()
              )
            )
          ),
          h(
            'div',
            {
              style: {
                padding: '12px 12px',
                borderRadius: 22,
                background: alpha(TOKENS.warning, '12'),
                border: `1px solid ${alpha(TOKENS.warning, '20')}`,
                color: TOKENS.ink,
              },
            },
            h('div', { style: { fontSize: 11, color: TOKENS.iron, marginBottom: 4 } }, 'Notice'),
            renderChip(`未讀 ${unreadCount} 則`, {
              background: alpha(TOKENS.warning, '18'),
              color: TOKENS.ink,
              border: `1px solid ${alpha(TOKENS.warning, '28')}`,
            })
          ),
          h(
            'div',
            {
              style: {
                padding: '12px',
                borderRadius: 22,
                background: alpha(TOKENS.positive, '10'),
                border: `1px solid ${alpha(TOKENS.positive, '22')}`,
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
                background: alpha(TOKENS.positive, '18'),
                border: `1px solid ${alpha(TOKENS.positive, '24')}`,
                color: TOKENS.ink,
              })
            ),
            h(
              'div',
              {
                style: {
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: TOKENS.ink,
                  fontFamily: TOKENS.fontBody,
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
            padding: '24px 24px',
            borderRadius: 30,
            border: `1px solid ${TOKENS.boneDeep}`,
            background: `radial-gradient(circle at 16% 18%, ${alpha(TOKENS.warning, '16')}, transparent 28%), linear-gradient(180deg, ${alpha(TOKENS.bone, 'fa')}, ${alpha(TOKENS.bone, 'ee')})`,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: TOKENS.iron,
              marginBottom: 8,
              fontFamily: TOKENS.fontCaption,
              fontVariantNumeric: 'tabular-nums',
            },
          },
          '新聞聚合 / News'
        ),
        h(
          'div',
          {
            style: {
              fontSize: 38,
              fontFamily: TOKENS.fontSection,
              color: TOKENS.ink,
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
              color: TOKENS.charcoal,
              lineHeight: 1.8,
              maxWidth: 520,
              marginBottom: 16,
              fontFamily: TOKENS.fontBody,
            },
          },
          '這頁先聚合 headline，再 handoff 給 Daily 判讀影響。加入持股後，ticker filter、impact tag 與已看機制會一起啟用。'
        ),
        h(
          Button,
          {
            onClick: onNavigateDaily,
            style: {
              padding: '8px 16px',
              background: TOKENS.cta,
              border: `1px solid ${alpha(TOKENS.cta, '40')}`,
              color: TOKENS.ink,
              textTransform: 'none',
              letterSpacing: '0.02em',
            },
          },
          '→ 前往收盤分析'
        )
      )
  )
}
