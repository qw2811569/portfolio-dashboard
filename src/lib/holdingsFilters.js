import companyProfiles from '../data/companyProfiles.json' with { type: 'json' }
import { STOCK_META } from '../seedData.js'
import { getEventStockCodes, isClosedEvent, parseFlexibleDate } from './eventUtils.js'
import { getHoldingMarketValue, getHoldingReturnPct, resolveHoldingPrice } from './holdings.js'
import { getInstrumentTypeLabel } from './instrumentTypes.js'
import { getRelevantCases } from './knowledgeBase.js'

export const HOLDINGS_FILTER_STORAGE_VERSION = 2

export const HOLDINGS_FILTER_PRIMARY_ORDER = ['attention', 'stable', 'action', 'all']

export const HOLDINGS_FILTER_PRIMARY_META = Object.freeze({
  attention: { label: '🔥 需關注', shortLabel: '需關注' },
  stable: { label: '✅ 穩的', shortLabel: '穩的' },
  action: { label: '⚠️ 要處理', shortLabel: '要處理' },
  all: { label: '📊 全部', shortLabel: '全部' },
})

export const HOLDINGS_FILTER_GROUP_ORDER = ['sector', 'type', 'eventWindow', 'pnl', 'risk']

export const HOLDINGS_FILTER_GROUP_META = Object.freeze({
  sector: { label: '產業' },
  type: { label: '類型' },
  eventWindow: { label: '事件窗' },
  pnl: { label: '盈虧' },
  risk: { label: '風險' },
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

export const HOLDINGS_FILTER_TYPE_META = Object.freeze({
  growth: { label: '成長股', legacyPrimaryKey: 'growth' },
  event: { label: '事件驅動', legacyPrimaryKey: 'event' },
  etf: { label: 'ETF', legacyPrimaryKey: 'etf' },
  warrant: { label: '權證', legacyPrimaryKey: 'warrant' },
  cyclical: { label: '景氣循環', legacyPrimaryKey: null },
  value: { label: '價值股', legacyPrimaryKey: null },
  other: { label: '其他', legacyPrimaryKey: 'other' },
})

export const HOLDINGS_FILTER_EVENT_WINDOW_META = Object.freeze({
  weekEvent: { label: '本週法說' },
  monthDividend: { label: '本月除權息' },
  news3d: { label: '近 3 日新聞' },
})

export const HOLDINGS_FILTER_PNL_META = Object.freeze({
  positive: { label: '正' },
  negative: { label: '負' },
  flat: { label: '持平' },
})

export const HOLDINGS_FILTER_RISK_META = Object.freeze({
  singleOver20: { label: '單股>20%' },
  sectorOver40: { label: '單產業>40%' },
  nearStopLoss: { label: '近停損' },
  stale: { label: 'stale' },
})

export const HOLDINGS_FILTER_URL_PARAM_KEYS = Object.freeze({
  intent: 'intent',
  sector: 'sector',
  type: 'type',
  eventWindow: 'event',
  pnl: 'pnl',
  risk: 'risk',
  query: 'q',
})

const DEFAULT_FILTER_GROUPS = Object.freeze({
  sector: [],
  type: [],
  eventWindow: [],
  pnl: [],
  risk: [],
})

const GROUP_VALUE_KEYS = Object.freeze({
  type: Object.keys(HOLDINGS_FILTER_TYPE_META),
  eventWindow: Object.keys(HOLDINGS_FILTER_EVENT_WINDOW_META),
  pnl: Object.keys(HOLDINGS_FILTER_PNL_META),
  risk: Object.keys(HOLDINGS_FILTER_RISK_META),
})

const HISTORY_REFERENCE_TAGS = new Set(['趨勢追蹤', '底部佈局', '反向操作', '景氣循環'])

const INTENT_LABEL_TO_KEY = Object.freeze({
  需關注: 'attention',
  attention: 'attention',
  alert: 'attention',
  穩的: 'stable',
  stable: 'stable',
  要處理: 'action',
  action: 'action',
  actionable: 'action',
  全部: 'all',
  all: 'all',
})

const TYPE_LABEL_TO_KEY = Object.freeze(
  Object.fromEntries(
    Object.entries(HOLDINGS_FILTER_TYPE_META).flatMap(([key, meta]) => [
      [key, key],
      [meta.label, key],
    ])
  )
)

const EVENT_WINDOW_LABEL_TO_KEY = Object.freeze({
  weekevent: 'weekEvent',
  'week-event': 'weekEvent',
  本週法說: 'weekEvent',
  thisweek: 'weekEvent',
  monthdividend: 'monthDividend',
  'month-dividend': 'monthDividend',
  本月除權息: 'monthDividend',
  dividend: 'monthDividend',
  news3d: 'news3d',
  'news-3d': 'news3d',
  recentnews: 'news3d',
  'recent-news': 'news3d',
  近3日新聞: 'news3d',
  '近 3 日新聞': 'news3d',
})

const PNL_LABEL_TO_KEY = Object.freeze({
  positive: 'positive',
  正: 'positive',
  negative: 'negative',
  負: 'negative',
  flat: 'flat',
  持平: 'flat',
})

const RISK_LABEL_TO_KEY = Object.freeze({
  singleover20: 'singleOver20',
  'single-over-20': 'singleOver20',
  '單股>20%': 'singleOver20',
  concentration: 'singleOver20',
  sectorover40: 'sectorOver40',
  'sector-over-40': 'sectorOver40',
  '單產業>40%': 'sectorOver40',
  'sector-concentration': 'sectorOver40',
  nearstoploss: 'nearStopLoss',
  'near-stop-loss': 'nearStopLoss',
  'near-stop': 'nearStopLoss',
  近停損: 'nearStopLoss',
  stale: 'stale',
})

const LEGACY_PRIMARY_TO_TYPE = Object.freeze({
  growth: 'growth',
  event: 'event',
  etf: 'etf',
  warrant: 'warrant',
  other: 'other',
})

const LEGACY_EVENT_TO_WINDOW = Object.freeze({
  upcoming: 'weekEvent',
  watch: 'news3d',
})

const LEGACY_PILLAR_TO_INTENT = Object.freeze({
  broken: 'attention',
  weakened: 'action',
  intact: 'stable',
})

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function uniqueNormalizedStrings(values = []) {
  return uniqueStrings(values).map((value) => value.replace(/\s+/g, ' '))
}

function sortByCountThenLabel(rows = []) {
  return [...rows].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-Hant')
  )
}

function startOfDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : parseFlexibleDate(value)
  if (!date) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function diffInCalendarDays(left, right) {
  const safeLeft = startOfDay(left)
  const safeRight = startOfDay(right)
  if (!safeLeft || !safeRight) return null
  return Math.round((safeLeft.getTime() - safeRight.getTime()) / (24 * 60 * 60 * 1000))
}

function isSameCalendarMonth(left, right) {
  const safeLeft = startOfDay(left)
  const safeRight = startOfDay(right)
  if (!safeLeft || !safeRight) return false
  return (
    safeLeft.getFullYear() === safeRight.getFullYear() &&
    safeLeft.getMonth() === safeRight.getMonth()
  )
}

function normalizeGroupValue(groupKey, value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) return ''

  if (groupKey === 'sector') return rawValue

  const normalized = normalizeLookupKey(rawValue)

  if (groupKey === 'type') return TYPE_LABEL_TO_KEY[rawValue] || TYPE_LABEL_TO_KEY[normalized] || ''
  if (groupKey === 'eventWindow') {
    return EVENT_WINDOW_LABEL_TO_KEY[rawValue] || EVENT_WINDOW_LABEL_TO_KEY[normalized] || ''
  }
  if (groupKey === 'pnl') return PNL_LABEL_TO_KEY[rawValue] || PNL_LABEL_TO_KEY[normalized] || ''
  if (groupKey === 'risk') return RISK_LABEL_TO_KEY[rawValue] || RISK_LABEL_TO_KEY[normalized] || ''
  return ''
}

