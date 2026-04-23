import { buildInternalAuthHeaders, withApiAuth } from './_lib/auth-middleware.js'
import { queryFinMindDataset } from './_lib/finmind-governor.js'
// Vercel Serverless Function — 自動事件行事曆 API
// 整合多種來源產生投資事件：
// 1. MOPS 重大訊息（法說會、股利、重訊）
// 2. 月營收公布日（每月 1-10 號）
// 3. TWSE 除權息日程
// 4. 固定行事曆（FOMC、央行、財報季）

const FIXED_EVENT_LOOKAHEAD_DAYS = 45
const GEMINI_EVENT_LOOKAHEAD_DAYS = 60
const ANNOUNCEMENT_LOOKBACK_DAYS = 7
const FSC_PRESS_RSS_URL = 'https://www.fsc.gov.tw/RSS/Messages?language=chinese&serno=201202290009'
const CBC_PRESS_LIST_URL = 'https://www.cbc.gov.tw/tw/lp-302-1.html'
const CBC_BOARD_SCHEDULE_URL = 'https://www.cbc.gov.tw/tw/cp-357-189514-82841-1.html'
const TWSE_EX_RIGHTS_URL = 'https://www.twse.com.tw/exchangeReport/TWT48U?response=json'
const MOF_TRADE_NEWS_URL = 'https://www.mof.gov.tw/singlehtml/121?cntId=1201'
const DGBAS_RELEASE_CALENDAR_URL = 'https://www.stat.gov.tw/News_NoticeCalendar.aspx?n=3717'
const DGBAS_CPI_REFERENCE_URL = 'https://ws.dgbas.gov.tw/win/dgbas03/bs7/sdds/english/cpi.htm'
const TWSE_EX_RIGHTS_PAGE_URL = 'https://www.twse.com.tw/zh/page/trading/exchange/TWT48U.html'
const DGBAS_GDP_NEWS_URL = 'https://www.stat.gov.tw/News.aspx?n=3703&sms=10980'

function normalizeText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHtml(value) {
  return normalizeText(value)
}

