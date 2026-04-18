import { useEffect, useMemo, useState } from 'react'
import { useHoldingsStore } from '../stores/holdingsStore.js'
import { useEventStore } from '../stores/eventStore.js'

const MOBILE_MEDIA_QUERY = '(max-width: 768px)'

function getIsMobileViewport() {
  const isMobile =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches

  return isMobile
}

function isCmdKShortcut(event) {
  return (event.metaKey || event.ctrlKey) && String(event.key || '').toLowerCase() === 'k'
}

const PANEL_ITEMS = [
  {
    key: 'overview',
    label: '總覽',
    keywords: 'overview dashboard kpi concentration 總覽 總表 指標 集中度',
  },
  { key: 'holdings', label: '持股', keywords: 'holdings 持股 持倉 部位 股票' },
  { key: 'watchlist', label: '觀察股', keywords: 'watchlist 觀察股 追蹤 清單' },
  { key: 'events', label: '催化驗證', keywords: 'events 催化 事件 驗證 calendar 行事曆' },
  { key: 'news', label: '情報脈絡', keywords: 'news 情報 新聞 脈絡' },
  { key: 'daily', label: '收盤分析', keywords: 'daily 收盤 分析 kpi 日報' },
  { key: 'research', label: '深度研究', keywords: 'research 研究 報告 dossier' },
  { key: 'trade', label: '上傳成交', keywords: 'trade 成交 上傳 匯入 交易' },
  { key: 'log', label: '交易日誌', keywords: 'log journal diary 交易 日誌 記錄' },
]

