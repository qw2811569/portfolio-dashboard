import { useEffect, useMemo, useState } from 'react'
import {
  applyHoldingsFilterStateToSearchParams,
  buildHoldingsFilterModel,
  buildLegacyHoldingsFilterStateMirror,
  countActiveHoldingsFilters,
  createDefaultHoldingsFilterState,
  filterHoldingsByChipState,
  normalizeHoldingsFilterState,
  readHoldingsFilterStateFromSearch,
} from '../../lib/holdingsFilters.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { HoldingsPanel, HoldingsTable } from './index.js'
import HoldingsRightRail from './HoldingsRightRail.jsx'

const EMPTY_LIST = []
const EMPTY_SAVED_FILTERS = []
const SEARCH_DEBOUNCE_MS = 200

function resolveFilterSourceHoldings(tableHoldings, panelHoldings) {
  const safeTableHoldings = Array.isArray(tableHoldings) ? tableHoldings : null
  const safePanelHoldings = Array.isArray(panelHoldings) ? panelHoldings : null

  if (safeTableHoldings && (safeTableHoldings.length > 0 || !safePanelHoldings?.length)) {
    return safeTableHoldings
  }

  if (safePanelHoldings) return safePanelHoldings
  if (safeTableHoldings) return safeTableHoldings
  return EMPTY_LIST
}

function serializeFilterState(state) {
  const safeState = normalizeHoldingsFilterState(state)
  return {
    version: 2,
    intentKey: safeState.intentKey,
    filterGroups: {
      sector: safeState.filterGroups.sector,
      type: safeState.filterGroups.type,
      eventWindow: safeState.filterGroups.eventWindow,
      pnl: safeState.filterGroups.pnl,
      risk: safeState.filterGroups.risk,
    },
    ...buildLegacyHoldingsFilterStateMirror(safeState),
  }
}

function stripFilterState(state) {
  const serialized = serializeFilterState(state)
  return {
    version: serialized.version,
    intentKey: serialized.intentKey,
    filterGroups: serialized.filterGroups,
  }
}

function areFilterStatesEqual(left, right) {
  return JSON.stringify(stripFilterState(left)) === JSON.stringify(stripFilterState(right))
}

function normalizeSavedFilterEntry(raw, index) {
  const name = String(raw?.name || '').trim()
  if (!name) return null

  return {
    id: String(raw?.id || `saved-filter-${index}`),
    name,
    filterState: normalizeHoldingsFilterState(raw?.filterState || raw?.state || raw),
  }
}

function readSavedFilters(storageKey) {
  if (typeof window === 'undefined' || !window.localStorage || !storageKey)
    return EMPTY_SAVED_FILTERS

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return EMPTY_SAVED_FILTERS

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_SAVED_FILTERS
    return parsed.map(normalizeSavedFilterEntry).filter(Boolean)
  } catch {
    return EMPTY_SAVED_FILTERS
  }
}

function readFilterViewState({ activePortfolioId, storageKeyV2, legacyStorageKey }) {
  const defaultFilterState = createDefaultHoldingsFilterState()
  if (typeof window === 'undefined' || !window.localStorage) {
    return { filterState: defaultFilterState, searchQuery: '' }
  }

  const urlState = readHoldingsFilterStateFromSearch(window.location.search, {
    activePortfolioId,
  })
  if (urlState.hasFilterParams) {
    return {
      filterState: normalizeHoldingsFilterState(urlState.filterState),
      searchQuery: urlState.searchQuery,
    }
  }

  try {
    const rawV2 = storageKeyV2 ? window.localStorage.getItem(storageKeyV2) : ''
    if (rawV2) {
      return {
        filterState: normalizeHoldingsFilterState(JSON.parse(rawV2)),
        searchQuery: '',
      }
    }

    const rawLegacy = legacyStorageKey ? window.localStorage.getItem(legacyStorageKey) : ''
    if (rawLegacy) {
      return {
        filterState: normalizeHoldingsFilterState(JSON.parse(rawLegacy)),
        searchQuery: '',
      }
    }
  } catch {
    return { filterState: defaultFilterState, searchQuery: '' }
  }

  return { filterState: defaultFilterState, searchQuery: '' }
}