function normalizeIntentKey(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) return 'all'
  return INTENT_LABEL_TO_KEY[rawValue] || INTENT_LABEL_TO_KEY[normalizeLookupKey(rawValue)] || 'all'
}

function buildLegacyMirrorFromRetailState(baseState) {
  const typeSelections = baseState.filterGroups.type
    .map((key) => HOLDINGS_FILTER_TYPE_META[key]?.legacyPrimaryKey || '')
    .filter(Boolean)

  const legacyAll =
    baseState.intentKey === 'attention'
      ? ['broken']
      : baseState.intentKey === 'action'
        ? ['weakened']
        : baseState.intentKey === 'stable'
          ? ['intact']
          : []

  const legacyEvent = baseState.filterGroups.eventWindow
    .map((key) => (key === 'weekEvent' ? 'upcoming' : key === 'news3d' ? 'watch' : ''))
    .filter(Boolean)

  return {
    focusedPrimaryKey: typeSelections[typeSelections.length - 1] || 'all',
    selectedPrimaryKeys: uniqueStrings(typeSelections),
    secondaryFilters: {
      all: legacyAll,
      growth: uniqueStrings(baseState.filterGroups.sector),
      event: uniqueStrings(legacyEvent),
    },
  }
}

function buildBaseRetailState(overrides = {}) {
  const nextGroups = {
    ...DEFAULT_FILTER_GROUPS,
    ...(overrides.filterGroups || {}),
  }

  return {
    version: HOLDINGS_FILTER_STORAGE_VERSION,
    intentKey: normalizeIntentKey(overrides.intentKey),
    filterGroups: {
      sector: uniqueNormalizedStrings(nextGroups.sector),
      type: uniqueStrings(nextGroups.type).filter((key) => GROUP_VALUE_KEYS.type.includes(key)),
      eventWindow: uniqueStrings(nextGroups.eventWindow).filter((key) =>
        GROUP_VALUE_KEYS.eventWindow.includes(key)
      ),
      pnl: uniqueStrings(nextGroups.pnl).filter((key) => GROUP_VALUE_KEYS.pnl.includes(key)),
      risk: uniqueStrings(nextGroups.risk).filter((key) => GROUP_VALUE_KEYS.risk.includes(key)),
    },
  }
}

