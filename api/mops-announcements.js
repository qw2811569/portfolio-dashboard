import { withApiAuth } from './_lib/auth-middleware.js'
import { getCachedResponse, setCachedResponse } from './_lib/cache.js'
import { queryFinMindDataset } from './_lib/finmind-governor.js'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]

const ANNOUNCEMENT_TYPES = {
  營收: 'revenue',
  股利: 'dividend',
  配息: 'dividend',
  除權: 'dividend',
  除息: 'dividend',
  董事: 'corporate',
  股東: 'shareholder',
  增資: 'corporate',
  併購: 'corporate',
  法說: 'conference',
  法人說明會: 'conference',
  重訊: 'material',
}

const TAG_CELL_REGEX = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
const TAG_ROW_REGEX = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function stripHtml(value = '') {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferAnnouncementType(title = '') {
  for (const [keyword, type] of Object.entries(ANNOUNCEMENT_TYPES)) {
    if (String(title || '').includes(keyword)) return type
  }
  return 'other'
}

export function normalizeAnnouncementDateInput(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{4})(?:[-\/]?)(\d{2})(?:[-\/]?)(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${match[1]}${match[2]}${match[3]}`
}

function normalizeCodeList(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((item) => item.trim().match(/\d{4,6}[A-Z]?L?/i)?.[0] || '')
        .filter(Boolean)
    )
  )
}

function buildAllowedCodeSet(codes = []) {
  return codes.length > 0 ? new Set(codes) : null
}

function extractRowCells(rowHtml = '') {
  return Array.from(String(rowHtml || '').matchAll(TAG_CELL_REGEX))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
}

export function parseAnnouncementCells(cells = []) {
  const codeIndex = cells.findIndex((cell) => /^\d{4,6}[A-Z]?L?$/.test(cell))
  if (codeIndex < 0) return null

  const code = cells[codeIndex]
  const time = cells.find((cell) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(cell)) || ''
  const nameCandidate = cells[codeIndex + 1] || ''
  const name =
    nameCandidate && !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(nameCandidate) ? nameCandidate : ''

  const titleCandidates = cells.filter(
    (cell) =>
      cell !== code &&
      cell !== name &&
      cell !== time &&
      !/^(是|否|N\/A|詳細資料)$/i.test(cell) &&
      cell.length >= 4
  )
  const title =
    titleCandidates.slice().sort((left, right) => {
      const leftScore =
        (/(法說|營收|股東|董事|重訊|併購|增資|除息|除權|股利)/.test(left) ? 1000 : 0) + left.length
      const rightScore =
        (/(法說|營收|股東|董事|重訊|併購|增資|除息|除權|股利)/.test(right) ? 1000 : 0) +
        right.length
      return rightScore - leftScore
    })[0] || ''

  if (!title) return null

  return {
    code,
    name,
    time,
    title,
    type: inferAnnouncementType(title),
  }
}

export function parseMopsAnnouncementHtml(html, { allowedCodes = [] } = {}) {
  const allowedCodeSet = buildAllowedCodeSet(allowedCodes)
  const rows = Array.from(String(html || '').matchAll(TAG_ROW_REGEX)).map((match) => match[0])
  const announcements = []
  const seen = new Set()

  for (const rowHtml of rows) {
    const cells = extractRowCells(rowHtml)
    const parsed = parseAnnouncementCells(cells)
    if (!parsed) continue
    if (allowedCodeSet && !allowedCodeSet.has(parsed.code)) continue

    const key = `${parsed.code}::${parsed.time}::${parsed.title}`
    if (seen.has(key)) continue
    seen.add(key)
    announcements.push(parsed)
  }

  return announcements
}

function formatDateForFinMind(date = '') {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
}

export function mapFinMindAnnouncementFallbackRows(rows = [], { code = '', date = '' } = {}) {
  const targetDate = formatDateForFinMind(date)
  const announcements = []
  const seen = new Set()

  for (const row of Array.isArray(rows) ? rows : []) {
    const rowDate = String(row?.date || '')
      .trim()
      .slice(0, 10)
    const title = String(row?.title || '').trim()
    if (!title || rowDate !== targetDate) continue

    const itemCode =
      String(row?.stock_id || row?.stockId || code || '')
        .trim()
        .match(/\d{4,6}[A-Z]?L?/i)?.[0] || ''
    if (!itemCode) continue

    const key = `${itemCode}::${title}`
    if (seen.has(key)) continue
    seen.add(key)

    announcements.push({
      code: itemCode,
      name: String(row?.stock_name || row?.stockName || '').trim(),
      title,
      time: '',
      type: inferAnnouncementType(title),
      source: 'finmind-fallback',
      link: String(row?.link || '').trim() || null,
    })
  }

  return announcements
}

async function loadFinMindAnnouncementFallback(codes = [], date = '') {
  const announcements = []
  for (const code of codes) {
    try {
      const rows = await queryFinMindDataset('news', {
        code,
        startDate: formatDateForFinMind(date),
        endDate: formatDateForFinMind(date),
        timeoutMs: 5000,
      })
      announcements.push(...mapFinMindAnnouncementFallbackRows(rows, { code, date }))
    } catch (error) {
      console.warn('[mops-announcements] FinMind fallback failed:', code, error?.message)
    }
  }
  return announcements
}

async function fetchMopsAnnouncementsHtml(date = '') {
  const year = Number(date.slice(0, 4)) - 1911
  const month = date.slice(4, 6)
  const day = date.slice(6, 8)

  await sleep(1000 + Math.floor(Math.random() * 1000))

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const response = await fetch('https://mops.twse.com.tw/mops/web/ajax_t05st01', {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://mops.twse.com.tw/mops/web/t05st01',
    },
    body: new URLSearchParams({
      encodeURIComponent: 1,
      step: 1,
      firstin: 1,
      off: 1,
      queryName: 'co_id',
      inpuType: 'co_id',
      TYPEK: 'all',
      isnew: 'true',
      co_id: '',
      date1: `${year}/${month}/${day}`,
      date2: `${year}/${month}/${day}`,
      keyword3: '',
      keyword4: '',
      code1: '',
      TYPEK2: '',
      checkbtn: '',
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`MOPS responded with ${response.status}`)
  }

  return response.text()
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const normalizedDate = normalizeAnnouncementDateInput(req.query?.date)
  if (!normalizedDate) {
    return res
      .status(400)
      .json({ error: '請提供日期參數，格式 YYYYMMDD / YYYY-MM-DD / YYYY/MM/DD' })
  }

  const codes = normalizeCodeList(req.query?.codes)
  const codesKey = codes.length > 0 ? codes.join(',') : 'all'
  const cacheKey = `mops-announcements-${normalizedDate}-${codesKey}`
  const cached = getCachedResponse(cacheKey)
  if (cached) {
    return res.status(200).json(cached)
  }

  let announcements = []
  let upstreamError = ''
  let source = 'mops'
  let degraded = false

  try {
    const html = await fetchMopsAnnouncementsHtml(normalizedDate)
    announcements = parseMopsAnnouncementHtml(html, { allowedCodes: codes }).map((item) => ({
      ...item,
      source: 'mops',
    }))
  } catch (error) {
    upstreamError = error?.message || 'MOPS announcement fetch failed'
    degraded = true
  }

  const missingCodes =
    codes.length > 0
      ? codes.filter((code) => !announcements.some((item) => item.code === code))
      : []

  if (missingCodes.length > 0 || (announcements.length === 0 && codes.length > 0)) {
    const fallbackRows = await loadFinMindAnnouncementFallback(
      missingCodes.length > 0 ? missingCodes : codes,
      normalizedDate
    )
    if (fallbackRows.length > 0) {
      const seen = new Set(announcements.map((item) => `${item.code}::${item.title}`))
      fallbackRows.forEach((item) => {
        const key = `${item.code}::${item.title}`
        if (seen.has(key)) return
        seen.add(key)
        announcements.push(item)
      })
      source = announcements.some((item) => item.source === 'mops') ? 'mixed' : 'finmind-fallback'
      degraded = degraded || source !== 'mops'
    }
  }

  const result = {
    date: normalizedDate,
    announcements,
    available: announcements.length > 0,
    source,
    degraded,
    ...(upstreamError ? { reason: upstreamError } : {}),
    fetchedAt: new Date().toISOString(),
  }

  setCachedResponse(cacheKey, result, 30 * 60)
  return res.status(200).json(result)
}

export default withApiAuth(handler)
