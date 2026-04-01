import { describe, expect, it } from 'vitest'
import {
  buildTradeParseErrorMessage,
  extractTradeParseJsonText,
} from '../../src/lib/tradeAiResponse.js'

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

  it('turns missing OCR json into a user-friendly error with preview', () => {
    expect(
      buildTradeParseErrorMessage({
        error: new Error('AI 未回傳可解析的內容'),
        rawText: '抱歉，我只能看出這是一張成交截圖，但無法整理成 JSON。',
      })
    ).toContain('AI 未回傳可解析 JSON')
  })

  it('turns JSON syntax errors into a user-friendly OCR error', () => {
    expect(
      buildTradeParseErrorMessage({
        error: new SyntaxError('Unexpected token'),
        rawText: '{ tradeDate: 2026/04/01 }',
      })
    ).toContain('AI 回傳格式不是合法 JSON')
  })
})
