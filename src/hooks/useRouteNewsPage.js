import { useCallback, useMemo, useState } from 'react'
import { createDefaultReviewForm as createDefaultReviewFormFallback } from '../lib/eventUtils.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteNewsPage() {
  const { newsEvents = [], createDefaultReviewForm = createDefaultReviewFormFallback } =
    usePortfolioRouteContext()

  const [reviewingEvent, setReviewingEvent] = useState(null)
  const [reviewForm, setReviewForm] = useState(() => createDefaultReviewForm())
  const [expandedNews, setExpandedNews] = useState(() => new Set())

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
      reviewingEvent,
      reviewForm,
      setReviewForm,
      submitReview,
      cancelReview,
      setExpandedNews,
      expandedNews,
      setReviewingEvent,
      createDefaultReviewForm,
    }),
    [
      cancelReview,
      createDefaultReviewForm,
      expandedNews,
      newsEvents,
      reviewForm,
      reviewingEvent,
      submitReview,
    ]
  )
}
