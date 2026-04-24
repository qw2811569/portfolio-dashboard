import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { callAiRaw, extractAiText } from '../../api/_lib/ai-provider.js'
import { buildInternalAuthHeaders } from '../../api/_lib/auth-middleware.js'
import { loadLocalEnvIfPresent } from '../../api/_lib/local-env.js'
import {
  appendMorningNoteAlert,
  appendMorningNoteLog,
  buildMorningNoteFallbackNote,
  coerceMorningNotePortfolio,
  formatMorningNoteDisplayDate,
  formatMorningNoteMarketDate,
  getMorningNoteClock,
  listMorningNotePortfolioKeys,
  MORNING_NOTE_FALLBACK_COPY,
  MORNING_NOTE_TIMEZONE,
  resolveMorningNotePortfolioMeta,
  writeMorningNoteSnapshot,
} from '../../api/_lib/morning-note.js'
import { markCronSuccess } from '../../src/lib/cronLastSuccess.js'
import { buildMorningNote } from '../../src/lib/morningNoteBuilder.js'
import { applyAccuracyGatePrompt } from '../../src/lib/accuracyGate.js'
import { extractTradeParseJsonText } from '../../src/lib/tradeAiResponse.js'
import { INIT_HOLDINGS, INIT_WATCHLIST } from '../../src/seedData.js'
import { INIT_HOLDINGS_JINLIANCHENG } from '../../src/seedDataJinliancheng.js'

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3000'
const DEFAULT_EVENT_RANGE_DAYS = 5
const MORNING_NOTE_RETRY_LIMIT = 3
const MORNING_NOTE_CONFIDENCE_THRESHOLD = 0.7
const INSIDER_BUY_SELL_RE =
  /(操作建議|買進|買入|賣出|加碼|減碼|停損|出場|布局|進場|調節|續抱|buy|sell|trim|rebalance|exit|action)/iu

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function readTextFile(targetPath) {
  return fsPromises.readFile(targetPath, 'utf8')
}

async function readJsonFile(targetPath) {
  try {
    return JSON.parse(await readTextFile(targetPath))
  } catch {
    return null
  }
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10
}

function safePercent(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? roundToOneDecimal(numeric) : null
}

function normalizeHoldingRows(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((row) => {
      const code = String(row?.code || '').trim()
      const name = String(row?.name || '').trim()
      if (!code || !name) return null

      const qty = toFiniteNumber(row?.qty)
      const price = toFiniteNumber(row?.price)
      const value = Math.max(0, toFiniteNumber(row?.value, price * qty))

      return {
        ...row,
        code,
        name,
        qty,
        price,
        value,
        pnl: toFiniteNumber(row?.pnl),
        pct: safePercent(row?.pct),
        type: String(row?.type || '').trim() || '股票',
      }
    })
    .filter(Boolean)
}

function buildCandidateText(candidate) {
  return [candidate.title, candidate.body].filter(Boolean).join(' · ')
}

function summarizeCandidateFacts(candidate) {
  return Array.isArray(candidate?.facts) ? candidate.facts.filter(Boolean).join('；') : ''
}

async function retryAsync(label, fn, { attempts = MORNING_NOTE_RETRY_LIMIT, logger = console } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      logger.warn?.(`[morning-note-worker] ${label} failed on attempt ${attempt}/${attempts}:`, error)
      if (attempt >= attempts) break
    }
  }

  throw lastError || new Error(`${label} failed`)
}

function rankStaleStatus(values = []) {
  const rank = { fresh: 0, stale: 1, missing: 2, failed: 3 }
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim() || 'fresh')
    .sort((left, right) => (rank[right] || 0) - (rank[left] || 0))[0]
}

function buildSnapshotStatus(notes = []) {
  return rankStaleStatus(notes.map((note) => note?.staleStatus || 'fresh'))
}

function extractHoldingCodes(holdings = []) {
  return normalizeHoldingRows(holdings)
    .map((holding) => holding.code)
    .filter(Boolean)
}