function clampDay(year, month, day) {
  const lastDay = new Date(year, month, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}

function formatIsoDate(year, month, day) {
  const resolvedDay = clampDay(year, month, day)
  return `${year}-${String(month).padStart(2, '0')}-${String(resolvedDay).padStart(2, '0')}`
}

export function parseRocDateString(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const rocMatch = raw.match(/(\d{2,3})年\s*(\d{1,2})月\s*(\d{1,2})日/)
  if (rocMatch) {
    const year = Number(rocMatch[1]) + 1911
    const month = Number(rocMatch[2])
    const day = Number(rocMatch[3])
    return formatIsoDate(year, month, day)
  }

  const compactMatch = raw.match(/(\d{3})(\d{2})(\d{2})/)
  if (compactMatch) {
    const year = Number(compactMatch[1]) + 1911
    const month = Number(compactMatch[2])
    const day = Number(compactMatch[3])
    return formatIsoDate(year, month, day)
  }

  return null
}

function parseRocDateTimeString(value) {
  const raw = String(value || '').trim()
  const date = parseRocDateString(raw)
  if (!date) return null

  const timeMatch = raw.match(/(\d{1,2})[:時](\d{2})/)
  const time = timeMatch
    ? `${String(Number(timeMatch[1])).padStart(2, '0')}:${String(Number(timeMatch[2])).padStart(2, '0')}`
    : ''

  return {
    date,
    time,
  }
}

function readNumericDateToken(value) {
  const match = String(value || '').match(/(\d{1,2})/)
  return match ? Number(match[1]) : null
}

function isBusinessDay(date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function nthBusinessDayAfterMonthEnd(year, month, nth = 5) {
  let cursor = new Date(year, month, 1)
  let businessCount = 0

  while (businessCount < nth) {
    if (isBusinessDay(cursor)) businessCount += 1
    if (businessCount === nth) {
      return formatIsoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return formatIsoDate(year, month, nth)
}

function shiftDate(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toAbsoluteUrl(baseUrl, href) {
  if (!href) return ''
  try {
    return new URL(String(href).trim(), baseUrl).toString()
  } catch {
    return ''
  }
}

function toHttpsUrl(value) {
  const href = String(value || '').trim()
  if (!href) return ''
  if (href.startsWith('http://')) return `https://${href.slice('http://'.length)}`
  return href
}

function isIsoDateInWindow(dateStr, startDate, endDate) {
  if (!dateStr) return false
  const normalized = parseRocDateString(dateStr) || dateStr
  if (!normalized) return false
  return isDateInRange(normalized, startDate, endDate)
}

function createCalendarEvent({
  id,
  date,
  title,
  detail = '',
  source = 'auto-calendar',
  type = 'macro',
  stocks = [],
  status = 'pending',
  pred = 'neutral',
  predReason = '',
  catalystType = 'macro',
  impact = 'medium',
  link = '',
  time = '',
  marketSegment = '',
}) {
  const normalizedDate = parseRocDateString(date) || String(date || '').trim()
  if (!normalizedDate) return null

  return {
    id,
    date: normalizedDate,
    eventDate: normalizedDate,
    type,
    source,
    title,
    detail,
    stocks,
    status,
    pred,
    predReason,
    catalystType,
    impact,
    link,
    time,
    marketSegment,
  }
}

async function fetchText(url, timeoutMs = 4500) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept:
        'text/html, application/rss+xml, application/xml, text/xml;q=0.9, application/json;q=0.8',
      'User-Agent': 'portfolio-dashboard/1.0',
    },
  })
  if (!response.ok) {
    throw new Error(`fetch failed (${response.status}) for ${url}`)
  }
  return response.text()
}

function parseRssItems(xml = '') {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  for (const match of xml.matchAll(itemRegex)) {
    const block = match[1] || ''
    const title = normalizeText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
    const link = toHttpsUrl(normalizeText(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || ''))
    const pubDate = normalizeText(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '')
    if (!title || !pubDate) continue
    items.push({
      title,
      link,
      pubDate: parseRocDateString(pubDate) || pubDate,
    })
  }
  return items
}

function parseCbcPressList(html = '') {
  const rows = []
  const itemRegex =
    /<li><span class="num">\d+<\/span><time>(\d{4}-\d{2}-\d{2})<\/time><a href="([^"]+)" title="([^"]+)">/g
  for (const match of html.matchAll(itemRegex)) {
    rows.push({
      date: match[1],
      link: toAbsoluteUrl(CBC_PRESS_LIST_URL, match[2]),
      title: stripHtml(match[3]),
    })
  }
  return rows
}

function parseCbcBoardScheduleDates(html = '') {
  return [...html.matchAll(/(\d{2,3})年(\d{1,2})月(\d{1,2})日/g)].map((match) =>
    formatIsoDate(Number(match[1]) + 1911, Number(match[2]), Number(match[3]))
  )
}

function buildStatCalendarDate(year, monthIndex, item = {}) {
  const day = readNumericDateToken(item?.date)
  if (!day) return null
  return formatIsoDate(year, monthIndex + 1, day)
}

function extractStatCalendarTimedatas(html = '', name = '') {
  if (!html || !name) return []
  const compact = html.replace(/\s+/g, ' ')
  const pattern = new RegExp(
    `"name":"${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}".*?"timedatas":(\\[[\\s\\S]*?\\])\\s*,\\"IsPressConference\\"`,
    'i'
  )
  const match = compact.match(pattern)
  if (!match) return []
  try {
    return JSON.parse(match[1])
  } catch {
    return []
  }
}

export function buildDgbasMacroCalendarEvents(
  html = '',
  { today = new Date(), rangeDays = 30 } = {}
) {
  const events = []
  const endDate = shiftDate(today, rangeDays)
  const year = today.getFullYear()

  const gdpAdvanceTimedatas = extractStatCalendarTimedatas(html, '國民所得概估統計')
  for (let monthIndex = 0; monthIndex < gdpAdvanceTimedatas.length; monthIndex += 1) {
    for (const item of gdpAdvanceTimedatas[monthIndex] || []) {
      const date = buildStatCalendarDate(year, monthIndex, item)
      if (!isIsoDateInWindow(date, today, endDate)) continue
      const quarter = normalizeText(item.notice || '').replace(/[()]/g, '')
      const time = normalizeText(item.time || '')
      events.push(
        createCalendarEvent({
          id: `dgbas-gdp-advance-${date}`,
          date,
          time,
          type: 'macro',
          source: 'dgbas-calendar',
          title: `${quarter || 'GDP'} 概估`,
          detail: '主計總處先給市場一個季度輪廓，電子、航運與景氣循環股通常會先對這組數字有反應。',
          predReason: '官方 GDP 概估時點',
          catalystType: 'macro',
          impact: 'high',
          link: DGBAS_GDP_NEWS_URL,
          marketSegment: 'macro',
        })
      )
    }
  }

  const gdpTimedatas = extractStatCalendarTimedatas(
    html,
    '國內生產毛額、國民所得、經濟成長率及平減指數'
  )
  const forecastTimedatas = extractStatCalendarTimedatas(html, '經濟預測')
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const gdpEntry = (gdpTimedatas[monthIndex] || [])[0] || null
    const forecastEntry = (forecastTimedatas[monthIndex] || [])[0] || null
    const referenceEntry = gdpEntry || forecastEntry
    if (!referenceEntry) continue
    const date = buildStatCalendarDate(year, monthIndex, referenceEntry)
    if (!isIsoDateInWindow(date, today, endDate)) continue
    const time = normalizeText(referenceEntry.time || gdpEntry?.time || forecastEntry?.time || '')
    const notice = normalizeText(gdpEntry?.notice || forecastEntry?.notice || '').replace(
      /[()]/g,
      ''
    )
    events.push(
      createCalendarEvent({
        id: `dgbas-gdp-final-${date}`,
        date,
        time,
        type: 'macro',
        source: 'dgbas-calendar',
        title: `${notice || 'GDP'} 更新`,
        detail: '這天會把 GDP、國民所得與年度展望一起攤開來看，市場會順手重估出口鏈與內需節奏。',
        predReason: '官方 GDP / 經濟預測更新時點',
        catalystType: 'macro',
        impact: 'high',
        link: DGBAS_RELEASE_CALENDAR_URL,
        marketSegment: 'macro',
      })
    )
  }

  for (let offset = 0; offset < 2; offset += 1) {
    const referenceMonth = new Date(today.getFullYear(), today.getMonth() + offset + 1, 1)
    const releaseDate = nthBusinessDayAfterMonthEnd(
      referenceMonth.getFullYear(),
      referenceMonth.getMonth() + 1,
      5
    )
    if (!isIsoDateInWindow(releaseDate, today, endDate)) continue
    const statsMonth = new Date(referenceMonth)
    statsMonth.setMonth(statsMonth.getMonth() - 1)
    const label = `${statsMonth.getFullYear()}/${String(statsMonth.getMonth() + 1).padStart(2, '0')}`
    events.push(
      createCalendarEvent({
        id: `dgbas-cpi-${releaseDate}`,
        date: releaseDate,
        time: '16:00',
        type: 'macro',
        source: 'dgbas-calendar',
        title: `${label} CPI / PPI 公布`,
        detail:
          '主計總處通常在下午 4 點更新物價數字，利率敏感、內需與零售股常會先看這組資料怎麼落地。',
        predReason: '官方物價統計固定發布節奏',
        catalystType: 'macro',
        impact: 'high',
        link: DGBAS_CPI_REFERENCE_URL,
        marketSegment: 'macro',
      })
    )
  }

  return events.filter(Boolean)
}