export default function HoldingsPanelChunk({ panelProps, tableProps }) {
  const isMobile = useIsMobile()
  const activePortfolioId = String(panelProps?.activePortfolioId || '').trim()
  const tableHoldings = tableProps?.holdings
  const panelHoldings = panelProps?.holdings
  const panelHoldingDossiers = panelProps?.holdingDossiers
  const panelNewsEvents = panelProps?.newsEvents
  const storageKeyV2 = activePortfolioId ? `pf-${activePortfolioId}-holdings-filters-v2` : ''
  const legacyStorageKey = activePortfolioId ? `pf-${activePortfolioId}-holdings-filters-v1` : ''
  const savedFiltersKey = activePortfolioId ? `pf-${activePortfolioId}-saved-filters-v1` : ''

  const initialViewState = useMemo(
    () => readFilterViewState({ activePortfolioId, storageKeyV2, legacyStorageKey }),
    [activePortfolioId, legacyStorageKey, storageKeyV2]
  )

  const [filterState, setFilterState] = useState(() => initialViewState.filterState)
  const [searchInput, setSearchInput] = useState(() => initialViewState.searchQuery)
  const [savedFilters, setSavedFilters] = useState(() => readSavedFilters(savedFiltersKey))
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    () => initialViewState.searchQuery
  )
  const [hydratedFilterStorageKey, setHydratedFilterStorageKey] = useState(storageKeyV2)
  const [hydratedSavedFiltersKey, setHydratedSavedFiltersKey] = useState(savedFiltersKey)

  useEffect(() => {
    const nextViewState = readFilterViewState({ activePortfolioId, storageKeyV2, legacyStorageKey })
    setFilterState(nextViewState.filterState)
    setSearchInput(nextViewState.searchQuery)
    setDebouncedSearchQuery(nextViewState.searchQuery)
    setHydratedFilterStorageKey(storageKeyV2)
  }, [activePortfolioId, legacyStorageKey, storageKeyV2])

  useEffect(() => {
    setSavedFilters(readSavedFilters(savedFiltersKey))
    setHydratedSavedFiltersKey(savedFiltersKey)
  }, [savedFiltersKey])

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearchQuery(String(searchInput || '').trim()),
      SEARCH_DEBOUNCE_MS
    )
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const safeFilterState = useMemo(() => normalizeHoldingsFilterState(filterState), [filterState])

  const filterModel = useMemo(() => {
    const safeHoldings = resolveFilterSourceHoldings(tableHoldings, panelHoldings)
    const safeHoldingDossiers = Array.isArray(panelHoldingDossiers)
      ? panelHoldingDossiers
      : EMPTY_LIST
    const safeNewsEvents = Array.isArray(panelNewsEvents) ? panelNewsEvents : EMPTY_LIST

    return buildHoldingsFilterModel({
      holdings: safeHoldings,
      holdingDossiers: safeHoldingDossiers,
      newsEvents: safeNewsEvents,
      state: safeFilterState,
      searchQuery: debouncedSearchQuery,
    })
  }, [
    debouncedSearchQuery,
    panelHoldingDossiers,
    panelHoldings,
    panelNewsEvents,
    safeFilterState,
    tableHoldings,
  ])

  const visibleHoldings = useMemo(
    () => filterHoldingsByChipState(filterModel.rows, safeFilterState, debouncedSearchQuery),
    [debouncedSearchQuery, filterModel.rows, safeFilterState]
  )

  const activeFilterCount = useMemo(
    () => countActiveHoldingsFilters(safeFilterState) + (debouncedSearchQuery ? 1 : 0),
    [debouncedSearchQuery, safeFilterState]
  )
  const hasActiveFilters = activeFilterCount > 0

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage || !storageKeyV2) return
    if (hydratedFilterStorageKey !== storageKeyV2) return

    window.localStorage.setItem(storageKeyV2, JSON.stringify(serializeFilterState(safeFilterState)))
    if (legacyStorageKey) {
      window.localStorage.setItem(
        legacyStorageKey,
        JSON.stringify(buildLegacyHoldingsFilterStateMirror(safeFilterState))
      )
    }
  }, [hydratedFilterStorageKey, legacyStorageKey, safeFilterState, storageKeyV2])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage || !savedFiltersKey) return
    if (hydratedSavedFiltersKey !== savedFiltersKey) return

    window.localStorage.setItem(
      savedFiltersKey,
      JSON.stringify(
        savedFilters.map((item) => ({
          id: item.id,
          name: item.name,
          filterState: stripFilterState(item.filterState),
        }))
      )
    )
  }, [hydratedSavedFiltersKey, savedFilters, savedFiltersKey])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nextParams = applyHoldingsFilterStateToSearchParams(
      new URLSearchParams(window.location.search),
      safeFilterState,
      debouncedSearchQuery,
      { activePortfolioId }
    )
    const nextSearch = nextParams.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
    if (nextUrl === currentUrl) return
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [activePortfolioId, debouncedSearchQuery, safeFilterState])

  const updateFilterState = (updater) => {
    setFilterState((current) =>
      normalizeHoldingsFilterState(updater(normalizeHoldingsFilterState(current)))
    )
  }

  const handleIntentChange = (intentKey) => {
    updateFilterState((current) => ({
      ...current,
      intentKey,
    }))
  }

  const handleGroupToggle = (groupKey, optionKey) => {
    updateFilterState((current) => {
      const currentValues = current.filterGroups?.[groupKey] || []
      const nextValues = currentValues.includes(optionKey)
        ? currentValues.filter((value) => value !== optionKey)
        : [...currentValues, optionKey]

      return {
        ...current,
        filterGroups: {
          ...current.filterGroups,
          [groupKey]: nextValues,
        },
      }
    })
  }

  const handleClearAll = () => {
    setFilterState(createDefaultHoldingsFilterState())
    setSearchInput('')
    setDebouncedSearchQuery('')
  }

  const handleApplySavedFilter = (savedFilterId) => {
    const matched = savedFilters.find((item) => item.id === savedFilterId)
    if (!matched) return
    setFilterState(normalizeHoldingsFilterState(matched.filterState))
    setSearchInput('')
    setDebouncedSearchQuery('')
  }

  const handleSaveCurrentFilter = (name) => {
    const normalizedName = String(name || '').trim()
    if (!normalizedName) return { ok: false, error: '請先命名這組篩選。' }
    if (countActiveHoldingsFilters(safeFilterState) === 0) {
      return { ok: false, error: '至少先選一個 intent 或副 chip。' }
    }

    const nextFilterState = stripFilterState(safeFilterState)
    setSavedFilters((current) => {
      const existing = current.find((item) => item.name === normalizedName)
      const nextEntry = {
        id: existing?.id || `saved-filter-${Date.now()}`,
        name: normalizedName,
        filterState: nextFilterState,
      }
      const withoutExisting = current.filter((item) => item.id !== existing?.id)
      return [nextEntry, ...withoutExisting]
    })

    return { ok: true }
  }

  const activeSavedFilterId = useMemo(
    () =>
      savedFilters.find((item) => areFilterStatesEqual(item.filterState, safeFilterState))?.id ||
      '',
    [safeFilterState, savedFilters]
  )

  const holdingsFilterBar = {
    activeFilterCount,
    filteredCount: visibleHoldings.length,
    totalCount: filterModel.rows.length,
    searchQuery: searchInput,
    debouncedSearchQuery,
    primaryChips: filterModel.primaryChips.map((chip) => ({
      ...chip,
      active: safeFilterState.intentKey === chip.key,
      onClick: () => handleIntentChange(chip.key),
    })),
    filterGroups: filterModel.filterGroups.map((group) => ({
      ...group,
      chips: group.chips.map((chip) => ({
        ...chip,
        active: (safeFilterState.filterGroups[group.key] || []).includes(chip.key),
        onClick: () => handleGroupToggle(group.key, chip.key),
      })),
    })),
    savedFilters,
    activeSavedFilterId,
    canSaveCurrentFilter: countActiveHoldingsFilters(safeFilterState) > 0,
    onSearchChange: setSearchInput,
    onSaveCurrentFilter: handleSaveCurrentFilter,
    onApplySavedFilter: handleApplySavedFilter,
    onClearAll: handleClearAll,
  }

  return (
    <div
      data-testid="holdings-panel-with-rail"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
        gap: isMobile ? 12 : 16,
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <HoldingsPanel {...panelProps} holdingsFilterBar={holdingsFilterBar}>
          <HoldingsTable
            {...tableProps}
            holdings={visibleHoldings}
            totalHoldingsCount={filterModel.rows.length}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearAll}
          />
        </HoldingsPanel>
      </div>
      <HoldingsRightRail
        holdings={panelProps?.holdings}
        holdingDossiers={panelProps?.holdingDossiers}
        dailyReport={panelProps?.dailyReport}
        alerts={panelProps?.newsEvents}
      />
    </div>
  )
}
