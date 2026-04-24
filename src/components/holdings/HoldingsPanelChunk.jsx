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
import { HoldingsPanel, HoldingsTable } from './index.js'

const EMPTY_LIST = []
const EMPTY_SAVED_FILTERS = []
const SEARCH_DEBOUNCE_MS = 200

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

function readFilterViewState({ storageKeyV2, legacyStorageKey }) {
  const defaultFilterState = createDefaultHoldingsFilterState()
  if (typeof window === 'undefined' || !window.localStorage) {
    return { filterState: defaultFilterState, searchQuery: '' }
  }

  const urlState = readHoldingsFilterStateFromSearch(window.location.search)
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
  const activePortfolioId = String(panelProps?.activePortfolioId || '').trim()
  const tableHoldings = tableProps?.holdings
  const panelHoldings = panelProps?.holdings
  const panelHoldingDossiers = panelProps?.holdingDossiers
  const panelNewsEvents = panelProps?.newsEvents
  const storageKeyV2 = activePortfolioId ? `pf-${activePortfolioId}-holdings-filters-v2` : ''
  const legacyStorageKey = activePortfolioId ? `pf-${activePortfolioId}-holdings-filters-v1` : ''
  const savedFiltersKey = activePortfolioId ? `pf-${activePortfolioId}-saved-filters-v1` : ''

  const initialViewState = useMemo(
    () => readFilterViewState({ storageKeyV2, legacyStorageKey }),
    [legacyStorageKey, storageKeyV2]
  )

  const [filterState, setFilterState] = useState(() => initialViewState.filterState)
  const [searchInput, setSearchInput] = useState(() => initialViewState.searchQuery)
  const [savedFilters, setSavedFilters] = useState(() => readSavedFilters(savedFiltersKey))
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    () => initialViewState.searchQuery
  )

  useEffect(() => {
    const nextViewState = readFilterViewState({ storageKeyV2, legacyStorageKey })
    setFilterState(nextViewState.filterState)
    setSearchInput(nextViewState.searchQuery)
    setDebouncedSearchQuery(nextViewState.searchQuery)
  }, [legacyStorageKey, storageKeyV2])

  useEffect(() => {
    setSavedFilters(readSavedFilters(savedFiltersKey))
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
    const safeHoldings = Array.isArray(tableHoldings)
      ? tableHoldings
      : Array.isArray(panelHoldings)
        ? panelHoldings
        : EMPTY_LIST
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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage || !storageKeyV2) return

    window.localStorage.setItem(storageKeyV2, JSON.stringify(serializeFilterState(safeFilterState)))
    if (legacyStorageKey) {
      window.localStorage.setItem(
        legacyStorageKey,
        JSON.stringify(buildLegacyHoldingsFilterStateMirror(safeFilterState))
      )
    }
  }, [legacyStorageKey, safeFilterState, storageKeyV2])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage || !savedFiltersKey) return

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
  }, [savedFilters, savedFiltersKey])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nextParams = applyHoldingsFilterStateToSearchParams(
      new URLSearchParams(window.location.search),
      safeFilterState,
      debouncedSearchQuery
    )
    const nextSearch = nextParams.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
    if (nextUrl === currentUrl) return
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [debouncedSearchQuery, safeFilterState])

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
    <HoldingsPanel {...panelProps} holdingsFilterBar={holdingsFilterBar}>
      <HoldingsTable {...tableProps} holdings={visibleHoldings} />
    </HoldingsPanel>
  )
}
