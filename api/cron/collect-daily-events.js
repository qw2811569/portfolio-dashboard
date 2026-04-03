import { put } from '@vercel/blob'
import { loadGeminiCalendarEvents, dedupeCalendarEvents } from '../event-calendar.js'

const CRON_TOKEN = process.env.CRON_SECRET
const BLOB_TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN
const SNAPSHOT_KEY = 'daily-events/latest.json'
const LOOKAHEAD_DAYS = 30

function parseStockCodes() {
  return String(process.env.EVENT_COLLECTION_CODES || '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}

function generateFixedEvents(today, rangeDays) {
  const events = []
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + rangeDays)
  const year = today.getFullYear()

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
        detail: '聯準會利率決議公布，影響全球股債市場',
        stocks: [],
        status: 'pending',
        impact: 'high',
      })
    }
  }

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
        detail: '財報公布截止日',
        stocks: [],
        status: 'pending',
        impact: 'high',
      })
    }
  }

  return events
}

function formatDateForFinMind(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function fetchFinMindNewsEvents(stockCodes = []) {
  const token = process.env.FINMIND_TOKEN || ''
  if (!token || stockCodes.length === 0) return []

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 3)
  const startStr = formatDateForFinMind(startDate)
  const events = []

  for (const code of stockCodes) {
    try {
      const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockNews&data_id=${code}&start_date=${startStr}&token=${token}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const json = await res.json()
      for (const item of (json.data || []).slice(0, 5)) {
        const title = String(item.title || '').trim()
        if (!title) continue
        events.push({
          id: `finmind-news-${code}-${item.date?.slice(0, 10) || 'unknown'}-${events.length}`,
          date: item.date?.slice(0, 10) || formatDateForFinMind(today),
          type: 'news',
          source: 'finmind-news',
          title,
          detail: item.summary || item.link || title,
          stocks: [code],
          status: 'pending',
          impact: 'medium',
          link: item.link || '',
        })
      }
    } catch {
      // best effort
    }
  }

  return events
}

function isAuthorized(req) {
  if (!CRON_TOKEN) return true
  return req.headers.authorization === `Bearer ${CRON_TOKEN}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method))
    return res.status(405).json({ error: 'Method not allowed' })
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const today = new Date()
    const stockCodes = parseStockCodes()
    const fixedEvents = generateFixedEvents(today, LOOKAHEAD_DAYS)
    const finmindEvents = await fetchFinMindNewsEvents(stockCodes)
    const geminiEvents = await loadGeminiCalendarEvents(today, LOOKAHEAD_DAYS, stockCodes)

    const events = dedupeCalendarEvents([...fixedEvents, ...finmindEvents, ...geminiEvents]).sort(
      (a, b) => String(a.date || '').localeCompare(String(b.date || ''))
    )

    const snapshot = {
      generatedAt: new Date().toISOString(),
      lookaheadDays: LOOKAHEAD_DAYS,
      stockCodes,
      stats: {
        fixedCount: fixedEvents.length,
        finmindCount: finmindEvents.length,
        geminiCount: geminiEvents.length,
        total: events.length,
      },
      events,
    }

    if (BLOB_TOKEN) {
      await put(SNAPSHOT_KEY, JSON.stringify(snapshot, null, 2), {
        token: BLOB_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
        access: 'public',
        contentType: 'application/json',
      })
    }

    return res.status(200).json({ ok: true, ...snapshot.stats, generatedAt: snapshot.generatedAt })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'collect daily events failed' })
  }
}
