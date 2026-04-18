#!/usr/bin/env node
/**
 * Agent Bridge — Standalone Server (extracted from VS Code extension)
 *
 * Runs on a GCP VM without VS Code dependency.
 * Manages LLM agent processes (Claude, Codex, Qwen, Gemini) via child_process.
 * Serves the mobile dashboard, task management, and WebSocket live feed.
 */

import http from 'node:http'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { exec, spawn } from 'node:child_process'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'node:url'
import { createLlmDispatcher } from './workers/llm-dispatcher.mjs'
import { createAnalystReportsWorker } from './workers/analyst-reports-worker.mjs'
import {
  appendPendingDecisionAnswer,
  listPendingDecisions,
} from '../api/_lib/pending-decisions-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ───────────────────────────────────────────────────────
const PORT = Number(process.env.BRIDGE_PORT) || 9527
const HOST = process.env.BRIDGE_HOST || '0.0.0.0'
const AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || ''
const AUTH_TOKEN_PREVIEW = process.env.BRIDGE_AUTH_TOKEN_PREVIEW || ''
const INTERNAL_TOKEN = process.env.BRIDGE_INTERNAL_TOKEN || ''
const DASHBOARD_PIN = String(process.env.BRIDGE_DASHBOARD_PIN || '').trim()
const VALID_TOKENS = new Set([AUTH_TOKEN, AUTH_TOKEN_PREVIEW, INTERNAL_TOKEN].filter(Boolean))
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()
const TASK_SEED_PATH = path.join(WORKSPACE_ROOT, 'coordination', 'llm-bus', 'agent-bridge-tasks.json')
const TASK_PERSIST_PATH = path.join(__dirname, 'data', 'tasks.json')
const LOCAL_ACTIVITY_PERSIST_PATH = path.join(__dirname, 'data', 'local-activity.json')
const HARD_GATES_ENABLED = process.env.AGENT_BRIDGE_HARD_GATES === '1'
const MAX_BUFFER_LINES = 500
const CONSENSUS_APPROVAL_QUORUM = 2
const DISPATCH_DATA_ROOT = path.join(__dirname, 'data')
const LOCAL_ACTIVITY_TTL_MS = 30 * 60 * 1000
const LOCAL_ACTIVITY_WRITE_DEBOUNCE_MS = 5000
const DASHBOARD_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const DASHBOARD_COOKIE_NAME = 'dashboard_token'
const VM_PROJECT_PATH = process.env.VM_PROJECT_PATH || path.join(process.env.HOME || '/home/chenkuichen', 'portfolio-dashboard')
const VM_LLM_CLI = process.env.VM_LLM_CLI || 'qwen'
const VM_LLM_MODEL = String(process.env.VM_LLM_MODEL || '').trim()
const VM_WAKE_LOG_DIR = process.env.VM_WAKE_LOG_DIR || '/tmp'
const WAKE_LOG_TAIL_BYTES = 5000
const DEFAULT_WAKE_CONTINUE_PROMPT = process.env.VM_WAKE_CONTINUE_PROMPT
  || '讀 docs/portfolio-spec-report/todo.md，找下一條 L0/L1 未完 TODO。先做診斷或最小安全修補，執行必要 verify，最後回報結果與下一步。不要 commit、不要 push、不要啟動長時間背景 daemon。'
const DASHBOARD_PROGRESS_CANDIDATE_PATHS = [
  path.join(WORKSPACE_ROOT, 'docs', 'portfolio-spec-report', 'progress.json'),
  '/var/www/app/current/dist/portfolio-report/progress.json',
  '/var/www/portfolio-report/progress.json',
]
const DASHBOARD_SNAPSHOT_COMMIT_DAYS = 7
const DASHBOARD_SNAPSHOT_RECENT_COMMITS_LIMIT = 5
const DASHBOARD_POSTER_AGENT_ORDER = ['codex', 'claude', 'qwen', 'gemini']

// ─── Agent Detection ──────────────────────────────────────────────
const AGENT_PROFILES = [
  { id: 'claude', name: 'Claude Code', icon: '🟠', color: '#E87B35', patterns: [/claude/i, /anthropic/i] },
  { id: 'codex', name: 'Codex CLI', icon: '🟢', color: '#10A37F', patterns: [/codex/i, /openai/i] },
  { id: 'qwen', name: 'Qwen', icon: '🔵', color: '#615EFF', patterns: [/qwen/i, /tongyi/i] },
  { id: 'gemini', name: 'Gemini', icon: '🔴', color: '#EA4335', patterns: [/gemini/i, /google/i] },
  { id: 'copilot', name: 'Copilot', icon: '⚪', color: '#6E40C9', patterns: [/copilot/i, /github/i] },
]

function detectAgent(name) {
  for (const p of AGENT_PROFILES) {
    for (const re of p.patterns) if (re.test(name)) return p
  }
  return { id: 'unknown', name, icon: '⬜', color: '#888888', patterns: [] }
}

// ─── State ────────────────────────────────────────────────────────
const sessions = new Map()   // id -> AgentSession
const tasks = new Map()      // id -> BridgeTask
const processes = new Map()  // sessionId -> ChildProcess
const wsClients = new Set()
const localActivity = new Map() // agent name -> {agent, status, message, timestamp, host}
const dashboardTokens = new Map() // token -> {issuedAt, expiresAt}
let localActivityPersistTimer = null
let localActivityPersistPromise = null
let localActivityPersistDisabled = false
let isShuttingDown = false

// ─── Logging ──────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function pruneLocalActivity(now = Date.now()) {
  for (const [agent, entry] of localActivity.entries()) {
    if (!entry?.timestamp || now - entry.timestamp >= LOCAL_ACTIVITY_TTL_MS) {
      localActivity.delete(agent)
    }
  }
}

function serializeLocalActivity() {
  pruneLocalActivity()
  return Array.from(localActivity.values())
    .sort((a, b) => b.timestamp - a.timestamp)
}

async function persistLocalActivity() {
  if (localActivityPersistDisabled) return
  pruneLocalActivity()
  const dir = path.dirname(LOCAL_ACTIVITY_PERSIST_PATH)
  const payload = JSON.stringify(serializeLocalActivity(), null, 2)
  try {
    await fsPromises.mkdir(dir, { recursive: true })
    await fsPromises.writeFile(LOCAL_ACTIVITY_PERSIST_PATH, payload, 'utf-8')
  } catch (error) {
    if (error?.code === 'ENOSPC') {
      localActivityPersistDisabled = true
      log(`ERROR localActivity persist disabled after ENOSPC: ${error.message}`)
      console.error(`[Agent Bridge] localActivity persist disabled after ENOSPC: ${error.message}`)
      return
    }
    log(`WARN localActivity persist failed: ${error.message}`)
  }
}

function scheduleLocalActivityPersist() {
  if (localActivityPersistDisabled) return
  if (localActivityPersistTimer) clearTimeout(localActivityPersistTimer)
  localActivityPersistTimer = setTimeout(() => {
    localActivityPersistTimer = null
    localActivityPersistPromise = persistLocalActivity()
      .finally(() => { localActivityPersistPromise = null })
  }, LOCAL_ACTIVITY_WRITE_DEBOUNCE_MS)
}

async function flushLocalActivityPersist() {
  if (localActivityPersistDisabled) return
  if (localActivityPersistTimer) {
    clearTimeout(localActivityPersistTimer)
    localActivityPersistTimer = null
    localActivityPersistPromise = persistLocalActivity()
      .finally(() => { localActivityPersistPromise = null })
  }
  if (localActivityPersistPromise) await localActivityPersistPromise
}

async function backupCorruptedLocalActivityFile() {
  const backupPath = `${LOCAL_ACTIVITY_PERSIST_PATH}.corrupted-${Date.now()}`
  await fsPromises.rename(LOCAL_ACTIVITY_PERSIST_PATH, backupPath)
  log(`ERROR localActivity corrupted file backed up to ${backupPath}`)
  return backupPath
}

async function loadLocalActivity() {
  try {
    const raw = await fsPromises.readFile(LOCAL_ACTIVITY_PERSIST_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw Object.assign(new Error('expected array'), { code: 'EBADJSON' })
    }
    const now = Date.now()
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object' || !entry.agent) continue
      const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : now
      if (now - timestamp >= LOCAL_ACTIVITY_TTL_MS) continue
      localActivity.set(entry.agent, {
        agent: entry.agent,
        status: entry.status || 'unknown',
        message: entry.message || '',
        timestamp,
        host: entry.host || 'unknown',
      })
    }
    log(`Local activity restored: ${localActivity.size}`)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      log('Local activity restore: no persisted file, starting empty')
      return
    }
    if (error instanceof SyntaxError || error?.code === 'EBADJSON') {
      localActivity.clear()
      try {
        await backupCorruptedLocalActivityFile()
      } catch (backupError) {
        log(`WARN localActivity corrupted backup failed: ${backupError.message}`)
      }
      log('Local activity restore: starting with empty map after corrupted file')
      return
    }
    log(`WARN localActivity restore failed: ${error.message}`)
  }
}

function registerShutdownFlush(signal) {
  process.once(signal, () => {
    if (isShuttingDown) return
    isShuttingDown = true
    flushLocalActivityPersist()
      .catch((error) => log(`WARN localActivity flush failed on ${signal}: ${error.message}`))
      .finally(() => process.exit(0))
  })
}

// ─── ANSI strip ───────────────────────────────────────────────────
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
}

