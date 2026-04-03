// Central AI adapter.
// If you want to swap Claude / endpoint / model later, update this file only.
//
// Preferred env vars:
// - AI_API_KEY
// - AI_MODE
// - AI_API_ENDPOINT
// - AI_ENABLE_EXTENDED_THINKING
// - AI_THINKING_BUDGET_TOKENS

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-6-20250610'
const DEFAULT_VERSION = '2023-06-01'
const MIN_THINKING_BUDGET = 1024

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  )
}

export function getAiConfig() {
  const provider = process.env.AI_PROVIDER || 'anthropic'
  const anthropicKey = process.env.ANTHROPIC_API_KEY || ''
  const genericKey = process.env.AI_API_KEY || ''
  const apiKey = provider === 'anthropic' ? anthropicKey || genericKey : genericKey || anthropicKey
  const thinkingBudget = Number(process.env.AI_THINKING_BUDGET_TOKENS || 2048)
  return {
    provider,
    displayName: process.env.AI_PROVIDER_NAME || 'Claude',
    endpoint: process.env.AI_API_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey,
    apiKeyEnv: provider === 'anthropic' && anthropicKey ? 'ANTHROPIC_API_KEY' : 'AI_API_KEY',
    model: process.env.AI_MODE || DEFAULT_MODEL,
    apiVersion: process.env.AI_API_VERSION || DEFAULT_VERSION,
    enableExtendedThinking: parseBoolean(process.env.AI_ENABLE_EXTENDED_THINKING),
    thinkingBudgetTokens: Number.isFinite(thinkingBudget) ? thinkingBudget : 2048,
  }
}

export function ensureAiConfigured() {
  const config = getAiConfig()
  if (!config.apiKey) {
    throw new Error('未設定 AI_API_KEY')
  }
  return config
}

export function extractAiText(data) {
  const parts = Array.isArray(data?.content)
    ? data.content
        .filter((item) => item?.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text)
    : []
  return parts.join('\n\n')
}

function buildThinkingConfig({ allowThinking, config, maxTokens }) {
  return allowThinking &&
    config.enableExtendedThinking &&
    config.thinkingBudgetTokens >= MIN_THINKING_BUDGET &&
    config.thinkingBudgetTokens < maxTokens
    ? {
        type: 'enabled',
        budget_tokens: config.thinkingBudgetTokens,
      }
    : undefined
}

function buildAiRequestBody({ model, system, messages, maxTokens, thinking, stream = false }) {
  return {
    model,
    max_tokens: maxTokens,
    system,
    ...(thinking ? { thinking } : {}),
    ...(stream ? { stream: true } : {}),
    messages,
  }
}

async function parseAiErrorResponse(response) {
  const text = await response.text()
  try {
    const data = JSON.parse(text)
    return (
      data?.error?.message ||
      data?.error ||
      data?.detail ||
      text ||
      `AI request failed (${response.status})`
    )
  } catch {
    return text || `AI request failed (${response.status})`
  }
}

async function* iterateSseEvents(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')

        const event = parseSseChunk(chunk)
        if (event) yield event
      }

      if (done) break
    }

    const tailEvent = parseSseChunk(buffer)
    if (tailEvent) yield tailEvent
  } finally {
    reader.releaseLock?.()
  }
}

function parseSseChunk(chunk = '') {
  const text = String(chunk || '').trim()
  if (!text) return null

  let event = 'message'
  const dataLines = []

  for (const line of text.split('\n')) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim() || 'message'
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (dataLines.length === 0) return null
  return {
    event,
    data: dataLines.join('\n'),
  }
}

export async function callAiRaw({ system, messages, maxTokens = 3000, allowThinking = true }) {
  const config = ensureAiConfigured()
  const thinking = buildThinkingConfig({ allowThinking, config, maxTokens })
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.apiVersion,
    },
    body: JSON.stringify(
      buildAiRequestBody({
        model: config.model,
        system,
        maxTokens,
        thinking,
        messages,
      })
    ),
  })
  const data = await response.json()
  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.error ||
      data?.detail ||
      `AI request failed (${response.status})`
    throw new Error(detail)
  }
  return data
}

export async function callAiRawStream({
  system,
  messages,
  maxTokens = 3000,
  allowThinking = true,
}) {
  const config = ensureAiConfigured()
  if (config.provider !== 'anthropic') {
    throw new Error(`目前僅支援 anthropic streaming，收到 provider=${config.provider}`)
  }

  const thinking = buildThinkingConfig({ allowThinking, config, maxTokens })
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.apiVersion,
    },
    body: JSON.stringify(
      buildAiRequestBody({
        model: config.model,
        system,
        maxTokens,
        thinking,
        messages,
        stream: true,
      })
    ),
  })

  if (!response.ok) {
    throw new Error(await parseAiErrorResponse(response))
  }

  if (!response.body) {
    throw new Error('AI streaming 回應缺少 body')
  }

  return (async function* () {
    for await (const event of iterateSseEvents(response.body)) {
      if (!event?.data || event.data === '[DONE]') continue

      let payload = null
      try {
        payload = JSON.parse(event.data)
      } catch {
        continue
      }

      if (event.event === 'message_start') {
        yield { type: 'message-start', message: payload?.message || null }
        continue
      }

      if (event.event === 'content_block_delta' && payload?.delta?.type === 'text_delta') {
        yield {
          type: 'text-delta',
          text: String(payload.delta.text || ''),
          index: Number(payload.index) || 0,
        }
        continue
      }

      if (event.event === 'message_delta') {
        yield { type: 'message-delta', delta: payload?.delta || null }
        continue
      }

      if (event.event === 'message_stop') {
        yield { type: 'message-stop' }
        continue
      }

      if (event.event === 'error') {
        throw new Error(payload?.error?.message || payload?.message || 'AI streaming 過程發生錯誤')
      }
    }
  })()
}

export async function callAiText({ system, user, maxTokens = 3000 }) {
  const data = await callAiRaw({
    system,
    maxTokens,
    messages: [{ role: 'user', content: user }],
  })
  return extractAiText(data)
}

export async function callAiImage({
  system,
  base64,
  mediaType = 'image/jpeg',
  prompt = '解析這張成交截圖',
  maxTokens = 600,
}) {
  return callAiRaw({
    system,
    maxTokens,
    allowThinking: false,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })
}
