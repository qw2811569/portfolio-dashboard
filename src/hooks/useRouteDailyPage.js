import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRunStressTest } from './api/useAnalysis.js'
import { useBrainStore } from '../stores/brainStore.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteDailyPage() {
  const navigate = useNavigate()
  const {
    portfolioId = 'me',
    dailyReport,
    analysisHistory = [],
    newsEvents = [],
    strategyBrain = null,
    staleStatus = 'fresh',
    operatingContext = null,
    maybeAutoConfirmDailyReport,
    analyzing: ctxAnalyzing,
    analyzeStep: ctxAnalyzeStep,
  } = usePortfolioRouteContext()

  const analyzing = ctxAnalyzing ?? false
  const analyzeStep = ctxAnalyzeStep ?? ''

  const [dailyExpanded, setDailyExpanded] = useState(false)
  const [stressResult, setStressResult] = useState(null)
  const [stressTesting, setStressTesting] = useState(false)
  const [expandedNews, setExpandedNews] = useState(() => new Set())
  const expandedStock = useBrainStore((state) => state.expandedStock)
  const setExpandedStock = useBrainStore((state) => state.setExpandedStock)

  const runStressTestMutation = useRunStressTest()

  const runDailyAnalysis = useCallback(async () => {
    warnBlockedRouteWrite('runDailyAnalysis')
  }, [])

  const runStressTest = useCallback(async () => {
    setStressTesting(true)
    try {
      const result = await runStressTestMutation.mutateAsync({ portfolioId })
      setStressResult(result)
    } catch (error) {
      console.error('Stress test failed:', error)
    } finally {
      setStressTesting(false)
    }
  }, [portfolioId, runStressTestMutation])

  return useMemo(
    () => ({
      dailyReport,
      analysisHistory,
      analyzing,
      analyzeStep,
      stressResult,
      stressTesting,
      dailyExpanded,
      setDailyExpanded,
      runDailyAnalysis,
      runStressTest,
      closeStressResult: () => setStressResult(null),
      newsEvents,
      setTab: (tab) => navigate(`/portfolio/${portfolioId}/${tab}`),
      setExpandedNews,
      expandedNews,
      expandedStock,
      setExpandedStock,
      strategyBrain,
      staleStatus,
      operatingContext,
      maybeAutoConfirmDailyReport,
    }),
    [
      analysisHistory,
      analyzeStep,
      analyzing,
      dailyExpanded,
      dailyReport,
      expandedNews,
      expandedStock,
      maybeAutoConfirmDailyReport,
      navigate,
      newsEvents,
      operatingContext,
      portfolioId,
      runDailyAnalysis,
      runStressTest,
      setExpandedStock,
      staleStatus,
      strategyBrain,
      stressResult,
      stressTesting,
    ]
  )
}
