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

const INSIDER_PROMPT_LINE_CUE =
  /(操作建議|買賣策略|買進|買入|賣出|加碼|減碼|停損|出場|持倉調整|資金調度|最需要行動|逢低|布局|續抱)/u

const INSIDER_PROMPT_APPENDIX = `【公司代表 / 合規模式】
- 只保留公開資訊、風險、狀態與法規遵循觀察
- 不提供買進、賣出、加碼、減碼、停損或出場建議
- 若原題目要求操作結論，改寫成風險提示與待驗證事件`

export function isInsiderPortfolio(portfolio = null) {
  const mode = String(portfolio?.compliance_mode || portfolio?.complianceMode || '')
    .trim()
    .toLowerCase()
  return mode === 'insider'
}

export function stripBuySellForInsider(prompt, portfolio = null) {
  const text = String(prompt || '').trim()
  if (!text) return ''
  if (!isInsiderPortfolio(portfolio)) return text

  const stripped = text
    .split('\n')
    .filter((line) => !INSIDER_PROMPT_LINE_CUE.test(String(line || '').trim()))
    .join('\n')
    .trim()

  return `${stripped}\n\n${INSIDER_PROMPT_APPENDIX}`.trim()
}

function summarizeTradeParsePreview(rawText = '', maxLength = 160) {
  const compact = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim()
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