export function buildTwseExRightsEventsFromResponse(
  payload = {},
  { today = new Date(), rangeDays = 30 } = {}
) {
  const endDate = shiftDate(today, rangeDays)
  const rows = Array.isArray(payload?.data) ? payload.data : []

  return rows
    .map((row) => {
      const date = parseRocDateString(row?.[0])
      if (!isIsoDateInWindow(date, today, endDate)) return null
      const code = normalizeText(row?.[1])
      const name = normalizeText(row?.[2])
      const dividendType = normalizeText(row?.[3]) || '除權息'
      const cashDividendRaw = normalizeText(row?.[7])
      const cashDividend = Number(cashDividendRaw)
      const cashDividendLabel = Number.isFinite(cashDividend)
        ? `現金股利 ${cashDividend.toFixed(2)} 元`
        : cashDividendRaw || '現金股利待公告'

      return {
        event: createCalendarEvent({
          id: `twse-ex-rights-${code}-${date}`,
          date,
          type: 'dividend',
          source: 'twse-ex-rights',
          title: `${name}(${code}) ${dividendType}`,
          detail: `${cashDividendLabel}，除權息日靠近時，殖利率與填息題材通常會重新被拿出來看。`,
          predReason: 'TWSE 除權息預告表',
          catalystType: 'dividend',
          impact: 'medium',
          link: TWSE_EX_RIGHTS_PAGE_URL,
          marketSegment: 'calendar',
          stocks: code ? [code] : [],
        }),
        sortCashDividend: Number.isFinite(cashDividend) ? cashDividend : -1,
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      const dateDiff = String(left.event?.date || '').localeCompare(String(right.event?.date || ''))
      if (dateDiff !== 0) return dateDiff
      return right.sortCashDividend - left.sortCashDividend
    })
    .slice(0, 8)
    .map((item) => item.event)
}

export function parseMofNextTradeRelease(html = '') {
  const compact = html.replace(/\s+/g, ' ')
  const match = compact.match(
    /海關進出口貿易初步統計.*?發布日期：\s*([0-9]{2,3}年[0-9]{1,2}月[0-9]{1,2}日).*?下次發布日期：\s*([0-9]{2,3}年[0-9]{1,2}月[0-9]{1,2}日(?:下午)?[0-9]{1,2}時(?:[0-9]{1,2}分)?)/i
  )
  if (!match) return null

  const currentRelease = parseRocDateString(match[1])
  const nextRelease = parseRocDateTimeString(match[2])
  if (!nextRelease?.date) return null

  return {
    currentRelease,
    nextReleaseDate: nextRelease.date,
    nextReleaseTime: nextRelease.time || '16:00',
  }
}

function filterRecentWindow(dateStr, today, lookbackDays = ANNOUNCEMENT_LOOKBACK_DAYS) {
  const normalized = parseRocDateString(dateStr)
  if (!normalized) return false
  const startDate = shiftDate(today, -lookbackDays)
  return isDateInRange(normalized, startDate, today)
}

const FSC_MARKET_KEYWORDS =
  /金控|保險|證券|期貨|銀行|基金|ETF|金融科技|數位金融|洗錢|開放銀行|資本市場|股市|房貸|授信/i
const CBC_MARKET_KEYWORDS =
  /理監事|外匯|匯率|外匯存底|金融|五大銀行|信用管制|房貸|人民幣|準備貨幣|CBDC/i

async function fetchFscAnnouncementEvents(today, _rangeDays) {
  try {
    const xml = await fetchText(FSC_PRESS_RSS_URL, 3500)
    return parseRssItems(xml)
      .filter((item) => filterRecentWindow(item.pubDate, today))
      .filter((item) => FSC_MARKET_KEYWORDS.test(item.title))
      .slice(0, 4)
      .map((item, index) =>
        createCalendarEvent({
          id: `fsc-news-${item.pubDate}-${index}`,
          date: item.pubDate,
          type: 'macro',
          source: 'fsc-rss',
          title: item.title,
          detail: '金管會本週有新公告，金融股、券商與保險族群可以留意盤面怎麼消化這個訊息。',
          predReason: '金管會 RSS 新聞稿',
          catalystType: 'macro',
          impact: 'medium',
          link: item.link,
          marketSegment: 'regulator',
        })
      )
      .filter(Boolean)
  } catch (error) {
    console.warn('FSC announcements fetch error:', error.message)
    return []
  }
}

async function fetchCbcAnnouncementEvents(today, _rangeDays) {
  try {
    const html = await fetchText(CBC_PRESS_LIST_URL, 3500)
    return parseCbcPressList(html)
      .filter((item) => filterRecentWindow(item.date, today))
      .filter((item) => CBC_MARKET_KEYWORDS.test(item.title))
      .slice(0, 4)
      .map((item) =>
        createCalendarEvent({
          id: `cbc-news-${item.date}-${item.title.slice(0, 18)}`,
          date: item.date,
          type: 'macro',
          source: 'cbc-news',
          title: item.title,
          detail: '央行這週有新訊息，金融、利率敏感與匯率連動族群通常會先有情緒反應。',
          predReason: '央行新聞稿列表',
          catalystType: 'macro',
          impact: /理監事|外匯存底|匯率/.test(item.title) ? 'high' : 'medium',
          link: item.link,
          marketSegment: 'central-bank',
        })
      )
      .filter(Boolean)
  } catch (error) {
    console.warn('CBC announcements fetch error:', error.message)
    return []
  }
}

async function fetchCbcBoardMeetingEvents(today, rangeDays) {
  try {
    const html = await fetchText(CBC_BOARD_SCHEDULE_URL, 3500)
    const endDate = shiftDate(today, rangeDays)
    return parseCbcBoardScheduleDates(html)
      .filter((date) => isIsoDateInWindow(date, today, endDate))
      .map((date) =>
        createCalendarEvent({
          id: `cbc-board-${date}`,
          date,
          time: '16:00',
          type: 'macro',
          source: 'cbc-calendar',
          title: '台灣央行理監事會議',
          detail: '利率與選擇性信用管制通常都在這天定調，金融、營建與高股息族群容易先被點名。',
          predReason: '央行公告之年度理監事會議日期',
          catalystType: 'macro',
          impact: 'high',
          link: CBC_BOARD_SCHEDULE_URL,
          marketSegment: 'central-bank',
        })
      )
      .filter(Boolean)
  } catch (error) {
    console.warn('CBC board schedule fetch error:', error.message)
    return []
  }
}

async function fetchCbcFxCalendarEvents(today, rangeDays) {
  try {
    const html = await fetchText(CBC_PRESS_LIST_URL, 3500)
    const latestReserve = parseCbcPressList(html).find((item) => /外匯存底/.test(item.title))
    if (!latestReserve?.link) return []

    const detailHtml = await fetchText(latestReserve.link, 3500)
    const nextReleaseMatch = detailHtml.match(
      /下一次之發布時間為\s*([0-9]{2,3}年[0-9]{1,2}月[0-9]{1,2}日)([0-9]{1,2}時[0-9]{2}分)/
    )
    if (!nextReleaseMatch) return []

    const nextReleaseDate = parseRocDateString(nextReleaseMatch[1])
    const nextReleaseTime = normalizeText(nextReleaseMatch[2]).replace('時', ':').replace('分', '')
    if (!nextReleaseDate) return []
    const endDate = shiftDate(today, rangeDays)
    if (!isIsoDateInWindow(nextReleaseDate, today, endDate)) return []

    return [
      createCalendarEvent({
        id: `cbc-fx-${nextReleaseDate}`,
        date: nextReleaseDate,
        time: nextReleaseTime || '16:20',
        type: 'macro',
        source: 'cbc-calendar',
        title: '央行外匯存底公布',
        detail: '外匯存底固定在下午更新，台幣、壽險與金控題材通常會順手被拿來比對。',
        predReason: '央行外匯存底新聞稿註記之下次發布時間',
        catalystType: 'macro',
        impact: 'medium',
        link: latestReserve.link,
        marketSegment: 'central-bank',
      }),
    ].filter(Boolean)
  } catch (error) {
    console.warn('CBC FX calendar fetch error:', error.message)
    return []
  }
}

async function fetchTwseExRightsEvents(today, rangeDays) {
  try {
    const response = await fetch(TWSE_EX_RIGHTS_URL, {
      signal: AbortSignal.timeout(3500),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'portfolio-dashboard/1.0',
      },
    })
    if (!response.ok) return []
    const payload = await response.json()
    return buildTwseExRightsEventsFromResponse(payload, { today, rangeDays })
  } catch (error) {
    console.warn('TWSE ex-rights fetch error:', error.message)
    return []
  }
}

