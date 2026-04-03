// Vercel Serverless Function — 截圖解析（圖片 → 交易資料）
import { callAiImage, ensureAiConfigured, extractAiText } from './_lib/ai-provider.js'
import { normalizeTradeParseResult } from '../src/lib/tradeParseUtils.js'
import { extractTradeParseJsonText } from '../src/lib/tradeAiResponse.js'

function truncateForLog(value, maxLength = 4000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function buildParsePrompt(systemPrompt = '') {
  return [
    systemPrompt,
    '請閱讀這張台股成交或持倉截圖，抽取所有股票交易資料。',
    '若圖片模糊或欄位不完整，請盡可能保留可辨識欄位，並在 note 說明缺漏。',
    '必須嚴格按以下 JSON 格式回傳，不要加任何說明文字或 markdown：',
    '{"trades":[{"code":"股票代碼","name":"股票名稱","action":"buy或sell","price":數字,"quantity":數字,"time":"日期時間","cost":成本價或null,"note":"備註"}]}',
    '如果是持倉截圖（不是成交單），action 用 "hold"，price 用現價，cost 用成本價。',
    '如果看到目標價資訊，加入 "targetPrice":數字 欄位。',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildUserFacingParseError(error, rawText = '') {
  const message = String(error?.message || '').trim()
  if (/credit balance is too low|rate limit|overloaded|timeout/i.test(message)) {
    return { status: 502, error: 'OCR 服務暫時忙碌，請稍後再試', detail: message }
  }
  if (message.includes('AI 未回傳可解析的內容')) {
    return {
      status: 422,
      error: '圖片無法解析成成交資料',
      detail: rawText ? `模型未回傳有效 JSON：${truncateForLog(rawText, 300)}` : message,
    }
  }
  if (message.includes('JSON')) {
    return {
      status: 422,
      error: 'OCR 已讀到內容，但格式無法解析',
      detail: rawText ? `模型輸出格式錯誤：${truncateForLog(rawText, 300)}` : message,
    }
  }
  return {
    status: 422,
    error: '圖片解析失敗',
    detail: message || '請改用更清晰的截圖，或確認圖片中有成交明細',
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    ensureAiConfigured()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  let rawText = ''
  try {
    const { systemPrompt, base64, mediaType: explicitMediaType } = req.body || {}
    if (!base64) {
      return res.status(400).json({ error: '缺少圖片內容(base64)' })
    }

    // 自動偵測圖片格式
    const detectMediaType = (b64) => {
      if (b64.startsWith('iVBOR')) return 'image/png'
      if (b64.startsWith('/9j/')) return 'image/jpeg'
      if (b64.startsWith('R0lG')) return 'image/gif'
      if (b64.startsWith('UklG')) return 'image/webp'
      return 'image/jpeg'
    }
    const mediaType = explicitMediaType || detectMediaType(base64)

    const data = await callAiImage({
      system: buildParsePrompt(systemPrompt),
      base64,
      mediaType,
      prompt:
        '請解析這張成交截圖，抽取股票代碼、買賣方向、價格、數量、時間，以及可能出現的目標價資訊。',
      maxTokens: 900,
    })

    rawText = extractAiText(data)

    console.log(
      '[api/parse] OCR AI raw response:',
      truncateForLog({
        mediaType: mediaType || 'image/jpeg',
        base64Length: String(base64 || '').length,
        response: data,
      })
    )

    const clean = extractTradeParseJsonText(rawText)
    if (!clean) {
      throw new Error('AI 未回傳可解析的內容')
    }

    let parsedPayload
    try {
      parsedPayload = JSON.parse(clean)
    } catch (error) {
      throw new Error(`JSON 解析失敗: ${error.message}`)
    }

    const normalized = normalizeTradeParseResult(parsedPayload)

    // Fuzzy match：用 STOCK_META 修正 OCR 辨識錯誤
    try {
      const { STOCK_META } = await import('../src/seedData.js')
      const knownStocks = Object.entries(STOCK_META).map(([code, meta]) => ({
        code,
        name: meta.name || '',
        industry: meta.industry || '',
      }))

      normalized.trades = normalized.trades.map((trade) => {
        // 先試精確匹配
        const exact = knownStocks.find((s) => s.code === trade.code)
        if (exact) return { ...trade, name: exact.name || trade.name, matched: true }

        // 用名稱 fuzzy match
        if (trade.name) {
          const byName = knownStocks.find(
            (s) => s.name && (trade.name.includes(s.name) || s.name.includes(trade.name))
          )
          if (byName)
            return {
              ...trade,
              code: byName.code,
              name: byName.name,
              matched: true,
              matchNote: `OCR原始代碼:${trade.code}→修正為:${byName.code}`,
            }
        }

        // 用價格+數量匹配（如果價格和數量跟已知持股很接近）
        return { ...trade, matched: false }
      })
    } catch {
      /* STOCK_META 載入失敗不影響主流程 */
    }

    if (!normalized.trades.length && !normalized.targetPriceUpdates.length) {
      return res.status(422).json({
        error: '圖片中未辨識到有效成交或目標價資訊',
        detail: normalized.note || '請確認截圖包含成交明細，且文字清晰可辨識',
      })
    }

    return res.status(200).json(normalized)
  } catch (err) {
    console.error('[api/parse] OCR parse failed:', err)
    const parsedError = buildUserFacingParseError(err, rawText)
    return res.status(parsedError.status).json({
      error: parsedError.error,
      detail: parsedError.detail,
    })
  }
}
