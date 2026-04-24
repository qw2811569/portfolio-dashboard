import { STOCK_META } from '../seedData.js'
import { getEventStockCodes, isClosedEvent, parseFlexibleDate } from './eventUtils.js'
import { getInstrumentTypeLabel } from './instrumentTypes.js'

export const HOLDINGS_FILTER_PRIMARY_ORDER = ['all', 'growth', 'event', 'etf', 'warrant', 'other']

export const HOLDINGS_FILTER_PRIMARY_META = Object.freeze({
  all: { label: '全部', secondaryLabel: '先用 thesis 節奏收一下' },
  growth: { label: '成長股', secondaryLabel: '想先看哪條產業線' },
  event: { label: '事件驅動', secondaryLabel: '先把事件節奏分開看' },
  etf: { label: 'ETF', secondaryLabel: '' },
  warrant: { label: '權證', secondaryLabel: '' },
  other: { label: '其他', secondaryLabel: '' },
})

export const HOLDINGS_FILTER_PILLAR_META = Object.freeze({
  intact: { label: '成立' },
  weakened: { label: '動搖' },
  broken: { label: '失效' },
})

export const HOLDINGS_FILTER_EVENT_META = Object.freeze({
  upcoming: { label: 'upcoming' },
  watch: { label: 'watch' },
  done: { label: 'done' },
})

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function sortByCountThenLabel(rows = []) {
  return [...rows].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-Hant')
  )
}

export function createDefaultHoldingsFilterState() {
  return {
    focusedPrimaryKey: 'all',
    selectedPrimaryKeys: [],
    secondaryFilters: {
      all: [],
      growth: [],
      event: [],
    },
  }
}

export function normalizeHoldingsFilterState(raw) {
  const defaultState = createDefaultHoldingsFilterState()
  const selectedPrimaryKeys = uniqueStrings(raw?.selectedPrimaryKeys).filter((key) =>
    ['growth', 'event', 'etf', 'warrant', 'other'].includes(key)
  )
  const requestedFocus = String(raw?.focusedPrimaryKey || '').trim()
  const focusedPrimaryKey =
    requestedFocus === 'all' || selectedPrimaryKeys.includes(requestedFocus)
      ? requestedFocus || 'all'
      : selectedPrimaryKeys[selectedPrimaryKeys.length - 1] || 'all'

  return {
    focusedPrimaryKey,
    selectedPrimaryKeys,
    secondaryFilters: {
      ...defaultState.secondaryFilters,
      all: uniqueStrings(raw?.secondaryFilters?.all).filter(
        (key) => HOLDINGS_FILTER_PILLAR_META[key]
      ),
      growth: uniqueStrings(raw?.secondaryFilters?.growth),
      event: uniqueStrings(raw?.secondaryFilters?.event).filter(
        (key) => HOLDINGS_FILTER_EVENT_META[key]
      ),
    },
  }
}

export function countActiveHoldingsFilters(state) {
  const safeState = normalizeHoldingsFilterState(state)
  const primaryCount = safeState.selectedPrimaryKeys.length
  const allSecondaryCount = safeState.secondaryFilters.all.length
  const scopedSecondaryCount = safeState.selectedPrimaryKeys.reduce(
    (sum, key) => sum + (safeState.secondaryFilters[key]?.length || 0),
    0
  )
  return primaryCount + allSecondaryCount + scopedSecondaryCount
}

export function normalizePillarStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (['broken', 'invalidated'].includes(normalized)) return 'broken'
  if (['watch', 'behind', 'weakened'].includes(normalized)) return 'weakened'
  if (['stable', 'on_track', 'intact', 'healthy'].includes(normalized)) return 'intact'
  return ''
}

function resolveHoldingPrimaryKey(holding = {}) {
  const code = String(holding?.code || '').trim()
  const stockMeta = STOCK_META?.[code] || {}
  const strategy = String(stockMeta?.strategy || '').trim()
  const instrumentType = getInstrumentTypeLabel(holding)

  if (instrumentType === '權證' || strategy === '權證') return 'warrant'
  if (instrumentType === 'ETF' || /ETF|指數/i.test(strategy)) return 'etf'
  if (strategy === '成長股') return 'growth'
  if (strategy === '事件驅動') return 'event'
  return 'other'
}

function resolveHoldingIndustry(holding = {}) {
  const code = String(holding?.code || '').trim()
  const stockMeta = STOCK_META?.[code] || {}
  return String(stockMeta?.sector || stockMeta?.industry || stockMeta?.type || '').trim()
}

function resolveHoldingPillarKey(dossier = null) {
  const pillars = Array.isArray(dossier?.thesis?.pillars) ? dossier.thesis.pillars : []
  if (pillars.length === 0) return ''

  const statuses = pillars.map((pillar) => normalizePillarStatus(pillar?.status)).filter(Boolean)
  if (statuses.includes('broken')) return 'broken'
  if (statuses.includes('weakened')) return 'weakened'
  if (statuses.includes('intact')) return 'intact'
  return ''
}

function resolveEventStatusKey(event = {}) {
  const rawStatus = String(event?.status || '')
    .trim()
    .toLowerCase()

  if (['tracking', 'watch'].includes(rawStatus)) return 'watch'
  if (rawStatus === 'pending' || rawStatus === 'upcoming') return 'upcoming'
  if (
    rawStatus === 'closed' ||
    rawStatus === 'done' ||
    rawStatus === 'past' ||
    isClosedEvent(event)
  ) {
    return 'done'
  }

  const eventDate = parseFlexibleDate(
    event?.eventDate || event?.date || event?.trackingStart || event?.startDate
  )
  if (!eventDate) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return eventDate >= today ? 'upcoming' : 'done'
}

