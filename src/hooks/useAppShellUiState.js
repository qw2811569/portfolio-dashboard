import { useCallback, useRef, useState } from 'react'
import { DEFAULT_CANONICAL_PORTFOLIO_TAB } from '../constants.js'
import { APP_LABELS } from '../lib/appMessages.js'
import { createDefaultReviewForm } from '../lib/eventUtils.js'
import {
  readActivePortfolioIdForTabPersistence,
  readPersistedTabForPortfolio,
  writePersistedTabForPortfolio,
} from '../lib/tabPersistence.js'

export function useAppShellUiState({ resetTradeCaptureRef = null } = {}) {
  const initialPortfolioId = readActivePortfolioIdForTabPersistence()
  const activePortfolioIdRef = useRef(initialPortfolioId)
  const [tab, setRawTab] = useState(() => readPersistedTabForPortfolio(initialPortfolioId))
  const [sortBy, setSortBy] = useState('value')
  const [scanQuery, setScanQuery] = useState('')
  const [scanFilter, setScanFilter] = useState(APP_LABELS.allFilter)
  const [filterType, setFilterType] = useState(APP_LABELS.allFilter)
  const [catalystFilter, setCatalystFilter] = useState('全部')
  const [showReversal, setShowReversal] = useState(false)
  const [dailyExpanded, setDailyExpanded] = useState(false)
  const [expandedStock, setExpandedStock] = useState(null)
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
    setRawTab(readPersistedTabForPortfolio(activePortfolioIdRef.current))
  }, [])

  const resetTransientUiState = useCallback(
    ({ resetTab = false } = {}) => {
      resetTradeCaptureRef?.current?.()
      setDailyExpanded(false)
      setExpandedStock(null)
      setExpandedNews(new Set())
      setReviewingEvent(null)
      setReviewForm(createDefaultReviewForm())
      setResearchTarget(null)
      setResearchResults(null)
      setRelayPlanExpanded(false)
      setCatalystFilter('全部')
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
