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
    '請使用 Claude Vision 直接閱讀這張台股成交截圖，抽取成交資料。',
    '若圖片模糊或欄位不完整，請盡可能保留可辨識欄位，並在 note 說明缺漏。',
    '只輸出 JSON。',
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
    const { systemPrompt, base64, mediaType } = req.body || {}
    if (!base64) {
      return res.status(400).json({ error: '缺少圖片內容(base64)' })
    }

    const data = await callAiImage({
      system: buildParsePrompt(systemPrompt),
      base64,
      mediaType: mediaType || 'image/jpeg',
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