function extractEventCodes(event) {
  const stockValues = Array.isArray(event?.stocks) ? event.stocks : []
  return stockValues
    .map((stock) => {
      const matched = String(stock || '').match(/\d{4,6}/)
      return matched ? matched[0] : null
    })
    .filter(Boolean)
}

function compareEventPriority(left, right, holdingCodes = new Set(), marketDate = '') {
  function score(event) {
    const eventCodes = extractEventCodes(event)
    const hitsHolding = eventCodes.some((code) => holdingCodes.has(code))
    const isToday = String(event?.date || '').trim() === marketDate
    const impact = String(event?.impact || '').trim().toLowerCase()
    const catalyst = String(event?.catalystType || event?.type || '').trim().toLowerCase()

    let total = 0
    if (isToday) total += 90
    if (hitsHolding) total += 40
    if (impact === 'high') total += 30
    if (impact === 'medium') total += 15
    if (catalyst === 'macro') total += 10
    return total
  }

  return score(right) - score(left)
}

function buildEventCandidates({ events = [], holdings = [], marketDate = '' } = {}) {
  const holdingCodes = new Set(extractHoldingCodes(holdings))
  const prioritized = [...(Array.isArray(events) ? events : [])].sort((left, right) =>
    compareEventPriority(left, right, holdingCodes, marketDate)
  )

  return prioritized.slice(0, 2).map((event, index) => {
    const eventCodes = extractEventCodes(event)
    const relatedCodes = eventCodes.filter((code) => holdingCodes.has(code))
    const dateLabel = String(event?.date || '').trim() || marketDate
    const impactLabel = String(event?.impact || 'medium')
      .trim()
      .toUpperCase()
    const title = String(event?.title || '').trim() || '今日行事曆提醒'
    const leadText =
      relatedCodes.length > 0
        ? `${title} 直接牽動 ${relatedCodes.join(' / ')}`
        : `${title} 會先定義今天的盤前節奏`

    return {
      id: `event-${index + 1}`,
      sourceRefs: [`event-calendar:${dateLabel}:${title}`],
      tone: impactLabel === 'HIGH' ? 'watch' : 'calm',
      title: leadText,
      body: `${dateLabel} · impact ${impactLabel}${relatedCodes.length > 0 ? ` · 相關持股 ${relatedCodes.join(', ')}` : ''}`,
      facts: [title, `日期 ${dateLabel}`, `impact ${impactLabel}`],
    }
  })
}

function buildConcentrationCandidate(holdings = []) {
  const normalized = normalizeHoldingRows(holdings)
  const totalValue = normalized.reduce((sum, holding) => sum + Math.max(0, holding.value), 0)
  if (!normalized.length || totalValue <= 0) return null

  const largest = [...normalized].sort((left, right) => right.value - left.value)[0]
  const weight = roundToOneDecimal((largest.value / totalValue) * 100)

  return {
    id: `concentration-${largest.code}`,
    sourceRefs: [`holdings:${largest.code}`],
    tone: weight >= 25 ? 'watch' : 'calm',
    title: `${largest.name} 仍是今天情緒溫度計`,
    body: `${largest.name} (${largest.code}) 約佔組合 ${weight}% · 盤前先把它的節奏放在第一排`,
    facts: [
      `${largest.name} (${largest.code})`,
      `組合占比 ${weight}%`,
      `持倉市值 ${Math.round(largest.value).toLocaleString()}`,
    ],
  }
}

