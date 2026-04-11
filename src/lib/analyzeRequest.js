// @ts-check

/**
 * @typedef {{
 *   detail?: string,
 *   error?: string,
 *   content?: Array<{ text?: string | null }>,
 * }} AnalyzeJsonPayload
 */

/**
 * @typedef {{
 *   ok?: boolean,
 *   status?: number,
 *   body?: unknown,
 *   headers?: { get?: ((name: string) => string | null | undefined) | undefined } | null,
 *   clone?: (() => { text: () => Promise<string> }) | null,
 *   text?: (() => Promise<string>) | null,
 *   json: () => Promise<AnalyzeJsonPayload>,
 * }} AnalyzeResponseLike
 */

/**
 * @typedef {{
 *   requestBody: unknown,
 *   fetchImpl?: (input: string, init?: RequestInit) => Promise<AnalyzeResponseLike>,
 *   streamUrl?: string,
 *   fallbackUrl?: string,
 *   timeoutMs?: number,
 *   consumeStream: (
 *     response: AnalyzeResponseLike,
 *     handlers: {
 *       onMeta: (meta: unknown) => void,
 *       onDelta: (delta: unknown) => void,
 *     }
 *   ) => Promise<string>,
 *   onMeta?: (meta: unknown) => void,
 *   onDelta?: (delta: unknown) => void,
 *   onFallback?: (error: unknown) => void,
 *   localRuntime?: boolean,
 * }} RequestAnalyzeWithFallbackOptions
 */

export const ANALYZE_REQUEST_TIMEOUT_MS = 55_000

export function createAnalyzeTimeoutSignal(timeoutMs = ANALYZE_REQUEST_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(timeoutMs), cancel: () => {} }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  }
}

function isTimeoutLikeText(text = '') {
  return String(text || '')
    .toUpperCase()
    .includes('TIMEOUT')
}

/**
 * @param {AnalyzeResponseLike | null | undefined} response
 */
export function isAnalyzeStreamResponse(response) {
  return Boolean(
    response?.ok &&
    response?.body &&
    response?.headers?.get?.('content-type')?.includes('text/event-stream')
  )
}

/**
 * @param {AnalyzeResponseLike | null | undefined} response
 */
async function readResponseText(response) {
  const clone = response?.clone?.()
  if (clone) {
    return clone.text().catch(() => '')
  }
  return response?.text?.().catch(() => '') || ''
}

/**
 * @param {AnalyzeResponseLike} response
 */
export async function buildAnalyzeHttpError(response) {
  const responseTextPromise = readResponseText(response)
  /** @type {AnalyzeJsonPayload | null} */
  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const text = payload ? '' : await responseTextPromise
  if (payload?.detail || payload?.error) {
    return new Error(payload.detail || payload.error)
  }
  if (isTimeoutLikeText(text)) {
    return new Error('AI 分析逾時，請稍後再試（Vercel function timeout）')
  }
  return new Error(text.slice(0, 120) || `AI 分析失敗 (${response?.status || 'unknown'})`)
}

/**
 * @param {AnalyzeResponseLike} response
 */
export async function parseAnalyzeJsonResponse(response) {
  const responseTextPromise = readResponseText(response)

  try {
    return await response.json()
  } catch {
    const text = await responseTextPromise
    throw new Error(
      isTimeoutLikeText(text)
        ? 'AI 分析逾時，請稍後再試（Vercel function timeout）'
        : `AI 回應格式錯誤：${text.slice(0, 80)}`
    )
  }
}

// localhost / vercel dev 不支援 SSE streaming，直接走非 streaming
function isLocalDev() {
  try {
    const host = globalThis.location?.hostname || ''
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')
  } catch {
    return false
  }
}

/**
 * @param {RequestAnalyzeWithFallbackOptions} options
 */
export async function requestAnalyzeWithFallback({
  requestBody,
  fetchImpl = globalThis.fetch,
  streamUrl = '/api/analyze?stream=1',
  fallbackUrl = '/api/analyze',
  timeoutMs = ANALYZE_REQUEST_TIMEOUT_MS,
  consumeStream,
  onMeta = () => {},
  onDelta = () => {},
  onFallback = () => {},
  localRuntime = isLocalDev(),
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Analyze fetch implementation unavailable')
  }
  if (typeof consumeStream !== 'function') {
    throw new Error('Analyze stream consumer unavailable')
  }

  /**
   * @param {AbortSignal} signal
   * @returns {RequestInit}
   */
  const requestInit = (signal) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  })

  const local = Boolean(localRuntime)

  // 本地開發跳過 streaming（vercel dev 不支援 SSE）
  if (!local) {
    /** @type {unknown | null} */
    let streamError = null
    const streamAttempt = createAnalyzeTimeoutSignal(timeoutMs)
    try {
      const response = await fetchImpl(streamUrl, requestInit(streamAttempt.signal))
      if (!response.ok) {
        throw await buildAnalyzeHttpError(response)
      }
      if (!isAnalyzeStreamResponse(response)) {
        throw new Error('AI 串流回應不可用')
      }

      const rawText = await consumeStream(response, { onMeta, onDelta })
      if (!String(rawText || '').trim()) {
        throw new Error('AI 串流分析沒有產出文字內容')
      }

      return { rawText, mode: 'stream', streamError: null }
    } catch (error) {
      streamError = error
    } finally {
      streamAttempt.cancel()
    }

    onFallback(streamError)
  }

  // 非 streaming 模式（本地開發的主要路徑，production 的 fallback）
  const fallbackAttempt = createAnalyzeTimeoutSignal(timeoutMs)
  try {
    const response = await fetchImpl(fallbackUrl, requestInit(fallbackAttempt.signal))
    if (!response.ok) {
      throw await buildAnalyzeHttpError(response)
    }

    const data = await parseAnalyzeJsonResponse(response)
    const rawText = data?.content?.[0]?.text || null
    if (!rawText) {
      throw new Error('AI 有回應，但沒有產出可顯示的文字內容')
    }

    return { rawText, mode: local ? 'local' : 'fallback', streamError: null }
  } finally {
    fallbackAttempt.cancel()
  }
}
