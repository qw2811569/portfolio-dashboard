import { normalizeTradeParseResult } from './tradeParseUtils.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNumber(value) {
  const number = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  )
  return Number.isFinite(number) ? number : 0
}

function normalizeAction(value) {
  const raw = normalizeText(value)
  if (/^(賣出|賣|sell|sold)$/i.test(raw)) return '賣出'
  return '買進'
}

function parseTradeLine(line, fallbackDate) {
  const text = normalizeText(line)
  if (!text) return null

  const match = text.match(
    /^(?:(買進|賣出|買|賣|buy|sell|sold)\s*)?([A-Za-z0-9]{4,6})(?:\s+([\u3400-\u9fffA-Za-z._-][\u3400-\u9fffA-Za-z0-9._-]*))?\s*(?:股數|qty|quantity|x)?\s*([0-9,]+)\s*(?:股|shares?)?\s*(?:@|＠|成交價|price|元)?\s*([0-9,.]+)/i
  )
  if (!match) return null

  const [, action, code, name, qty, price] = match
  const normalizedCode = normalizeText(code).toUpperCase()
  const needsActionConfirmation = !normalizeText(action)
  return {
    action: normalizeAction(action),
    code: normalizedCode,
    name: normalizeText(name) || normalizedCode,
    qty: normalizeNumber(qty),
    price: normalizeNumber(price),
    date: fallbackDate,
    confidence: needsActionConfirmation ? 'low' : 'medium',
    needsActionConfirmation,
  }
}

export function parseTradesFromText(
  text,
  { fallbackDate = new Date().toISOString().slice(0, 10) } = {}
) {
  const lines = normalizeText(text)
    .split(/\n|；|;/)
    .map((line) => line.trim())
    .filter(Boolean)
  const trades = lines.map((line) => parseTradeLine(line, fallbackDate)).filter(Boolean)
  const hasUnspecifiedAction = trades.some((trade) => trade.needsActionConfirmation)

  return normalizeTradeParseResult(
    {
      tradeDate: fallbackDate,
      trades,
      note: hasUnspecifiedAction
        ? '文字解析：部分交易未指定買進或賣出'
        : trades.length
          ? '文字解析'
          : '未偵測到交易',
      confidence: trades.length && !hasUnspecifiedAction ? 'medium' : 'low',
    },
    fallbackDate
  )
}

export function buildManualTrade({ code, name, action, qty, price, tradeDate }) {
  return normalizeTradeParseResult(
    {
      tradeDate,
      trades: [
        {
          code: normalizeText(code),
          name: normalizeText(name) || normalizeText(code),
          action: normalizeAction(action),
          qty: normalizeNumber(qty),
          price: normalizeNumber(price),
        },
      ],
      note: '手動填單',
      confidence: 'high',
    },
    tradeDate
  )
}

export async function parseTradeScreenshot(file, { fallbackDate, fetchImpl = fetch } = {}) {
  if (!file) {
    return normalizeTradeParseResult({ tradeDate: fallbackDate, trades: [] }, fallbackDate)
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('讀取截圖失敗'))
    reader.onload = (event) => resolve(String(event.target?.result || ''))
    reader.readAsDataURL(file)
  })
  const [, base64 = ''] = dataUrl.split(',')
  const response = await fetchImpl('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64,
      mediaType: file.type || 'image/jpeg',
    }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.detail || payload?.error || '解析失敗')
  return normalizeTradeParseResult(payload, fallbackDate)
}
