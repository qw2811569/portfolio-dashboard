export function extractTradeParseJsonText(rawText) {
  const text = String(rawText || '')
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim()

  if (!text) return ''

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim()
  }

  return text
}

function summarizeTradeParsePreview(rawText = '', maxLength = 160) {
  const compact = String(rawText || '').replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact
}

export function buildTradeParseErrorMessage({
  error,
  rawText = '',
  responseData = null,
  fallback = '解析失敗，請確認截圖清晰後再試',
} = {}) {
  const preview =
    summarizeTradeParsePreview(rawText) ||
    summarizeTradeParsePreview(responseData ? JSON.stringify(responseData) : '')
  const message = String(error?.message || error || '').trim()

  if (!message) {
    return fallback
  }

  if (message === 'AI 未回傳可解析的內容') {
    return preview
      ? `AI 未回傳可解析 JSON，原始回覆：${preview}`
      : 'AI 未回傳可解析內容，請確認截圖清晰或稍後重試'
  }

  if (error instanceof SyntaxError) {
    return preview
      ? `AI 回傳格式不是合法 JSON，原始回覆：${preview}`
      : 'AI 回傳格式不是合法 JSON，請稍後重試'
  }

  return message
}
