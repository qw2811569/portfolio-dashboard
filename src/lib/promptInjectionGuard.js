const PROMPT_INJECTION_PATTERNS = [
  /ignore(?:\s+all)?\s+previous\s+instructions/i,
  /\byou\s+are\s+now\b/i,
  /^\s*system\s*:/im,
]

export function findPromptInjectionAttempt(text = '') {
  const input = String(text || '')
  if (!input.trim()) return null

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const match = input.match(pattern)
    if (match) {
      return {
        excerpt: match[0],
        pattern: pattern.source,
      }
    }
  }

  return null
}

export function findPromptInjectionInRequest({ systemPrompt = '', userPrompt = '' } = {}) {
  const systemAttempt = findPromptInjectionAttempt(systemPrompt)
  if (systemAttempt) {
    return {
      field: 'systemPrompt',
      ...systemAttempt,
    }
  }

  const userAttempt = findPromptInjectionAttempt(userPrompt)
  if (userAttempt) {
    return {
      field: 'userPrompt',
      ...userAttempt,
    }
  }

  return null
}
