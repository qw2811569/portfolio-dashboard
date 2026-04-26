import { createElement as h, useEffect, useMemo, useState } from 'react'
// useNavigate removed — component must work without Router context (App.jsx)
import { TOKENS, alpha } from '../../theme.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
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

const FILTER_DEFAULTS = {
  source: '全部來源',
  impact: '全部影響',
  ticker: '全部持股',
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

const NEWS_FEED_SUCCESS_CACHE_TTL_MS = 5 * 60 * 1000
const NEWS_FEED_ERROR_CACHE_TTL_MS = 15 * 1000
const newsFeedRequestCache = new Map()

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
  if (item?.suppressImpactJudgment) return 'neutral'
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
  const positiveWords = ['成長', '上修', '擴', '回溫', '升溫', '樂觀', '接單', '受惠', '創高']
  const negativeWords = ['下修', '衰退', '震盪', '保守', '遞延', '壓力', '疲弱', '下滑', '調降']
  if (negativeWords.some((word) => text.includes(word.toLowerCase()))) return 'negative'
  if (positiveWords.some((word) => text.includes(word.toLowerCase()))) return 'positive'
  return 'neutral'
}

function getRelatedStockCodes(item = {}) {
  return (Array.isArray(item.relatedStocks) ? item.relatedStocks : [])
    .map((stock) => String(stock?.code || stock || '').trim())
    .filter(Boolean)
}

function normalizeInsiderNewsItem(item = {}, insiderCodes = []) {
  const relatedCodes = getRelatedStockCodes(item)
  const isRelatedSelfStock = relatedCodes.some((code) => insiderCodes.includes(code))
  if (!isRelatedSelfStock) return item

  return {
    ...item,
    impactJudgment: null,
    actionCta: null,
    aiImpactPromptInput: null,
    suppressImpactJudgment: true,
    isRelatedSelfStock: true,
  }
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

function buildHoldingCodesFromKey(codesKey = '') {
  return String(codesKey || '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}

function buildNewsFeedResultPayload(data, holdingCodes = []) {
  const remoteItems = (data?.items || []).map((item) => ({
    ...item,
    recordType: 'news',
  }))
  return {
    error: null,
    items: remoteItems.length ? remoteItems : buildPreviewNewsItems(holdingCodes),
  }
}

function buildNewsFeedErrorPayload(error, holdingCodes = []) {
  return {
    error: normalizeDataError(error, { resource: 'news' }),
    items: buildPreviewNewsItems(holdingCodes),
  }
}

function readNewsFeedRequestCache(requestKey) {
  const entry = newsFeedRequestCache.get(requestKey)
  if (!entry) return null

  if (entry.status === 'pending') return entry

  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
    newsFeedRequestCache.delete(requestKey)
    return null
  }

  return entry
}

function cacheResolvedNewsFeedRequest(requestKey, payload, ttlMs) {
  newsFeedRequestCache.set(requestKey, {
    status: 'resolved',
    payload,
    expiresAt: Date.now() + ttlMs,
  })
}

function createNewsFeedRequest(requestKey, codesKey, holdingCodes = []) {
  const pendingEntry = {
    status: 'pending',
    promise: fetch(`/api/news-feed?codes=${encodeURIComponent(codesKey)}&days=3`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const payload = buildNewsFeedResultPayload(data, holdingCodes)
        cacheResolvedNewsFeedRequest(requestKey, payload, NEWS_FEED_SUCCESS_CACHE_TTL_MS)
        return payload
      })
      .catch((error) => {
        const payload = buildNewsFeedErrorPayload(error, holdingCodes)
        cacheResolvedNewsFeedRequest(requestKey, payload, NEWS_FEED_ERROR_CACHE_TTL_MS)
        return payload
      }),
  }

  newsFeedRequestCache.set(requestKey, pendingEntry)
  return pendingEntry
}

export function __resetNewsFeedRequestCacheForTests() {
  newsFeedRequestCache.clear()
}

function buildTrendSummary(items) {
  const positives = items.filter((item) => inferImpact(item) === 'positive').length
  const negatives = items.filter((item) => inferImpact(item) === 'negative').length
  if (positives > negatives) return '正向訊號集中在 AI 供應鏈，短線偏向接單與出貨能見度提升。'
  if (negatives > positives)
    return '負面訊號來自短期遞延與報價整理，今晚重點是確認是否只是節奏放慢。'
  return '目前多數新聞偏整理盤語氣，更適合進 Daily 做脈絡判讀，而不是直接在這頁升格成事件。'
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
    impactCounts.positive > 0 ? `利多消息 ${impactCounts.positive} 則` : null,
    impactCounts.negative > 0 ? `利空消息 ${impactCounts.negative} 則` : null,
    impactCounts.neutral > 0 ? `中性消息 ${impactCounts.neutral} 則` : null,
    leadingSource ? `主來源 ${leadingSource[0]} · ${leadingSource[1]} 則` : null,
  ].filter(Boolean)
}