function buildDrawdownCandidate(holdings = []) {
  const normalized = normalizeHoldingRows(holdings)
  const worst = [...normalized]
    .filter((holding) => Number.isFinite(holding.pct))
    .sort((left, right) => toFiniteNumber(left.pct) - toFiniteNumber(right.pct))[0]

  if (!worst) return null

  const pct = roundToOneDecimal(toFiniteNumber(worst.pct))
  const tone = pct <= -10 ? 'watch' : 'calm'

  return {
    id: `drawdown-${worst.code}`,
    sourceRefs: [`holdings:${worst.code}`],
    tone,
    title: `${worst.name} 還在拉扯組合心情`,
    body: `${worst.name} (${worst.code}) 目前未實現報酬 ${pct}% · 先把風險節奏看清楚`,
    facts: [
      `${worst.name} (${worst.code})`,
      `未實現報酬 ${pct}%`,
      `未實現損益 ${Math.round(toFiniteNumber(worst.pnl)).toLocaleString()}`,
    ],
  }
}

function buildPortfolioPulseCandidate(holdings = []) {
  const normalized = normalizeHoldingRows(holdings)
  if (!normalized.length) return null

  const totalValue = normalized.reduce((sum, holding) => sum + Math.max(0, holding.value), 0)
  const totalPnl = normalized.reduce((sum, holding) => sum + toFiniteNumber(holding.pnl), 0)

  return {
    id: 'portfolio-pulse',
    sourceRefs: ['portfolio:overview'],
    tone: totalPnl < 0 ? 'watch' : 'calm',
    title: '盤前先把整體節奏排一下',
    body: `目前共 ${normalized.length} 檔持倉 · 組合市值約 ${Math.round(totalValue).toLocaleString()} · 先看主要部位就夠`,
    facts: [
      `持倉檔數 ${normalized.length}`,
      `組合市值 ${Math.round(totalValue).toLocaleString()}`,
      `未實現損益 ${Math.round(totalPnl).toLocaleString()}`,
    ],
  }
}

function deriveMorningFocusCandidates({ events = [], holdings = [] } = {}) {
  const candidates = [
    ...buildEventCandidates({
      events,
      holdings,
      marketDate:
        (Array.isArray(events) ? events[0]?.date : '') || formatMorningNoteMarketDate(new Date()),
    }),
    buildConcentrationCandidate(holdings),
    buildDrawdownCandidate(holdings),
    buildPortfolioPulseCandidate(holdings),
  ].filter(Boolean)

  const deduped = []
  const seen = new Set()
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue
    seen.add(candidate.id)
    deduped.push(candidate)
    if (deduped.length >= 3) break
  }
  return deduped
}

function buildMorningNoteSystemPrompt(meta) {
  const safetyLine =
    meta.complianceMode === 'insider'
      ? '這是公司代表 / 合規模式，只能寫公開資訊、風險與待驗證事項，不得出現買進、賣出、加碼、減碼、停損、出場等語氣。'
      : '可以提醒用戶今天先看什麼，但保持軟語，不要下命令或直接叫人買賣。'

  return applyAccuracyGatePrompt(
    [
      '你是台股盤前晨報編輯，任務是把既有 facts 改寫成軟語版 Morning Note。',
      '語氣：台灣繁中、投資網紅式、溫和、像在提醒節奏，不要命令句。',
      '只能改寫輸入 facts，不得新增新事實、數字、日期、ticker 或來源。',
      safetyLine,
      '輸出必須是 JSON，不要 markdown code block，不要補充說明。',
      '欄位內容以 plain text 為主；若真的需要層次，只可用基本 markdown（heading/list/strong/table），不要 raw HTML。',
      'JSON schema:',
      '{',
      '  "accuracyStatus": "pass|blocked",',
      '  "blockedReason": "string",',
      '  "confidence": 0.0,',
      '  "headline": "16字內",',
      '  "summary": "1句總結",',
      '  "lead": "1-2句盤前導語",',
      '  "items": [',
      '    {',
      '      "sourceId": "input item id",',
      '      "tone": "calm|watch",',
      '      "title": "一句焦點標題",',
      '      "body": "一句軟語描述"',
      '    }',
      '  ]',
      '}',
      '若 facts 不足、無法保真，請回傳 accuracyStatus="blocked" 並寫 blockedReason。',
    ].join('\n'),
    {
      portfolio: {
        complianceMode: meta.complianceMode,
      },
      sourceLabel: 'worker-derived holdings / calendar facts',
      confidenceThreshold: MORNING_NOTE_CONFIDENCE_THRESHOLD,
    }
  )
}

