// Vercel Serverless Function — MOPS 月營收數據 API
// 來源：https://mops.twse.com.tw/
// 注意：此為網頁爬蟲，需實施反爬蟲對策

import { getCachedResponse, setCachedResponse } from './_lib/cache.js'

// 反爬蟲對策：隨機延遲與 User-Agent 輪替
const DELAYS = [1000, 1500, 2000, 2500, 3000]
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { stockId, year, month } = req.query

  // 驗證參數
  if (!stockId) {
    return res.status(400).json({ error: '缺少 stockId 參數' })
  }

  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: '年份格式錯誤，請使用 YYYY 格式' })
  }

  if (!month || !/^\d{1,2}$/.test(month)) {
    return res.status(400).json({ error: '月份格式錯誤，請使用 1-12' })
  }

  const monthNum = Number(month)
  if (monthNum < 1 || monthNum > 12) {
    return res.status(400).json({ error: '月份必須在 1-12 之間' })
  }

  try {
    // 檢查快取（月營收更新頻率低，可快取較久）
    const cacheKey = `mops-revenue-${stockId}-${year}-${month}`
    const cached = getCachedResponse(cacheKey)
    if (cached) {
      return res.status(200).json(cached)
    }

    // 隨機延遲（反爬蟲）
    const delay = DELAYS[Math.floor(Math.random() * DELAYS.length)]
    await new Promise((resolve) => setTimeout(resolve, delay))

    // 隨機 User-Agent
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

    // 判斷上市/上櫃
    const isTwse = !stockId.includes('.TWO') && !stockId.includes('.otc')
    const typek = isTwse ? 'sii' : 'otc'
    const code = stockId.split('.')[0]

    // MOPS 月營收查詢（模擬表單提交）
    const formData = new FormData()
    formData.append('encodeURIComponent', '1')
    formData.append('step', '1')
    formData.append('firstin', '1')
    formData.append('TYPEK', typek)
    formData.append('code', code)

    // 注意：MOPS 需要會話管理，此處簡化處理
    // 實際實作可能需要使用 puppeteer 或 playwright
    const url = `https://mops.twse.com.tw/mops/web/ajax_t51sb01`

    // 由於 Vercel Serverless 不支援 FormData POST 到某些網站，
    // 改用 GET 參數方式（如果 MOPS 支援）
    const fetchUrl = `${url}?encodeURIComponent=1&step=1&firstin=1&TYPEK=${typek}&code=${code}`

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`MOPS 回應錯誤：${response.status}`)
    }

    const html = await response.text()

    // 解析 HTML 萃取月營收數據
    const revenue = parseRevenueFromHTML(html, year, monthNum, stockId)

    const result = {
      stockId,
      year,
      month: monthNum,
      ...revenue,
      fetchedAt: new Date().toISOString(),
      source: 'MOPS',
    }

    // 寫入快取（30 天）
    setCachedResponse(cacheKey, result, 30 * 24 * 60 * 60)

    return res.status(200).json(result)
  } catch (err) {
    console.error('MOPS 月營收 API 錯誤:', err)

    // 降級：返回空數據但不報錯
    return res.status(200).json({
      stockId,
      year,
      month: Number(month),
      available: false,
      reason: err.message,
      revenue: null,
      revenueYoY: null,
      revenueMoM: null,
      cumulativeRevenue: null,
      cumulativeYoY: null,
      fetchedAt: new Date().toISOString(),
    })
  }
}

/**
 * Parse revenue data from MOPS HTML response
 */
function parseRevenueFromHTML(html, year, month, stockId) {
  // MOPS HTML 結構分析
  // 通常包含表格，需萃取：
  // - 當月營收
  // - 上月營收（用於計算 MoM）
  // - 去年同月營收（用於計算 YoY）
  // - 累計營收

  try {
    // 使用正則表達式萃取表格數據
    // 注意：實際結構需根據 MOPS 網站調整

    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
    if (!tableMatch) {
      return {
        available: false,
        reason: '無法解析營收表格',
      }
    }

    const tableContent = tableMatch[1]
    const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []

    // 尋找對應月份的數據行
    let targetRow = null
    for (const row of rows) {
      // 檢查是否包含年份和月份
      if (row.includes(year) && row.includes(String(month).padStart(2, '0'))) {
        targetRow = row
        break
      }
    }

    if (!targetRow) {
      return {
        available: false,
        reason: `找不到${year}年${month}月的營收數據`,
      }
    }

    // 萃取數據欄位
    const cells = targetRow.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []

    // 解析數字（移除千分位逗號）
    const parseNum = (html) => {
      if (!html) return null
      const text = html.replace(/<[^>]+>/g, '').trim()
      const num = text.replace(/,/g, '')
      return Number(num) || null
    }

    // 假設欄位結構（需根據實際 MOPS 結構調整）
    // 通常：月份 | 營收 | 上月 | 去年同月 | 累計 | ...
    const revenue = parseNum(cells[1])
    const lastMonthRevenue = parseNum(cells[2])
    const lastYearRevenue = parseNum(cells[3])
    const cumulativeRevenue = parseNum(cells[4])

    // 計算 YoY 和 MoM
    const revenueYoY = lastYearRevenue
      ? ((revenue - lastYearRevenue) / lastYearRevenue) * 100
      : null

    const revenueMoM = lastMonthRevenue
      ? ((revenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : null

    const cumulativeYoY = cumulativeRevenue ? null : null // 需更多數據

    return {
      available: true,
      revenue,
      revenueYoY: revenueYoY !== null ? Math.round(revenueYoY * 100) / 100 : null,
      revenueMoM: revenueMoM !== null ? Math.round(revenueMoM * 100) / 100 : null,
      cumulativeRevenue,
      cumulativeYoY,
    }
  } catch (err) {
    console.error('解析 MOPS HTML 失敗:', err)
    return {
      available: false,
      reason: `解析失敗：${err.message}`,
    }
  }
}