function ViewModeNotice({ note }) {
  const isMobile = useIsMobile()

  if (!note) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 12,
        padding: isMobile ? '12px 14px' : '16px 16px',
        borderRadius: isMobile ? TOKENS.radii.lg : 28,
        borderLeft: `3px solid ${alpha(TOKENS.cta, '40')}`,
      },
    },
    h(
      'div',
      { style: { ...lbl, color: TOKENS.iron, fontSize: isMobile ? 11 : lbl.fontSize } },
      '合規顯示模式'
    ),
    h('div', { style: { fontSize: isMobile ? 11 : 12, color: TOKENS.ink, lineHeight: 1.7 } }, note)
  )
}

function countActiveFilters({
  sourceFilter = FILTER_DEFAULTS.source,
  impactFilter = FILTER_DEFAULTS.impact,
  tickerFilter = FILTER_DEFAULTS.ticker,
}) {
  let count = 0
  if (sourceFilter !== FILTER_DEFAULTS.source) count += 1
  if (impactFilter !== FILTER_DEFAULTS.impact) count += 1
  if (tickerFilter !== FILTER_DEFAULTS.ticker) count += 1
  return count
}

function buildActiveFilterSummary({
  sourceFilter = FILTER_DEFAULTS.source,
  impactFilter = FILTER_DEFAULTS.impact,
  tickerFilter = FILTER_DEFAULTS.ticker,
}) {
  const activeFilters = [
    sourceFilter !== FILTER_DEFAULTS.source ? sourceFilter : null,
    impactFilter !== FILTER_DEFAULTS.impact ? impactFilter : null,
    tickerFilter !== FILTER_DEFAULTS.ticker ? tickerFilter : null,
  ].filter(Boolean)

  if (activeFilters.length === 0) {
    return '預設：全部來源 / 全部影響 / 全部持股'
  }

  return activeFilters.join(' · ')
}