function parseMorningNoteAiJson(rawText) {
  const text = extractTradeParseJsonText(rawText)
  if (!text) throw new Error('AI 未回傳可解析的 morning note JSON')
  return JSON.parse(text)
}

function evaluateMorningNoteAiPayload(payload, candidates = [], meta) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('morning note AI payload must be an object')
  }

  const accuracyStatus = String(payload.accuracyStatus || '').trim().toLowerCase()
  const blockedReason = String(payload.blockedReason || '').trim()
  const confidence = Number(payload.confidence)

  if (accuracyStatus === 'blocked') {
    return {
      blocked: true,
      reason: blockedReason || 'Accuracy Gate 主動攔下 morning note 文案',
    }
  }

  if (!Number.isFinite(confidence)) {
    throw new Error('morning note AI confidence is missing')
  }

  if (confidence < MORNING_NOTE_CONFIDENCE_THRESHOLD) {
    return {
      blocked: true,
      reason: `AI confidence ${confidence.toFixed(2)} below ${MORNING_NOTE_CONFIDENCE_THRESHOLD.toFixed(2)}`,
    }
  }

  const headline = String(payload.headline || '').trim()
  const summary = String(payload.summary || '').trim()
  const lead = String(payload.lead || '').trim()
  const items = Array.isArray(payload.items) ? payload.items : []

  if (!headline || !summary || !lead || items.length !== candidates.length) {
    throw new Error('morning note AI payload is incomplete')
  }

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const normalizedItems = []
  const seen = new Set()

  for (const item of items) {
    const sourceId = String(item?.sourceId || '').trim()
    const candidate = candidateById.get(sourceId)
    if (!candidate || seen.has(sourceId)) {
      return {
        blocked: true,
        reason: 'AI 回傳的 focus item 沒有對齊原始 source facts',
      }
    }

    const title = String(item?.title || '').trim()
    const body = String(item?.body || '').trim()
    if (!title || !body) {
      throw new Error('morning note AI item is incomplete')
    }

    seen.add(sourceId)
    normalizedItems.push({
      id: sourceId,
      sourceRefs: candidate.sourceRefs,
      tone: String(item?.tone || '').trim() === 'watch' ? 'watch' : candidate.tone,
      title,
      body,
      facts: candidate.facts,
    })
  }

  const combinedText = [headline, summary, lead, ...normalizedItems.map(buildCandidateText)].join('\n')
  if (meta.complianceMode === 'insider' && INSIDER_BUY_SELL_RE.test(combinedText)) {
    return {
      blocked: true,
      reason: 'insider morning note 出現買賣語氣，已被合規攔下',
    }
  }

  return {
    blocked: false,
    headline,
    summary,
    lead,
    confidence,
    focusPoints: normalizedItems,
  }
}

async function generateAiMorningNote({
  meta,
  candidates,
  callAiRawImpl = callAiRaw,
}) {
  const system = buildMorningNoteSystemPrompt(meta)
  const userPrompt = JSON.stringify(
    {
      portfolio: {
        id: meta.snapshotKey,
        label: meta.displayName,
        complianceMode: meta.complianceMode,
      },
      items: candidates.map((candidate) => ({
        id: candidate.id,
        tone: candidate.tone,
        facts: candidate.facts,
        sourceRefs: candidate.sourceRefs,
      })),
    },
    null,
    2
  )

  const response = await callAiRawImpl({
    system,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    maxTokens: 1200,
    allowThinking: false,
  })

  return evaluateMorningNoteAiPayload(
    parseMorningNoteAiJson(extractAiText(response)),
    candidates,
    meta
  )
}

