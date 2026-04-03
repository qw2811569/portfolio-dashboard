import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()
const mockUseBrainStore = vi.fn()
const mockFilterEventsByType = vi.fn()

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

vi.mock('../../src/stores/brainStore.js', () => ({
  useBrainStore: (selector) => mockUseBrainStore(selector),
}))

vi.mock('../../src/lib/appShellRuntime.js', () => ({
  filterEventsByType: (args) => mockFilterEventsByType(args),
}))

vi.mock('../../src/seedData.js', () => ({
  NEWS_EVENTS: [{ id: 'seed-1', title: 'Seed Event' }],
}))

import { useRouteEventsPage } from '../../src/hooks/useRouteEventsPage.js'

describe('hooks/useRouteEventsPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupDefaults(newsEvents = [{ id: 'e1', title: 'Event 1', type: 'earnings' }]) {
    mockUsePortfolioRouteContext.mockReturnValue({
      newsEvents,
    })

    const setRelayPlanExpanded = vi.fn()
    mockUseBrainStore.mockImplementation((selector) => {
      return selector({ relayPlanExpanded: false, setRelayPlanExpanded })
    })

    mockFilterEventsByType.mockImplementation(({ newsEvents: events }) => events || [])

    return { setRelayPlanExpanded }
  }

  it('renders without crashing and returns correct props structure', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteEventsPage())

    expect(result.current).toHaveProperty('showRelayPlan', true)
    expect(result.current).toHaveProperty('relayPlanExpanded')
    expect(result.current).toHaveProperty('setRelayPlanExpanded')
    expect(result.current).toHaveProperty('filterType', '全部')
    expect(result.current).toHaveProperty('setFilterType')
    expect(result.current).toHaveProperty('filteredEvents')
  })

  it('calls filterEventsByType with correct arguments', () => {
    const events = [{ id: 'e1', title: 'Event 1', type: 'earnings' }]
    setupDefaults(events)

    renderHook(() => useRouteEventsPage())

    expect(mockFilterEventsByType).toHaveBeenCalledWith(
      expect.objectContaining({
        newsEvents: events,
        filterType: '全部',
      })
    )
    // fallbackEvents comes from NEWS_EVENTS seedData — just verify it's an array
    const callArgs = mockFilterEventsByType.mock.calls[0][0]
    expect(Array.isArray(callArgs.fallbackEvents)).toBe(true)
  })

  it('passes filtered events through', () => {
    const filtered = [{ id: 'e2', title: 'Filtered' }]
    setupDefaults()
    mockFilterEventsByType.mockReturnValue(filtered)

    const { result } = renderHook(() => useRouteEventsPage())

    expect(result.current.filteredEvents).toBe(filtered)
  })

  it('exposes relay plan state from brain store', () => {
    const { setRelayPlanExpanded } = setupDefaults()

    const { result } = renderHook(() => useRouteEventsPage())

    expect(result.current.relayPlanExpanded).toBe(false)
    expect(result.current.setRelayPlanExpanded).toBe(setRelayPlanExpanded)
  })
})