function resolveLegacyIntentSelection(values = []) {
  const selectedPillars = uniqueStrings(values).filter((key) => HOLDINGS_FILTER_PILLAR_META[key])
  if (selectedPillars.length !== 1) return 'all'
  return LEGACY_PILLAR_TO_INTENT[selectedPillars[0]] || 'all'
}

function migrateLegacyHoldingsFilterState(raw) {
  const selectedPrimaryKeys = uniqueStrings(raw?.selectedPrimaryKeys)
    .map((value) => LEGACY_PRIMARY_TO_TYPE[value] || '')
    .filter(Boolean)

  const nextIntent = resolveLegacyIntentSelection(raw?.secondaryFilters?.all)

  return buildBaseRetailState({
    intentKey: nextIntent,
    filterGroups: {
      sector: uniqueStrings(raw?.secondaryFilters?.growth),
      type: selectedPrimaryKeys,
      eventWindow: uniqueStrings(raw?.secondaryFilters?.event)
        .map((value) => LEGACY_EVENT_TO_WINDOW[value] || '')
        .filter(Boolean),
    },
  })
}

function withLegacyMirror(baseState) {
  return {
    ...buildLegacyMirrorFromRetailState(baseState),
    ...baseState,
  }
}

function normalizeExplicitRetailState(raw) {
  const groups = raw?.filterGroups || {}
  return buildBaseRetailState({
    intentKey: raw?.intentKey,
    filterGroups: {
      sector: uniqueStrings(groups.sector),
      type: uniqueStrings(groups.type).map((value) => normalizeGroupValue('type', value)),
      eventWindow: uniqueStrings(groups.eventWindow).map((value) =>
        normalizeGroupValue('eventWindow', value)
      ),
      pnl: uniqueStrings(groups.pnl).map((value) => normalizeGroupValue('pnl', value)),
      risk: uniqueStrings(groups.risk).map((value) => normalizeGroupValue('risk', value)),
    },
  })
}

export function createDefaultHoldingsFilterState() {
  return withLegacyMirror(buildBaseRetailState({ intentKey: 'all' }))
}

export function normalizeHoldingsFilterState(raw) {
  if (!raw || typeof raw !== 'object') return createDefaultHoldingsFilterState()

  const normalized =
    raw?.version === HOLDINGS_FILTER_STORAGE_VERSION || raw?.filterGroups || raw?.intentKey
      ? normalizeExplicitRetailState(raw)
      : migrateLegacyHoldingsFilterState(raw)

  return withLegacyMirror(normalized)
}

export function countActiveHoldingsFilters(state) {
  const safeState = normalizeHoldingsFilterState(state)
  const intentCount = safeState.intentKey === 'all' ? 0 : 1
  const groupCount = Object.values(safeState.filterGroups).reduce(
    (sum, values) => sum + uniqueStrings(values).length,
    0
  )
  return intentCount + groupCount
}

export function normalizePillarStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (['broken', 'invalidated'].includes(normalized)) return 'broken'
  if (['watch', 'behind', 'weakened', 'wobbly'].includes(normalized)) return 'weakened'
  if (['stable', 'on_track', 'intact', 'healthy'].includes(normalized)) return 'intact'
  return ''
}

function resolveHoldingStockMeta(holding = {}, dossier = null) {
  const code = String(holding?.code || dossier?.code || '').trim()
  return (
    dossier?.stockMeta ||
    holding?.stockMeta ||
    STOCK_META?.[code] ||
    companyProfiles?.[code] ||
    null
  )
}

function resolveHoldingTypeKey(holding = {}, dossier = null) {
  const stockMeta = resolveHoldingStockMeta(holding, dossier) || {}
  const strategy = String(stockMeta?.strategy || '').trim()
  const instrumentType = getInstrumentTypeLabel(holding)

  if (instrumentType === '權證' || strategy === '權證') return 'warrant'
  if (instrumentType === 'ETF' || instrumentType === '指數' || /ETF|指數/i.test(strategy))
    return 'etf'
  if (strategy === '成長股') return 'growth'
  if (strategy === '事件驅動') return 'event'
  if (strategy === '景氣循環') return 'cyclical'
  if (strategy === '價值股' || strategy === '價值投資') return 'value'
  return 'other'
}