async function fetchMofTradeReleaseEvents(today, rangeDays) {
  try {
    const html = await fetchText(MOF_TRADE_NEWS_URL, 3500)
    const parsed = parseMofNextTradeRelease(html)
    if (!parsed?.nextReleaseDate) return []
    const endDate = shiftDate(today, rangeDays)
    if (!isIsoDateInWindow(parsed.nextReleaseDate, today, endDate)) return []

    return [
      createCalendarEvent({
        id: `mof-export-${parsed.nextReleaseDate}`,
        date: parsed.nextReleaseDate,
        time: parsed.nextReleaseTime || '16:00',
        type: 'macro',
        source: 'mof-calendar',
        title: '財政部出口統計公布',
        detail: '出口數字一更新，電子鏈、航運與景氣循環股通常會很快被重新定價。',
        predReason: '財政部海關進出口貿易初步統計之下次發布日期',
        catalystType: 'macro',
        impact: 'high',
        link: MOF_TRADE_NEWS_URL,
        marketSegment: 'macro',
      }),
    ].filter(Boolean)
  } catch (error) {
    console.warn('MOF trade release fetch error:', error.message)
    return []
  }
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { codes, range = '30' } = req.query
  const stockCodes = codes
    ? codes
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : []
  const rangeDays = Math.min(parseInt(range) || 30, 90)
  const fixedLookaheadDays = Math.max(rangeDays, FIXED_EVENT_LOOKAHEAD_DAYS)
  const geminiLookaheadDays = Math.max(rangeDays, GEMINI_EVENT_LOOKAHEAD_DAYS)

  try {
    const today = new Date()
    const events = []
    const generatedAt = new Date().toISOString()

    // ── 1. 月營收公布日（每月 1-10 號，所有上市櫃公司） ──
    const revenueEvents = generateRevenueAnnouncementEvents(today, rangeDays, stockCodes)
    events.push(...revenueEvents)

    // ── 2. 固定行事曆事件（FOMC、財報季） ──
    const fixedEvents = generateFixedCalendarEvents(today, fixedLookaheadDays)
    events.push(...fixedEvents)

    // ── 3. 官方總經 / 央行 / 監理 calendar 與公告 ──
    const [
      dgbasMacroEvents,
      cbcBoardEvents,
      cbcFxEvents,
      cbcAnnouncementEvents,
      fscAnnouncementEvents,
      twseExRightsEvents,
      mofTradeReleaseEvents,
    ] = await Promise.allSettled([
      fetchText(DGBAS_RELEASE_CALENDAR_URL, 3500).then((html) =>
        buildDgbasMacroCalendarEvents(html, { today, rangeDays: fixedLookaheadDays })
      ),
      fetchCbcBoardMeetingEvents(today, fixedLookaheadDays),
      fetchCbcFxCalendarEvents(today, fixedLookaheadDays),
      fetchCbcAnnouncementEvents(today, fixedLookaheadDays),
      fetchFscAnnouncementEvents(today, fixedLookaheadDays),
      fetchTwseExRightsEvents(today, fixedLookaheadDays),
      fetchMofTradeReleaseEvents(today, fixedLookaheadDays),
    ])

    for (const result of [
      dgbasMacroEvents,
      cbcBoardEvents,
      cbcFxEvents,
      cbcAnnouncementEvents,
      fscAnnouncementEvents,
      twseExRightsEvents,
      mofTradeReleaseEvents,
    ]) {
      if (result.status === 'fulfilled') {
        events.push(...(result.value || []))
      }
    }

    // ── 4. 除權息旺季提醒（TWSE 預告失敗時至少保留季節提醒） ──
    const dividendEvents = generateDividendSeasonEvents(today, fixedLookaheadDays, stockCodes)
    events.push(...dividendEvents)

    // ── 5. MOPS 法說會 ── 已停用（需要瀏覽器會話）

    // ── 6. FinMind 個股新聞（直接呼叫外部 API，不走 self-request）──
    let finmindNewsEvents = []
    if (stockCodes.length > 0) {
      try {
        console.debug(
          '[event-calendar] FinMind news: querying',
          stockCodes.length,
          'stocks, token:',
          process.env.FINMIND_TOKEN ? 'SET' : 'MISSING'
        )
        finmindNewsEvents = await fetchFinMindNewsDirectly(stockCodes)
        console.debug('[event-calendar] FinMind news: got', finmindNewsEvents.length, 'events')
      } catch (finmindError) {
        console.warn('[event-calendar] FinMind news failed:', finmindError.message)
      }
    }
    events.push(...finmindNewsEvents)

    // ── 7. Gemini 蒐集的已確認事件（即時 API fallback） ──
    let geminiEvents = []
    try {
      geminiEvents = await loadGeminiCalendarEvents(today, geminiLookaheadDays, stockCodes)
    } catch (geminiError) {
      console.warn('Gemini 事件載入失敗（不影響其他事件）:', geminiError.message)
    }
    events.push(...geminiEvents)

    // 去重後按日期排序
    const dedupedEvents = dedupeCalendarEvents(events).map((event) => ({
      ...event,
      eventDate: event?.eventDate || event?.date || null,
      sourceUpdatedAt: String(event?.sourceUpdatedAt || generatedAt).trim() || generatedAt,
    }))
    dedupedEvents.sort((a, b) => a.date.localeCompare(b.date))

    return res.status(200).json({
      success: true,
      events: dedupedEvents,
      sources: [
        'revenue-calendar',
        'fixed-calendar',
        dgbasMacroEvents.status === 'fulfilled' && dgbasMacroEvents.value?.length > 0
          ? 'dgbas-calendar'
          : null,
        cbcBoardEvents.status === 'fulfilled' && cbcBoardEvents.value?.length > 0
          ? 'cbc-calendar'
          : null,
        cbcAnnouncementEvents.status === 'fulfilled' && cbcAnnouncementEvents.value?.length > 0
          ? 'cbc-news'
          : null,
        fscAnnouncementEvents.status === 'fulfilled' && fscAnnouncementEvents.value?.length > 0
          ? 'fsc-rss'
          : null,
        twseExRightsEvents.status === 'fulfilled' && twseExRightsEvents.value?.length > 0
          ? 'twse-ex-rights'
          : null,
        mofTradeReleaseEvents.status === 'fulfilled' && mofTradeReleaseEvents.value?.length > 0
          ? 'mof-calendar'
          : null,
        'dividend-season',
        finmindNewsEvents.length > 0 ? 'finmind-news' : null,
        geminiEvents.length > 0 ? 'gemini-research' : null,
      ].filter(Boolean),
      generatedAt,
    })
  } catch (error) {
    console.error('Event calendar error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 輔助函數：比較日期（忽略時間，只比較日期部分）
function isDateInRange(dateStr, today, endDate) {
  const todayStr = today.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)
  const dStr = dateStr
  return dStr >= todayStr && dStr <= endStr
}

// ── 月營收公布日 ──
function generateRevenueAnnouncementEvents(today, rangeDays, stockCodes) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)

  for (let d = new Date(today); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    // 每月 10 號是月營收公布截止日
    const deadline = new Date(d.getFullYear(), d.getMonth(), 10)
    if (deadline < today || deadline > endDate) continue

    const prevMonth = new Date(deadline)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const monthLabel = `${prevMonth.getFullYear()}/${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

    events.push({
      id: `rev-${deadline.toISOString().slice(0, 10)}`,
      date: deadline.toISOString().slice(0, 10),
      type: 'revenue',
      source: 'auto-calendar',
      title: `${monthLabel} 月營收公布截止`,
      detail:
        stockCodes.length > 0
          ? `關注持股：${stockCodes.join(', ')} 的 ${monthLabel} 月營收`
          : '所有上市櫃公司月營收公布截止日',
      stocks: stockCodes,
      status: 'pending',
      pred: 'neutral',
      predReason: '月營收是基本面追蹤的定期事件',
      catalystType: 'earnings',
      impact: 'medium',
    })
  }
  return events
}

// ── 固定行事曆（FOMC、央行、財報季） ──
function generateFixedCalendarEvents(today, rangeDays) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)
  const year = today.getFullYear()

  // FOMC 會議日（2026 預估）
  const fomcDates = [
    `${year}-01-29`,
    `${year}-03-19`,
    `${year}-05-07`,
    `${year}-06-18`,
    `${year}-07-30`,
    `${year}-09-17`,
    `${year}-11-05`,
    `${year}-12-17`,
  ]

  for (const dateStr of fomcDates) {
    const d = new Date(dateStr)
    if (d >= today && d <= endDate) {
      events.push({
        id: `fomc-${dateStr}`,
        date: dateStr,
        type: 'macro',
        source: 'auto-calendar',
        title: 'FOMC 利率決議',
        detail: '聯準會利率決議公布，影響全球股債市場。升息利空成長股、降息利多',
        stocks: [],
        status: 'pending',
        pred: 'neutral',
        predReason: '利率決議結果不確定',
        catalystType: 'macro',
        impact: 'high',
      })
    }
  }

  // 台股財報季（Q1:5/15、Q2:8/14、Q3:11/14、年報:3/31）
  const earningsDates = [
    { date: `${year}-03-31`, label: `${year - 1} 年報公布截止` },
    { date: `${year}-05-15`, label: `${year} Q1 季報公布截止` },
    { date: `${year}-08-14`, label: `${year} Q2 半年報公布截止` },
    { date: `${year}-11-14`, label: `${year} Q3 季報公布截止` },
  ]

  for (const item of earningsDates) {
    const d = new Date(item.date)
    if (d >= today && d <= endDate) {
      events.push({
        id: `earnings-${item.date}`,
        date: item.date,
        type: 'earnings',
        source: 'auto-calendar',
        title: item.label,
        detail: '財報公布截止日，關注持股財報是否優於預期',
        stocks: [],
        status: 'pending',
        pred: 'neutral',
        predReason: '財報季定期事件',
        catalystType: 'earnings',
        impact: 'high',
      })
    }
  }

  return events
}

// ── 除權息旺季提醒 ──
function generateDividendSeasonEvents(today, rangeDays, stockCodes) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)
  const year = today.getFullYear()

  // 除權息旺季 7-8 月提醒
  const divStart = new Date(year, 6, 1) // 7月1日
  if (divStart >= today && divStart <= endDate) {
    events.push({
      id: `div-season-${year}`,
      date: divStart.toISOString().slice(0, 10),
      type: 'dividend',
      source: 'auto-calendar',
      title: `${year} 除權息旺季開始`,
      detail:
        stockCodes.length > 0
          ? `關注持股 ${stockCodes.join(', ')} 的除權息日程與填息機率`
          : '7-8 月為台股除權息旺季，留意高股息股填息表現',
      stocks: stockCodes,
      status: 'pending',
      pred: 'neutral',
      predReason: '除權息旺季，需個別評估填息機率',
      catalystType: 'dividend',
      impact: 'medium',
    })
  }
  return events
}

// ── MOPS 法說會事件 ──
async function fetchMopsConferenceEvents(today, rangeDays, stockCodes, req) {
  if (stockCodes.length === 0) return []

  const events = []
  const todayStr = formatDate(today)

  // 只查近 7 天的 MOPS（避免過多請求）
  const checkDays = Math.min(rangeDays, 7)
  for (let i = 0; i < checkDays; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = formatDate(d)

    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http'
      const host = req.headers.host || '127.0.0.1:3002'
      const mopsParams = new URLSearchParams({ date: dateStr })
      if (stockCodes.length > 0) mopsParams.set('codes', stockCodes.join(','))
      const mopsUrl = `${protocol}://${host}/api/mops-announcements?${mopsParams.toString()}`
      const mopsRes = await fetch(mopsUrl, {
        signal: AbortSignal.timeout(3000),
        headers: buildInternalAuthHeaders(),
      })
      if (!mopsRes.ok) continue

      const mopsData = await mopsRes.json()
      const announcements = mopsData.announcements || []

      // 篩選持股相關的法說會公告
      const relevant = announcements.filter(
        (a) => a.type === 'conference' && (stockCodes.length === 0 || stockCodes.includes(a.code))
      )

      for (const ann of relevant) {
        events.push({
          id: `mops-conf-${ann.code}-${dateStr}`,
          date: d.toISOString().slice(0, 10),
          type: 'conference',
          source: 'mops',
          title: `${ann.name}(${ann.code}) 法說會`,
          detail: ann.title,
          stocks: [ann.code],
          status: 'pending',
          pred: 'neutral',
          predReason: '法說會結果待觀察',
          catalystType: 'conference',
          impact: 'high',
        })
      }
    } catch {
      // Skip failed dates silently
    }
  }
  return events
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// ── FinMind 個股新聞事件 ──
export async function fetchFinMindNewsEvents(today, rangeDays, stockCodes, req) {
  if (stockCodes.length === 0) return []

  const events = []
  const startDate = new Date(today)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(today)
  endDate.setHours(23, 59, 59, 999)
  endDate.setDate(endDate.getDate() + rangeDays)

  const conferencePattern = /法說/
  const shareholderPattern = /股東(?:常)?會/
  const dividendPattern = /除權|除息/
  const earningsPattern = /財報|營收/

  try {
    // 對每檔持股查詢新聞
    for (const code of stockCodes) {
      const protocol = req.headers['x-forwarded-proto'] || 'http'
      const host = req.headers.host || '127.0.0.1:3002'
      const newsUrl = `${protocol}://${host}/api/finmind?dataset=news&code=${code}&start_date=${formatDateForFinMind(today)}`

      const newsRes = await fetch(newsUrl, {
        signal: AbortSignal.timeout(5000),
        headers: buildInternalAuthHeaders(),
      })
      if (!newsRes.ok) continue

      const newsData = await newsRes.json()
      const news = newsData.data || []

      // 篩選含事件關鍵字的新聞
      for (const item of news) {
        const title = String(item.title || '')
        const hasEventKeyword =
          conferencePattern.test(title) ||
          shareholderPattern.test(title) ||
          dividendPattern.test(title) ||
          earningsPattern.test(title)
        if (!hasEventKeyword) continue

        const newsDate = new Date(item.date)
        if (newsDate < startDate || newsDate > endDate) continue

        // 判斷事件類型
        let type = 'news'
        if (conferencePattern.test(title)) type = 'conference'
        else if (shareholderPattern.test(title)) type = 'shareholder'
        else if (dividendPattern.test(title)) type = 'dividend'
        else if (earningsPattern.test(title)) type = 'earnings'

        events.push({
          id: `finmind-news-${code}-${item.date}`,
          date: item.date,
          type: type,
          source: 'finmind-news',
          title: `${item.title}`,
          detail: item.description || item.link || '',
          stocks: [code],
          status: 'pending',
          pred: 'neutral',
          predReason: '新聞事件待觀察',
          catalystType:
            type === 'conference'
              ? 'conference'
              : type === 'shareholder'
                ? 'shareholder'
                : type === 'dividend'
                  ? 'dividend'
                  : 'earnings',
          impact: type === 'conference' || type === 'earnings' ? 'high' : 'medium',
          link: item.link,
        })
      }
    }
  } catch (err) {
    console.warn('FinMind news fetch error:', err.message)
  }

  return events
}