// ─── Auth check ───────────────────────────────────────────────────
const PUBLIC_HTTP_ROUTES = new Set([
  '/',
  '/index.html',
  '/dashboard',
  '/dashboard/',
  '/dashboard/index.html',
  '/login.html',
  '/dashboard/login.html',
  '/dashboard/login',
  '/api/health',
])
const DASHBOARD_HTTP_ROUTES = [
  /^\/api\/dashboard-snapshot$/,
  /^\/api\/pending-decisions$/,
  /^\/api\/pending-decisions\/[^/]+\/answer$/,
  /^\/api\/project$/,
  /^\/api\/status$/,
  /^\/api\/sessions$/,
  /^\/api\/tasks$/,
  /^\/api\/workers\/dispatch$/,
  /^\/api\/workers\/dispatch\/[^/]+$/,
  /^\/api\/send$/,
  /^\/api\/terminal\/create$/,
  /^\/api\/tasks\/sync$/,
  /^\/api\/tasks\/[^/]+$/,
  /^\/api\/tasks\/[^/]+\/dispatch$/,
  /^\/api\/tasks\/[^/]+\/complete$/,
  /^\/api\/tasks\/[^/]+\/consensus$/,
  /^\/wake$/,
  /^\/wake\/log\/[^/]+$/,
]
const PROTECTED_HTTP_ROUTES = [
  /^\/internal\/analyst-reports$/,
  /^\/internal\/analyst-reports\/[^/]+$/,
  /^\/api\/dashboard-snapshot$/,
  /^\/api\/pending-decisions$/,
  /^\/api\/pending-decisions\/[^/]+\/answer$/,
  /^\/api\/project$/,
  /^\/api\/sessions$/,
  /^\/api\/send$/,
  /^\/api\/terminal\/create$/,
  /^\/api\/tasks$/,
  /^\/api\/tasks\/sync$/,
  /^\/api\/local-status$/,
  /^\/api\/tasks\/[^/]+$/,
  /^\/api\/tasks\/[^/]+\/dispatch$/,
  /^\/api\/tasks\/[^/]+\/complete$/,
  /^\/api\/tasks\/[^/]+\/consensus$/,
  /^\/api\/workers\/dispatch$/,
  /^\/api\/workers\/dispatch\/[^/]+$/,
  /^\/wake$/,
  /^\/wake\/log\/[^/]+$/,
]
const PROTECTED_WS_MESSAGE_TYPES = new Set([
  'send',
  'session:history',
  'terminal:create',
  'task:list',
  'task:create',
  'task:update',
  'task:dispatch',
  'task:complete',
  'task:consensus',
  'task:sync',
  'worker:dispatch',
])
const PRIVATE_WS_OUTBOUND_TYPES = new Set([
  'snapshot',
  'session:open',
  'session:update',
  'session:close',
  'session:history',
  'terminal:data',
  'tasks:snapshot',
  'task:created',
  'task:updated',
  'task:completed',
  'task:dispatched',
  'task:consensus',
  'worker:dispatches',
  'worker:dispatched',
  'worker:completed',
  'worker:log',
])

function getBearerToken(value) {
  return typeof value === 'string'
    ? value.replace(/^Bearer\s+/i, '')
    : ''
}

function identifyTokenKind(token) {
  if (!VALID_TOKENS.size) return 'disabled'
  if (token && AUTH_TOKEN && token === AUTH_TOKEN) return 'prod'
  if (token && AUTH_TOKEN_PREVIEW && token === AUTH_TOKEN_PREVIEW) return 'preview'
  if (token && INTERNAL_TOKEN && token === INTERNAL_TOKEN) return 'internal'
  return null
}

function pruneDashboardTokens(now = Date.now()) {
  for (const [token, entry] of dashboardTokens.entries()) {
    if (!entry?.expiresAt || entry.expiresAt <= now) dashboardTokens.delete(token)
  }
}

function issueDashboardToken() {
  pruneDashboardTokens()
  const issuedAt = Date.now()
  const expiresAt = issuedAt + DASHBOARD_TOKEN_TTL_MS
  const token = crypto.randomBytes(32).toString('hex')
  dashboardTokens.set(token, { issuedAt, expiresAt })
  return { token, issuedAt, expiresAt }
}

function identifyDashboardToken(token) {
  if (!DASHBOARD_PIN || !token) return null
  pruneDashboardTokens()
  return dashboardTokens.has(token) ? 'dashboard' : null
}

function extractDashboardTokenFromUrl(urlValue) {
  try {
    const url = new URL(urlValue ?? '/', 'http://127.0.0.1')
    return String(url.searchParams.get('dashboard_token') || url.searchParams.get('dashboardToken') || '').trim()
  } catch {
    return ''
  }
}

function getCookieValue(cookieHeader, name) {
  const source = String(cookieHeader || '')
  if (!source) return ''
  const parts = source.split(';')
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey !== name) continue
    return decodeURIComponent(rest.join('=').trim())
  }
  return ''
}

function hasDashboardAuth(req) {
  return identifyDashboardToken(getBearerToken(req.headers.authorization || ''))
    || identifyDashboardToken(getCookieValue(req.headers.cookie, DASHBOARD_COOKIE_NAME))
    || identifyDashboardToken(extractDashboardTokenFromUrl(req.url))
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  if (forwardedProto) return forwardedProto === 'https'
  return Boolean(req.socket?.encrypted)
}