function resolveHoldingLegacyPrimaryKey(holding = {}, dossier = null) {
  const typeKey = resolveHoldingTypeKey(holding, dossier)
  return HOLDINGS_FILTER_TYPE_META[typeKey]?.legacyPrimaryKey || 'other'
}

function resolveHoldingSectorLabel(holding = {}, dossier = null) {
  const code = String(holding?.code || dossier?.code || '').trim()
  const stockMeta = resolveHoldingStockMeta(holding, dossier) || {}
  const companyProfile = companyProfiles?.[code] || {}

  const candidates = [
    stockMeta?.sector,
    stockMeta?.industry,
    holding?.sector,
    holding?.industry,
    companyProfile?.sector,
    companyProfile?.industry,
    stockMeta?.type,
  ]

  const label = candidates.map((value) => String(value || '').trim()).find(Boolean)
  return label || '其他'
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

function resolveLegacyEventStatusKey(event = {}) {
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

  const today = startOfDay(new Date())
  return eventDate >= today ? 'upcoming' : 'done'
}

function normalizeEventKind(event = {}) {
  const rawKind = String(
    event?.eventType ||
      event?.eventSubType ||
      event?.catalystType ||
      event?.type ||
      event?.recordType ||
      ''
  )
    .trim()
    .toLowerCase()
  const title = String(event?.title || '')

  if (
    ['earnings', 'conference'].includes(rawKind) ||
    /法說|財報|季報|說明會|earnings|conference/i.test(title)
  ) {
    return 'earnings'
  }

  if (
    ['dividend', 'ex-dividend'].includes(rawKind) ||
    /除權|除息|股息|配息|dividend/i.test(title)
  ) {
    return 'dividend'
  }

  if (
    rawKind === 'news' ||
    String(event?.source || '')
      .trim()
      .toLowerCase()
      .includes('news')
  ) {
    return 'news'
  }

  return 'other'
}

function resolveEventReferenceDate(event = {}) {
  return (
    parseFlexibleDate(
      event?.publishedAt ||
        event?.sourceUpdatedAt ||
        event?.updatedAt ||
        event?.eventDate ||
        event?.date ||
        event?.trackingStart ||
        event?.startDate
    ) || null
  )
}

function createEmptyEventContext() {
  return {
    allEvents: [],
    legacyStatusKeys: [],
    hasUpcomingWeekEvent: false,
    hasNearbyEvent: false,
    hasMonthDividend: false,
    hasRecentNews3d: false,
  }
}

function buildHoldingEventContextMap(newsEvents = [], now = new Date()) {
  const safeNow = startOfDay(now) || startOfDay(new Date())
  const contextByCode = new Map()

  for (const event of Array.isArray(newsEvents) ? newsEvents : []) {
    const codes = getEventStockCodes(event)
    if (codes.length === 0) continue

    const eventDate = resolveEventReferenceDate(event)
    const dayDiff = eventDate ? diffInCalendarDays(eventDate, safeNow) : null
    const eventKind = normalizeEventKind(event)
    const legacyStatusKey = resolveLegacyEventStatusKey(event)
    const hasUpcomingWeekEvent =
      eventKind === 'earnings' && dayDiff != null && dayDiff >= 0 && dayDiff <= 7
    const hasNearbyEvent =
      Boolean(
        String(event?.status || '')
          .trim()
          .toLowerCase() === 'tracking'
      ) ||
      (dayDiff != null && Math.abs(dayDiff) <= 7)
    const hasMonthDividend = eventKind === 'dividend' && isSameCalendarMonth(eventDate, safeNow)
    const hasRecentNews3d = eventKind === 'news' && dayDiff != null && Math.abs(dayDiff) <= 3

    for (const rawCode of codes) {
      const code = String(rawCode || '').trim()
      if (!code) continue

      const bucket = contextByCode.get(code) || createEmptyEventContext()
      bucket.allEvents.push(event)
      if (legacyStatusKey) {
        bucket.legacyStatusKeys = uniqueStrings([...bucket.legacyStatusKeys, legacyStatusKey])
      }
      bucket.hasUpcomingWeekEvent = bucket.hasUpcomingWeekEvent || hasUpcomingWeekEvent
      bucket.hasNearbyEvent = bucket.hasNearbyEvent || hasNearbyEvent
      bucket.hasMonthDividend = bucket.hasMonthDividend || hasMonthDividend
      bucket.hasRecentNews3d = bucket.hasRecentNews3d || hasRecentNews3d
      contextByCode.set(code, bucket)
    }
  }

  return contextByCode
}

function buildRetailPortfolioContext({
  holdings = [],
  holdingDossiers = [],
  newsEvents = [],
} = {}) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const safeHoldingDossiers = Array.isArray(holdingDossiers) ? holdingDossiers : []
  const dossierByCode = new Map(
    safeHoldingDossiers.map((dossier) => [String(dossier?.code || '').trim(), dossier])
  )
  const totalValue = safeHoldings.reduce(
    (sum, holding) => sum + Math.max(0, getHoldingMarketValue(holding)),
    0
  )

  const weightsByCode = new Map()
  const sectorWeights = new Map()

  for (const holding of safeHoldings) {
    const code = String(holding?.code || '').trim()
    if (!code) continue
    const dossier = dossierByCode.get(code) || null
    const value = Math.max(0, getHoldingMarketValue(holding))
    const weight = totalValue > 0 ? value / totalValue : 0
    const sectorLabel = resolveHoldingSectorLabel(holding, dossier)

    weightsByCode.set(code, weight)
    sectorWeights.set(sectorLabel, (sectorWeights.get(sectorLabel) || 0) + weight)
  }

  return {
    now: startOfDay(new Date()) || new Date(),
    totalValue,
    weightsByCode,
    sectorWeights,
    dossierByCode,
    eventContextByCode: buildHoldingEventContextMap(newsEvents),
  }
}

