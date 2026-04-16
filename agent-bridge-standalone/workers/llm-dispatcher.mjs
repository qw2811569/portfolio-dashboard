import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { put } from '@vercel/blob'

const LOG_BATCH_INTERVAL_MS = 400
const MAX_LOG_LINES = 2000
const MAX_RECENT_LINES = 120

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
}

function norm(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function clipWords(value, limit = 250) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) return words.join(' ')
  return `${words.slice(0, limit).join(' ')}...`
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function safeFileName(value) {
  return String(value || 'dispatch').replace(/[^a-zA-Z0-9._-]/g, '_')
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function collectChangedFiles(workspaceRoot, baseline = []) {
  const result = spawnSync('git', ['status', '--short'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) return []
  const before = new Set(baseline)
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((file) => file && !before.has(file))
    .filter((file) => !file.startsWith('agent-bridge-standalone/data/dispatches'))
}

function readGitStatusBaseline(workspaceRoot) {
  const result = spawnSync('git', ['status', '--short'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) return []
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
}

function readHeadCommit(workspaceRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function buildCommand(agent, brief, env) {
  const geminiModel = norm(env.GEMINI_MODEL) || 'gemini-2.5-flash'
  switch (agent) {
    case 'codex':
      return {
        command: 'codex',
        args: ['exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-'],
        stdin: brief,
      }
    case 'qwen':
      return {
        command: 'qwen',
        args: ['--auth-type', 'qwen-oauth', '-y', '-p', brief],
        stdin: '',
      }
    case 'gemini':
      return {
        command: 'gemini',
        args: ['-m', geminiModel, '-p', brief],
        stdin: '',
      }
    default:
      throw new Error(`Unsupported agent: ${agent}`)
  }
}

function extractTaggedValue(lines, prefix) {
  const upper = prefix.toUpperCase()
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = String(lines[i] || '').trim()
    if (line.toUpperCase().startsWith(`${upper}:`)) {
      return line.slice(prefix.length + 1).trim()
    }
  }
  return ''
}

function summarizeLines(lines) {
  const joined = lines.slice(-80).join('\n')
  const paragraphs = joined
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(>|\$|❯|warning:|note:)/i.test(line))
  if (!paragraphs.length) return ''
  return clipWords(paragraphs.slice(-8).join(' '), 250)
}

function inferVerdict(exitCode, lines) {
  const explicit = extractTaggedValue(lines, 'VERDICT').toLowerCase()
  if (['shipped', 'blocked', 'failed'].includes(explicit)) return explicit
  const tail = lines.slice(-30).join('\n').toLowerCase()
  if (/\bblocked\b/.test(tail)) return 'blocked'
  if (exitCode === 0) return 'shipped'
  return 'failed'
}

async function postCallback(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`callback failed (${response.status})`)
  }
}

async function uploadArtifact(blobToken, key, payload) {
  if (!blobToken) return { blobKey: '', blobUrl: '' }
  const result = await put(key, JSON.stringify(payload, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    token: blobToken,
  })
  return { blobKey: key, blobUrl: result.url }
}

function serializeDispatch(run) {
  return {
    taskId: run.taskId,
    agent: run.agent,
    status: run.status,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    durationSec: run.durationSec,
    verdict: run.verdict,
    done: run.done,
    summary_250words: run.summary_250words,
    next_step: run.next_step,
    changed_files: run.changed_files,
    commit_hash: run.commit_hash,
    blob_key: run.blob_key,
    blob_url: run.blob_url,
    callback: run.callback,
    callbackDelivered: run.callbackDelivered,
    exitCode: run.exitCode,
    logLineCount: run.logLines.length,
    recentLines: run.logLines.slice(-MAX_RECENT_LINES),
    error: run.error,
  }
}

