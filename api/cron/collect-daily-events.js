// Vercel Cron Job — 每日自動蒐集事件與新聞
// 排程：每天台灣時間 08:00（UTC 00:00）盤前執行
// 資料寫入 Vercel Blob，前端 boot 時讀取
//
// 蒐集來源：
// 1. MOPS 重大訊息（法說會、重訊、股利公告）
// 2. 固定行事曆（FOMC、央行、財報季、月營收、除權息）
// 3. Google News RSS（持股相關新聞標題）

import { put, list } from '@vercel/blob'

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN
const BLOB_PREFIX = 'daily-events'
const MOPS_BASE = 'https://mops.twse.com.tw/mops/web/ajax_t05st01'
const MAX_KEEP_DAYS = 7 // 只保留最近 7 天的快照

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
]

// ── MOPS 抓取 ──
async function fetchMopsAnnouncements(dateStr) {
  const year = parseInt(dateStr.slice(0, 4)) - 1911
  const month = dateStr.slice(4, 6)
  const day = dateStr.slice(6, 8)

  const body = new URLSearchParams({
    encodeURIComponent: 1,
    step: 1,
    firstin: 1,
    off: 1,
    keyword4: '',
    code1: '',
    TYPEK2: '',
    checkbtn: '',
    queryName: 'co_id',
    inpuType: 'co_id',
    TYPEK: 'all',
    isnew: 'true',
    co_id: '',
    date1: `${year}/${month}/${day}`,
    date2: `${year}/${month}/${day}`,
    keyword3: '',
  })

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const res = await fetch(MOPS_BASE, {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://mops.twse.com.tw/mops/web/t05st01',
    },
    body: body.toString(),
  })

  if (!res.ok) return []

  const html = await res.text()
  const announcements = []
  const rowRegex =
    /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi
  let match
  while ((match = rowRegex.exec(html)) !== null) {
    const code = match[1]?.replace(/<[^>]+>/g, '').trim()
    const name = match[2]?.replace(/<[^>]+>/g, '').trim()
    const title = match[4]?.replace(/<[^>]+>/g, '').trim()
    if (!code || !title || !/^\d{4}$/.test(code)) continue

    const type = inferType(title)
    if (type) {
      announcements.push({
        code,
        name,
        title,
        type,
        date: `${dateStr.slice(0, 4)}-${month}-${day}`,
      })
    }
  }
  return announcements
}

function inferType(title) {
  if (/法說/.test(title)) return 'conference'
  if (/股利|配息|除權|除息/.test(title)) return 'dividend'
  if (/營收/.test(title)) return 'revenue'
  if (/董事|股東|增資|併購/.test(title)) return 'corporate'
  if (/重訊|重大/.test(title)) return 'material'
  return null // 過濾掉不重要的
}

// ── Google News RSS ──
async function fetchNewsHeadlines(codes) {
  const headlines = []
  // 批次查詢避免太多請求，每次最多 5 檔
  const batches = []
  for (let i = 0; i < codes.length; i += 5) {
    batches.push(codes.slice(i, i + 5))
  }

  for (const batch of batches) {
    const query = batch.map((c) => c.code).join(' OR ') + ' 台股'
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:2d')}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENTS[0], Accept: 'application/rss+xml' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/gi)]
      for (const [itemXml] of items.slice(0, 10)) {
        const title = itemXml
          .match(/<title>([\s\S]*?)<\/title>/)?.[1]
          ?.replace(/<!\[CDATA\[|\]\]>/g, '')
          .trim()
        const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
        const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim()
        if (!title) continue

        // 匹配到哪些持股
        const matchedCodes = batch
          .filter((c) => title.includes(c.code) || title.includes(c.name))
          .map((c) => c.code)
        if (matchedCodes.length === 0) continue

        headlines.push({
          title,
          url: link || null,
          publishedAt: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : null,
          stocks: matchedCodes,
        })
      }
    } catch {
      // RSS fetch failed, skip
    }
  }

  return headlines
}