function pickFirstFinite(values = []) {
  for (const value of values) {
    const candidate = Number(value)
    if (Number.isFinite(candidate)) return candidate
  }
  return null
}

function hasFreshStatuses(freshness = {}) {
  const statuses = [freshness?.fundamentals, freshness?.targets]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return statuses.length > 0 && statuses.every((status) => status === 'fresh')
}

function hasStaleStatuses(freshness = {}) {
  const statuses = [freshness?.fundamentals, freshness?.targets]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return statuses.some((status) => ['aging', 'stale', 'missing', 'failed'].includes(status))
}

function buildHistoricalReferenceTags(stockMeta = {}) {
  return uniqueStrings(
    getRelevantCases(stockMeta, { maxItems: 3 })
      .flatMap((item) => item?.tags || [])
      .filter((tag) => HISTORY_REFERENCE_TAGS.has(tag))
  )
}

export function deriveRetailIntent(holding, portfolio, dossier = null) {
  const code = String(holding?.code || dossier?.code || '').trim()
  const stockMeta = resolveHoldingStockMeta(holding, dossier) || {}
  const eventContext = portfolio?.eventContextByCode?.get(code) || createEmptyEventContext()
  const sectorLabel = resolveHoldingSectorLabel(holding, dossier)
  const positionWeight = Number(portfolio?.weightsByCode?.get(code)) || 0
  const sectorWeight = Number(portfolio?.sectorWeights?.get(sectorLabel)) || 0
  const price = resolveHoldingPrice(holding, dossier?.position?.price || null)
  const cost = Number(holding?.cost ?? dossier?.position?.cost)
  const explicitStopLoss = Number(dossier?.thesis?.stopLoss ?? holding?.stopLoss)
  const urgentStopPrice =
    Number.isFinite(explicitStopLoss) && explicitStopLoss > 0
      ? explicitStopLoss
      : Number.isFinite(cost) && cost > 0
        ? cost * 0.9
        : null
  const warningStopPrice =
    Number.isFinite(explicitStopLoss) && explicitStopLoss > 0
      ? Math.max(
          explicitStopLoss,
          Number.isFinite(cost) && cost > 0 ? cost * 0.95 : explicitStopLoss
        )
      : Number.isFinite(cost) && cost > 0
        ? cost * 0.95
        : null
  const isAtOrBelowUrgentStop =
    Number.isFinite(price) &&
    Number.isFinite(urgentStopPrice) &&
    urgentStopPrice > 0 &&
    price <= urgentStopPrice
  const isNearStopLoss =
    Number.isFinite(price) &&
    Number.isFinite(warningStopPrice) &&
    warningStopPrice > 0 &&
    price <= warningStopPrice
  const pillarKey = resolveHoldingPillarKey(dossier)
  const pnlPct = getHoldingReturnPct(holding, dossier?.position?.price || null)
  const recentVolatilityPct = Math.abs(
    pickFirstFinite([
      holding?.changePct3d,
      holding?.threeDayChangePct,
      holding?.volatility3dPct,
      holding?.changePct,
    ]) || 0
  )
  const alertValue = holding?.alert
  const hasUrgentAlert =
    Boolean(holding?.alertUrgent || alertValue?.urgent) ||
    (typeof alertValue === 'string' && alertValue.trim().length > 0)
  const freshness = dossier?.freshness || {}
  const staleData = hasStaleStatuses(freshness)
  const freshData = hasFreshStatuses(freshness)

  const riskFlags = []
  const tags = [
    stockMeta?.strategy,
    sectorLabel,
    ...(Array.isArray(stockMeta?.themes) ? stockMeta.themes : []),
    ...buildHistoricalReferenceTags(stockMeta),
  ]

  if (positionWeight > 0.2) {
    riskFlags.push('singleOver20')
    tags.push('集中度警示')
  }

  if (sectorWeight > 0.4) {
    riskFlags.push('sectorOver40')
    tags.push('產業集中')
  }

  if (isNearStopLoss) {
    riskFlags.push('nearStopLoss')
  }

  if (staleData) {
    riskFlags.push('stale')
  }

  let intent = '全部'
  if (
    hasUrgentAlert ||
    eventContext.hasUpcomingWeekEvent ||
    recentVolatilityPct >= 5 ||
    pillarKey === 'broken' ||
    isAtOrBelowUrgentStop
  ) {
    intent = '需關注'
  } else if (pillarKey === 'weakened' || staleData || isNearStopLoss) {
    intent = '要處理'
  } else if (pillarKey === 'intact' && !eventContext.hasNearbyEvent && pnlPct > 0 && freshData) {
    intent = '穩的'
  }

  return {
    intent,
    tags: uniqueStrings(tags),
    riskFlags: uniqueStrings(riskFlags),
  }
}