function buildDashboardCookie(token, req) {
  const parts = [
    `${DASHBOARD_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.floor(DASHBOARD_TOKEN_TTL_MS / 1000)}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (isSecureRequest(req)) parts.push('Secure')
  return parts.join('; ')
}

function hasValidAuth(req) {
  return identifyTokenKind(getBearerToken(req.headers.authorization || ''))
}

function isProtectedHttpRoute(pathname, method) {
  if (method === 'OPTIONS') return false
  if ((method === 'GET' || method === 'HEAD') && PUBLIC_HTTP_ROUTES.has(pathname)) return false
  return PROTECTED_HTTP_ROUTES.some((re) => re.test(pathname))
}

function isDashboardProtectedHttpRoute(pathname, method) {
  if (!DASHBOARD_PIN || method === 'OPTIONS') return false
  return DASHBOARD_HTTP_ROUTES.some((re) => re.test(pathname))
}

function hasWsAuth(req, msg) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const dashboardQueryToken = String(url.searchParams.get('dashboard_token') || url.searchParams.get('dashboardToken') || '').trim()
  const queryToken = url.searchParams.get('token') || ''
  const headerToken = getBearerToken(req.headers.authorization || '')
  const messageToken = typeof msg?.authToken === 'string' ? msg.authToken : ''
  const dashboardMessageToken = typeof msg?.dashboardToken === 'string' ? msg.dashboardToken : ''
  const dashboardTokenKind = identifyDashboardToken(dashboardQueryToken)
    || identifyDashboardToken(headerToken)
    || identifyDashboardToken(dashboardMessageToken)
  const bridgeTokenKind = identifyTokenKind(queryToken)
    || identifyTokenKind(headerToken)
    || identifyTokenKind(messageToken)
  if (dashboardTokenKind) return dashboardTokenKind
  if (DASHBOARD_PIN) return bridgeTokenKind && bridgeTokenKind !== 'disabled' ? bridgeTokenKind : null
  return bridgeTokenKind
}

function logAuthUsage(transport, target, tokenKind) {
  if (!tokenKind || tokenKind === 'disabled') return
  log(`Auth accepted (${transport}:${tokenKind}) ${target}`)
}

function execCommand(command, { cwd = WORKSPACE_ROOT, timeoutMs = 5000 } = {}) {
  // 5s timeout 防 git command hang（Qwen reg-5 找的 P1 risk）
  return new Promise((resolve) => {
    const child = exec(command, { cwd, timeout: timeoutMs, killSignal: 'SIGKILL' }, (error, stdout, stderr) => {
      if (error) {
        const isTimeout = error.killed && error.signal === 'SIGKILL'
        resolve({
          ok: false,
          stdout: stdout || '',
          stderr: stderr || error.message,
          timedOut: isTimeout,
        })
        return
      }
      resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' })
    })
    // 雙重保險：節點原生 timeout 失效時也能 SIGKILL
    const watchdog = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
    }, timeoutMs + 500)
    child.on('exit', () => clearTimeout(watchdog))
  })
}

function parseTaskSummaryFromRecords(records) {
  const summary = { total: 0, active: 0, done: 0 }
  for (const record of records) {
    if (!record || typeof record !== 'object') continue
    summary.total += 1
    const status = String(record.status || '').trim().toLowerCase()
    if (status === 'completed' || status === 'done') summary.done += 1
    else summary.active += 1
  }
  return summary
}

async function readTaskSummary() {
  try {
    const raw = await fsPromises.readFile(TASK_PERSIST_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    const records = parsed && typeof parsed === 'object' ? Object.values(parsed) : []
    return parseTaskSummaryFromRecords(records)
  } catch {
    return parseTaskSummaryFromRecords(Array.from(tasks.values()))
  }
}

function computeAgentBreakdown(entries) {
  const breakdown = { codex: 0, qwen: 0, gemini: 0 }
  for (const entry of entries) {
    const agentId = detectAgent(entry?.agent || '').id
    if (agentId in breakdown) breakdown[agentId] += 1
  }
  return breakdown
}

async function readTodayCommits() {
  // git --since='today' 在某些 git 版本不可靠，用 24 小時內代替
  const result = await execCommand("git log --since='24 hours ago' --oneline")
  if (!result.ok) return 0
  return result.stdout.split('\n').filter(Boolean).length
}

async function readRecentCommits(limit = 10) {
  // 拉近 24 小時 commit list（最新優先），給 Bridge 故事化 timeline 用
  // 包含 file count + +/- 行數
  const result = await execCommand(
    `git log --since='24 hours ago' --shortstat --pretty=format:'COMMIT|%h|%cI|%s' -n ${limit}`
  )
  if (!result.ok) return []

  // 解析 git log --shortstat 輸出（每 commit 兩行：第 1 行 metadata，第 2 行 stat）
  const lines = result.stdout.split('\n').filter((l) => l.trim() || l === '')
  const commits = []
  let current = null
  for (const line of lines) {
    if (line.startsWith('COMMIT|')) {
      if (current) commits.push(current)
      const [, hash, time, ...msgParts] = line.split('|')
      current = {
        hash,
        time,
        message: msgParts.join('|'),
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      }
    } else if (current && line.includes('changed')) {
      // " 3 files changed, 45 insertions(+), 12 deletions(-)"
      const filesMatch = line.match(/(\d+) files? changed/)
      const insMatch = line.match(/(\d+) insertions?/)
      const delMatch = line.match(/(\d+) deletions?/)
      if (filesMatch) current.filesChanged = Number(filesMatch[1])
      if (insMatch) current.insertions = Number(insMatch[1])
      if (delMatch) current.deletions = Number(delMatch[1])
    }
  }
  if (current) commits.push(current)
  return commits
}

async function readPendingPush() {
  const dirtyResult = await execCommand('git status --porcelain')
  const dirtyCount = dirtyResult.ok ? dirtyResult.stdout.split('\n').filter(Boolean).length : 0
  const upstreamResult = await execCommand('git rev-parse --abbrev-ref --symbolic-full-name @{upstream}')
  if (!upstreamResult.ok) return dirtyCount
  const upstream = upstreamResult.stdout.trim()
  if (!upstream) return dirtyCount
  const unpushedResult = await execCommand(`git rev-list --count ${upstream}..HEAD`)
  const unpushedCount = unpushedResult.ok ? Number(unpushedResult.stdout.trim()) || 0 : 0
  return dirtyCount + unpushedCount
}

function resolveGitCwd() {
  const candidates = [WORKSPACE_ROOT, VM_PROJECT_PATH]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      if (fs.existsSync(path.join(candidate, '.git'))) return candidate
    } catch {}
  }
  return WORKSPACE_ROOT
}

function formatLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDashboardBarLabel(dateKey) {
  if (!dateKey) return '—'
  const [, month = '00', day = '00'] = String(dateKey).split('-')
  return `${Number(month)}/${Number(day)}`
}

function truncateText(value, max = 48) {
  const text = String(value || '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function normalizeDashboardTaskStatus(status) {
  const value = String(status || '').trim().toLowerCase().replaceAll('_', '-').replace(/\s+/g, '-')
  if (value === 'completed' || value === 'done') return 'completed'
  if (value === 'in-progress' || value === 'active' || value === 'working') return 'in-progress'
  if (value === 'blocked') return 'blocked'
  if (value === 'waiting-decision' || value === 'waiting-review' || value === 'waiting-approval') return 'waiting-decision'
  if (value === 'queued' || value === 'todo' || value === 'pending') return 'pending'
  return 'pending'
}

function normalizeDashboardTaskRecord(raw) {
  const task = raw && typeof raw === 'object' ? raw : {}
  return {
    id: String(task.id || '').trim(),
    owner: String(task.owner || task.preferredAgentId || 'unknown').trim() || 'unknown',
    title: String(task.title || 'Untitled').trim() || 'Untitled',
    summary: String(task.summary || '').trim(),
    lane: String(task.lane || 'general').trim() || 'general',
    priority: String(task.priority || 'medium').trim().toLowerCase(),
    status: normalizeDashboardTaskStatus(task.status),
    requiresConsensus: Boolean(task.requiresConsensus),
    consensusState: String(task.consensusState || 'none').trim().toLowerCase() || 'none',
    recommendedSessionId: task.recommendedSessionId || task.assignedSessionId || null,
    recommendedSessionName: task.recommendedSessionName || null,
    assignedSessionId: task.assignedSessionId || null,
    completedAt: typeof task.completedAt === 'number' ? task.completedAt : null,
    createdAt: typeof task.createdAt === 'number' ? task.createdAt : null,
    updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : null,
  }
}

async function readDashboardTaskRecords() {
  try {
    const raw = await fsPromises.readFile(TASK_PERSIST_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    const source = parsed && typeof parsed === 'object' ? Object.values(parsed) : []
    if (Array.isArray(source) && source.length) {
      return source.map(normalizeDashboardTaskRecord)
    }
  } catch {}
  return Array.from(tasks.values()).map(serializeTaskPublic).map(normalizeDashboardTaskRecord)
}

async function readDashboardProgressSummary() {
  for (const candidate of DASHBOARD_PROGRESS_CANDIDATE_PATHS) {
    try {
      const raw = await fsPromises.readFile(candidate, 'utf-8')
      const parsed = JSON.parse(raw)
      const shipBefore = parsed?.byStatus?.shipBefore || {}
      const items = Array.isArray(parsed?.items) ? parsed.items : []
      const doneThisWeek = items.filter((item) => {
        if (!item?.done || !item?.completedAt) return false
        const completedAt = Date.parse(item.completedAt)
        return Number.isFinite(completedAt) && (Date.now() - completedAt) < (7 * 24 * 60 * 60 * 1000)
      }).length
      return {
        ok: true,
        sourcePath: candidate,
        track: 'shipBefore',
        label: String(shipBefore.label || 'Ship-Before'),
        done: Number(shipBefore.done) || 0,
        total: Number(shipBefore.total) || 0,
        completionPct: Number(parsed?.completionPct) || 0,
        etaDays: Number(parsed?.etaDaysToShipBefore) || null,
        lastUpdatedAt: parsed?.lastUpdatedAt || null,
        doneThisWeek,
      }
    } catch {}
  }
  return {
    ok: false,
    sourcePath: null,
    track: 'shipBefore',
    label: 'Ship-Before',
    done: 0,
    total: 0,
    completionPct: 0,
    etaDays: null,
    lastUpdatedAt: null,
    doneThisWeek: 0,
  }
}

async function readCommitChart(days = DASHBOARD_SNAPSHOT_COMMIT_DAYS) {
  const gitCwd = resolveGitCwd()
  const buckets = new Map()
  const today = new Date()
  const todayKey = formatLocalDateKey(today)
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    buckets.set(formatLocalDateKey(date), 0)
  }

  const result = await execCommand(
    `git log --date=short --pretty=format:'%cd' --since='${days - 1} days ago'`,
    { cwd: gitCwd, timeoutMs: 5000 },
  )
  if (result.ok) {
    for (const line of result.stdout.split('\n')) {
      const key = String(line || '').trim()
      if (!buckets.has(key)) continue
      buckets.set(key, (buckets.get(key) || 0) + 1)
    }
  }

  const entries = Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    label: formatDashboardBarLabel(date),
    count,
    isToday: date === todayKey,
  }))
  const peak = entries.reduce((max, entry) => Math.max(max, entry.count), 0)
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  return {
    entries,
    peak,
    total,
    average: entries.length ? total / entries.length : 0,
    todayCount: entries.find((entry) => entry.isToday)?.count || 0,
  }
}

async function readRecentCommitsForDashboard(limit = DASHBOARD_SNAPSHOT_RECENT_COMMITS_LIMIT) {
  const gitCwd = resolveGitCwd()
  const result = await execCommand(
    `git log --shortstat --pretty=format:'COMMIT|%h|%cI|%an|%s' -n ${limit}`,
    { cwd: gitCwd, timeoutMs: 5000 },
  )
  if (!result.ok) return []

  const commits = []
  let current = null
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('COMMIT|')) {
      if (current) commits.push(current)
      const [, hash, time, author, ...messageParts] = line.split('|')
      current = {
        hash,
        time,
        author,
        message: messageParts.join('|'),
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      }
      continue
    }
    if (!current || !line.includes('changed')) continue
    const filesMatch = line.match(/(\d+) files? changed/)
    const insertionsMatch = line.match(/(\d+) insertions?/)
    const deletionsMatch = line.match(/(\d+) deletions?/)
    if (filesMatch) current.filesChanged = Number(filesMatch[1])
    if (insertionsMatch) current.insertions = Number(insertionsMatch[1])
    if (deletionsMatch) current.deletions = Number(deletionsMatch[1])
  }
  if (current) commits.push(current)
  return commits
}

function dashboardTaskPriorityRank(priority) {
  if (priority === 'critical') return 4
  if (priority === 'high') return 3
  if (priority === 'medium') return 2
  if (priority === 'low') return 1
  return 0
}

function dashboardTaskStatusRank(status) {
  if (status === 'in-progress') return 4
  if (status === 'waiting-decision') return 3
  if (status === 'blocked') return 2
  if (status === 'pending') return 1
  if (status === 'completed') return 0
  return -1
}

function pickActiveDashboardTask(taskRecords, sessionRecords = []) {
  const recommendedByOwner = new Map()
  for (const session of sessionRecords) {
    if (!session?.isActive || !session?.agent?.id || recommendedByOwner.has(session.agent.id)) continue
    recommendedByOwner.set(session.agent.id, session)
  }

  const ranked = taskRecords
    .map((task) => {
      const recommendedSession = recommendedByOwner.get(task.owner) || null
      return {
        ...task,
        recommendedSessionId: task.recommendedSessionId || recommendedSession?.id || null,
        recommendedSessionName: task.recommendedSessionName || recommendedSession?.terminalName || null,
      }
    })
    .sort((a, b) => {
      const statusDelta = dashboardTaskStatusRank(b.status) - dashboardTaskStatusRank(a.status)
      if (statusDelta) return statusDelta
      const priorityDelta = dashboardTaskPriorityRank(b.priority) - dashboardTaskPriorityRank(a.priority)
      if (priorityDelta) return priorityDelta
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    })

  const activeTask = ranked.find((task) => dashboardTaskStatusRank(task.status) >= 2)
    || ranked.find((task) => task.status === 'pending')
    || ranked[0]
    || null
  if (!activeTask) return null

  const siblingActiveCount = taskRecords.filter((task) => task.id !== activeTask.id && task.status === 'in-progress').length
  return {
    ...activeTask,
    detail: activeTask.summary
      || `${String(activeTask.owner || 'agent').toUpperCase()} 正在推進這條 task。${siblingActiveCount ? `另外還有 ${siblingActiveCount} 條 active task。` : ''}`.trim(),
    siblingActiveCount,
  }
}

function buildDashboardAgents({ localEntries, sessionRecords, taskRecords }) {
  const rows = []
  const taskByOwner = new Map()
  for (const task of taskRecords) {
    const current = taskByOwner.get(task.owner)
    if (!current) {
      taskByOwner.set(task.owner, task)
      continue
    }
    const statusDelta = dashboardTaskStatusRank(task.status) - dashboardTaskStatusRank(current.status)
    if (statusDelta > 0 || (statusDelta === 0 && dashboardTaskPriorityRank(task.priority) > dashboardTaskPriorityRank(current.priority))) {
      taskByOwner.set(task.owner, task)
    }
  }

  for (const entry of localEntries) {
    const profile = detectAgent(entry.agent)
    rows.push({
      id: `local:${entry.agent}`,
      agentKey: profile.id,
      label: entry.agent,
      host: String(entry.host || 'mac').toUpperCase(),
      status: entry.status || 'unknown',
      statusTone: entry.status === 'done'
        ? 'up'
        : entry.status === 'failed'
          ? 'down'
          : entry.status === 'blocked'
            ? 'amber'
            : 'active',
      message: entry.message || 'waiting update',
      timestamp: entry.timestamp || 0,
      sessionId: null,
    })
  }

  for (const session of sessionRecords) {
    const relatedTask = taskByOwner.get(session?.agent?.id)
    rows.push({
      id: `session:${session.id}`,
      agentKey: session?.agent?.id || 'unknown',
      label: `${session.agent?.name || 'Agent'} · ${session.terminalName || session.id}`,
      host: 'VM',
      status: session.isActive ? 'active' : 'idle',
      statusTone: session.isActive ? 'active' : 'muted',
      message: relatedTask?.title || session.lastLines?.slice(-1)?.[0] || 'running',
      timestamp: session.lastActivity || 0,
      sessionId: session.id,
    })
  }

  for (const profile of AGENT_PROFILES) {
    if (profile.id === 'unknown' || profile.id === 'copilot') continue
    if (rows.some((row) => row.agentKey === profile.id)) continue
    const task = taskByOwner.get(profile.id)
    rows.push({
      id: `task:${profile.id}`,
      agentKey: profile.id,
      label: profile.name,
      host: task ? String(task.lane || 'task').toUpperCase() : 'QUEUE',
      status: task?.status || 'idle',
      statusTone: task?.status === 'completed'
        ? 'up'
        : task?.status === 'blocked'
          ? 'down'
          : task?.status === 'waiting-decision'
            ? 'amber'
            : task
              ? 'active'
              : 'muted',
      message: task?.title || 'No active lane',
      timestamp: task?.updatedAt || 0,
      sessionId: task?.recommendedSessionId || null,
    })
  }

  const deduped = new Map()
  for (const row of rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))) {
    const dedupeKey = row.agentKey && row.agentKey !== 'unknown' ? row.agentKey : row.label
    if (deduped.has(dedupeKey)) continue
    deduped.set(dedupeKey, row)
  }
  return Array.from(deduped.values()).slice(0, 8)
}

function dashboardWeekdayLetter(dateKey) {
  if (!dateKey) return '—'
  const parsed = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parsed.getDay()] || '—'
}

function formatPosterTaskId(taskId) {
  const raw = String(taskId || '').trim()
  if (!raw) return 'QUIET MODE'
  return raw.replace(/-/g, ' ').toUpperCase()
}

function formatPosterDuration(fromTs, now = Date.now()) {
  const diff = Math.max(0, now - (Number(fromTs) || now))
  const totalMinutes = Math.floor(diff / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (totalMinutes > 0) return `${totalMinutes}m`
  return `${Math.floor(diff / 1000)}s`
}

function buildPosterAgentRows({ localEntries, sessionRecords, taskRecords }) {
  const localByAgent = new Map()
  for (const entry of localEntries) {
    const agentId = detectAgent(entry?.agent || '').id
    if (!agentId || agentId === 'unknown' || localByAgent.has(agentId)) continue
    localByAgent.set(agentId, entry)
  }

  const sessionByAgent = new Map()
  for (const session of sessionRecords
    .filter((record) => record?.agent?.id)
    .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))) {
    if (sessionByAgent.has(session.agent.id)) continue
    sessionByAgent.set(session.agent.id, session)
  }

  const activeTaskByOwner = new Map()
  for (const task of taskRecords
    .filter((record) => record.status === 'in-progress' || record.status === 'blocked')
    .sort((a, b) => (
      dashboardTaskStatusRank(b.status) - dashboardTaskStatusRank(a.status)
      || dashboardTaskPriorityRank(b.priority) - dashboardTaskPriorityRank(a.priority)
      || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    ))) {
    if (activeTaskByOwner.has(task.owner)) continue
    activeTaskByOwner.set(task.owner, task)
  }

  return DASHBOARD_POSTER_AGENT_ORDER.map((agentId) => {
    const profile = AGENT_PROFILES.find((entry) => entry.id === agentId) || {
      id: agentId,
      name: agentId.toUpperCase(),
      color: '#A1A1AA',
    }
    const session = sessionByAgent.get(agentId) || null
    const local = localByAgent.get(agentId) || null
    const task = activeTaskByOwner.get(agentId) || null

    let status = 'offline'
    if (session?.isActive) status = 'running'
    else if (local) {
      const raw = String(local.status || '').toLowerCase()
      status = /(run|work|busy|active)/.test(raw) ? 'running' : 'idle'
    } else if (task) {
      status = 'idle'
    }

    const note = session?.lastLines?.slice(-1)?.[0]
      || local?.message
      || task?.title
      || 'No active lane'
    const metaParts = []
    if (task?.status === 'blocked') metaParts.push('blocked')
    else if (task?.status === 'in-progress') metaParts.push('in progress')
    if (session?.terminalName) metaParts.push(session.terminalName)
    if (!metaParts.length && local?.host) metaParts.push(String(local.host).toUpperCase())

    return {
      id: agentId,
      label: agentId.toUpperCase(),
      name: profile.name,
      color: profile.color,
      status,
      sessionId: session?.id || null,
      timestamp: session?.lastActivity || local?.timestamp || task?.updatedAt || 0,
      meta: metaParts.join(' · ') || 'waiting',
      note: truncateText(note, 48),
    }
  })
}

function buildPosterNarrative({ focusTask, focusAgent, inProgressCount, waitingCount, recentCommits, shipPct, pendingPush }) {
  const lane = focusTask?.title ? truncateText(focusTask.title, 46) : 'No focus task selected yet'
  const lead = focusAgent
    ? `${focusAgent.label} ${focusAgent.status}`
    : 'No live agent'
  const latestCommit = recentCommits[0]?.message ? truncateText(recentCommits[0].message, 42) : 'No recent commit'
  return `${lane}. ${lead}. ${inProgressCount} running lanes, ${waitingCount} waiting, latest commit: ${latestCommit}, ship-before ${shipPct.toFixed(1)}%, pending push ${pendingPush}.`
}

async function buildDashboardSnapshot() {
  const [progress, commitChart, recentCommits, taskRecords, pendingPush] = await Promise.all([
    readDashboardProgressSummary(),
    readCommitChart(),
    readRecentCommitsForDashboard(),
    readDashboardTaskRecords(),
    readPendingPush(),
  ])
  const localEntries = serializeLocalActivity()
  const sessionRecords = Array.from(sessions.values()).map(serializeSession)
  const activeTask = pickActiveDashboardTask(taskRecords, sessionRecords)
  const waitingCount = taskRecords.filter((task) => {
    if (task.status === 'waiting-decision' || task.status === 'blocked') return true
    return task.requiresConsensus && task.consensusState !== 'approved'
  }).length
  const inProgressCount = taskRecords.filter((task) => task.status === 'in-progress').length
  const completedThisWeek = progress.doneThisWeek || taskRecords.filter((task) => {
    if (!task.completedAt) return false
    return (Date.now() - task.completedAt) < (7 * 24 * 60 * 60 * 1000)
  }).length
  const posterAgents = buildPosterAgentRows({ localEntries, sessionRecords, taskRecords })
  const focusAgent = posterAgents.find((agent) => agent.id === activeTask?.owner)
    || posterAgents.find((agent) => agent.status === 'running')
    || null
  const activeSessionId = focusAgent?.sessionId
    || activeTask?.recommendedSessionId
    || sessionRecords.find((session) => session.isActive)?.id
    || null
  const shipPct = Number(progress.completionPct) || 0
  const focusTimestamp = activeTask?.updatedAt
    || sessionRecords.find((session) => session.id === activeSessionId)?.lastActivity
    || Date.now()
  const liveAgents = buildDashboardAgents({ localEntries, sessionRecords, taskRecords })
  const parallelCount = inProgressCount
    || taskRecords.filter((task) => (
      task.owner === activeTask?.owner
      && task.status !== 'completed'
      && dashboardTaskPriorityRank(task.priority) >= 3
    )).length
    || waitingCount
    || 1

  return {
    generatedAt: new Date().toISOString(),
    topbar: {
      today: formatLocalDateKey(new Date()),
      syncLabel: activeTask ? '已連線' : '待命中',
    },
    activeTask: activeTask && {
      ...activeTask,
      ownerLabel: String(activeTask.owner || 'agent').toUpperCase(),
    },
    kpi: {
      waitingCount,
      todayCommits: commitChart.todayCount,
      weekDone: completedThisWeek,
      inProgressCount,
      totalTasks: taskRecords.length,
      pendingPush,
    },
    commitChart,
    progress: {
      label: progress.label,
      done: progress.done,
      total: progress.total,
      completionPct: shipPct,
      etaDays: progress.etaDays,
      lastUpdatedAt: progress.lastUpdatedAt,
      sourcePath: progress.sourcePath,
    },
    focus: {
      taskId: activeTask?.id || null,
      sessionId: activeSessionId,
      status: focusAgent?.status || 'idle',
      headline: formatPosterTaskId(activeTask?.id),
      subhead: activeTask?.title || '等待下一條指令',
      detail: activeTask?.detail || activeTask?.summary || 'Bridge is ready for the next task.',
      parallelCount,
      parallelLabel: `${parallelCount} 條並行`,
      statusLabel: `${(focusAgent?.label || activeTask?.owner || 'BRIDGE').toUpperCase()} ${focusAgent?.status || 'idle'}`,
      statusMeta: `${formatPosterDuration(focusTimestamp)} elapsed · ${completedThisWeek} done`,
    },
    today: {
      commits: commitChart.todayCount,
      done: completedThisWeek,
      errors: taskRecords.filter((task) => task.status === 'blocked').length,
      pct: Math.round(shipPct),
      pendingPush,
    },
    commitBars: commitChart.entries.map((entry) => ({
      date: entry.date,
      label: dashboardWeekdayLetter(entry.date),
      count: entry.count,
      isToday: entry.isToday,
    })),
    shipBefore: {
      label: progress.label,
      done: progress.done,
      total: progress.total,
      pct: shipPct / 100,
      pctLabel: `${shipPct.toFixed(1)}%`,
      etaDays: progress.etaDays,
      lastUpdatedAt: progress.lastUpdatedAt,
      sourcePath: progress.sourcePath,
    },
    posterAgents,
    agents: liveAgents,
    posterRecentCommits: recentCommits.map((commit) => ({
      hash: commit.hash,
      shortHash: String(commit.hash || '').slice(0, 4),
      message: truncateText(commit.message, 42),
      author: commit.author,
      time: commit.time,
      filesChanged: commit.filesChanged,
      insertions: commit.insertions,
      deletions: commit.deletions,
    })),
    recentCommits,
    sessions: sessionRecords
      .filter((session) => session.isActive)
      .map((session) => ({
        id: session.id,
        terminalName: session.terminalName,
        agentId: session.agent?.id || 'unknown',
        agentName: session.agent?.name || session.terminalName,
        lastActivity: session.lastActivity,
      })),
    composer: {
      sessionId: activeSessionId,
      targetLabel: focusAgent?.label || String(activeTask?.owner || 'BRIDGE').toUpperCase(),
      narrative: buildPosterNarrative({
        focusTask: activeTask,
        focusAgent,
        inProgressCount: parallelCount,
        waitingCount,
        recentCommits,
        shipPct,
        pendingPush,
      }),
      placeholder: activeSessionId
        ? `Send a note to ${(focusAgent?.label || activeTask?.owner || 'BRIDGE').toUpperCase()}`
        : 'No live agent session right now',
    },
  }
}

// ─── Session management (child_process based) ─────────────────────
function createSession(name, command, args = []) {
  const id = `proc_${name}_${Date.now()}`
  const agent = detectAgent(name)

  const session = {
    id,
    terminalName: name,
    agent,
    buffer: [],
    lastActivity: Date.now(),
    isActive: true,
  }
  sessions.set(id, session)

  // Spawn the process
  const proc = spawn(command, args, {
    cwd: WORKSPACE_ROOT,
    shell: true,
    env: { ...process.env, TERM: 'xterm-256color' },
  })
  processes.set(id, proc)

  const onData = (data) => {
    const cleaned = stripAnsi(data.toString())
    if (!cleaned.trim()) return
    const lines = cleaned.split('\n').filter(l => l.trim())
    for (const line of lines) {
      session.buffer.push(line)
      if (session.buffer.length > MAX_BUFFER_LINES) session.buffer.shift()
    }
    session.lastActivity = Date.now()

    // Re-detect agent from output
    if (session.agent.id === 'unknown') {
      for (const p of AGENT_PROFILES) {
        for (const re of p.patterns) {
          if (re.test(cleaned)) {
            session.agent = p
            broadcast({ type: 'session:update', session: serializeSession(session) })
            break
          }
        }
      }
    }

    broadcast({ type: 'terminal:data', sessionId: id, data: cleaned, timestamp: Date.now() })
  }

  proc.stdout?.on('data', onData)
  proc.stderr?.on('data', onData)

  proc.on('exit', (code) => {
    session.isActive = false
    processes.delete(id)
    broadcast({ type: 'session:close', sessionId: id })
    reconcileTaskAssignments()
    broadcastTasksSnapshot()
    log(`Process exited: ${name} (code ${code})`)
  })

  broadcast({ type: 'session:open', session: serializeSession(session) })
  broadcastTasksSnapshot()
  log(`Process started: ${name} → ${command} ${args.join(' ')}`)

  return session
}

function sendToSession(sessionId, text) {
  const proc = processes.get(sessionId)
  const session = sessions.get(sessionId)
  if (!proc || !session?.isActive) return false
  proc.stdin?.write(text + '\n')
  log(`Sent to ${session.agent.name}: ${text.substring(0, 80)}...`)
  return true
}

// ─── Task management (same logic, file-based persistence) ─────────
function persistTasks() {
  const dir = path.dirname(TASK_PERSIST_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const payload = Object.fromEntries(tasks.entries())
  fs.writeFileSync(TASK_PERSIST_PATH, JSON.stringify(payload, null, 2))
}

function readSeedTasks() {
  if (!fs.existsSync(TASK_SEED_PATH)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(TASK_SEED_PATH, 'utf-8'))
    return Array.isArray(parsed.tasks) ? parsed.tasks : []
  } catch (e) {
    log(`Failed to read seed: ${e.message}`)
    return []
  }
}

function norm(v) { return typeof v === 'string' ? v.trim() : '' }
function normArr(v) { return Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean) : [] }
function normTs(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null }

function parseStatus(v) {
  if (['pending','in_progress','blocked','completed'].includes(v)) return v
  if (v === 'in-progress') return 'in_progress'
  if (v === 'queued') return 'pending'
  if (v === 'done') return 'completed'
  return 'pending'
}
function parsePriority(v) {
  return ['low','medium','high','critical'].includes(v) ? v : 'medium'
}
function parseConsensusState(v) {
  return ['pending','approved','rejected'].includes(v) ? v : 'none'
}
function parseConsensusDecision(v) {
  return ['approved','rejected'].includes(v) ? v : null
}

function normEvidence(raw, cur) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    changedFiles: normArr(r.changedFiles ?? cur?.changedFiles),
    verificationRuns: normArr(r.verificationRuns ?? cur?.verificationRuns),
    risksNoted: normArr(r.risksNoted ?? cur?.risksNoted),
    nextStep: norm(r.nextStep ?? cur?.nextStep),
  }
}

function normReviews(raw, cur = []) {
  const src = Array.isArray(raw) ? raw : cur
  const map = new Map()
  for (const item of src) {
    if (!item || typeof item !== 'object') continue
    const agentId = norm(item.agentId)
    const decision = parseConsensusDecision(item.decision)
    if (!agentId || !decision) continue
    map.set(agentId, { agentId, decision, summary: norm(item.summary), updatedAt: normTs(item.updatedAt) ?? Date.now() })
  }
  return Array.from(map.values()).sort((a, b) => a.agentId.localeCompare(b.agentId))
}

function deriveConsensus(req, reviews) {
  if (!req) return 'none'
  if (reviews.some(r => r.decision === 'rejected')) return 'rejected'
  return reviews.filter(r => r.decision === 'approved').length >= CONSENSUS_APPROVAL_QUORUM ? 'approved' : 'pending'
}

function normalizeTask(raw, cur) {
  const now = Date.now()
  const id = norm(raw.id) || cur?.id || `task-${now}`
  const owner = norm(raw.owner) || norm(raw.preferredAgentId) || cur?.owner || 'unknown'
  const requiresConsensus = Boolean(raw.requiresConsensus ?? cur?.requiresConsensus)
  const reviews = normReviews(raw.consensusReviews, cur?.consensusReviews)
  return {
    id, owner, requiresConsensus, consensusReviews: reviews,
    title: norm(raw.title) || cur?.title || 'Untitled',
    lane: norm(raw.lane) || cur?.lane || 'general',
    status: parseStatus(raw.status ?? cur?.status),
    priority: parsePriority(raw.priority ?? cur?.priority),
    dependsOn: normArr(raw.dependsOn ?? cur?.dependsOn),
    writeScope: normArr(raw.writeScope ?? cur?.writeScope),
    sourcePlanRef: norm(raw.sourcePlanRef) || cur?.sourcePlanRef || '',
    summary: norm(raw.summary) || cur?.summary || '',
    dispatchPrompt: norm(raw.dispatchPrompt) || cur?.dispatchPrompt || norm(raw.summary) || cur?.summary || norm(raw.title) || cur?.title || '',
    assignedSessionId: norm(raw.assignedSessionId) || cur?.assignedSessionId || null,
    lastDispatchedAt: normTs(raw.lastDispatchedAt) ?? cur?.lastDispatchedAt ?? null,
    dispatchCount: typeof raw.dispatchCount === 'number' ? raw.dispatchCount : cur?.dispatchCount ?? 0,
    evidence: normEvidence(raw.evidence, cur?.evidence),
    completedAt: normTs(raw.completedAt) ?? cur?.completedAt ?? null,
    consensusState: deriveConsensus(requiresConsensus, reviews),
    createdAt: normTs(raw.createdAt) ?? cur?.createdAt ?? now,
    updatedAt: now,
  }
}

function loadTasks() {
  tasks.clear()
  // Load persisted
  if (fs.existsSync(TASK_PERSIST_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(TASK_PERSIST_PATH, 'utf-8'))
      for (const [id, raw] of Object.entries(data)) {
        tasks.set(id, normalizeTask({ id, ...raw }))
      }
    } catch (e) { log(`Load tasks error: ${e.message}`) }
  }
  // Merge seed
  for (const seed of readSeedTasks()) {
    const id = norm(seed.id)
    if (!id) continue
    tasks.set(id, normalizeTask({ ...seed, id }, tasks.get(id)))
  }
  persistTasks()
}

function hasEvidence(t) { return t.evidence.changedFiles.length > 0 && t.evidence.verificationRuns.length > 0 }

function requireCompletionEvidence(t) {
  const missing = []
  if (!t.evidence.changedFiles.length) missing.push('changedFiles')
  if (!t.evidence.verificationRuns.length) missing.push('verificationRuns')
  if (!t.evidence.risksNoted.length) missing.push('risksNoted')
  if (!t.evidence.nextStep.trim()) missing.push('nextStep')
  return missing.length ? { ok: false, error: 'hard-gate: missing completion evidence', missing } : { ok: true }
}

function requireConsensusApproved(t) {
  if (!t.requiresConsensus) return { ok: true }
  if (t.consensusState === 'approved') return { ok: true }
  return { ok: false, error: 'hard-gate: consensus not approved', reason: t.consensusState || 'none' }
}

function sanitize(raw) {
  const next = { ...raw }
  delete next.consensusState
  delete next.consensusReviews
  return next
}

function findRecommendedSession(task) {
  if (task.assignedSessionId) {
    const s = sessions.get(task.assignedSessionId)
    if (s?.isActive) return s
  }
  return Array.from(sessions.values())
    .filter(s => s.isActive && s.agent.id === task.owner)
    .sort((a, b) => b.lastActivity - a.lastActivity)[0] ?? null
}

function serializeTask(t) {
  const rec = findRecommendedSession(t)
  const ev = hasEvidence(t)
  const approvalCount = t.consensusReviews.filter(r => r.decision === 'approved').length
  const vState = t.status !== 'completed' ? 'open'
    : !ev ? 'draft'
    : t.consensusState === 'rejected' ? 'rejected'
    : t.requiresConsensus && t.consensusState !== 'approved' ? 'pending_consensus'
    : 'verified'
  return {
    ...t,
    recommendedSessionId: rec?.id ?? null,
    recommendedSessionName: rec?.terminalName ?? null,
    consensusApprovalCount: approvalCount,
    consensusRequiredCount: t.requiresConsensus ? CONSENSUS_APPROVAL_QUORUM : 0,
    verificationState: vState,
  }
}

// 公開 dashboard 用的 sanitized task：只暴露 metadata，藏 dispatchPrompt / writeScope / sourcePlanRef / evidence 等敏感
function serializeTaskPublic(t) {
  const full = serializeTask(t)
  return {
    id: full.id,
    title: full.title,
    summary: full.summary?.slice(0, 200) || '',
    owner: full.owner,
    status: full.status,
    lane: full.lane,
    priority: full.priority,
    requiresConsensus: full.requiresConsensus,
    consensusState: full.consensusState,
    consensusApprovalCount: full.consensusApprovalCount,
    consensusRequiredCount: full.consensusRequiredCount,
    verificationState: full.verificationState,
    dependsOn: full.dependsOn || [],
    completedAt: full.completedAt,
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
    recommendedSessionId: full.recommendedSessionId,
    recommendedSessionName: full.recommendedSessionName,
  }
}

function upsertTask(raw) {
  const id = norm(raw.id)
  const cur = id ? tasks.get(id) : undefined
  const next = normalizeTask(raw, cur)
  tasks.set(next.id, next)
  persistTasks()
  broadcast({ type: cur ? 'task:updated' : 'task:created', task: serializeTask(next) })
  return next
}

function applyConsensusReview(taskId, raw) {
  const cur = tasks.get(taskId)
  if (!cur) return { ok: false, error: 'Task not found' }
  if (!cur.requiresConsensus) return { ok: false, error: 'Task does not require consensus' }
  const agentId = norm(raw.agentId)
  const decision = parseConsensusDecision(raw.decision)
  if (!agentId || !decision) return { ok: false, error: 'Need agentId and decision' }
  const reviews = cur.consensusReviews.filter(r => r.agentId !== agentId)
  reviews.push({ agentId, decision, summary: norm(raw.summary), updatedAt: Date.now() })
  const t = normalizeTask({ ...cur, id: taskId, consensusReviews: reviews }, cur)
  tasks.set(taskId, t)
  persistTasks()
  broadcast({ type: 'task:consensus', task: serializeTask(t) })
  return { ok: true, task: serializeTask(t) }
}

function completeTask(taskId, raw) {
  const cur = tasks.get(taskId)
  if (!cur) return { ok: false, error: 'Task not found' }
  const t = normalizeTask({
    ...cur, ...sanitize(raw), id: taskId, status: 'completed',
    evidence: normEvidence(raw.evidence, cur.evidence), completedAt: Date.now(),
  }, cur)
  if (HARD_GATES_ENABLED) {
    const er = requireCompletionEvidence(t); if (!er.ok) return er
    const cr = requireConsensusApproved(t); if (!cr.ok) return cr
  }
  tasks.set(taskId, t)
  persistTasks()
  broadcast({ type: 'task:completed', task: serializeTask(t) })
  return { ok: true, task: serializeTask(t) }
}

function dispatchTask(taskId, reqSessionId) {
  const t = tasks.get(taskId)
  if (!t) return { ok: false, error: 'Task not found' }
  for (const depId of t.dependsOn) {
    const dep = tasks.get(depId)
    if (!dep) continue
    if (dep.status !== 'completed') return { ok: false, error: `Dependency ${depId} not completed` }
    if (dep.requiresConsensus && dep.consensusState !== 'approved') return { ok: false, error: `Dependency ${depId} waiting consensus` }
  }
  const target = (reqSessionId ? sessions.get(reqSessionId) : null) ?? findRecommendedSession(t)
  if (!target?.isActive) return { ok: false, error: 'No active session' }
  const text = t.dispatchPrompt || t.summary || t.title
  if (!sendToSession(target.id, text)) return { ok: false, error: 'Failed to send' }
  t.assignedSessionId = target.id
  t.status = 'in_progress'
  t.dispatchCount += 1
  t.lastDispatchedAt = Date.now()
  t.updatedAt = Date.now()
  persistTasks()
  broadcast({ type: 'task:dispatched', task: serializeTask(t) })
  return { ok: true, task: serializeTask(t), sessionId: target.id }
}

function reconcileTaskAssignments() {
  let changed = false
  for (const t of tasks.values()) {
    if (!t.assignedSessionId) continue
    const s = sessions.get(t.assignedSessionId)
    if (s?.isActive) continue
    t.assignedSessionId = null
    if (t.status === 'in_progress') t.status = 'pending'
    t.updatedAt = Date.now()
    changed = true
  }
  if (changed) { persistTasks(); broadcastTasksSnapshot() }
}

function broadcastTasksSnapshot() {
  broadcast({ type: 'tasks:snapshot', tasks: Array.from(tasks.values()).map(serializeTask) })
}

// ─── WebSocket broadcast ──────────────────────────────────────────
function isPrivateWsOutboundMessage(data) {
  return PRIVATE_WS_OUTBOUND_TYPES.has(data?.type)
}

function broadcast(data) {
  const json = JSON.stringify(data)
  for (const ws of wsClients) {
    if (ws.readyState !== 1) continue
    if (isPrivateWsOutboundMessage(data) && !ws.authTokenKind) continue
    ws.send(json)
  }
}

function serializeSession(s) {
  return {
    id: s.id, terminalName: s.terminalName,
    agent: { id: s.agent.id, name: s.agent.name, icon: s.agent.icon, color: s.agent.color },
    bufferLength: s.buffer.length, lastLines: s.buffer.slice(-20),
    lastActivity: s.lastActivity, isActive: s.isActive,
  }
}

const dispatcher = createLlmDispatcher({
  workspaceRoot: WORKSPACE_ROOT,
  dataRoot: DISPATCH_DATA_ROOT,
  broadcast,
  log,
})
const analystReportsWorker = createAnalystReportsWorker({ logger: console })

// ─── HTTP + WebSocket Server ──────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
  })
}

function detectWakeCliKind(command = VM_LLM_CLI) {
  const value = path.basename(String(command || '').trim()).toLowerCase()
  if (value.includes('claude')) return 'claude'
  if (value.includes('qwen')) return 'qwen'
  if (value.includes('gemini')) return 'gemini'
  return 'custom'
}

function buildWakePrompt(body) {
  const mode = String(body?.mode || '').trim().toLowerCase() === 'continue' ? 'continue' : 'command'
  const prompt = mode === 'continue'
    ? DEFAULT_WAKE_CONTINUE_PROMPT
    : String(body?.message || '').trim()
  return { mode, prompt }
}

function buildWakeInvocation(prompt) {
  const cliKind = detectWakeCliKind()
  const command = String(VM_LLM_CLI || '').trim()
  if (!command) throw new Error('VM_LLM_CLI is not configured')
  if (cliKind === 'claude') {
    const args = ['--bare', '-p', '--output-format', 'text', '--permission-mode', 'bypassPermissions']
    if (VM_LLM_MODEL) args.push('--model', VM_LLM_MODEL)
    args.push(prompt)
    return {
      cliKind,
      command,
      args,
    }
  }
  if (cliKind === 'qwen') {
    const args = ['--auth-type', 'gemini', '-y']
    if (VM_LLM_MODEL) args.push('-m', VM_LLM_MODEL)
    args.push('-p', prompt)
    return {
      cliKind,
      command,
      args,
    }
  }
  if (cliKind === 'gemini') {
    const args = []
    if (VM_LLM_MODEL) args.push('-m', VM_LLM_MODEL)
    args.push('-y', '-p', prompt)
    return {
      cliKind,
      command,
      args,
    }
  }
  return {
    cliKind,
    command: 'bash',
    args: ['-lc', `${command} ${JSON.stringify(prompt)}`],
  }
}

function wakeAgentLabel(cliKind) {
  if (cliKind === 'claude') return 'Claude Wake'
  if (cliKind === 'qwen') return 'Qwen Wake'
  if (cliKind === 'gemini') return 'Gemini Wake'
  return 'VM Wake'
}

function updateWakeActivity(cliKind, status, message) {
  localActivity.set(wakeAgentLabel(cliKind), {
    agent: wakeAgentLabel(cliKind),
    status,
    message,
    timestamp: Date.now(),
    host: 'vm',
  })
  scheduleLocalActivityPersist()
}

async function startWakeJob({ mode, prompt }) {
  const wakeId = Date.now()
  const logPath = path.join(VM_WAKE_LOG_DIR, `wake-${wakeId}.log`)
  const { cliKind, command, args } = buildWakeInvocation(prompt)
  const header = [
    `[WAKE_START] ${new Date().toISOString()}`,
    `mode=${mode}`,
    `cli=${cliKind}`,
    `cwd=${VM_PROJECT_PATH}`,
    `prompt=${prompt}`,
    '',
  ].join('\n')
  await fsPromises.writeFile(logPath, header, 'utf-8')

  const stdoutFd = fs.openSync(logPath, 'a')
  const stderrFd = fs.openSync(logPath, 'a')
  const child = spawn(command, args, {
    cwd: VM_PROJECT_PATH,
    detached: true,
    env: {
      ...process.env,
      PATH: [
        path.join(process.env.HOME || '/home/chenkuichen', '.local', 'bin'),
        process.env.PATH || '',
      ].filter(Boolean).join(':'),
    },
    stdio: ['ignore', stdoutFd, stderrFd],
  })
  fs.closeSync(stdoutFd)
  fs.closeSync(stderrFd)

  child.on('error', (error) => {
    fs.appendFile(logPath, `\n[WAKE_ERROR] ${error.message}\n`, () => {})
    updateWakeActivity(cliKind, 'failed', `Wake 啟動失敗：${error.message}`)
  })
  child.on('exit', (code, signal) => {
    fs.appendFile(
      logPath,
      `\n[WAKE_EXIT] code=${code ?? 'null'} signal=${signal ?? 'null'} finishedAt=${new Date().toISOString()}\n`,
      () => {},
    )
    updateWakeActivity(
      cliKind,
      code === 0 ? 'done' : 'failed',
      code === 0 ? 'Wake 任務已完成' : `Wake 任務退出 code=${code ?? 'null'}`,
    )
  })
  child.unref()

  updateWakeActivity(cliKind, 'working', `Wake 任務已送出：${mode === 'continue' ? 'continue runbook' : prompt}`)
  return { logPath, cliKind }
}

async function readWakeLog(logId) {
  if (!/^\d+$/.test(String(logId || ''))) {
    throw Object.assign(new Error('invalid wake id'), { code: 'EINVAL' })
  }
  const logPath = path.join(VM_WAKE_LOG_DIR, `wake-${logId}.log`)
  const content = await fsPromises.readFile(logPath, 'utf-8')
  const trimmed = content.length > WAKE_LOG_TAIL_BYTES
    ? content.slice(-WAKE_LOG_TAIL_BYTES)
    : content
  return {
    logPath,
    content: trimmed,
    status: content.includes('[WAKE_EXIT]') ? 'finished' : 'running',
  }
}

// Read dashboard HTML
const dashboardDir = path.join(__dirname, 'dashboard')
const dashboardPath = path.join(dashboardDir, 'index.html')
const dashboardLoginPath = path.join(dashboardDir, 'login.html')
const dashboardFallbackHtml = '<html><body><h1>Agent Bridge</h1><p>Dashboard not found</p></body></html>'
const dashboardLoginFallbackHtml = '<html><body><h1>Agent Bridge</h1><p>Login page not found</p></body></html>'
const DASHBOARD_STATIC_MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
])

function readDashboardHtml(filePath, fallbackHtml) {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8')
  } catch {}
  return fallbackHtml
}

function resolveDashboardStaticFile(pathname) {
  let relPath = null
  if (pathname === '/dashboard-live.js') relPath = 'dashboard-live.js'
  else if (pathname.startsWith('/assets/')) relPath = pathname.slice(1)
  else if (pathname.startsWith('/dashboard/')) relPath = pathname.slice('/dashboard/'.length)
  if (!relPath || relPath.endsWith('/')) return null
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = path.join(dashboardDir, normalized)
  if (!filePath.startsWith(dashboardDir)) return null
  return filePath
}

async function serveDashboardStaticFile(pathname, res) {
  const filePath = resolveDashboardStaticFile(pathname)
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = DASHBOARD_STATIC_MIME_TYPES.get(ext)
  if (!mimeType) return false
  try {
    const stat = await fsPromises.stat(filePath)
    if (!stat.isFile()) return false
    const content = await fsPromises.readFile(filePath)
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp'
        ? 'public, max-age=300'
        : 'no-cache, no-store, must-revalidate',
    })
    res.end(content)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url ?? '/', `http://127.0.0.1`)
  const p = url.pathname
  const isReadMethod = req.method === 'GET' || req.method === 'HEAD'

  // Dashboard static pages — no-cache, hot-reload from disk
  if (
    (p === '/' || p === '/index.html' || p === '/dashboard' || p === '/dashboard/' || p === '/dashboard/index.html' || p === '/login.html' || p === '/dashboard/login.html')
    && isReadMethod
  ) {
    const html = (p === '/login.html' || p === '/dashboard/login.html')
      ? readDashboardHtml(dashboardLoginPath, dashboardLoginFallbackHtml)
      : readDashboardHtml(dashboardPath, dashboardFallbackHtml)
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    })
    res.end(html); return
  }
  if (isReadMethod && await serveDashboardStaticFile(p, res)) return

  if (p === '/dashboard/login' && req.method === 'POST') {
    const { pin } = await readBody(req)
    if (!DASHBOARD_PIN) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'PIN not configured' })); return
    }
    if (String(pin ?? '').trim() !== DASHBOARD_PIN) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false })); return
    }
    const session = issueDashboardToken()
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': buildDashboardCookie(session.token, req),
    })
    res.end(JSON.stringify({
      ok: true,
      token: session.token,
      expiresInMs: DASHBOARD_TOKEN_TTL_MS,
      expiresAt: session.expiresAt,
    })); return
  }

  const requiresDashboardAuth = isDashboardProtectedHttpRoute(p, req.method)
  const requiresHttpAuth = isProtectedHttpRoute(p, req.method)
  const dashboardTokenKind = hasDashboardAuth(req)
  const bridgeTokenKind = hasValidAuth(req)
  const httpTokenKind = dashboardTokenKind
    || (requiresDashboardAuth
      ? (bridgeTokenKind && bridgeTokenKind !== 'disabled' ? bridgeTokenKind : null)
      : bridgeTokenKind)
  if ((requiresDashboardAuth || requiresHttpAuth) && !httpTokenKind) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: requiresDashboardAuth ? 'unauthorized · re-login with PIN' : 'Unauthorized',
    })); return
  }
  if (requiresDashboardAuth || requiresHttpAuth) logAuthUsage('http', `${req.method} ${p}`, httpTokenKind)

  // GET routes
  if (p === '/api/health' && isReadMethod) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() })); return
  }
  if (p === '/api/sessions' && isReadMethod) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(Array.from(sessions.values()).map(serializeSession))); return
  }
  if (p === '/api/dashboard-snapshot' && isReadMethod) {
    const snapshot = await buildDashboardSnapshot()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(snapshot)); return
  }
  if (p === '/api/pending-decisions' && isReadMethod) {
    const payload = await listPendingDecisions({
      includeHistory: url.searchParams.get('history') === '1',
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload)); return
  }
  if (p === '/api/status' && isReadMethod) {
    const localEntries = serializeLocalActivity()
    const [taskSummary, todayCommits, pendingPush, recentCommits] = await Promise.all([
      readTaskSummary(),
      readTodayCommits(),
      readPendingPush(),
      readRecentCommits(15),
    ])
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      uptime: process.uptime(),
      sessions: sessions.size,
      tasks: taskSummary,
      clients: wsClients.size, workspace: path.basename(WORKSPACE_ROOT),
      agentBreakdown: computeAgentBreakdown(localEntries),
      todayCommits,
      pendingPush,
      recentCommits,
      localActivity: localEntries,
    })); return
  }
  if (p === '/api/project' && isReadMethod) {
    const statusPath = path.join(__dirname, 'project-status.json')
    try {
      const project = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ...project,
        hardGates: { enabled: HARD_GATES_ENABLED, envVar: 'AGENT_BRIDGE_HARD_GATES' },
      }))
    } catch { res.writeHead(404); res.end('{}') }
    return
  }
  if (p === '/api/tasks' && isReadMethod) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(Array.from(tasks.values()).map(serializeTask))); return
  }
  if (p === '/api/workers/dispatch' && isReadMethod) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(dispatcher.listDispatches())); return
  }
  const wakeLog = p.match(/^\/wake\/log\/([^/]+)$/)
  if (wakeLog && isReadMethod) {
    try {
      const result = await readWakeLog(decodeURIComponent(wakeLog[1]))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ...result }))
    } catch (error) {
      const status = error?.code === 'ENOENT' ? 404 : 400
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: status === 404 ? 'log not found' : error?.message || 'invalid wake log request' }))
    }
    return
  }
  const dispatchDetail = p.match(/^\/api\/workers\/dispatch\/([^/]+)$/)
  if (dispatchDetail && isReadMethod) {
    const run = dispatcher.getDispatch(decodeURIComponent(dispatchDetail[1]))
    res.writeHead(run ? 200 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(run || { error: 'Dispatch not found' })); return
  }
  const analystJob = p.match(/^\/internal\/analyst-reports\/([^/]+)$/)
  if (analystJob && isReadMethod) {
    const job = analystReportsWorker.get(decodeURIComponent(analystJob[1]))
    res.writeHead(job ? 200 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(job || { error: 'Job not found' })); return
  }

  // POST routes
  if (p === '/internal/analyst-reports' && req.method === 'POST') {
    const body = await readBody(req)
    const wait = url.searchParams.get('wait') === '1'
    try {
      const job = await analystReportsWorker.submit(body, { wait })
      res.writeHead(job.status === 'failed' ? 500 : wait ? 200 : 202, {
        'Content-Type': 'application/json',
      })
      res.end(JSON.stringify(job))
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error?.message || 'invalid analyst-reports request' }))
    }
    return
  }
  if (p === '/api/send' && req.method === 'POST') {
    const { sessionId, text } = await readBody(req)
    const ok = sendToSession(sessionId, text)
    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok, sessionId })); return
  }
  if (p === '/api/terminal/create' && req.method === 'POST') {
    const { name, command, args } = await readBody(req)
    const session = createSession(name || 'agent', command || '/bin/bash', args || [])
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, sessionId: session.id, name: session.terminalName })); return
  }
  if (p === '/api/tasks' && req.method === 'POST') {
    const body = await readBody(req)
    const t = upsertTask(sanitize(body))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, task: serializeTask(t) })); return
  }
  if (p === '/api/local-status' && req.method === 'POST') {
    const body = await readBody(req)
    const { agent, status, message, timestamp, host } = body
    if (!agent) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing agent field' })); return
    }
    localActivity.set(agent, {
      agent,
      status: status || 'unknown',
      message: message || '',
      timestamp: timestamp || Date.now(),
      host: host || 'unknown',
    })
    scheduleLocalActivityPersist()
    log(`Local status update: ${agent} → ${status}`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, agent })); return
  }
  if (p === '/api/tasks/sync' && req.method === 'POST') {
    loadTasks(); reconcileTaskAssignments(); broadcastTasksSnapshot()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, tasks: Array.from(tasks.values()).map(serializeTask) })); return
  }
  if (p === '/api/workers/dispatch' && req.method === 'POST') {
    const body = await readBody(req)
    const result = await dispatcher.dispatch(body)
    res.writeHead(result.ok ? 202 : 400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result)); return
  }
  if (p === '/wake' && req.method === 'POST') {
    const body = await readBody(req)
    const { mode, prompt } = buildWakePrompt(body)
    if (!prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'empty prompt' })); return
    }
    try {
      const result = await startWakeJob({ mode, prompt })
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        mode,
        cli: result.cliKind,
        logPath: result.logPath,
        hint: '訊息已送 VM LLM CLI；可在 dashboard 的 Layer 2 panel 追蹤 log。',
      }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error?.message || 'wake launch failed' }))
    }
    return
  }
  const pendingDecisionAnswer = p.match(/^\/api\/pending-decisions\/([^/]+)\/answer$/)
  if (pendingDecisionAnswer && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const decision = await appendPendingDecisionAnswer(
        decodeURIComponent(pendingDecisionAnswer[1]),
        body,
      )
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, decision })); return
    } catch (error) {
      const message = error?.message || 'Failed to answer pending decision'
      const statusCode = message === 'Decision not found' ? 404 : 400
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message })); return
    }
  }

  // Task action routes
  const dispatch = p.match(/^\/api\/tasks\/([^/]+)\/dispatch$/)
  if (dispatch && req.method === 'POST') {
    const body = await readBody(req)
    const result = dispatchTask(decodeURIComponent(dispatch[1]), body.sessionId)
    res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result)); return
  }
  const complete = p.match(/^\/api\/tasks\/([^/]+)\/complete$/)
  if (complete && req.method === 'POST') {
    const body = await readBody(req)
    const result = completeTask(decodeURIComponent(complete[1]), body)
    const sc = result.ok ? 200 : result.error?.includes('consensus') ? 409 : 400
    res.writeHead(sc, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result)); return
  }
  const consensus = p.match(/^\/api\/tasks\/([^/]+)\/consensus$/)
  if (consensus && req.method === 'POST') {
    const body = await readBody(req)
    const result = applyConsensusReview(decodeURIComponent(consensus[1]), body)
    res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result)); return
  }
  const taskPatch = p.match(/^\/api\/tasks\/([^/]+)$/)
  if (taskPatch && (req.method === 'PATCH' || req.method === 'POST')) {
    const body = await readBody(req)
    const taskId = decodeURIComponent(taskPatch[1])
    const s = sanitize(body)
    if (HARD_GATES_ENABLED && parseStatus(body.status) === 'completed') {
      const next = normalizeTask({ ...s, id: taskId }, tasks.get(taskId))
      const er = requireCompletionEvidence(next); if (!er.ok) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(er)); return }
      const cr = requireConsensusApproved(next); if (!cr.ok) { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cr)); return }
    }
    const t = upsertTask({ ...s, id: taskId })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, task: serializeTask(t) })); return
  }

  res.writeHead(404); res.end('Not found')
})

