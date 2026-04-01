import { describe, expect, it } from 'vitest'
import { extractTradeParseJsonText } from '../../src/lib/tradeAiResponse.js'

describe('tradeAiResponse', () => {
  it('extracts fenced json payloads', () => {
    expect(extractTradeParseJsonText('```json\n{"tradeDate":"2026/04/01","trades":[]}\n```')).toBe(
      '{"tradeDate":"2026/04/01","trades":[]}'
    )
  })

  it('extracts the first json object even when the model adds extra narration', () => {
    expect(
      extractTradeParseJsonText(
        '以下是解析結果：\n{"tradeDate":"2026/04/01","trades":[{"code":"2330"}]}\n請確認。'
      )
    ).toBe('{"tradeDate":"2026/04/01","trades":[{"code":"2330"}]}')
  })
})
