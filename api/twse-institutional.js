// Vercel Serverless Function — TWSE 三大法人買賣超 API
// 來源：https://www.twse.com.tw/rwd/zh/fund/T86
import { getCachedResponse, setCachedResponse } from './_lib/cache.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { date } = req.query

  // 驗證日期格式
  if (!date || !/^\d{8}$/.test(date)) {
    return res.status(400).json({ error: '日期格式錯誤，請使用 YYYYMMDD 格式' })
  }

  try {
    // 檢查快取
    const cacheKey = `twse-institutional-${date}`
    const cached = getCachedResponse(cacheKey)
    if (cached) {
      return res.status(200).json(cached)
    }

    // 呼叫 TWSE API
    const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${date}&rt=true`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (portfolio-dashboard/1.0)',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`TWSE API 回應錯誤：${response.status}`)
    }

    const data = await response.json()

    // 標準化回應格式
    const normalized = normalizeInstitutionalData(data, date)

    // 寫入快取（24 小時）
    setCachedResponse(cacheKey, normalized, 24 * 60 * 60)

    return res.status(200).json(normalized)
  } catch (err) {
    console.error('TWSE 三大法人 API 錯誤:', err)
    return res.status(500).json({
      error: '三大法人數據抓取失敗',
      detail: err.message,
    })
  }
}

/**
 * Normalize TWSE institutional trading data
 */
function normalizeInstitutionalData(data, date) {
  // TWSE API 回應格式可能不同，需處理多種情況
  const raw = data?.data || data

  if (!raw) {
    return {
      date,
      available: false,
      reason: '無數據（可能是假日或休市）',
      institutions: {
        foreign: { buy: 0, sell: 0, net: 0 },
        investment: { buy: 0, sell: 0, net: 0 },
        dealer: { buy: 0, sell: 0, net: 0 },
      },
    }
  }

  // 解析三大法人數據
  const institutions = {
    foreign: parseInstitutionalRow(raw, '外資'),
    investment: parseInstitutionalRow(raw, '投信'),
    dealer: parseInstitutionalRow(raw, '自營商'),
  }

  return {
    date,
    available: true,
    fetchedAt: new Date().toISOString(),
    institutions,
    summary: {
      totalNet: institutions.foreign.net + institutions.investment.net + institutions.dealer.net,
      netBuyCount: [institutions.foreign, institutions.investment, institutions.dealer].filter(
        (i) => i.net > 0
      ).length,
    },
  }
}

/**
 * Parse institutional investor data from TWSE response
 */
function parseInstitutionalRow(data, institutionName) {
  // TWSE API 的欄位結構：
  // [股票代號，股票名稱，買進股數，賣出股數，買賣超]

  const rows = Array.isArray(data?.data) ? data.data : []

  // 尋找該法人的總計欄位（通常是「總計」或「小計」）
  const summaryRow = rows.find((row) => {
    const name = String(row[0] || row[1] || '')
    return name.includes(institutionName) && name.includes('總計')
  })

  if (!summaryRow) {
    return { buy: 0, sell: 0, net: 0 }
  }

  // 解析數字（需處理千分位逗號）
  const parseNumber = (value) => {
    if (typeof value === 'number') return value
    if (!value) return 0
    return Number(String(value).replace(/,/g, '')) || 0
  }

  // 根據 TWSE API 回應結構，欄位可能是：
  // 索引 2: 買進，索引 3: 賣出，索引 4: 買賣超
  const buy = parseNumber(summaryRow[2])
  const sell = parseNumber(summaryRow[3])
  const net = parseNumber(summaryRow[4])

  return { buy, sell, net }
}