function buildCalendarEventDedupeKey(event) {
  return [
    String(event?.date || ''),
    String(event?.type || ''),
    String(event?.title || ''),
    (Array.isArray(event?.stocks) ? event.stocks : []).join(','),
  ].join('|')
}

export function dedupeCalendarEvents(events) {
  const seen = new Set()
  const rows = []

  for (const event of Array.isArray(events) ? events : []) {
    const key = buildCalendarEventDedupeKey(event)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push(event)
  }

  return rows
}

function mapGeminiType(geminiType) {
  if (geminiType.includes('法說')) return 'conference'
  if (geminiType.includes('股東')) return 'shareholder'
  if (geminiType.includes('財報')) return 'earnings'
  if (geminiType.includes('除權') || geminiType.includes('除息')) return 'dividend'
  return 'other'
}

export function mapGeminiFactsToEvents(facts = [], today, rangeDays, stockCodes = []) {
  const startDate = new Date(today)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + rangeDays)

  const events = []
  for (const fact of Array.isArray(facts) ? facts : []) {
    if (!fact?.date || !fact?.eventType || fact?.confidence !== 'confirmed') continue
    if (stockCodes.length > 0 && !stockCodes.includes(fact.code)) continue

    const eventDate = new Date(fact.date)
    if (Number.isNaN(eventDate.getTime()) || eventDate < startDate || eventDate > endDate) continue

    const type = mapGeminiType(String(fact.eventType))
    events.push({
      id: `gemini-${fact.code}-${fact.date}-${type}`,
      date: fact.date,
      type,
      source: 'gemini-research',
      title: `${fact.name}(${fact.code}) ${fact.eventType}`,
      detail: fact.source || 'Gemini 事件蒐集',
      stocks: fact.code ? [fact.code] : [],
      status: 'pending',
      pred: 'neutral',
      predReason: '已確認事件，待觀察實際影響',
      catalystType:
        type === 'conference'
          ? 'conference'
          : type === 'shareholder'
            ? 'shareholder'
            : type === 'dividend'
              ? 'dividend'
              : type === 'earnings'
                ? 'earnings'
                : 'other',
      impact:
        type === 'conference' || type === 'earnings' || type === 'shareholder' ? 'high' : 'medium',
      citation: fact.source || '',
      link: fact.source || '',
    })
  }

  return events
}