// ── 固定行事曆 ──
function generateFixedEvents(today, rangeDays) {
  const events = []
  const end = new Date(today)
  end.setDate(end.getDate() + rangeDays)
  const year = today.getFullYear()

  // 月營收截止（每月 10 號）
  for (let m = today.getMonth(); m < today.getMonth() + 2; m++) {
    const d = new Date(year, m, 10)
    if (d >= today && d <= end) {
      const prev = new Date(d)
      prev.setMonth(prev.getMonth() - 1)
      events.push({
        id: `rev-${d.toISOString().slice(0, 10)}`,
        type: 'revenue',
        title: `${prev.getFullYear()}/${String(prev.getMonth() + 1).padStart(2, '0')} 月營收公布截止`,
        date: d.toISOString().slice(0, 10),
        impact: 'medium',
      })
    }
  }

  // FOMC
  const fomc = [
    `${year}-01-29`,
    `${year}-03-19`,
    `${year}-05-07`,
    `${year}-06-18`,
    `${year}-07-30`,
    `${year}-09-17`,
    `${year}-11-05`,
    `${year}-12-17`,
  ]
  for (const ds of fomc) {
    const d = new Date(ds)
    if (d >= today && d <= end) {
      events.push({
        id: `fomc-${ds}`,
        type: 'macro',
        title: 'FOMC 利率決議',
        date: ds,
        impact: 'high',
      })
    }
  }

  // 台灣央行（3/6/9/12 月第三個週四）
  for (const m of [3, 6, 9, 12]) {
    let thursdays = 0
    for (let day = 1; day <= 28; day++) {
      const d = new Date(year, m - 1, day)
      if (d.getDay() === 4 && ++thursdays === 3) {
        if (d >= today && d <= end) {
          events.push({
            id: `cbc-${d.toISOString().slice(0, 10)}`,
            type: 'macro',
            title: '台灣央行理監事會議',
            date: d.toISOString().slice(0, 10),
            impact: 'high',
          })
        }
        break
      }
    }
  }

  // 財報季
  const earnings = [
    [`${year}-03-31`, `${year - 1} 年報`],
    [`${year}-05-15`, `Q1 季報`],
    [`${year}-08-14`, `Q2 半年報`],
    [`${year}-11-14`, `Q3 季報`],
  ]
  for (const [ds, label] of earnings) {
    const d = new Date(ds)
    if (d >= today && d <= end) {
      events.push({
        id: `earn-${ds}`,
        type: 'earnings',
        title: `${label}公布截止`,
        date: ds,
        impact: 'high',
      })
    }
  }

  return events
}

// ── 清理舊快照 ──
async function cleanupOldSnapshots() {
  if (!TOKEN) return
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX, token: TOKEN })
    const sorted = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname))
    // 保留最近 MAX_KEEP_DAYS 個
    for (const blob of sorted.slice(MAX_KEEP_DAYS)) {
      try {
        await fetch(blob.url, { method: 'DELETE' })
      } catch {}
    }
  } catch {}
}

// ── Handler ──
export default async function handler(req, res) {
  // Vercel Cron 會帶 Authorization header 驗證
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // 也允許手動觸發（GET 無 auth）用於測試
    if (req.method !== 'GET') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const todayISO = today.toISOString().slice(0, 10)

  try {
    // 1. MOPS（今天 + 未來 3 天）
    const mopsEvents = []
    for (let i = 0; i < 4; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      try {
        const items = await fetchMopsAnnouncements(ds)
        mopsEvents.push(
          ...items.map((item) => ({
            id: `mops-${item.code}-${ds}`,
            type: item.type,
            title: `${item.name}(${item.code}) ${item.title}`,
            date: item.date,
            stocks: [item.code],
            source: 'mops',
            impact: item.type === 'conference' ? 'high' : 'medium',
          }))
        )
      } catch {}
      // Rate limit: 1-2 秒間隔
      if (i < 3) await new Promise((r) => setTimeout(r, 1500))
    }

    // 2. 固定行事曆（未來 30 天）
    const fixedEvents = generateFixedEvents(today, 30)

    // 3. Google News（不帶持股代碼 — 蒐集的是公共新聞，前端再篩選）
    // 這裡用空陣列，因為 cron 不知道每個用戶的持股
    // 新聞蒐集由前端按需觸發（api/analyst-reports.js）

    // 組裝快照
    const snapshot = {
      date: todayISO,
      generatedAt: new Date().toISOString(),
      events: {
        mops: mopsEvents,
        fixed: fixedEvents,
      },
      stats: {
        mopsCount: mopsEvents.length,
        fixedCount: fixedEvents.length,
      },
    }

    // 寫入 Vercel Blob
    if (TOKEN) {
      const key = `${BLOB_PREFIX}/${todayISO}.json`
      await put(key, JSON.stringify(snapshot), {
        access: 'public',
        token: TOKEN,
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      await cleanupOldSnapshots()
    }

    return res.status(200).json({ success: true, ...snapshot.stats, date: todayISO })
  } catch (error) {
    console.error('Daily event collection failed:', error)
    return res.status(500).json({ error: error.message })
  }
}