// WebSocket
const wss = new WebSocketServer({ server })
wss.on('connection', (ws, req) => {
  ws.authTokenKind = hasWsAuth(req)
  if (DASHBOARD_PIN && !ws.authTokenKind) {
    ws.send(JSON.stringify({ type: 'error', error: 'unauthorized · re-login with PIN' }))
    ws.close(4401, 'unauthorized')
    return
  }
  wsClients.add(ws)
  log(`Client connected (total: ${wsClients.size})`)

  ws.send(JSON.stringify({
    type: 'snapshot',
    sessions: ws.authTokenKind ? Array.from(sessions.values()).map(serializeSession) : [],
    workspace: path.basename(WORKSPACE_ROOT),
  }))
  // 公開 task list (sanitized) — dashboard 預設能看任務狀態 / lane / 進度，不含 dispatchPrompt 等敏感
  ws.send(JSON.stringify({
    type: 'tasks:snapshot',
    tasks: ws.authTokenKind
      ? Array.from(tasks.values()).map(serializeTask)
      : Array.from(tasks.values()).map(serializeTaskPublic),
  }))
  if (ws.authTokenKind) {
    logAuthUsage('ws', 'connect', ws.authTokenKind)
    ws.send(JSON.stringify({
      type: 'worker:dispatches',
      dispatches: dispatcher.listDispatches(),
    }))
  }

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      const wsTokenKind = hasWsAuth(req, msg)
      if (PROTECTED_WS_MESSAGE_TYPES.has(msg.type) && !wsTokenKind) {
        ws.send(JSON.stringify({ type: 'error', error: 'Unauthorized', requestType: msg.type }))
        return
      }
      if (PROTECTED_WS_MESSAGE_TYPES.has(msg.type)) logAuthUsage('ws', msg.type, wsTokenKind)
      switch (msg.type) {
        case 'send': {
          const ok = sendToSession(msg.sessionId, msg.text)
          ws.send(JSON.stringify({ type: 'send:ack', ok, sessionId: msg.sessionId })); break
        }
        case 'terminal:create': {
          const s = createSession(msg.name || 'agent', msg.command || '/bin/bash', msg.args || [])
          ws.send(JSON.stringify({ type: 'terminal:created', name: s.terminalName, sessionId: s.id })); break
        }
        case 'session:history': {
          const s = sessions.get(msg.sessionId)
          if (s) ws.send(JSON.stringify({ type: 'session:history', sessionId: msg.sessionId, lines: s.buffer }))
          break
        }
        case 'task:list': broadcastTasksSnapshot(); break
        case 'task:create': { const t = upsertTask(sanitize(msg.task ?? msg)); ws.send(JSON.stringify({ type: 'task:created:ack', task: serializeTask(t) })); break }
        case 'task:update': { const t = upsertTask(sanitize(msg.task ?? msg)); ws.send(JSON.stringify({ type: 'task:updated:ack', task: serializeTask(t) })); break }
        case 'task:dispatch': { const r = dispatchTask(msg.taskId, msg.sessionId); ws.send(JSON.stringify({ type: 'task:dispatch:ack', ...r })); break }
        case 'task:complete': { const r = completeTask(msg.taskId, msg.task ?? msg); ws.send(JSON.stringify({ type: 'task:complete:ack', ...r })); break }
        case 'task:consensus': { const r = applyConsensusReview(msg.taskId, msg.review ?? msg); ws.send(JSON.stringify({ type: 'task:consensus:ack', ...r })); break }
        case 'task:sync': loadTasks(); reconcileTaskAssignments(); broadcastTasksSnapshot(); break
        case 'worker:dispatch': {
          const r = await dispatcher.dispatch(msg.dispatch ?? msg)
          ws.send(JSON.stringify({ type: 'worker:dispatch:ack', ...r }))
          break
        }
        case 'ping': ws.send(JSON.stringify({ type: 'pong' })); break
      }
    } catch { log('Invalid WS message') }
  })

  ws.on('close', () => {
    wsClients.delete(ws)
    log(`Client disconnected (total: ${wsClients.size})`)
  })
})

// ─── Start ────────────────────────────────────────────────────────
loadTasks()
registerShutdownFlush('SIGINT')
registerShutdownFlush('SIGTERM')
await loadLocalActivity()
server.listen(PORT, HOST, () => {
  log(`Agent Bridge standalone server running on ${HOST}:${PORT}`)
  log(`Dashboard: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  log(`Workspace: ${WORKSPACE_ROOT}`)
  if (!VALID_TOKENS.size) log('Auth: DISABLED (set BRIDGE_AUTH_TOKEN and optionally BRIDGE_AUTH_TOKEN_PREVIEW)')
  else log(`Auth: enabled (${Array.from([
    AUTH_TOKEN ? 'prod' : null,
    AUTH_TOKEN_PREVIEW ? 'preview' : null,
  ]).filter(Boolean).join(' + ')})`)
  log(`Dashboard PIN auth: ${DASHBOARD_PIN ? 'ON' : 'off'}`)
  log(`Hard gates: ${HARD_GATES_ENABLED ? 'ON' : 'off'}`)
  log(`Tasks loaded: ${tasks.size}`)
})