function buildSearchText(row) {
  const thesis = row.dossier?.thesis || {}
  const pillars = Array.isArray(thesis?.pillars)
    ? thesis.pillars
        .map((pillar) => String(pillar?.label || pillar?.text || '').trim())
        .filter(Boolean)
    : []

  return [
    row.code,
    row.holding?.name,
    row.sectorLabel,
    row.typeLabel,
    thesis?.statement,
    thesis?.reason,
    thesis?.summary,
    thesis?.expectation,
    thesis?.invalidation,
    row.holding?.alert,
    ...pillars,
    ...(row.tags || []),
  ]
    .map((value) =>
      String(value || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .join(' ')
}

function resolveHoldingPnlBucket(holding, dossier = null) {
  const pnlPct = getHoldingReturnPct(holding, dossier?.position?.price || null)
  if (pnlPct > 0) return 'positive'
  if (pnlPct < 0) return 'negative'
  return 'flat'
}

function resolveHoldingEventWindowKeys(eventContext = null) {
  const keys = []
  if (eventContext?.hasUpcomingWeekEvent) keys.push('weekEvent')
  if (eventContext?.hasMonthDividend) keys.push('monthDividend')
  if (eventContext?.hasRecentNews3d) keys.push('news3d')
  return keys
}

function rowMatchesSearch(row, searchQuery) {
  const normalizedQuery = String(searchQuery || '')
    .trim()
    .toLowerCase()
  if (!normalizedQuery) return true

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every((token) => row.searchText.includes(token))
}

function rowMatchesGroupSelection(row, groupKey, selectedValues = []) {
  if (selectedValues.length === 0) return true

  if (groupKey === 'sector') return selectedValues.includes(row.sectorLabel)
  if (groupKey === 'type') return selectedValues.includes(row.typeKey)
  if (groupKey === 'eventWindow')
    return row.eventWindowKeys.some((key) => selectedValues.includes(key))
  if (groupKey === 'pnl') return selectedValues.includes(row.pnlKey)
  if (groupKey === 'risk') return row.riskFlags.some((key) => selectedValues.includes(key))
  return true
}

function rowMatchesSpecificOption(row, groupKey, optionKey) {
  if (groupKey === 'sector') return row.sectorLabel === optionKey
  if (groupKey === 'type') return row.typeKey === optionKey
  if (groupKey === 'eventWindow') return row.eventWindowKeys.includes(optionKey)
  if (groupKey === 'pnl') return row.pnlKey === optionKey
  if (groupKey === 'risk') return row.riskFlags.includes(optionKey)
  return false
}

function rowMatchesState(
  row,
  state,
  searchQuery = '',
  { ignoreIntent = false, ignoreGroupKey = '' } = {}
) {
  const safeState = normalizeHoldingsFilterState(state)
  if (!rowMatchesSearch(row, searchQuery)) return false

  if (!ignoreIntent && safeState.intentKey !== 'all' && row.intentKey !== safeState.intentKey) {
    return false
  }

  for (const groupKey of HOLDINGS_FILTER_GROUP_ORDER) {
    if (groupKey === ignoreGroupKey) continue
    if (!rowMatchesGroupSelection(row, groupKey, safeState.filterGroups[groupKey] || []))
      return false
  }

  return true
}

function countRowsForIntent(rows, state, searchQuery, intentKey) {
  return rows.filter((row) => {
    if (!rowMatchesState(row, state, searchQuery, { ignoreIntent: true })) return false
    return intentKey === 'all' ? true : row.intentKey === intentKey
  }).length
}

function countRowsForOption(rows, state, searchQuery, groupKey, optionKey) {
  return rows.filter((row) => {
    if (!rowMatchesState(row, state, searchQuery, { ignoreGroupKey: groupKey })) return false
    return rowMatchesSpecificOption(row, groupKey, optionKey)
  }).length
}

function createGroupChip(key, label, count, active) {
  return {
    key,
    label,
    count,
    active,
  }
}

function buildSectorChips(rows, state, searchQuery) {
  const safeState = normalizeHoldingsFilterState(state)
  const sectorOptions = uniqueStrings([
    ...rows.map((row) => row.sectorLabel),
    ...safeState.filterGroups.sector,
  ])

  return sortByCountThenLabel(
    sectorOptions.map((label) =>
      createGroupChip(
        label,
        label,
        countRowsForOption(rows, safeState, searchQuery, 'sector', label),
        safeState.filterGroups.sector.includes(label)
      )
    )
  ).filter((chip) => chip.count > 0 || chip.active)
}

function collectPresentGroupKeys(rows, groupKey) {
  return new Set(
    rows.flatMap((row) => {
      if (groupKey === 'type') return row.typeKey ? [row.typeKey] : []
      if (groupKey === 'eventWindow') return row.eventWindowKeys || []
      if (groupKey === 'pnl') return row.pnlKey ? [row.pnlKey] : []
      if (groupKey === 'risk') return row.riskFlags || []
      return []
    })
  )
}

function buildTypedChips(metaMap, rows, state, searchQuery, groupKey, orderedKeys = null) {
  const safeState = normalizeHoldingsFilterState(state)
  const activeKeys = safeState.filterGroups[groupKey] || []
  const presentKeys = collectPresentGroupKeys(rows, groupKey)
  const optionKeys = orderedKeys || Object.keys(metaMap)

  return optionKeys
    .map((key) =>
      createGroupChip(
        key,
        metaMap[key]?.label || key,
        countRowsForOption(rows, safeState, searchQuery, groupKey, key),
        activeKeys.includes(key)
      )
    )
    .filter((chip) => chip.count > 0 || chip.active || presentKeys.has(chip.key))
}

export function buildHoldingsFilterModel({
  holdings = [],
  holdingDossiers = [],
  newsEvents = [],
  state = null,
  searchQuery = '',
} = {}) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const safeHoldingDossiers = Array.isArray(holdingDossiers) ? holdingDossiers : []
  const portfolioContext = buildRetailPortfolioContext({
    holdings: safeHoldings,
    holdingDossiers: safeHoldingDossiers,
    newsEvents,
  })
  const safeState = normalizeHoldingsFilterState(state)

  const rows = safeHoldings.map((holding) => {
    const code = String(holding?.code || '').trim()
    const dossier = portfolioContext.dossierByCode.get(code) || null
    const retailIntent = deriveRetailIntent(holding, portfolioContext, dossier)
    const eventContext = portfolioContext.eventContextByCode.get(code) || createEmptyEventContext()
    const typeKey = resolveHoldingTypeKey(holding, dossier)
    const intentKey = normalizeIntentKey(retailIntent.intent)

    const row = {
      code,
      holding,
      dossier,
      intentKey,
      typeKey,
      typeLabel: HOLDINGS_FILTER_TYPE_META[typeKey]?.label || HOLDINGS_FILTER_TYPE_META.other.label,
      sectorLabel: resolveHoldingSectorLabel(holding, dossier),
      eventWindowKeys: resolveHoldingEventWindowKeys(eventContext),
      pnlKey: resolveHoldingPnlBucket(holding, dossier),
      riskFlags: retailIntent.riskFlags,
      tags: retailIntent.tags,
      legacyPrimaryKey: resolveHoldingLegacyPrimaryKey(holding, dossier),
      legacyPillarKey: resolveHoldingPillarKey(dossier),
      legacyEventStatusKeys: eventContext.legacyStatusKeys,
    }

    return {
      ...row,
      searchText: buildSearchText(row),
    }
  })

  return {
    rows,
    primaryChips: HOLDINGS_FILTER_PRIMARY_ORDER.map((key) => ({
      key,
      label: HOLDINGS_FILTER_PRIMARY_META[key]?.label || HOLDINGS_FILTER_PRIMARY_META.all.label,
      count: countRowsForIntent(rows, safeState, searchQuery, key),
    })),
    filterGroups: [
      {
        key: 'sector',
        label: HOLDINGS_FILTER_GROUP_META.sector.label,
        chips: buildSectorChips(rows, safeState, searchQuery),
      },
      {
        key: 'type',
        label: HOLDINGS_FILTER_GROUP_META.type.label,
        chips: buildTypedChips(HOLDINGS_FILTER_TYPE_META, rows, safeState, searchQuery, 'type', [
          'growth',
          'event',
          'etf',
          'warrant',
          'cyclical',
          'value',
          'other',
        ]),
      },
      {
        key: 'eventWindow',
        label: HOLDINGS_FILTER_GROUP_META.eventWindow.label,
        chips: buildTypedChips(
          HOLDINGS_FILTER_EVENT_WINDOW_META,
          rows,
          safeState,
          searchQuery,
          'eventWindow',
          ['weekEvent', 'monthDividend', 'news3d']
        ),
      },
      {
        key: 'pnl',
        label: HOLDINGS_FILTER_GROUP_META.pnl.label,
        chips: buildTypedChips(HOLDINGS_FILTER_PNL_META, rows, safeState, searchQuery, 'pnl', [
          'positive',
          'negative',
          'flat',
        ]),
      },
      {
        key: 'risk',
        label: HOLDINGS_FILTER_GROUP_META.risk.label,
        chips: buildTypedChips(HOLDINGS_FILTER_RISK_META, rows, safeState, searchQuery, 'risk', [
          'singleOver20',
          'sectorOver40',
          'nearStopLoss',
          'stale',
        ]),
      },
    ],
  }
}

export function filterHoldingsByChipState(rows = [], state, searchQuery = '') {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => rowMatchesState(row, state, searchQuery))
    .map((row) => row.holding)
}

