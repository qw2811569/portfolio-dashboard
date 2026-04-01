function normalizePromptText(value) {
  return String(value ?? '').trim()
}

export function truncatePromptText(text, maxChars, { ellipsis = '\n...(已截斷)' } = {}) {
  const source = normalizePromptText(text)
  const budget = Number(maxChars)
  if (!Number.isFinite(budget) || budget <= 0) return ''
  if (source.length <= budget) return source

  const suffix = normalizePromptText(ellipsis)
  const keep = Math.max(0, budget - suffix.length)
  const head = source.slice(0, keep).trimEnd()
  return head ? `${head}${suffix}` : suffix.slice(0, budget)
}

export function formatRecentLessons(lessons, { limit = 3 } = {}) {
  return (Array.isArray(lessons) ? lessons : [])
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .slice(-Math.max(1, limit))
    .map((item) => `- [${item.date || '日期未填'}] ${item.text.trim()}`)
    .join('\n')
}

export function buildBudgetedHoldingSummary(
  entries,
  { maxChars = 3000, maxEntries = 5, joiner = '\n\n' } = {}
) {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry, index) => {
      const text = normalizePromptText(entry?.text)
      if (!text) return null
      return {
        key: String(entry?.key || entry?.code || entry?.name || index),
        code: String(entry?.code || '').trim(),
        name: String(entry?.name || '').trim(),
        weight: Number.isFinite(Number(entry?.weight)) ? Number(entry.weight) : 0,
        index,
        text,
      }
    })
    .filter(Boolean)

  const fullText = normalizedEntries.map((entry) => entry.text).join(joiner)
  if (fullText.length <= maxChars) {
    return {
      text: fullText,
      truncated: false,
      retainedKeys: normalizedEntries.map((entry) => entry.key),
      omittedKeys: [],
    }
  }

  const retained = [...normalizedEntries]
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, Math.max(1, maxEntries))
  const retainedKeySet = new Set(retained.map((entry) => entry.key))
  const omitted = normalizedEntries.filter((entry) => !retainedKeySet.has(entry.key))
  const omittedLabels = omitted
    .map((entry) => entry.name || entry.code)
    .filter(Boolean)
    .slice(0, 6)
    .join('、')
  const note = [
    '【prompt budget】持股摘要過長，已省略較小部位',
    `${omitted.length}檔，僅保留最大部位${retained.length}檔`,
    omittedLabels ? `（略過：${omittedLabels}${omitted.length > 6 ? '…' : ''}）` : '',
  ]
    .filter(Boolean)
    .join('')

  const retainedText = retained
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((entry) => entry.text)
    .join(joiner)

  return {
    text: truncatePromptText([note, retainedText].filter(Boolean).join('\n\n'), maxChars),
    truncated: true,
    retainedKeys: retained.map((entry) => entry.key),
    omittedKeys: omitted.map((entry) => entry.key),
  }
}

export function buildBudgetedBrainContext({
  fullText = '',
  userRulesText = '',
  recentLessonsText = '',
  maxChars = 1500,
}) {
  const normalizedFullText = normalizePromptText(fullText)
  if (normalizedFullText.length <= maxChars) {
    return {
      text: normalizedFullText,
      truncated: false,
    }
  }

  const fallback = [
    '══ 策略大腦（prompt budget mode）══',
    userRulesText ? `✅ 用戶確認規則：\n${userRulesText}` : '✅ 用戶確認規則：無',
    recentLessonsText ? `📚 最近 3 條教訓：\n${recentLessonsText}` : '📚 最近 3 條教訓：無',
    '⚠️ 其餘 AI 規則、候選規則、checklist 與統計資訊因 prompt 預算暫時省略。',
    '══════════════════════════',
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    text: truncatePromptText(fallback, maxChars),
    truncated: true,
  }
}
