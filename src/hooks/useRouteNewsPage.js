import { useCallback, useMemo, useState } from 'react'
import { createDefaultReviewForm as createDefaultReviewFormFallback } from '../lib/eventUtils.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'
import { resolveViewMode } from '../lib/viewModeContract.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteNewsPage() {
  const {
    portfolioId = 'me',
    portfolioName = '',
    newsEvents = [],
    holdings = [],
    holdingCodes = [],
    operatingContext = null,
    createDefaultReviewForm = createDefaultReviewFormFallback,
  } = usePortfolioRouteContext()

  const [reviewingEvent, setReviewingEvent] = useState(null)
  const [reviewForm, setReviewForm] = useState(() => createDefaultReviewForm())
  const [expandedNews, setExpandedNews] = useState(() => new Set())
  const resolvedHoldingCodes = useMemo(
    () =>
      Array.isArray(holdingCodes) && holdingCodes.length > 0
        ? holdingCodes
        : Array.isArray(holdings)
          ? holdings.map((item) => item?.code).filter(Boolean)
          : [],
    [holdingCodes, holdings]
  )
  const viewMode = resolveViewMode({
    portfolio: {
      id: portfolioId,
      name: portfolioName,
      displayName: portfolioName,
      isOwner: portfolioId === 'me',
    },
    currentUser: 'me',
  })

  const resetReview = useCallback(() => {
    setReviewingEvent(null)
    setReviewForm(createDefaultReviewForm())
  }, [createDefaultReviewForm])

  const submitReview = useCallback(() => {
    if (!reviewingEvent) return
    warnBlockedRouteWrite('updateEvent')
  }, [reviewingEvent])

  const cancelReview = useCallback(() => {
    resetReview()
  }, [resetReview])

  return useMemo(
    () => ({
      newsEvents,
      holdingCodes: resolvedHoldingCodes,
      operatingContext,
      reviewingEvent,
      reviewForm,
      setReviewForm,
      submitReview,
      cancelReview,
      setExpandedNews,
      expandedNews,
      setReviewingEvent,
      createDefaultReviewForm,
      viewMode,
    }),
    [
      cancelReview,
      createDefaultReviewForm,
      expandedNews,
      resolvedHoldingCodes,
      newsEvents,
      operatingContext,
      reviewForm,
      reviewingEvent,
      submitReview,
      viewMode,
    ]
  )
}