async function loadOwnerHoldings(repoRoot) {
  const direct = await readJsonFile(path.join(repoRoot, 'data', 'holdings.json'))
  if (Array.isArray(direct) && direct.length > 0) {
    return {
      holdings: normalizeHoldingRows(direct),
      source: 'local-data',
      staleReason: '',
    }
  }

  return {
    holdings: normalizeHoldingRows(INIT_HOLDINGS),
    source: 'seed-fallback',
    staleReason: 'owner_seed_fallback',
  }
}

async function loadInsiderHoldings() {
  return {
    holdings: normalizeHoldingRows(INIT_HOLDINGS_JINLIANCHENG),
    source: 'seed-insider-baseline',
    staleReason: '',
  }
}

async function loadPortfolioHoldings(portfolioKey, { repoRoot }) {
  if (portfolioKey === '7865') return loadInsiderHoldings()
  return loadOwnerHoldings(repoRoot)
}

function loadPortfolioWatchlist(portfolioKey) {
  if (portfolioKey === 'me') return Array.isArray(INIT_WATCHLIST) ? INIT_WATCHLIST : []
  return []
}

function resolveApiOrigin() {
  return (
    String(process.env.MORNING_NOTE_API_ORIGIN || '').trim() ||
    String(process.env.INTERNAL_API_ORIGIN || '').trim() ||
    DEFAULT_API_ORIGIN
  ).replace(/\/$/, '')
}

