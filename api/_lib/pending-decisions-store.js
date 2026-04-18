import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_NEXT_EXPECTED_DECISION_AT = '預計 3 天後 · L8 signoff 前'

function resolveWorkspaceRoot() {
  const explicit = String(process.env.WORKSPACE_ROOT || '').trim()
  const candidates = [explicit, process.cwd(), path.resolve(process.cwd(), '..')].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'coordination', 'llm-bus'))) return candidate
  }

  return explicit || process.cwd()
}

function toIsoString(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function normalizeOption(option, fallbackKey = '') {
  const raw = option && typeof option === 'object' ? option : {}
  const key = String(raw.key || fallbackKey || '')
    .trim()
    .toUpperCase()
  const label = String(raw.label || '').trim()
  if (!key || !label) return null
  return { key, label }
}

function normalizeDecisionId(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
}

function normalizeDecisionRecord(record) {
  const raw = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
  const id = normalizeDecisionId(raw.id)
  if (!id) return null

  const options = Array.isArray(raw.options)
    ? raw.options
        .map((option, index) => normalizeOption(option, String.fromCharCode(65 + index)))
        .filter(Boolean)
    : []
  const status =
    String(raw.status || '')
      .trim()
      .toLowerCase() || 'pending'

  return {
    id,
    createdAt: raw.createdAt ? toIsoString(raw.createdAt) : undefined,
    askedBy: String(raw.askedBy || '').trim() || undefined,
    context: String(raw.context || '').trim() || undefined,
    question: String(raw.question || '').trim() || undefined,
    options: options.length ? options : undefined,
    recommendation:
      String(raw.recommendation || '')
        .trim()
        .toUpperCase() || undefined,
    recommendationReason: String(raw.recommendationReason || raw.reason || '').trim() || undefined,
    deadlineSoft: raw.deadlineSoft ? toIsoString(raw.deadlineSoft) : undefined,
    nextExpectedDecisionAt: String(raw.nextExpectedDecisionAt || '').trim() || undefined,
    answer:
      String(raw.answer || '')
        .trim()
        .toUpperCase() || undefined,
    answeredAt: raw.answeredAt ? toIsoString(raw.answeredAt) : undefined,
    notes: String(raw.notes || '').trim() || undefined,
    status: status === 'answered' ? 'answered' : 'pending',
  }
}

export function getPendingDecisionsPath() {
  const explicit = String(process.env.PENDING_DECISIONS_PATH || '').trim()
  if (explicit) return explicit
  return path.join(resolveWorkspaceRoot(), 'coordination', 'llm-bus', 'pending-decisions.jsonl')
}

async function ensureJsonlDirectory(filePath) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
}

