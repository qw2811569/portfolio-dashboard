const EVENT_TYPE_META_ENTRIES = {
  earnings: {
    label: '財報',
    shortLabel: '財報',
    filterLabel: '財報日',
    defaultVisible: true,
    needsThesisReview: true,
  },
  'ex-dividend': {
    label: '除權息',
    shortLabel: '除權息',
    filterLabel: '除權息',
    defaultVisible: true,
    needsThesisReview: true,
  },
  'shareholding-meeting': {
    label: '股東會',
    shortLabel: '股東會',
    filterLabel: '股東會',
    defaultVisible: true,
    needsThesisReview: true,
  },
  strategic: {
    label: '策略變動',
    shortLabel: '策略',
    filterLabel: '策略變動',
    defaultVisible: true,
    needsThesisReview: true,
  },
  informational: {
    label: '資訊',
    shortLabel: '資訊',
    filterLabel: '資訊',
    defaultVisible: false,
    needsThesisReview: false,
  },
  macro: {
    label: '總經',
    shortLabel: '總經',
    filterLabel: '總經',
    defaultVisible: true,
    needsThesisReview: true,
  },
  market: {
    label: '市場',
    shortLabel: '市場',
    filterLabel: '市場',
    defaultVisible: true,
    needsThesisReview: true,
  },
  technical: {
    label: '技術',
    shortLabel: '技術',
    filterLabel: '技術',
    defaultVisible: true,
    needsThesisReview: true,
  },
  other: {
    label: '事件',
    shortLabel: '事件',
    filterLabel: '其他',
    defaultVisible: true,
    needsThesisReview: true,
  },
}

export const EVENT_TYPE_META = Object.freeze(
  Object.fromEntries(
    Object.entries(EVENT_TYPE_META_ENTRIES).map(([key, value]) => [key, Object.freeze(value)])
  )
)

export const ALL_EVENTS_FILTER_LABEL = '全部'

export const PRIMARY_EVENT_FILTERS = Object.freeze([
  'earnings',
  'ex-dividend',
  'shareholding-meeting',
  'strategic',
  'informational',
])

export const EVENT_TYPES = Object.freeze(Object.keys(EVENT_TYPE_META))

const EVENT_TYPE_ALIASES = Object.freeze({
  earnings: 'earnings',
  conference: 'earnings',
  revenue: 'earnings',
  法說: 'earnings',
  法人說明會: 'earnings',
  財報: 'earnings',
  營收: 'earnings',
  dividend: 'ex-dividend',
  'ex-dividend': 'ex-dividend',
  'ex-rights': 'ex-dividend',
  除息: 'ex-dividend',
  除權: 'ex-dividend',
  除權息: 'ex-dividend',
  股利: 'ex-dividend',
  配息: 'ex-dividend',
  配股: 'ex-dividend',
  shareholder: 'shareholding-meeting',
  'shareholding-meeting': 'shareholding-meeting',
  股東會: 'shareholding-meeting',
  股東常會: 'shareholding-meeting',
  股東臨時會: 'shareholding-meeting',
  strategic: 'strategic',
  catalyst: 'strategic',
  corporate: 'strategic',
  material: 'strategic',
  策略: 'strategic',
  催化: 'strategic',
  informational: 'informational',
  information: 'informational',
  資訊: 'informational',
  紀念品: 'informational',
  macro: 'macro',
  總經: 'macro',
  market: 'market',
  大盤: 'market',
  technical: 'technical',
  技術: 'technical',
  操作: 'technical',
  other: 'other',
})

const EARNINGS_RE = /營收|財報|eps|法說|法人說明會|季報|年報|業績|獲利/u
const EX_DIVIDEND_RE = /除權息|除權|除息|股利|配息|配股|現金股利|股票股利|減資/u
const SHAREHOLDER_RE = /股東(?:常)?會|股東臨時會|股東會/u
const INFORMATIONAL_RE = /紀念品|股東贈品|股東禮|紀念禮|gift/u
const STRATEGIC_RE =
  /併購|收購|合併|策略聯盟|轉型|換將|接班|董事長|總經理|執行長|主管|重大投資|擴產|減產|資本支出|新業務|跨足|處分|出售|政策|法規|補助|關稅|標案/u
const MACRO_RE = /fomc|fed|利率|gdp|cpi|央行|匯率|關稅|經濟|出口/u
const MARKET_RE = /加權|大盤|指數|盤面|成交量|市場焦點/u
const TECHNICAL_RE = /外資|融資|融券|成交量|突破|跌破|籌碼/u

function normalizeToken(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function buildEventText(event = {}) {
  return [
    event?.title,
    event?.detail,
    event?.description,
    event?.sub,
    event?.label,
    event?.type,
    event?.eventType,
  ]
    .filter(Boolean)
    .join(' ')
}

export function normalizeEventType(value) {
  const normalized = normalizeToken(value)
  if (!normalized) return null
  return EVENT_TYPE_ALIASES[normalized] || null
}

export function getEventTypeMeta(value) {
  const eventType = normalizeEventType(value) || 'other'
  return EVENT_TYPE_META[eventType] || EVENT_TYPE_META.other
}

export function getEventTypeLabel(value) {
  return getEventTypeMeta(value).label
}

export function inferEventType(event = {}) {
  const explicitType = normalizeEventType(event?.eventType)
  if (explicitType) return explicitType

  const legacyType = normalizeEventType(event?.type)
  if (legacyType) return legacyType

  const source = normalizeToken(event?.source)
  const catalystType = normalizeToken(event?.catalystType)
  const text = buildEventText(event)

  if (['finmind-dividend', 'finmind-capital-reduction', 'twse-ex-rights'].includes(source)) {
    return 'ex-dividend'
  }
  if (['mops-shareholder', 'shareholder-announcement'].includes(source)) {
    return 'shareholding-meeting'
  }
  if (
    ['cbc-calendar', 'cbc-news', 'dgbas-calendar', 'mof-calendar', 'fsc-rss'].includes(source) ||
    catalystType === 'macro'
  ) {
    return 'macro'
  }
  if (source === 'market-cache') return 'market'
  if (catalystType === 'technical') return 'technical'

  if (SHAREHOLDER_RE.test(text)) return 'shareholding-meeting'
  if (EARNINGS_RE.test(text)) return 'earnings'
  if (EX_DIVIDEND_RE.test(text)) return 'ex-dividend'
  if (STRATEGIC_RE.test(text)) return 'strategic'
  if (INFORMATIONAL_RE.test(text)) return 'informational'
  if (MACRO_RE.test(text)) return 'macro'
  if (MARKET_RE.test(text)) return 'market'
  if (TECHNICAL_RE.test(text)) return 'technical'

  if (catalystType === 'earnings') return 'earnings'
  if (catalystType === 'macro') return 'macro'
  if (catalystType === 'technical') return 'technical'

  return 'other'
}

export function shouldCollapseEventByDefault(event = {}) {
  const eventType = inferEventType(event)
  return eventType === 'informational'
}

export function shouldEventNeedThesisReview(event = {}) {
  if (typeof event?.needsThesisReview === 'boolean') {
    return event.needsThesisReview
  }
  const meta = getEventTypeMeta(event?.eventType || inferEventType(event))
  return meta.needsThesisReview
}