function renderFilterSectionHeading({ title, activeValue, isMobile }) {
  if (!isMobile) {
    return h(
      'div',
      {
        style: {
          fontSize: 14,
          fontWeight: 600,
          color: TOKENS.ink,
          marginBottom: 8,
          fontFamily: TOKENS.fontSection,
        },
      },
      title
    )
  }

  return h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        marginBottom: 8,
        flexWrap: 'wrap',
      },
    },
    h(
      'div',
      {
        style: {
          fontSize: 13,
          fontWeight: 600,
          color: TOKENS.ink,
          fontFamily: TOKENS.fontSection,
        },
      },
      title
    ),
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: activeValue ? TOKENS.ink : TOKENS.iron,
          lineHeight: 1.5,
          fontFamily: TOKENS.fontBody,
        },
      },
      activeValue
    )
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
  isMobile = false,
  onToggleRead = () => {},
  onNavigateDaily = () => {},
}) {
  const suppressImpact = Boolean(item?.suppressImpactJudgment || item?.isRelatedSelfStock)
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
      'data-testid': 'news-article-card',
      style: {
        padding: '24px 0 16px',
        borderBottom: isLast ? 'none' : `1px solid ${TOKENS.boneDeep}`,
      },
    },
    h(
      'div',
      {
        'data-testid': 'news-article-row',
        style: {
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          gap: isMobile ? 12 : 16,
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
        },
      },
      h(
        'div',
        {
          'data-testid': 'news-article-main',
          style: { flex: 1, minWidth: isMobile ? 0 : 280 },
        },
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
          !suppressImpact &&
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
              fontSize: 14,
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
          'data-testid': 'news-article-rail',
          style: {
            width: isMobile ? '100%' : 170,
            flexShrink: isMobile ? 1 : 0,
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            justifyContent: isMobile ? 'space-between' : 'flex-start',
            alignItems: isMobile ? 'center' : 'flex-end',
            gap: 8,
          },
        },
        h(
          'div',
          {
            style: {
              width: isMobile ? '100%' : 'auto',
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
        !suppressImpact &&
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
                width: isMobile ? 'auto' : '100%',
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
  const isMobile = useIsMobile()
  const codesKey = useMemo(() => [...holdingCodes].sort().join(','), [holdingCodes])
  const requestHoldingCodes = useMemo(() => buildHoldingCodesFromKey(codesKey), [codesKey])
  const insiderCodes = useMemo(
    () => (viewMode === 'insider-compressed' ? requestHoldingCodes : []),
    [requestHoldingCodes, viewMode]
  )

  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [requestNonce, setRequestNonce] = useState(0)
  const [settledRequestKey, setSettledRequestKey] = useState('')
  const requestKey = `${codesKey}:${requestNonce}`
  const [sourceFilter, setSourceFilter] = useState('全部來源')
  const [impactFilter, setImpactFilter] = useState('全部影響')
  const [tickerFilter, setTickerFilter] = useState('全部持股')
  const [isMobileFilterCollapsed, setIsMobileFilterCollapsed] = useState(true)
  const [readIds, setReadIds] = useState(() => new Set())

  useEffect(() => {
    if (!codesKey) return undefined

    let active = true
    const cachedEntry = readNewsFeedRequestCache(requestKey)
    const requestEntry =
      cachedEntry && cachedEntry.status === 'pending'
        ? cachedEntry
        : cachedEntry || createNewsFeedRequest(requestKey, codesKey, requestHoldingCodes)

    const applyPayload = (payload) => {
      if (!active || !payload) return
      setError(payload.error || null)
      const nextItems =
        viewMode === 'insider-compressed'
          ? (payload.items || []).map((item) => normalizeInsiderNewsItem(item, insiderCodes))
          : payload.items || []
      setItems(nextItems)
      setSettledRequestKey(requestKey)
    }

    if (requestEntry.status === 'resolved') {
      applyPayload(requestEntry.payload)
      return () => {
        active = false
      }
    }

    requestEntry.promise.then((payload) => {
      applyPayload(payload)
    })

    return () => {
      active = false
    }
  }, [codesKey, insiderCodes, requestHoldingCodes, requestKey, viewMode])

  const sources = useMemo(
    () => ['全部來源', ...new Set(items.map((item) => normalizeSourceLabel(item.source)))],
    [items]
  )
  const impacts = ['全部影響', '利多', '利空', '中性']
  const tickers = useMemo(
    () => [
      '全部持股',
      ...new Set(
        items.flatMap((item) =>
          (item.relatedStocks || []).map((stock) => `${stock.code} ${stock.name}`)
        )
      ),
    ],
    [items]
  )

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const sourceLabel = normalizeSourceLabel(item.source)
        const impactLabel = IMPACT_COPY[inferImpact(item)]
        const itemTickers = (item.relatedStocks || []).map((stock) => `${stock.code} ${stock.name}`)
        const sourceOk = sourceFilter === '全部來源' || sourceFilter === sourceLabel
        const impactOk = impactFilter === '全部影響' || impactFilter === impactLabel
        const tickerOk = tickerFilter === '全部持股' || itemTickers.includes(tickerFilter)
        return sourceOk && impactOk && tickerOk
      }),
    [impactFilter, items, sourceFilter, tickerFilter]
  )

  const visibleItems = filteredItems
  const visibleItemCount = visibleItems.length
  const unreadCount = visibleItems.filter(
    (item, index) => !readIds.has(getItemId(item, index))
  ).length
  const showTickerSideNotes = isViewModeEnabled('showTickerSideNotes', viewMode)
  const aggregateClusters = useMemo(() => buildAggregateNewsClusters(visibleItems), [visibleItems])
  const showFilterBody = !isMobile || !isMobileFilterCollapsed
  const activeFilterCount = countActiveFilters({ sourceFilter, impactFilter, tickerFilter })
  const hasActiveFilters = activeFilterCount > 0
  const activeFilterSummary = buildActiveFilterSummary({ sourceFilter, impactFilter, tickerFilter })
  const loading = Boolean(codesKey) && settledRequestKey !== requestKey

  if (loading) {
    return h(
      Card,
      { style: { padding: '24px 16px' } },
      h('div', { style: { fontSize: 11, color: TOKENS.iron, marginBottom: 12 } }, '新聞脈絡整理中'),
      h(Skeleton, { variant: 'card', count: 2 })
    )
  }

  if (items.length === 0) return null

  const handleToggleRead = (item, index) => {
    const itemId = getItemId(item, index)
    setReadIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const handleResetFilters = () => {
    setSourceFilter(FILTER_DEFAULTS.source)
    setImpactFilter(FILTER_DEFAULTS.impact)
    setTickerFilter(FILTER_DEFAULTS.ticker)
  }

  const handleRetryNewsFeed = () => {
    setError(null)
    setRequestNonce((current) => current + 1)
  }

  const handleSourceFilterChange = (nextValue) => {
    setSourceFilter(nextValue)
  }

  const handleImpactFilterChange = (nextValue) => {
    setImpactFilter(nextValue)
  }

  const handleTickerFilterChange = (nextValue) => {
    setTickerFilter(nextValue)
  }

  const heroTitle = holdingCodes.length > 0 ? '這些新聞跟你組合有關' : '今天市場在說什麼'
  const mobileResultChipStyle = {
    background: hasActiveFilters ? alpha(TOKENS.warning, '26') : alpha(TOKENS.warning, '18'),
    border: `1px solid ${hasActiveFilters ? alpha(TOKENS.warning, '36') : alpha(TOKENS.warning, '24')}`,
    color: TOKENS.ink,
  }
  const baseFilterButtonStyle = (isSelected, tone) => ({
    minWidth: 44,
    minHeight: 44,
    borderRadius: 999,
    border: `1px solid ${isSelected ? alpha(tone, '2c') : TOKENS.boneDeep}`,
    background: isSelected ? alpha(tone, '12') : alpha(TOKENS.bone, 'ed'),
    color: TOKENS.ink,
    padding: '8px 12px',
    fontSize: 11,
    fontFamily: TOKENS.fontBody,
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
    boxShadow: isSelected && isMobile ? `0 0 0 1px ${alpha(tone, '14')}` : 'none',
  })
  const sideNotesBody = h(
    'div',
    {
      id: 'news-side-notes-body',
      'data-testid': 'news-side-notes-body',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 18 : 16,
      },
    },
    h(
      'div',
      { 'data-testid': 'news-filter-group-ticker' },
      renderFilterSectionHeading({
        title: showTickerSideNotes
          ? isMobile
            ? '持股篩選'
            : '依持股'
          : isMobile
            ? '組合摘要'
            : '組合摘要',
        activeValue: showTickerSideNotes ? tickerFilter : `${aggregateClusters.length} 個群組`,
        isMobile,
      }),
      showTickerSideNotes
        ? isMobile
          ? h(
              'div',
              {
                style: {
                  position: 'relative',
                },
              },
              h(
                'select',
                {
                  'data-testid': 'news-filter-ticker-select',
                  'aria-label': '依持股篩選新聞',
                  value: tickerFilter,
                  onChange: (event) => handleTickerFilterChange(event.target.value),
                  style: {
                    appearance: 'none',
                    width: '100%',
                    minHeight: 44,
                    borderRadius: 18,
                    border: `1px solid ${tickerFilter !== FILTER_DEFAULTS.ticker ? alpha(TOKENS.positive, '2c') : TOKENS.boneDeep}`,
                    background: alpha(TOKENS.bone, 'f7'),
                    color: TOKENS.ink,
                    padding: '10px 40px 10px 12px',
                    fontSize: 12,
                    fontFamily: TOKENS.fontBody,
                    fontVariantNumeric: 'tabular-nums',
                    outline: 'none',
                  },
                },
                ...tickers.map((option) => h('option', { key: option, value: option }, option))
              ),
              h(
                'span',
                {
                  'aria-hidden': 'true',
                  style: {
                    position: 'absolute',
                    top: '50%',
                    right: 14,
                    transform: 'translateY(-50%)',
                    color: TOKENS.iron,
                    fontSize: 11,
                    pointerEvents: 'none',
                  },
                },
                'v'
              )
            )
          : h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              ...tickers.map((option) =>
                h(
                  'button',
                  {
                    key: option,
                    type: 'button',
                    className: 'ui-btn',
                    onClick: () => handleTickerFilterChange(option),
                    style: baseFilterButtonStyle(option === tickerFilter, TOKENS.positive),
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
      { 'data-testid': 'news-filter-group-source' },
      renderFilterSectionHeading({
        title: isMobile ? '來源篩選' : '依來源',
        activeValue: sourceFilter,
        isMobile,
      }),
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
              onClick: () => handleSourceFilterChange(option),
              style: baseFilterButtonStyle(option === sourceFilter, TOKENS.warning),
            },
            option
          )
        )
      )
    ),
    h(
      'div',
      { 'data-testid': 'news-filter-group-impact' },
      renderFilterSectionHeading({
        title: isMobile ? '影響篩選' : '依影響',
        activeValue: impactFilter,
        isMobile,
      }),
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
                onClick: () => handleImpactFilterChange(option),
                style: baseFilterButtonStyle(option === impactFilter, tone),
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
          padding: isMobile ? '10px 12px' : '12px 12px',
          borderRadius: isMobile ? 18 : TOKENS.radii.lg,
          background: alpha(TOKENS.warning, '12'),
          border: `1px solid ${alpha(TOKENS.warning, '20')}`,
          color: TOKENS.ink,
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
          null,
          h(
            'div',
            {
              style: {
                fontSize: isMobile ? 10 : 11,
                color: TOKENS.iron,
                marginBottom: isMobile ? 2 : 4,
              },
            },
            '閱讀狀態'
          ),
          isMobile &&
            h(
              'div',
              {
                style: {
                  fontSize: 11,
                  color: TOKENS.charcoal,
                  lineHeight: 1.6,
                },
              },
              unreadCount > 0 ? '先標已看，再交給 Daily 判讀。' : '這輪都已經標記已看。'
            )
        ),
        renderChip(`未讀 ${unreadCount} 則`, {
          background: alpha(TOKENS.warning, '18'),
          color: TOKENS.ink,
          border: `1px solid ${alpha(TOKENS.warning, '28')}`,
        })
      )
    ),
    h(
      'div',
      {
        style: {
          padding: isMobile ? '10px 12px' : '12px',
          borderRadius: isMobile ? 18 : TOKENS.radii.lg,
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
        renderChip(isMobile ? '今日摘要' : '今日趨勢摘要', {
          background: alpha(TOKENS.positive, '18'),
          border: `1px solid ${alpha(TOKENS.positive, '24')}`,
          color: TOKENS.ink,
        })
      ),
      h(
        'div',
        {
          style: {
            fontSize: isMobile ? 12 : 14,
            lineHeight: 1.7,
            color: TOKENS.ink,
            fontFamily: TOKENS.fontBody,
          },
        },
        buildTrendSummary(visibleItems)
      )
    )
  )

  return h(
    'div',
    {
      'data-testid': 'news-layout',
      style: {
        display: 'grid',
        gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.9fr) minmax(280px, 0.9fr)',
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
          onRetry: handleRetryNewsFeed,
          style: { marginBottom: 12 },
        }),
      h(
        Card,
        {
          style: {
            marginBottom: 16,
            padding: isMobile ? '20px 18px' : '24px 24px',
            borderRadius: 16,
            border: `1px solid ${TOKENS.boneDeep}`,
            background: alpha(TOKENS.bone, 'fa'),
            position: 'relative',
            overflow: 'hidden',
          },
        },
        h('div', {
          style: {
            position: 'absolute',
            inset: 0,
            background: alpha(TOKENS.charcoal, '04'),
            opacity: 0.38,
            pointerEvents: 'none',
          },
        }),
        h(
          'div',
          {
            'data-testid': 'news-hero-grid',
            style: {
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
              gap: isMobile ? 12 : 16,
              alignItems: isMobile ? 'start' : 'end',
            },
          },
          h(
            'div',
            null,
            h('div', { style: { ...lbl, color: TOKENS.iron, marginBottom: 8 } }, '新聞脈絡'),
            h(
              'div',
              {
                'data-testid': 'news-hero-title',
                style: {
                  fontFamily: TOKENS.fontSection,
                  fontSize: isMobile ? 'clamp(20px, 5vw, 28px)' : 52,
                  lineHeight: 1.04,
                  color: TOKENS.ink,
                  maxWidth: isMobile ? '100%' : 520,
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
              'Google News RSS 與 FinMind 新聞會先進來，先標已看、先整理重點，再交給 Daily 判讀，不在這頁直接升格成事件。'
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
              renderChip(`${visibleItemCount} 則相關新聞`, {
                ...(isMobile
                  ? mobileResultChipStyle
                  : {
                      background: alpha(TOKENS.warning, '18'),
                      border: `1px solid ${alpha(TOKENS.warning, '24')}`,
                      color: TOKENS.ink,
                    }),
              }),
              renderChip(`持股範圍：${holdingCodes.length || '自動'} 檔`, {
                background: alpha(TOKENS.bone, 'f0'),
                border: `1px solid ${TOKENS.boneDeep}`,
                color: TOKENS.charcoal,
              }),
              isMobile &&
                renderChip(`今日 ${visibleItemCount} 則`, {
                  background: alpha(TOKENS.charcoal, '06'),
                  border: `1px solid ${TOKENS.boneDeep}`,
                  color: TOKENS.iron,
                }),
              isMobile &&
                renderChip(`未讀 ${unreadCount} 則`, {
                  background: alpha(TOKENS.warning, '12'),
                  border: `1px solid ${alpha(TOKENS.warning, '20')}`,
                  color: TOKENS.ink,
                })
            )
          ),
          !isMobile &&
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
                '今日'
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
                visibleItemCount
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
                '目前相關新聞'
              )
            )
        )
      ),
      h(
        Card,
        {
          style: {
            borderRadius: 16,
            padding: '0 24px',
            border: `1px solid ${TOKENS.boneDeep}`,
            background: alpha(TOKENS.bone, 'f7'),
            overflow: 'hidden',
          },
        },
        visibleItems.map((item, i) =>
          h(NewsFeedCard, {
            key: getItemId(item, i),
            item,
            isRead: readIds.has(getItemId(item, i)),
            isLast: i === visibleItems.length - 1,
            isMobile,
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
          'data-testid': 'news-side-notes',
          style: {
            borderRadius: 16,
            padding: '16px 16px 16px',
            border: `1px solid ${TOKENS.boneDeep}`,
            background: alpha(TOKENS.bone, 'f5'),
            position: isMobile ? 'static' : 'sticky',
            top: isMobile ? 'auto' : 16,
          },
        },
        isMobile
          ? h(
              'div',
              {
                style: {
                  display: 'grid',
                  gap: 10,
                  marginBottom: showFilterBody ? 12 : 0,
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                  },
                },
                h(
                  'div',
                  {
                    style: {
                      display: 'grid',
                      gap: 6,
                      flex: 1,
                      minWidth: 0,
                    },
                  },
                  h(
                    'div',
                    { style: { ...lbl, color: TOKENS.iron, marginBottom: 0 } },
                    '篩選與側欄'
                  ),
                  h(
                    'div',
                    {
                      style: {
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      },
                    },
                    renderChip(`${visibleItemCount} 則`, mobileResultChipStyle),
                    renderChip(hasActiveFilters ? `${activeFilterCount} 個篩選中` : '預設狀態', {
                      background: hasActiveFilters
                        ? alpha(TOKENS.positive, '12')
                        : alpha(TOKENS.bone, 'f0'),
                      border: `1px solid ${hasActiveFilters ? alpha(TOKENS.positive, '24') : TOKENS.boneDeep}`,
                      color: hasActiveFilters ? TOKENS.ink : TOKENS.charcoal,
                    })
                  ),
                  h(
                    'div',
                    {
                      'data-testid': 'news-filter-summary',
                      style: {
                        fontSize: 11,
                        color: TOKENS.charcoal,
                        lineHeight: 1.6,
                        fontFamily: TOKENS.fontBody,
                      },
                    },
                    activeFilterSummary
                  )
                ),
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    },
                  },
                  showFilterBody &&
                    h(
                      Button,
                      {
                        type: 'button',
                        size: 'xs',
                        disabled: !hasActiveFilters,
                        onClick: handleResetFilters,
                        style: {
                          textTransform: 'none',
                        },
                      },
                      '全部清除'
                    ),
                  h(
                    Button,
                    {
                      'data-testid': 'news-filter-toggle',
                      type: 'button',
                      size: 'xs',
                      'aria-expanded': showFilterBody,
                      'aria-controls': 'news-side-notes-body',
                      onClick: () => setIsMobileFilterCollapsed((collapsed) => !collapsed),
                      style: {
                        textTransform: 'none',
                        background: hasActiveFilters
                          ? alpha(TOKENS.warning, '18')
                          : alpha(TOKENS.bone, 'ef'),
                        border: `1px solid ${hasActiveFilters ? alpha(TOKENS.warning, '32') : TOKENS.boneDeep}`,
                        color: TOKENS.ink,
                      },
                    },
                    h(
                      'span',
                      {
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        },
                      },
                      h('span', null, showFilterBody ? '收起篩選' : '看篩選'),
                      h(
                        'span',
                        { 'aria-hidden': 'true', style: { fontSize: 11, color: TOKENS.iron } },
                        showFilterBody ? '^' : 'v'
                      )
                    )
                  )
                )
              )
            )
          : h('div', { style: { ...lbl, color: TOKENS.iron, marginBottom: 8 } }, '篩選與側欄'),
        showFilterBody ? sideNotesBody : null
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
            borderRadius: 16,
            border: `1px solid ${TOKENS.boneDeep}`,
            background: alpha(TOKENS.bone, 'fa'),
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
          '新聞脈絡'
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
          '這頁先整理新聞脈絡，再交給 Daily 判讀影響。加入持股後，依持股篩選、影響標記與已看機制都會一起啟用。'
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