function buildEventStatusMap(newsEvents = []) {
  const statusByCode = new Map()

  for (const event of Array.isArray(newsEvents) ? newsEvents : []) {
    const eventStatusKey = resolveEventStatusKey(event)
    if (!eventStatusKey) continue

    for (const code of getEventStockCodes(event)) {
      const normalizedCode = String(code || '').trim()
      if (!normalizedCode) continue
      const bucket = statusByCode.get(normalizedCode) || new Set()
      bucket.add(eventStatusKey)
      statusByCode.set(normalizedCode, bucket)
    }
  }

  return statusByCode
}

export function buildHoldingsFilterModel({
  holdings = [],
  holdingDossiers = [],
  newsEvents = [],
} = {}) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const safeHoldingDossiers = Array.isArray(holdingDossiers) ? holdingDossiers : []
  const dossierByCode = new Map(
    safeHoldingDossiers.map((dossier) => [String(dossier?.code || '').trim(), dossier])
  )
  const eventStatusByCode = buildEventStatusMap(newsEvents)

  const rows = safeHoldings.map((holding) => {
    const code = String(holding?.code || '').trim()
    const eventStatusKeys = Array.from(eventStatusByCode.get(code) || [])
    return {
      code,
      holding,
      primaryKey: resolveHoldingPrimaryKey(holding),
      industry: resolveHoldingIndustry(holding),
      pillarKey: resolveHoldingPillarKey(dossierByCode.get(code) || null),
      eventStatusKeys,
    }
  })

  const primaryCounts = rows.reduce(
    (acc, row) => ({
      ...acc,
      [row.primaryKey]: (acc[row.primaryKey] || 0) + 1,
    }),
    { all: rows.length, growth: 0, event: 0, etf: 0, warrant: 0, other: 0 }
  )

  const growthSectorCounts = new Map()
  const eventStatusCounts = new Map()
  const pillarStatusCounts = new Map()

  for (const row of rows) {
    if (row.primaryKey === 'growth' && row.industry) {
      growthSectorCounts.set(row.industry, (growthSectorCounts.get(row.industry) || 0) + 1)
    }

    if (row.primaryKey === 'event') {
      for (const statusKey of row.eventStatusKeys) {
        eventStatusCounts.set(statusKey, (eventStatusCounts.get(statusKey) || 0) + 1)
      }
    }

    if (row.pillarKey) {
      pillarStatusCounts.set(row.pillarKey, (pillarStatusCounts.get(row.pillarKey) || 0) + 1)
    }
  }

  return {
    rows,
    primaryChips: HOLDINGS_FILTER_PRIMARY_ORDER.map((key) => ({
      key,
      label:
        key === 'all'
          ? `全部 ${rows.length} 檔`
          : HOLDINGS_FILTER_PRIMARY_META[key]?.label || HOLDINGS_FILTER_PRIMARY_META.other.label,
      count: key === 'all' ? rows.length : primaryCounts[key] || 0,
    })),
    secondaryChips: {
      all: sortByCountThenLabel(
        Object.entries(HOLDINGS_FILTER_PILLAR_META).map(([key, meta]) => ({
          key,
          label: meta.label,
          count: pillarStatusCounts.get(key) || 0,
        }))
      ).filter((item) => item.count > 0),
      growth: sortByCountThenLabel(
        Array.from(growthSectorCounts.entries()).map(([label, count]) => ({
          key: label,
          label,
          count,
        }))
      ),
      event: ['upcoming', 'watch', 'done']
        .map((key) => ({
          key,
          label: HOLDINGS_FILTER_EVENT_META[key].label,
          count: eventStatusCounts.get(key) || 0,
        }))
        .filter((item) => item.count > 0),
      etf: [],
      warrant: [],
      other: [],
    },
  }
}

export function filterHoldingsByChipState(rows = [], state) {
  const safeRows = Array.isArray(rows) ? rows : []
  const safeState = normalizeHoldingsFilterState(state)
  const selectedPrimaryKeys = new Set(safeState.selectedPrimaryKeys)
  const allPillarFilters = new Set(safeState.secondaryFilters.all)
  const growthFilters = new Set(
    selectedPrimaryKeys.has('growth') ? safeState.secondaryFilters.growth : []
  )
  const eventFilters = new Set(
    selectedPrimaryKeys.has('event') ? safeState.secondaryFilters.event : []
  )

  return safeRows
    .filter((row) => {
      if (allPillarFilters.size > 0) {
        if (!row.pillarKey || !allPillarFilters.has(row.pillarKey)) return false
      }

      if (selectedPrimaryKeys.size === 0) return true
      if (!selectedPrimaryKeys.has(row.primaryKey)) return false

      if (row.primaryKey === 'growth' && growthFilters.size > 0) {
        if (!row.industry || !growthFilters.has(row.industry)) return false
      }

      if (row.primaryKey === 'event' && eventFilters.size > 0) {
        if (!row.eventStatusKeys.some((statusKey) => eventFilters.has(statusKey))) return false
      }

      return true
    })
    .map((row) => row.holding)
}
