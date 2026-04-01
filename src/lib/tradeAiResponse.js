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
