import { useMemo, useState } from 'react'
import { useBrainStore } from '../stores/brainStore.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'
import { NEWS_EVENTS } from '../seedDataEvents.js'
import { filterEventsByType } from '../lib/appShellRuntime.js'

export function useRouteEventsPage() {
  const { newsEvents = [] } = usePortfolioRouteContext()
  const relayPlanExpanded = useBrainStore((state) => state.relayPlanExpanded)
  const setRelayPlanExpanded = useBrainStore((state) => state.setRelayPlanExpanded)
  const [filterType, setFilterType] = useState('全部')

  return useMemo(() => {
    const filteredEvents = filterEventsByType({
      newsEvents,
      fallbackEvents: NEWS_EVENTS,
      filterType,
    })

    return {
      showRelayPlan: true,
      relayPlanExpanded,
      setRelayPlanExpanded,
      filterType,
      setFilterType,
      filteredEvents,
    }
  }, [filterType, newsEvents, relayPlanExpanded, setRelayPlanExpanded])
}
