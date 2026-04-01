// Vercel Serverless Function — 代理 TWSE 即時報價 API
// 用途：解決瀏覽器 CORS 限制，讓前端可以取得台股即時/收盤報價

const TWSE_QUOTE_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-cache, no-store')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const exCh = String(req.query?.ex_ch || '').trim()
  if (!exCh) {
    return res.status(400).json({ error: '缺少 ex_ch 參數' })
  }

  try {
    const url = `${TWSE_QUOTE_URL}?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
        Referer: 'https://mis.twse.com.tw/',
      },
    })
    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'TWSE API 請求失敗',
        detail: data?.msg || data?.error || `HTTP ${response.status}`,
      })
    }

    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({
      error: 'TWSE API 請求失敗',
      detail: error.message,
    })
  }
}