const SOURCE_LABELS = {
  holding: '持股',
  tab: '頁面',
  event: '事件',
  command: '指令',
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

function scoreMatch(query, haystack) {
  if (!query) return 1

  const normalizedQuery = normalize(query)
  const normalizedHaystack = normalize(haystack)
  if (!normalizedQuery || !normalizedHaystack) return 0

  if (normalizedHaystack === normalizedQuery) return 120
  if (normalizedHaystack.startsWith(normalizedQuery)) return 90
  if (normalizedHaystack.includes(normalizedQuery)) return 70

  let position = 0
  let matched = 0
  for (const char of normalizedQuery) {
    const nextIndex = normalizedHaystack.indexOf(char, position)
    if (nextIndex === -1) return 0
    matched += 1
    position = nextIndex + 1
  }

  return matched === normalizedQuery.length ? 40 - Math.min(position, 20) : 0
}

function parseEventDate(rawValue) {
  const raw = String(rawValue || '').trim()
  const matched = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (!matched) return null
  const value = `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}T00:00:00`
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isWithinThirtyDayWindow(date) {
  if (!(date instanceof Date)) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - 30)
  const end = new Date(today)
  end.setDate(today.getDate() + 30)
  return date >= start && date <= end
}

function findElementByText(root, patterns) {
  if (!root || !Array.isArray(patterns) || patterns.length === 0) return null

  const normalizedPatterns = patterns.map(normalize).filter(Boolean)
  if (normalizedPatterns.length === 0) return null

  const allElements = Array.from(root.querySelectorAll('*'))
  let bestMatch = null

  for (const element of allElements) {
    const text = normalize(element.textContent)
    if (!text) continue
    const matches = normalizedPatterns.every((pattern) => text.includes(pattern))
    if (!matches) continue

    if (!bestMatch || text.length < bestMatch.text.length) {
      bestMatch = { element, text }
    }
  }

  return bestMatch?.element || null
}

function scrollTargetIntoView(target) {
  if (!target || typeof target.scrollIntoView !== 'function') return false
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  if (typeof target.focus === 'function') {
    try {
      target.focus({ preventScroll: true })
    } catch {
      target.focus()
    }
  }
  return true
}

export function useCmdK({ headerProps = {}, panelsActions = {}, panelRootRef = null }) {
  const holdings = useHoldingsStore((state) => state.holdings)
  const newsEvents = useEventStore((state) => state.newsEvents)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport())

  const setTab = headerProps.setTab
  const openOverview = headerProps.openOverview
  const setExpandedStock = panelsActions?.holdingsTable?.setExpandedStock

  const scheduleScroll = (resolver, attempts = 8) => {
    let remaining = attempts

    const tick = () => {
      const root = panelRootRef?.current || document.body
      const target = resolver(root)
      if (scrollTargetIntoView(target) || remaining <= 0) return
      remaining -= 1
      window.setTimeout(() => window.requestAnimationFrame(tick), 60)
    }

    window.requestAnimationFrame(tick)
  }

  const scrollToSelector = (selector) => {
    scheduleScroll((root) => root?.querySelector?.(selector) || null)
  }

  const dispatchCommand = (id, label) => {
    window.dispatchEvent(new CustomEvent('cmdk:command', { detail: { id, label } }))
  }

  const commandItems = useMemo(
    () =>
      [
        {
          key: 'recompute-kpi',
          label: '重新計算 KPI',
          subtitle: '先切到總覽，後續 action 先用 stub event',
          keywords: '重新計算 kpi recompute refresh metrics 總覽',
        },
        {
          key: 'show-concentration',
          label: '顯示集中度',
          subtitle: '切到總覽並捲到集中度區塊',
          keywords: 'concentration hhi 集中度 風險 總覽',
        },
        {
          key: 'open-research',
          label: '打開研究頁',
          subtitle: '切到深度研究',
          keywords: 'research 研究 報告',
        },
        {
          key: 'open-daily',
          label: '打開收盤分析',
          subtitle: '切到收盤分析',
          keywords: 'daily 收盤 分析',
        },
        {
          key: 'open-events',
          label: '打開事件頁',
          subtitle: '切到催化驗證',
          keywords: 'events 事件 催化',
        },
        {
          key: 'open-holdings',
          label: '打開持倉頁',
          subtitle: '切到持股清單',
          keywords: 'holdings 持股 持倉',
        },
      ].map((item) => ({
        id: `command:${item.key}`,
        type: 'command',
        source: SOURCE_LABELS.command,
        title: item.label,
        subtitle: item.subtitle,
        keywords: item.keywords,
        payload: { key: item.key },
      })),
    []
  )

  const allItems = useMemo(() => {
    const holdingItems = (Array.isArray(holdings) ? holdings : []).map((holding) => ({
      id: `holding:${holding.code}`,
      type: 'holding',
      source: SOURCE_LABELS.holding,
      title: `${holding.code} ${holding.name || ''}`.trim(),
      subtitle: holding.name || '未命名持股',
      keywords: `${holding.code} ${holding.name || ''} holding stock`,
      payload: {
        code: String(holding.code || '').trim(),
        name: String(holding.name || '').trim(),
      },
    }))

    const tabItems = PANEL_ITEMS.map((tab) => ({
      id: `tab:${tab.key}`,
      type: 'tab',
      source: SOURCE_LABELS.tab,
      title: tab.label,
      subtitle: `切換到${tab.label}`,
      keywords: `${tab.keywords} ${tab.label}`,
      payload: tab,
    }))

    const eventItems = (Array.isArray(newsEvents) ? newsEvents : [])
      .filter((event) => isWithinThirtyDayWindow(parseEventDate(event?.date || event?.eventDate)))
      .map((event, index) => ({
        id: `event:${event.id ?? index}`,
        type: 'event',
        source: SOURCE_LABELS.event,
        title: event.label || event.title || '未命名事件',
        subtitle: [
          event.date || event.eventDate,
          Array.isArray(event.stocks) ? event.stocks.join('、') : '',
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: `${event.label || ''} ${event.title || ''} ${event.detail || ''} ${(event.stocks || []).join(' ')}`,
        payload: {
          title: event.label || event.title || '未命名事件',
        },
      }))

    return [...holdingItems, ...tabItems, ...eventItems, ...commandItems]
  }, [commandItems, holdings, newsEvents])

  const results = useMemo(() => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return allItems
    }

    return allItems
      .map((item) => ({
        ...item,
        matchScore: Math.max(
          scoreMatch(trimmedQuery, item.title),
          scoreMatch(trimmedQuery, item.keywords)
        ),
      }))
      .filter((item) => item.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title, 'zh-Hant'))
  }, [allItems, query])

  const resolvedActiveIndex = results.length ? Math.min(activeIndex, results.length - 1) : 0

  const closePalette = () => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  const openPalette = () => {
    setOpen(true)
    setQuery('')
    setActiveIndex(0)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)

    updateIsMobile()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateIsMobile)
      return () => mediaQuery.removeEventListener('change', updateIsMobile)
    }

    mediaQuery.addListener(updateIsMobile)
    return () => mediaQuery.removeListener(updateIsMobile)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleOpenRequest = () => {
      setOpen(true)
      setQuery('')
      setActiveIndex(0)
    }

    window.addEventListener('cmdk:open', handleOpenRequest)
    return () => window.removeEventListener('cmdk:open', handleOpenRequest)
  }, [])

  const togglePalette = () => {
    if (open) {
      closePalette()
      return
    }
    openPalette()
  }

  const moveSelection = (delta) => {
    if (!results.length) return
    setActiveIndex((current) => {
      const next = current + delta
      if (next < 0) return results.length - 1
      if (next >= results.length) return 0
      return next
    })
  }

  const handleQueryChange = (value) => {
    setQuery(value)
    setActiveIndex(0)
  }

  const executeItem = (item) => {
    if (!item) return

    if (item.type === 'tab') {
      closePalette()
      if (item.payload?.key === 'overview') {
        openOverview?.()
      } else {
        setTab?.(item.payload?.key)
      }
      return
    }

    if (item.type === 'holding') {
      closePalette()
      setTab?.('holdings')
      if (item.payload?.code) setExpandedStock?.(item.payload.code)
      scheduleScroll(
        (root) =>
          findElementByText(root, [item.payload?.code, item.payload?.name].filter(Boolean)) ||
          findElementByText(root, [item.payload?.code].filter(Boolean))
      )
      return
    }

    if (item.type === 'event') {
      closePalette()
      setTab?.('events')
      scheduleScroll((root) => findElementByText(root, [item.payload?.title].filter(Boolean)))
      return
    }

    if (item.type === 'command') {
      closePalette()

      switch (item.payload?.key) {
        case 'recompute-kpi':
          openOverview?.()
          dispatchCommand('recompute-kpi', '重新計算 KPI')
          return
        case 'show-concentration':
          openOverview?.()
          dispatchCommand('show-concentration', '顯示集中度')
          scrollToSelector('[data-testid="concentration-dashboard"]')
          return
        case 'open-research':
          setTab?.('research')
          return
        case 'open-daily':
          setTab?.('daily')
          return
        case 'open-events':
          setTab?.('events')
          return
        case 'open-holdings':
          setTab?.('holdings')
          return
        default:
          return
      }
    }

    closePalette()
  }

  const handleGlobalKeyDown = (event) => {
    if (isCmdKShortcut(event)) {
      if (isMobile) return
      event.preventDefault()
      togglePalette()
      return
    }

    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
    }
  }

  const handleInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      executeItem(results[resolvedActiveIndex])
    }
  }

  return {
    open,
    query,
    results,
    activeIndex: resolvedActiveIndex,
    setQuery: handleQueryChange,
    setActiveIndex,
    openPalette,
    closePalette,
    togglePalette,
    handleGlobalKeyDown,
    onInputKeyDown: handleInputKeyDown,
    onSelectItem: executeItem,
  }
}