async function loadCalendarEvents({
  origin = resolveApiOrigin(),
  holdings = [],
  fetchImpl = fetch,
  logger = console,
}) {
  const codes = extractHoldingCodes(holdings)
  const url = new URL('/api/event-calendar', origin)
  url.searchParams.set('range', String(DEFAULT_EVENT_RANGE_DAYS))
  if (codes.length > 0) {
    url.searchParams.set('codes', codes.join(','))
  }

  return retryAsync(
    'event-calendar',
    async () => {
      const response = await fetchImpl(url, {
        headers: buildInternalAuthHeaders({ Accept: 'application/json' }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || `event-calendar failed (${response.status})`)
      }

      return Array.isArray(payload?.events) ? payload.events : []
    },
    { logger }
  )
}

function filterPortfolioEvents(events = [], holdings = [], marketDate = '') {
  const holdingCodes = new Set(extractHoldingCodes(holdings))

  return (Array.isArray(events) ? events : []).filter((event) => {
    const date = String(event?.date || '').trim()
    const eventCodes = extractEventCodes(event)
    return (
      date === marketDate ||
      String(event?.catalystType || event?.type || '').trim().toLowerCase() === 'macro' ||
      eventCodes.some((code) => holdingCodes.has(code))
    )
  })
}

export async function buildMorningNotePortfolioArtifact(
  portfolioKey,
  {
    marketDate,
    events = [],
    repoRoot = resolveRepoRoot(),
    callAiRawImpl = callAiRaw,
    logger = console,
  } = {}
) {
  const meta = resolveMorningNotePortfolioMeta(portfolioKey)
  const generatedAt = new Date().toISOString()
  const date = formatMorningNoteDisplayDate(new Date(`${marketDate}T00:30:00.000Z`), MORNING_NOTE_TIMEZONE)
  const holdingState = await loadPortfolioHoldings(portfolioKey, { repoRoot })
  const holdings = holdingState.holdings
  const watchlist = loadPortfolioWatchlist(portfolioKey)
  const staleReasons = holdingState.staleReason ? [holdingState.staleReason] : []

  if (!Array.isArray(holdings) || holdings.length === 0) {
    return buildMorningNoteFallbackNote({
      portfolioKey,
      marketDate,
      date,
      staleStatus: 'failed',
      reason: 'holdings_missing',
      generatedAt,
      source: 'vm-worker',
    })
  }

  const portfolioEvents = filterPortfolioEvents(events, holdings, marketDate)
  const sectionsNote = buildMorningNote({
    holdings,
    theses: [],
    events: portfolioEvents,
    watchlist,
    institutional: null,
    announcements: [],
    today: marketDate,
  })
  const candidates = deriveMorningFocusCandidates({
    events: portfolioEvents,
    holdings,
  })

  if (candidates.length === 0) {
    return {
      ...buildMorningNoteFallbackNote({
        portfolioKey,
        marketDate,
        date,
        staleStatus: 'failed',
        reason: 'empty_focus_candidates',
        generatedAt,
        source: 'vm-worker',
      }),
      sections: sectionsNote.sections,
    }
  }

  try {
    const aiResult = await retryAsync(
      `morning-note-ai:${portfolioKey}`,
      () =>
        generateAiMorningNote({
          meta,
          candidates,
          callAiRawImpl,
        }),
      { logger }
    )

    if (aiResult.blocked) {
      return {
        ...buildMorningNoteFallbackNote({
          portfolioKey,
          marketDate,
          date,
          staleStatus: 'failed',
          reason: 'accuracy_gate_blocked',
          blockedReason: aiResult.reason,
          message: 'Accuracy Gate 已攔下今日盤前文案，請查看原因',
          generatedAt,
          source: 'vm-worker',
        }),
        sections: sectionsNote.sections,
      }
    }

    return coerceMorningNotePortfolio(
      {
        ...sectionsNote,
        marketDate,
        date,
        generatedAt,
        source: 'vm-worker',
        staleStatus: staleReasons.length > 0 ? 'stale' : 'fresh',
        staleReasons,
        accuracyStatus: 'pass',
        headline: aiResult.headline,
        summary: aiResult.summary,
        lead: aiResult.lead,
        focusPoints: aiResult.focusPoints,
        fallbackMessage: null,
        blockedReason: null,
      },
      {
        portfolioKey,
        marketDate,
      }
    )
  } catch (error) {
    logger.warn?.(`[morning-note-worker] AI generation fallback for ${portfolioKey}:`, error)
    return {
      ...buildMorningNoteFallbackNote({
        portfolioKey,
        marketDate,
        date,
        staleStatus: 'failed',
        reason: 'ai_generation_failed',
        message: MORNING_NOTE_FALLBACK_COPY,
        generatedAt,
        source: 'vm-worker',
      }),
      staleReasons: [...staleReasons, 'ai_generation_failed'],
      sections: sectionsNote.sections,
    }
  }
}

export async function generateMorningNoteSnapshot({
  now = new Date(),
  origin = resolveApiOrigin(),
  fetchImpl = fetch,
  callAiRawImpl = callAiRaw,
  logger = console,
  repoRoot = resolveRepoRoot(),
} = {}) {
  const clock = getMorningNoteClock(now)
  const marketDate = formatMorningNoteMarketDate(now, MORNING_NOTE_TIMEZONE)
  const noteDate = formatMorningNoteDisplayDate(now, MORNING_NOTE_TIMEZONE)

  if (clock.isWeekend) {
    return {
      skipped: true,
      reason: 'weekend',
      marketDate,
      noteDate,
    }
  }

  const ownerHoldings = await loadPortfolioHoldings('me', { repoRoot })
  let events = []
  let calendarFailure = null

  try {
    events = await loadCalendarEvents({
      origin,
      holdings: ownerHoldings.holdings,
      fetchImpl,
      logger,
    })
  } catch (error) {
    calendarFailure = error
    logger.warn?.('[morning-note-worker] event calendar unavailable, proceeding with holdings-only note', error)
  }

  const portfolios = {}
  for (const portfolioKey of listMorningNotePortfolioKeys()) {
    const note = await buildMorningNotePortfolioArtifact(portfolioKey, {
      marketDate,
      events,
      repoRoot,
      callAiRawImpl,
      logger,
    })

    if (calendarFailure) {
      note.staleStatus = note.staleStatus === 'failed' ? 'failed' : 'stale'
      note.staleReasons = Array.from(new Set([...(note.staleReasons || []), 'calendar_fetch_failed']))
    }

    portfolios[portfolioKey] = note
  }

  const notes = Object.values(portfolios)
  return {
    schemaVersion: 1,
    timeZone: MORNING_NOTE_TIMEZONE,
    marketDate,
    date: noteDate,
    generatedAt: now.toISOString(),
    source: 'vm-worker',
    status: buildSnapshotStatus(notes),
    staleReasons: calendarFailure ? ['calendar_fetch_failed'] : [],
    portfolios,
  }
}

function buildAlertPayload({ snapshot = null, error = null, now = new Date() } = {}) {
  return {
    ts: new Date(now).toISOString(),
    kind: 'morning-note',
    level: 'error',
    status: snapshot?.status || 'failed',
    marketDate: snapshot?.marketDate || formatMorningNoteMarketDate(now, MORNING_NOTE_TIMEZONE),
    error: error?.message || null,
    portfolios: Object.entries(snapshot?.portfolios || {}).map(([portfolioId, note]) => ({
      portfolioId,
      staleStatus: note?.staleStatus || 'failed',
      blockedReason: note?.blockedReason || null,
      staleReasons: Array.isArray(note?.staleReasons) ? note.staleReasons : [],
    })),
  }
}

export async function runMorningNoteWorker({
  now = new Date(),
  origin = resolveApiOrigin(),
  fetchImpl = fetch,
  callAiRawImpl = callAiRaw,
  logger = console,
} = {}) {
  const snapshot = await generateMorningNoteSnapshot({
    now,
    origin,
    fetchImpl,
    callAiRawImpl,
    logger,
  })

  if (snapshot.skipped) {
    logger.info?.(
      `[morning-note-worker] skipped ${snapshot.marketDate} because ${snapshot.reason || 'unknown'}`
    )
    return snapshot
  }

  await writeMorningNoteSnapshot(snapshot)
  await appendMorningNoteLog({
    ts: new Date(now).toISOString(),
    marketDate: snapshot.marketDate,
    status: snapshot.status,
    staleReasons: snapshot.staleReasons,
    portfolios: Object.values(snapshot.portfolios).map((note) => ({
      portfolioId: note.portfolioId,
      staleStatus: note.staleStatus,
      staleReasons: note.staleReasons,
      blockedReason: note.blockedReason,
    })),
  })

  if (
    snapshot.status === 'failed' ||
    Object.values(snapshot.portfolios).some((note) => note?.blockedReason)
  ) {
    await appendMorningNoteAlert(buildAlertPayload({ snapshot, now }))
  }

  await markCronSuccess('morning-note', {
    token: process.env.BLOB_READ_WRITE_TOKEN || process.env.PUB_BLOB_READ_WRITE_TOKEN || '',
    now,
    access: 'private',
    logger,
  })

  logger.info?.(`[morning-note-worker] completed ${snapshot.marketDate} (${snapshot.status})`)
  return snapshot
}

function parseCliArgs(argv = []) {
  const parsed = {}

  for (const arg of argv) {
    if (arg.startsWith('--date=')) parsed.date = arg.slice('--date='.length).trim()
    if (arg.startsWith('--origin=')) parsed.origin = arg.slice('--origin='.length).trim()
  }

  return parsed
}

function resolveCliDate(value) {
  const normalized = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return new Date()
  return new Date(`${normalized}T00:30:00.000Z`)
}

async function main() {
  const repoRoot = resolveRepoRoot()
  loadLocalEnvIfPresent({ cwd: repoRoot })
  const args = parseCliArgs(process.argv.slice(2))

  try {
    const snapshot = await runMorningNoteWorker({
      now: resolveCliDate(args.date),
      origin: args.origin || resolveApiOrigin(),
      logger: console,
    })
    console.log(JSON.stringify(snapshot, null, 2))
  } catch (error) {
    await appendMorningNoteAlert(buildAlertPayload({ error, now: new Date() }))
    console.error('[morning-note-worker] fatal error:', error)
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