export function buildLegacyHoldingsFilterStateMirror(state) {
  const safeState = normalizeHoldingsFilterState(state)
  return buildLegacyMirrorFromRetailState({
    intentKey: safeState.intentKey,
    filterGroups: safeState.filterGroups,
  })
}

export function readHoldingsFilterStateFromSearch(search = '') {
  const params = new URLSearchParams(String(search || ''))
  const nextState = buildBaseRetailState()
  const searchQuery = String(params.get(HOLDINGS_FILTER_URL_PARAM_KEYS.query) || '').trim()
  let hasFilterParams = false

  const intentParam = params.get(HOLDINGS_FILTER_URL_PARAM_KEYS.intent)
  if (intentParam) {
    nextState.intentKey = normalizeIntentKey(intentParam)
    hasFilterParams = true
  }

  for (const [groupKey, paramKey] of Object.entries({
    sector: HOLDINGS_FILTER_URL_PARAM_KEYS.sector,
    type: HOLDINGS_FILTER_URL_PARAM_KEYS.type,
    eventWindow: HOLDINGS_FILTER_URL_PARAM_KEYS.eventWindow,
    pnl: HOLDINGS_FILTER_URL_PARAM_KEYS.pnl,
    risk: HOLDINGS_FILTER_URL_PARAM_KEYS.risk,
  })) {
    const rawValue = String(params.get(paramKey) || '').trim()
    if (!rawValue) continue
    hasFilterParams = true
    nextState.filterGroups[groupKey] = uniqueStrings(
      rawValue
        .split(',')
        .map((value) => normalizeGroupValue(groupKey, value))
        .filter(Boolean)
    )
  }

  return {
    hasFilterParams: hasFilterParams || Boolean(searchQuery),
    filterState: withLegacyMirror(nextState),
    searchQuery,
  }
}

