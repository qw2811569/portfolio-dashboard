import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CANONICAL_PORTFOLIO_TAB } from '../constants.js'
import { APP_LABELS } from '../lib/appMessages.js'
import { createDefaultReviewForm } from '../lib/eventUtils.js'
import { buildPortfolioTabs } from '../lib/navigationTabs.js'
import {
  readActivePortfolioIdForTabPersistence,
  readPersistedTabForPortfolio,
  writePersistedTabForPortfolio,
} from '../lib/tabPersistence.js'

const PATH_DRIVEN_TAB_KEYS = new Set(
  buildPortfolioTabs()
    .map((tab) => tab?.k)
    .filter((key) => key && key !== 'overview')
)

function readDetailStockCodeFromWindow() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const code = String(params.get('stock') || '').trim()
  return code || null
}

function readPathDrivenTabFromWindow() {
  if (typeof window === 'undefined') return null
  const pathSegments = window.location.pathname.split('/').filter(Boolean)
  const lastSegment = String(pathSegments[pathSegments.length - 1] || '').trim()
  return PATH_DRIVEN_TAB_KEYS.has(lastSegment) ? lastSegment : null
}

function writeDetailStockCodeToWindow(nextCode, { replace = false } = {}) {
  if (typeof window === 'undefined') return

  const normalizedCode = String(nextCode || '').trim()
  const params = new URLSearchParams(window.location.search)
  if (normalizedCode) params.set('stock', normalizedCode)
  else params.delete('stock')

  const search = params.toString()
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`
  const historyMethod = replace ? 'replaceState' : 'pushState'
  window.history[historyMethod](window.history.state, '', nextUrl)
}

export function useAppShellUiState({ resetTradeCaptureRef = null } = {}) {
  const initialPortfolioId = readActivePortfolioIdForTabPersistence()
  const initialDetailStockCode = readDetailStockCodeFromWindow()
  const initialPathDrivenTab = readPathDrivenTabFromWindow()
  const activePortfolioIdRef = useRef(initialPortfolioId)
  const detailStockCodeRef = useRef(initialDetailStockCode)
  const [tab, setRawTab] = useState(() => {
    if (initialDetailStockCode) return 'holdings'
    if (initialPathDrivenTab) return initialPathDrivenTab
    return readPersistedTabForPortfolio(initialPortfolioId)
  })
  const [sortBy, setSortBy] = useState('value')
  const [scanQuery, setScanQuery] = useState('')
  const [scanFilter, setScanFilter] = useState(APP_LABELS.allFilter)
  const [filterType, setFilterType] = useState(APP_LABELS.allFilter)
  const [catalystFilter, setCatalystFilter] = useState('全部')
  const [showReversal, setShowReversal] = useState(false)
  const [dailyExpanded, setDailyExpanded] = useState(false)
  const [expandedStock, setExpandedStock] = useState(null)
  const [detailStockCode, setRawDetailStockCode] = useState(initialDetailStockCode)
  const [expandedNews, setExpandedNews] = useState(new Set())
  const [reviewingEvent, setReviewingEvent] = useState(null)
  const [reviewForm, setReviewForm] = useState(() => createDefaultReviewForm())
  const [relayPlanExpanded, setRelayPlanExpanded] = useState(false)
  const [researchTarget, setResearchTarget] = useState(null)
  const [researchResults, setResearchResults] = useState(null)

  const setTab = useCallback((nextTab) => {
    if (!nextTab) return
    setRawTab(nextTab)
    writePersistedTabForPortfolio(activePortfolioIdRef.current, nextTab)
  }, [])

  const restoreTabForPortfolio = useCallback((portfolioId) => {
    activePortfolioIdRef.current = portfolioId || readActivePortfolioIdForTabPersistence()
    const nextDetailStockCode = readDetailStockCodeFromWindow()
    const nextPathDrivenTab = readPathDrivenTabFromWindow()
    if (nextDetailStockCode) {
      setRawTab('holdings')
      return
    }
    if (nextPathDrivenTab) {
      setRawTab(nextPathDrivenTab)
      return
    }
    setRawTab(readPersistedTabForPortfolio(activePortfolioIdRef.current))
  }, [])

  const setDetailStockCode = useCallback((nextCode, { replace = false } = {}) => {
    const normalizedCode = String(nextCode || '').trim() || null
    if (detailStockCodeRef.current === normalizedCode) return
    detailStockCodeRef.current = normalizedCode
    setRawDetailStockCode(normalizedCode)
    writeDetailStockCodeToWindow(normalizedCode, { replace })
    if (normalizedCode) setRawTab('holdings')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      const nextDetailStockCode = readDetailStockCodeFromWindow()
      const nextPathDrivenTab = readPathDrivenTabFromWindow()

      detailStockCodeRef.current = nextDetailStockCode
      setRawDetailStockCode(nextDetailStockCode)

      if (nextDetailStockCode) {
        setRawTab('holdings')
        return
      }

      if (nextPathDrivenTab) {
        setRawTab(nextPathDrivenTab)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const resetTransientUiState = useCallback(
    ({ resetTab = false } = {}) => {
      resetTradeCaptureRef?.current?.()
      setDailyExpanded(false)
      setExpandedStock(null)
      detailStockCodeRef.current = null
      setRawDetailStockCode(null)
      setExpandedNews(new Set())
      setReviewingEvent(null)
      setReviewForm(createDefaultReviewForm())
      setResearchTarget(null)
      setResearchResults(null)
      setRelayPlanExpanded(false)
      setCatalystFilter('全部')
      writeDetailStockCodeToWindow(null, { replace: true })
      if (resetTab) setRawTab(DEFAULT_CANONICAL_PORTFOLIO_TAB)
    },
    [resetTradeCaptureRef]
  )

  return {
    tab,
    setTab,
    restoreTabForPortfolio,
    sortBy,
    setSortBy,
    scanQuery,
    setScanQuery,
    scanFilter,
    setScanFilter,
    filterType,
    setFilterType,
    catalystFilter,
    setCatalystFilter,
    showReversal,
    setShowReversal,
    dailyExpanded,
    setDailyExpanded,
    expandedStock,
    setExpandedStock,
    detailStockCode,
    setDetailStockCode,
    expandedNews,
    setExpandedNews,
    reviewingEvent,
    setReviewingEvent,
    reviewForm,
    setReviewForm,
    relayPlanExpanded,
    setRelayPlanExpanded,
    researchTarget,
    setResearchTarget,
    researchResults,
    setResearchResults,
    resetTransientUiState,
  }
}
