import { useEffect, useMemo, useState } from 'react'
import {
  HOLDINGS_FILTER_PRIMARY_META,
  buildHoldingsFilterModel,
  countActiveHoldingsFilters,
  createDefaultHoldingsFilterState,
  filterHoldingsByChipState,
  normalizeHoldingsFilterState,
} from '../../lib/holdingsFilters.js'
import { HoldingsPanel, HoldingsTable } from './index.js'

const EMPTY_LIST = []

function readStoredFilterState(storageKey) {
  if (typeof window === 'undefined' || !window.localStorage || !storageKey) {
    return createDefaultHoldingsFilterState()
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? normalizeHoldingsFilterState(JSON.parse(raw)) : createDefaultHoldingsFilterState()
  } catch {
    return createDefaultHoldingsFilterState()
  }
}

export default function HoldingsPanelChunk({ panelProps, tableProps }) {
  const activePortfolioId = String(panelProps?.activePortfolioId || '').trim()
  const tableHoldings = tableProps?.holdings
  const panelHoldings = panelProps?.holdings
  const panelHoldingDossiers = panelProps?.holdingDossiers
  const panelNewsEvents = panelProps?.newsEvents
  const storageKey = activePortfolioId ? `pf-${activePortfolioId}-holdings-filters-v1` : ''
  const [storedFilterState, setStoredFilterState] = useState(() => ({
    storageKey,
    value: readStoredFilterState(storageKey),
  }))
  const hydratedFilterState = useMemo(() => readStoredFilterState(storageKey), [storageKey])
  const filterState =
    storedFilterState.storageKey === storageKey ? storedFilterState.value : hydratedFilterState

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
    })
  }, [panelHoldingDossiers, panelHoldings, panelNewsEvents, tableHoldings])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage || !storageKey) return

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(normalizeHoldingsFilterState(filterState))
    )
  }, [filterState, storageKey])

  const safeFilterState = useMemo(() => normalizeHoldingsFilterState(filterState), [filterState])
  const activePrimaryKeys = useMemo(
    () => new Set(safeFilterState.selectedPrimaryKeys),
    [safeFilterState.selectedPrimaryKeys]
  )
  const focusedPrimaryKey = safeFilterState.focusedPrimaryKey
  const visibleHoldings = useMemo(
    () => filterHoldingsByChipState(filterModel.rows, safeFilterState),
    [filterModel.rows, safeFilterState]
  )
  const activeFilterCount = useMemo(
    () => countActiveHoldingsFilters(safeFilterState),
    [safeFilterState]
  )
  const secondaryChips = filterModel.secondaryChips?.[focusedPrimaryKey] || []
  const activeSecondaryKeys = new Set(safeFilterState.secondaryFilters?.[focusedPrimaryKey] || [])

  const updateFilterState = (updater) => {
    setStoredFilterState((current) => {
      const baseState =
        current.storageKey === storageKey ? current.value : readStoredFilterState(storageKey)

      return {
        storageKey,
        value: normalizeHoldingsFilterState(updater(normalizeHoldingsFilterState(baseState))),
      }
    })
  }

  const handlePrimaryToggle = (primaryKey) => {
    if (primaryKey === 'all') {
      updateFilterState((current) => ({
        ...current,
        focusedPrimaryKey: 'all',
      }))
      return
    }

    updateFilterState((current) => {
      const isSelected = current.selectedPrimaryKeys.includes(primaryKey)

      if (isSelected && current.focusedPrimaryKey !== primaryKey) {
        return {
          ...current,
          focusedPrimaryKey: primaryKey,
        }
      }

      const nextSelectedPrimaryKeys = isSelected
        ? current.selectedPrimaryKeys.filter((key) => key !== primaryKey)
        : [...current.selectedPrimaryKeys, primaryKey]
      const nextFocusedPrimaryKey = isSelected
        ? nextSelectedPrimaryKeys[nextSelectedPrimaryKeys.length - 1] || 'all'
        : primaryKey

      return {
        ...current,
        selectedPrimaryKeys: nextSelectedPrimaryKeys,
        focusedPrimaryKey: nextFocusedPrimaryKey,
      }
    })
  }

  const handleSecondaryToggle = (secondaryKey) => {
    if (!['all', 'growth', 'event'].includes(focusedPrimaryKey)) return

    updateFilterState((current) => {
      const currentValues = current.secondaryFilters?.[focusedPrimaryKey] || []
      const nextValues = currentValues.includes(secondaryKey)
        ? currentValues.filter((value) => value !== secondaryKey)
        : [...currentValues, secondaryKey]

      return {
        ...current,
        secondaryFilters: {
          ...current.secondaryFilters,
          [focusedPrimaryKey]: nextValues,
        },
      }
    })
  }

  const holdingsFilterBar = {
    activeFilterCount,
    filteredCount: visibleHoldings.length,
    totalCount: filterModel.rows.length,
    focusedPrimaryKey,
    secondaryLabel: HOLDINGS_FILTER_PRIMARY_META[focusedPrimaryKey]?.secondaryLabel || '',
    primaryChips: filterModel.primaryChips.map((chip) => ({
      ...chip,
      active: chip.key === 'all' ? activePrimaryKeys.size === 0 : activePrimaryKeys.has(chip.key),
      focused: focusedPrimaryKey === chip.key,
      onClick: () => handlePrimaryToggle(chip.key),
    })),
    secondaryChips: secondaryChips.map((chip) => ({
      ...chip,
      active: activeSecondaryKeys.has(chip.key),
      onClick: () => handleSecondaryToggle(chip.key),
    })),
    onClearAll: () =>
      setStoredFilterState({
        storageKey,
        value: createDefaultHoldingsFilterState(),
      }),
  }

  return (
    <HoldingsPanel {...panelProps} holdingsFilterBar={holdingsFilterBar}>
      <HoldingsTable {...tableProps} holdings={visibleHoldings} />
    </HoldingsPanel>
  )
}