export function createLlmDispatcher({
  workspaceRoot,
  dataRoot,
  broadcast,
  log,
  env = process.env,
}) {
  const dispatches = new Map()
  const activeProcesses = new Map()
  const localDispatchDir = path.join(dataRoot, 'dispatches')
  ensureDir(localDispatchDir)

  function persistDispatch(run) {
    fs.writeFileSync(
      path.join(localDispatchDir, `${safeFileName(run.taskId)}.json`),
      JSON.stringify(serializeDispatch(run), null, 2),
    )
  }

  for (const file of fs.readdirSync(localDispatchDir)) {
    if (!file.endsWith('.json')) continue
    const parsed = safeJsonParse(fs.readFileSync(path.join(localDispatchDir, file), 'utf8'))
    if (parsed?.taskId) {
      dispatches.set(parsed.taskId, {
        ...parsed,
        logLines: Array.isArray(parsed.recentLines) ? parsed.recentLines.slice(-MAX_LOG_LINES) : [],
        gitStatusBaseline: [],
      })
    }
  }

  function broadcastSnapshot() {
    broadcast({
      type: 'worker:dispatches',
      dispatches: Array.from(dispatches.values())
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .map(serializeDispatch),
    })
  }

  async function finalizeRun(run, { exitCode = null, error = '' } = {}) {
    run.updatedAt = Date.now()
    run.finishedAt = run.updatedAt
    run.durationSec = Math.max(0, Math.round((run.finishedAt - run.startedAt) / 1000))
    run.exitCode = exitCode
    run.done = true
    run.status = exitCode === 0 ? 'completed' : 'failed'
    run.error = norm(error)
    run.verdict = inferVerdict(exitCode, run.logLines)
    run.summary_250words = clipWords(
      extractTaggedValue(run.logLines, 'SUMMARY_250WORDS')
        || extractTaggedValue(run.logLines, 'SUMMARY')
        || summarizeLines(run.logLines),
      250,
    )
    run.next_step = extractTaggedValue(run.logLines, 'NEXT_STEP')
    run.changed_files = collectChangedFiles(workspaceRoot, run.gitStatusBaseline)
    run.commit_hash = readHeadCommit(workspaceRoot)

    const artifactKey = `llm-dispatches/${run.taskId}.json`
    const artifactPayload = {
      taskId: run.taskId,
      agent: run.agent,
      brief: run.brief,
      done: run.done,
      verdict: run.verdict,
      summary_250words: run.summary_250words,
      next_step: run.next_step,
      changed_files: run.changed_files,
      commit_hash: run.commit_hash,
      duration_sec: run.durationSec,
      started_at: new Date(run.startedAt).toISOString(),
      finished_at: new Date(run.finishedAt).toISOString(),
      exit_code: run.exitCode,
      callback: run.callback,
      error: run.error,
      log_lines: run.logLines,
    }

    try {
      const uploaded = await uploadArtifact(env.BLOB_READ_WRITE_TOKEN || env.PUB_BLOB_READ_WRITE_TOKEN || '', artifactKey, artifactPayload)
      run.blob_key = uploaded.blobKey
      run.blob_url = uploaded.blobUrl
    } catch (blobError) {
      run.error = run.error || `blob upload failed: ${blobError.message}`
      log(`Dispatcher blob upload failed for ${run.taskId}: ${blobError.message}`)
    }

    persistDispatch(run)
    dispatches.set(run.taskId, run)
    broadcast({
      type: 'worker:completed',
      dispatch: serializeDispatch(run),
    })
    broadcastSnapshot()

    if (run.callback) {
      const payload = {
        taskId: run.taskId,
        agent: run.agent,
        done: run.done,
        verdict: run.verdict,
        summary_250words: run.summary_250words,
        changed_files: run.changed_files,
        commit_hash: run.commit_hash,
        blob_key: run.blob_key,
        duration_sec: run.durationSec,
        next_step: run.next_step,
      }
      try {
        await postCallback(run.callback, payload)
        run.callbackDelivered = true
        run.updatedAt = Date.now()
        persistDispatch(run)
        broadcastSnapshot()
      } catch (callbackError) {
        run.callbackDelivered = false
        run.error = run.error || callbackError.message
        run.updatedAt = Date.now()
        persistDispatch(run)
        broadcastSnapshot()
        log(`Dispatcher callback failed for ${run.taskId}: ${callbackError.message}`)
      }
    }
  }

  function getDispatch(taskId) {
    return taskId && dispatches.get(taskId) ? serializeDispatch(dispatches.get(taskId)) : null
  }

  function listDispatches() {
    return Array.from(dispatches.values())
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(serializeDispatch)
  }

  async function dispatch({ agent, brief, taskId, callback = '' }) {
    const safeAgent = norm(agent).toLowerCase()
    const safeTaskId = norm(taskId) || `dispatch-${Date.now()}`
    const safeBrief = String(brief || '').trim()
    if (!safeBrief) return { ok: false, error: 'brief is required' }
    if (!['codex', 'qwen', 'gemini'].includes(safeAgent)) return { ok: false, error: 'unsupported agent' }
    if (activeProcesses.has(safeTaskId)) return { ok: false, error: 'task already running' }

    const cmd = buildCommand(safeAgent, safeBrief, env)
    const run = {
      taskId: safeTaskId,
      agent: safeAgent,
      brief: safeBrief,
      callback: norm(callback),
      callbackDelivered: false,
      status: 'running',
      done: false,
      verdict: '',
      summary_250words: '',
      next_step: '',
      changed_files: [],
      commit_hash: '',
      blob_key: '',
      blob_url: '',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      finishedAt: null,
      durationSec: null,
      exitCode: null,
      error: '',
      logLines: [],
      gitStatusBaseline: readGitStatusBaseline(workspaceRoot),
    }

    dispatches.set(safeTaskId, run)
    persistDispatch(run)
    broadcast({
      type: 'worker:dispatched',
      dispatch: serializeDispatch(run),
      command: {
        program: cmd.command,
        args: cmd.args,
      },
    })
    broadcastSnapshot()

    let logBatch = []
    let flushTimer = null
    const flushLogs = () => {
      flushTimer = null
      if (!logBatch.length) return
      broadcast({
        type: 'worker:log',
        taskId: safeTaskId,
        agent: safeAgent,
        lines: logBatch,
        timestamp: Date.now(),
      })
      logBatch = []
    }
    const queueLogLines = (chunk) => {
      const cleaned = stripAnsi(String(chunk || ''))
      if (!cleaned.trim()) return
      const lines = cleaned
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim())
      if (!lines.length) return
      run.logLines.push(...lines)
      if (run.logLines.length > MAX_LOG_LINES) {
        run.logLines.splice(0, run.logLines.length - MAX_LOG_LINES)
      }
      run.updatedAt = Date.now()
      logBatch.push(...lines)
      if (!flushTimer) flushTimer = setTimeout(flushLogs, LOG_BATCH_INTERVAL_MS)
    }

    try {
      const child = spawn(cmd.command, cmd.args, {
        cwd: workspaceRoot,
        env: { ...env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      activeProcesses.set(safeTaskId, child)
      log(`Dispatcher started ${safeAgent} for ${safeTaskId}`)

      child.stdout?.on('data', queueLogLines)
      child.stderr?.on('data', queueLogLines)
      child.on('error', async (spawnError) => {
        if (flushTimer) clearTimeout(flushTimer)
        flushLogs()
        activeProcesses.delete(safeTaskId)
        await finalizeRun(run, { exitCode: 1, error: spawnError.message })
      })
      child.on('close', async (code) => {
        if (flushTimer) clearTimeout(flushTimer)
        flushLogs()
        activeProcesses.delete(safeTaskId)
        await finalizeRun(run, { exitCode: typeof code === 'number' ? code : 1 })
      })

      if (cmd.stdin) child.stdin.write(cmd.stdin)
      child.stdin.end()

      return { ok: true, dispatch: serializeDispatch(run) }
    } catch (error) {
      activeProcesses.delete(safeTaskId)
      await finalizeRun(run, { exitCode: 1, error: error.message })
      return { ok: false, error: error.message, dispatch: serializeDispatch(run) }
    }
  }

  return {
    dispatch,
    getDispatch,
    listDispatches,
    serializeDispatch,
    broadcastSnapshot,
  }
}