export function applyHoldingsFilterStateToSearchParams(params, state, searchQuery = '') {
  const safeParams = params instanceof URLSearchParams ? params : new URLSearchParams(params)
  const safeState = normalizeHoldingsFilterState(state)

  for (const key of Object.values(HOLDINGS_FILTER_URL_PARAM_KEYS)) {
    safeParams.delete(key)
  }

  if (safeState.intentKey !== 'all') {
    safeParams.set(HOLDINGS_FILTER_URL_PARAM_KEYS.intent, safeState.intentKey)
  }

  const groupParamEntries = [
    ['sector', HOLDINGS_FILTER_URL_PARAM_KEYS.sector],
    ['type', HOLDINGS_FILTER_URL_PARAM_KEYS.type],
    ['eventWindow', HOLDINGS_FILTER_URL_PARAM_KEYS.eventWindow],
    ['pnl', HOLDINGS_FILTER_URL_PARAM_KEYS.pnl],
    ['risk', HOLDINGS_FILTER_URL_PARAM_KEYS.risk],
  ]

  for (const [groupKey, paramKey] of groupParamEntries) {
    const values = uniqueStrings(safeState.filterGroups[groupKey] || [])
    if (values.length > 0) {
      safeParams.set(paramKey, values.join(','))
    }
  }

  const normalizedQuery = String(searchQuery || '').trim()
  if (normalizedQuery) {
    safeParams.set(HOLDINGS_FILTER_URL_PARAM_KEYS.query, normalizedQuery)
  }

  return safeParams
}