async function readLines(filePath) {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf-8')
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export async function readPendingDecisionEvents(filePath = getPendingDecisionsPath()) {
  const lines = await readLines(filePath)
  return lines.map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Invalid pending-decisions JSONL at line ${index + 1}: ${error.message}`)
    }
  })
}

export function reducePendingDecisionEvents(events = []) {
  const latestById = new Map()
  let nextExpectedDecisionAt = ''

  for (const event of events) {
    const normalized = normalizeDecisionRecord(event)
    if (!normalized) continue
    const previous = latestById.get(normalized.id) || {}
    latestById.set(normalized.id, {
      ...previous,
      ...normalized,
      options: normalized.options || previous.options,
    })
    if (normalized.nextExpectedDecisionAt)
      nextExpectedDecisionAt = normalized.nextExpectedDecisionAt
  }

  return {
    decisions: Array.from(latestById.values()),
    nextExpectedDecisionAt: nextExpectedDecisionAt || DEFAULT_NEXT_EXPECTED_DECISION_AT,
  }
}

function sortVisibleDecisions(left, right) {
  const leftDeadline = Date.parse(left?.deadlineSoft || '')
  const rightDeadline = Date.parse(right?.deadlineSoft || '')
  if (
    Number.isFinite(leftDeadline) &&
    Number.isFinite(rightDeadline) &&
    leftDeadline !== rightDeadline
  ) {
    return leftDeadline - rightDeadline
  }
  if (Number.isFinite(leftDeadline) && !Number.isFinite(rightDeadline)) return -1
  if (!Number.isFinite(leftDeadline) && Number.isFinite(rightDeadline)) return 1

  const leftCreated = Date.parse(left?.createdAt || '')
  const rightCreated = Date.parse(right?.createdAt || '')
  if (
    Number.isFinite(leftCreated) &&
    Number.isFinite(rightCreated) &&
    leftCreated !== rightCreated
  ) {
    return leftCreated - rightCreated
  }
  if (Number.isFinite(leftCreated) && !Number.isFinite(rightCreated)) return -1
  if (!Number.isFinite(leftCreated) && Number.isFinite(rightCreated)) return 1

  return String(left?.id || '').localeCompare(String(right?.id || ''))
}

export async function listPendingDecisions({
  includeHistory = false,
  filePath = getPendingDecisionsPath(),
} = {}) {
  const events = await readPendingDecisionEvents(filePath)
  const reduced = reducePendingDecisionEvents(events)
  const visible = reduced.decisions
    .filter((decision) => includeHistory || decision.status !== 'answered')
    .sort(sortVisibleDecisions)

  return {
    decisions: visible,
    summary: {
      pendingCount: reduced.decisions.filter((decision) => decision.status !== 'answered').length,
      nextExpectedDecisionAt: reduced.nextExpectedDecisionAt || DEFAULT_NEXT_EXPECTED_DECISION_AT,
    },
  }
}

async function appendJsonLine(filePath, record) {
  await ensureJsonlDirectory(filePath)
  const payload = `${JSON.stringify(record)}\n`
  try {
    const stats = await fsPromises.stat(filePath)
    if (stats.size > 0) {
      const handle = await fsPromises.open(filePath, 'r')
      try {
        const buffer = Buffer.alloc(1)
        await handle.read(buffer, 0, 1, stats.size - 1)
        const prefix = buffer[0] === 0x0a ? '' : '\n'
        await fsPromises.appendFile(filePath, `${prefix}${payload}`, 'utf-8')
        return
      } finally {
        await handle.close()
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  await fsPromises.appendFile(filePath, payload, 'utf-8')
}

export async function appendPendingDecision(record, filePath = getPendingDecisionsPath()) {
  const decision = normalizeDecisionRecord({
    ...record,
    status: 'pending',
    createdAt: record?.createdAt || new Date().toISOString(),
  })
  if (!decision?.id || !decision.question) {
    throw new Error('Pending decision requires id and question')
  }
  if (!Array.isArray(decision.options) || decision.options.length < 2) {
    throw new Error('Pending decision requires at least two options')
  }
  await appendJsonLine(filePath, decision)
  return decision
}

export async function appendPendingDecisionAnswer(
  id,
  { answer, notes } = {},
  filePath = getPendingDecisionsPath()
) {
  const decisionId = normalizeDecisionId(id)
  const answerValue = String(answer || '')
    .trim()
    .toUpperCase()
  if (!decisionId) throw new Error('Missing decision id')
  if (!answerValue) throw new Error('Missing answer')

  const { decisions } = await listPendingDecisions({ includeHistory: true, filePath })
  const existing = decisions.find((decision) => decision.id === decisionId)
  if (!existing) throw new Error('Decision not found')
  if (
    !Array.isArray(existing.options) ||
    !existing.options.some((option) => option.key === answerValue)
  ) {
    throw new Error('Answer must match an existing option key')
  }

  const answerRecord = normalizeDecisionRecord({
    id: decisionId,
    answer: answerValue,
    notes,
    answeredAt: new Date().toISOString(),
    status: 'answered',
  })
  await appendJsonLine(filePath, answerRecord)
  return {
    ...existing,
    ...answerRecord,
    options: existing.options,
  }
}

export function writePendingDecisionsFixture(records, filePath = getPendingDecisionsPath()) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const payload = Array.isArray(records)
    ? records.map((record) => JSON.stringify(record)).join('\n')
    : ''
  fs.writeFileSync(filePath, payload ? `${payload}\n` : '', 'utf-8')
  return filePath
}
