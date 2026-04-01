import { describe, expect, it } from 'vitest'
import {
  buildBudgetedBrainContext,
  buildBudgetedHoldingSummary,
  formatRecentLessons,
} from '../../src/lib/promptBudget.js'

describe('lib/promptBudget', () => {
  it('keeps the largest holdings when the holding summary exceeds budget', () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      key: `h-${index + 1}`,
      code: `${index + 1}`,
      name: `持股${index + 1}`,
      weight: 700 - index * 100,
      text: `持股${index + 1}：${'摘要'.repeat(80)}`,
    }))

    const budgeted = buildBudgetedHoldingSummary(entries, {
      maxChars: 900,
      maxEntries: 5,
    })

    expect(budgeted.truncated).toBe(true)
    expect(budgeted.text).toContain('僅保留最大部位5檔')
    expect(budgeted.text).toContain('持股1')
    expect(budgeted.text).toContain('持股5')
    expect(budgeted.omittedKeys).toContain('h-7')
  })

  it('falls back to user rules and recent lessons when brain context exceeds budget', () => {
    const budgeted = buildBudgetedBrainContext({
      fullText: '完整策略大腦'.repeat(400),
      userRulesText: '1. 僅保留用戶規則',
      recentLessonsText: formatRecentLessons([
        { date: '2026/04/01', text: '教訓一' },
        { date: '2026/03/31', text: '教訓二' },
        { date: '2026/03/30', text: '教訓三' },
        { date: '2026/03/29', text: '教訓四' },
      ]),
      maxChars: 200,
    })

    expect(budgeted.truncated).toBe(true)
    expect(budgeted.text).toContain('用戶確認規則')
    expect(budgeted.text).toContain('最近 3 條教訓')
    expect(budgeted.text).not.toContain('完整策略大腦完整策略大腦完整策略大腦')
  })
})
