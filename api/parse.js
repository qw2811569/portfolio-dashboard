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
    '你是台股交易截圖 OCR 專家。請仔細閱讀這張圖片，辨識所有股票資料。',
    '',
    '台股代碼規則：',
    '- 一般股票：4 位數字（如 2308、3443、1503）',
    '- 權證：6 位數字（如 053848、702157、084891）',
    '- ETF：4-5 位數字或代碼（如 0050、00637L、00918）',
    '- 注意區分：不要把股票名稱的數字跟代碼搞混',
    '',
    '常見台股券商截圖欄位：股票代碼、股票名稱、買/賣/庫存、成交價/現價、張數/股數、成本均價、損益',
    '',
    '必須嚴格按以下 JSON 格式回傳，不要加任何說明文字、markdown 或 code fence：',
    '{"trades":[{"code":"股票代碼","name":"股票名稱","action":"buy或sell或hold","price":現價數字,"quantity":股數數字,"cost":成本均價數字或null,"pnl":損益數字或null,"note":"備註"}]}',
    '',
    '重要：',
    '- code 必須是正確的台股代碼格式',
    '- 如果是持倉庫存截圖，action 用 "hold"',
    '- price 和 cost 用實際數字，不要帶逗號或千分位',
    '- quantity 是股數（1張=1000股，如果看到"張"要乘1000）',
    '- 如果某欄看不清楚，寧可填 null 也不要亂猜',
  ]
    .filter(Boolean)
    .join('\n')
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
      maxTokens: 4000,
    })

    rawText = extractAiText(data)

    console.debug(
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

    // Fuzzy match：用 STOCK_META + INIT_HOLDINGS 修正 OCR 辨識錯誤
    try {
      const { STOCK_META, INIT_HOLDINGS } = await import('../src/seedData.js')
      const knownStocks = Object.entries(STOCK_META).map(([code, meta]) => ({
        code,
        name: meta.name || '',
        industry: meta.industry || '',
      }))

      // 也收集已知持股的價格資訊（從 localStorage 無法取，但從 holdings 可以推）
      const holdingCodes = new Set((INIT_HOLDINGS || []).map((h) => h.code))

      normalized.trades = normalized.trades.map((trade) => {
        // 1. 精確匹配代碼
        const exact = knownStocks.find((s) => s.code === trade.code)
        if (exact) return { ...trade, name: exact.name || trade.name, matched: true }

        // 2. 名稱包含匹配（「台達電」→ 2308）
        if (trade.name) {
          const byName = knownStocks.find(
            (s) =>
              s.name &&
              s.name.length >= 2 &&
              (trade.name.includes(s.name) || s.name.includes(trade.name))
          )
          if (byName)
            return {
              ...trade,
              code: byName.code,
              name: byName.name,
              matched: true,
              matchNote: 'name-match:' + trade.code + '→' + byName.code,
            }
        }

        // 3. 代碼相似度（允許 1 位數錯誤：2308 vs 2303）
        if (trade.code && trade.code.length === 4) {
          const similar = knownStocks.find((s) => {
            if (s.code.length !== 4) return false
            let diff = 0
            for (let i = 0; i < 4; i++) {
              if (s.code[i] !== trade.code[i]) diff++
            }
            return diff === 1
          })
          if (similar)
            return {
              ...trade,
              code: similar.code,
              name: similar.name,
              matched: true,
              matchNote: 'code-fuzzy:' + trade.code + '→' + similar.code,
            }
        }

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
