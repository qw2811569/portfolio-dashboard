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
import path from 'node:path'
import { spawn } from 'node:child_process'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ───────────────────────────────────────────────────────
const PORT = Number(process.env.BRIDGE_PORT) || 9527
const AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || ''
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()
const TASK_SEED_PATH = path.join(WORKSPACE_ROOT, 'coordination', 'llm-bus', 'agent-bridge-tasks.json')
const TASK_PERSIST_PATH = path.join(__dirname, 'data', 'tasks.json')
const HARD_GATES_ENABLED = process.env.AGENT_BRIDGE_HARD_GATES === '1'
const MAX_BUFFER_LINES = 500
const CONSENSUS_APPROVAL_QUORUM = 2

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

// ─── Logging ──────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

// ─── ANSI strip ───────────────────────────────────────────────────
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
}

// ─── Auth check ───────────────────────────────────────────────────
function checkAuth(req) {
  if (!AUTH_TOKEN) return true // no token = open (dev mode)
  const header = req.headers.authorization || ''
  return header === `Bearer ${AUTH_TOKEN}`
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
function broadcast(data) {
  const json = JSON.stringify(data)
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(json)
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

// ─── HTTP + WebSocket Server ──────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
  })
}

// Read dashboard HTML
const dashboardPath = path.join(__dirname, 'dashboard', 'index.html')
let dashboardHtml = '<html><body><h1>Agent Bridge</h1><p>Dashboard not found</p></body></html>'
if (fs.existsSync(dashboardPath)) dashboardHtml = fs.readFileSync(dashboardPath, 'utf-8')

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url ?? '/', `http://127.0.0.1`)
  const p = url.pathname

  // Dashboard — no auth
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(dashboardHtml); return
  }

  // API auth check
  if (p.startsWith('/api/') && !checkAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' })); return
  }

  // GET routes
  if (p === '/api/sessions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(Array.from(sessions.values()).map(serializeSession))); return
  }
  if (p === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      uptime: process.uptime(), sessions: sessions.size, tasks: tasks.size,
      clients: wsClients.size, workspace: path.basename(WORKSPACE_ROOT),
      hardGates: { enabled: HARD_GATES_ENABLED, envVar: 'AGENT_BRIDGE_HARD_GATES' },
    })); return
  }
  if (p === '/api/tasks' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(Array.from(tasks.values()).map(serializeTask))); return
  }

  // POST routes
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
  if (p === '/api/tasks/sync' && req.method === 'POST') {
    loadTasks(); reconcileTaskAssignments(); broadcastTasksSnapshot()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, tasks: Array.from(tasks.values()).map(serializeTask) })); return
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
  // Auth check for WS via query param
  if (AUTH_TOKEN) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.searchParams.get('token') !== AUTH_TOKEN) {
      ws.close(4001, 'Unauthorized'); return
    }
  }

  wsClients.add(ws)
  log(`Client connected (total: ${wsClients.size})`)

  ws.send(JSON.stringify({
    type: 'snapshot',
    sessions: Array.from(sessions.values()).map(serializeSession),
    workspace: path.basename(WORKSPACE_ROOT),
  }))
  ws.send(JSON.stringify({
    type: 'tasks:snapshot',
    tasks: Array.from(tasks.values()).map(serializeTask),
  }))

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
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
server.listen(PORT, '0.0.0.0', () => {
  log(`Agent Bridge standalone server running on 0.0.0.0:${PORT}`)
  log(`Dashboard: http://localhost:${PORT}`)
  log(`Workspace: ${WORKSPACE_ROOT}`)
  log(`Auth: ${AUTH_TOKEN ? 'enabled' : 'DISABLED (set BRIDGE_AUTH_TOKEN)'}`)
  log(`Hard gates: ${HARD_GATES_ENABLED ? 'ON' : 'off'}`)
  log(`Tasks loaded: ${tasks.size}`)
})