export async function loadGeminiCalendarEvents(today, rangeDays, stockCodes = []) {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const geminiDir = path.join(process.cwd(), 'docs/gemini-research')
    const files = fs.readdirSync(geminiDir)
    const eventFile = files
      .filter((file) => file.startsWith('event-calendar-') && file.endsWith('.json'))
      .sort()
      .pop()

    if (!eventFile) return []

    const filePath = path.join(geminiDir, eventFile)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return mapGeminiFactsToEvents(data?.facts || [], today, rangeDays, stockCodes)
  } catch (error) {
    console.warn('Gemini event file load error:', error.message)
    return []
  }
}

function formatDateForFinMind(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── 直接呼叫 FinMind governor 邊界 ──
// 取最近 3 天的持股新聞作為行事曆事件
async function fetchFinMindNewsDirectly(stockCodes) {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 3)
  const startStr = formatDateForFinMind(startDate)
  const limitedCodes = (Array.isArray(stockCodes) ? stockCodes : []).filter(Boolean).slice(0, 12)

  const perCodeTasks = limitedCodes.map(async (code) => {
    try {
      return (
        await queryFinMindDataset('news', {
          code,
          startDate: startStr,
          timeoutMs: 2500,
        })
      )
        .slice(0, 2) // 每檔最多 2 則最新，避免事件過多拖慢 response
        .map((item) => {
          const title = String(item.title || '')
          if (!title || title.length < 10) return null
          return {
            id: `finmind-news-${code}-${item.date?.slice(0, 10) || 'unknown'}-${title.slice(0, 12)}`,
            date: item.date?.slice(0, 10) || formatDateForFinMind(today),
            type: 'news',
            source: 'finmind-news',
            title: `${code} ${title.slice(0, 60)}`,
            detail: title,
            stocks: [code],
            status: 'closed',
            pred: 'neutral',
            predReason: '持股相關新聞',
            catalystType: 'news',
            impact: 'low',
            link: item.link || '',
          }
        })
        .filter(Boolean)
    } catch {
      return []
    }
  })

  const settled = await Promise.allSettled(perCodeTasks)
  return settled.flatMap((item) => (item.status === 'fulfilled' ? item.value : []))
}

export default withApiAuth(handler)
