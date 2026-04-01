// Vercel Cron Job — 每日自動蒐集事件與新聞
// 排程：每天台灣時間 16:00（UTC 08:00）收盤後執行
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

// ── MOPS 抓取（已停用 — MOPS 需要完整瀏覽器會話）─
// 改用 Gemini 蒐集的事件作為 fallback
// 參考：docs/gemini-research/event-calendar-*.json
async function fetchMopsAnnouncements(dateStr) {
  // MOPS 需要完整瀏覽器會話（JavaScript + cookie），無法用簡單 fetch 訪問
  // 返回空陣列，讓系統使用 Gemini 蒐集的事件
  console.log('[MOPS] 已停用 — 使用 Gemini 事件作為 fallback')
  return []
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
    // 1. MOPS（已停用，返回空陣列）
    const mopsEvents = []

    // 2. 固定行事曆（未來 30 天）
    const fixedEvents = generateFixedEvents(today, 30)

    // 3. Gemini 蒐集的事件（fallback for MOPS）
    // 讀取最新的 event-calendar-*.json
    const geminiEvents = await loadGeminiEvents(todayISO, stockCodes)

    // 組裝快照
    const snapshot = {
      date: todayISO,
      generatedAt: new Date().toISOString(),
      events: {
        mops: mopsEvents,
        fixed: fixedEvents,
        gemini: geminiEvents,
      },
      stats: {
        mopsCount: mopsEvents.length,
        fixedCount: fixedEvents.length,
        geminiCount: geminiEvents.length,
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

// ── 載入 Gemini 蒐集的事件 ──
async function loadGeminiEvents(todayISO, stockCodes = []) {
  try {
    // 讀取最新的 event-calendar JSON（從 docs/gemini-research/）
    const fs = await import('fs')
    const path = await import('path')
    const geminiDir = path.join(process.cwd(), 'docs/gemini-research')
    const files = fs.readdirSync(geminiDir)
    const eventFile = files.filter(f => f.startsWith('event-calendar-') && f.endsWith('.json')).sort().pop()
    
    if (!eventFile) {
      console.log('[Gemini] 無事件檔案')
      return []
    }

    const filePath = path.join(geminiDir, eventFile)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const facts = data.facts || []
    
    // 過濾並轉換為系統格式
    const today = new Date(todayISO)
    const events = []
    
    for (const fact of facts) {
      if (!fact.date || !fact.eventType || fact.confidence !== 'confirmed') continue
      
      // 如果有指定持股代碼，只回傳相關的事件
      if (stockCodes.length > 0 && !stockCodes.includes(fact.code)) continue
      
      const eventDate = new Date(fact.date)
      const daysDiff = (eventDate - today) / (1000 * 60 * 60 * 24)
      
      // 只取今天起未來 60 天的事件
      if (daysDiff < 0 || daysDiff > 60) continue
      
      events.push({
        id: `gemini-${fact.code}-${fact.date}`,
        type: mapGeminiType(fact.eventType),
        title: `${fact.name}(${fact.code}) ${fact.eventType}`,
        date: fact.date,
        stocks: [fact.code],
        source: 'gemini-research',
        impact: fact.eventType.includes('法說') || fact.eventType.includes('股東') ? 'high' : 'medium',
        citation: fact.source,
      })
    }
    
    console.log(`[Gemini] 載入 ${events.length} 個事件 from ${eventFile}`)
    return events
  } catch (err) {
    console.warn('[Gemini] 載入失敗:', err.message)
    return []
  }
}

function mapGeminiType(geminiType) {
  if (geminiType.includes('法說')) return 'conference'
  if (geminiType.includes('股東')) return 'shareholder'
  if (geminiType.includes('財報')) return 'earnings'
  if (geminiType.includes('除權') || geminiType.includes('除息')) return 'dividend'
  return 'other'
}
