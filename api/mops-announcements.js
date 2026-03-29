// Vercel Serverless Function — 公開資訊觀測站 重大訊息 API
// 來源：https://mops.twse.com.tw/
// 快取：30 分鐘

import { getCachedResponse, setCachedResponse } from './_lib/cache.js'

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
  股東: 'corporate',
  增資: 'corporate',
  併購: 'corporate',
  法說: 'conference',
  重訊: 'material',
}

function inferAnnouncementType(title) {
  for (const [keyword, type] of Object.entries(ANNOUNCEMENT_TYPES)) {
    if (title.includes(keyword)) return type
  }
  return 'other'
}

function parseAnnouncementRow(raw) {
  const code = (raw.code || '').trim()
  const name = (raw.name || '').trim()
  const title = (raw.title || '').trim()
  const time = (raw.time || '').trim()
  if (!code || !title) return null
  return {
    code,
    name,
    type: inferAnnouncementType(title),
    title,
    time,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { date } = req.query

  if (!date || !/^\d{8}$/.test(date)) {
    return res.status(400).json({ error: '請提供日期參數，格式 YYYYMMDD' })
  }

  try {
    const cacheKey = `mops-announcements-${date}`
    const cached = getCachedResponse(cacheKey)
    if (cached) {
      return res.status(200).json(cached)
    }

    const delay = 1000 + Math.floor(Math.random() * 1000)
    await new Promise((resolve) => setTimeout(resolve, delay))

    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

    const year = parseInt(date.slice(0, 4)) - 1911
    const month = date.slice(4, 6)
    const day = date.slice(6, 8)

    const url = 'https://mops.twse.com.tw/mops/web/ajax_t05st01'
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://mops.twse.com.tw/mops/web/t05st01',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return res.status(502).json({ error: `MOPS responded with ${response.status}` })
    }

    const html = await response.text()

    const announcements = []
    const rowRegex =
      /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi
    let match
    while ((match = rowRegex.exec(html)) !== null) {
      const raw = {
        code: match[1].replace(/<[^>]*>/g, '').trim(),
        name: match[2].replace(/<[^>]*>/g, '').trim(),
        time: match[3].replace(/<[^>]*>/g, '').trim(),
        title: match[4].replace(/<[^>]*>/g, '').trim(),
      }
      const parsed = parseAnnouncementRow(raw)
      if (parsed && /^\d{4,6}$/.test(parsed.code)) {
        announcements.push(parsed)
      }
    }

    const result = {
      date,
      announcements,
      fetchedAt: new Date().toISOString(),
    }

    setCachedResponse(cacheKey, result, 30 * 60)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({
      error: '取得公開資訊觀測站資料失敗',
      message: err.message,
    })
  }
}
