#!/usr/bin/env node
/* eslint-disable no-console */

process.env.AGENT_BRIDGE_HARD_GATES = '1'

const http = require('http')
const path = require('path')
const Module = require('module')

const registeredCommands = new Map()
const statusBarItem = {
  text: '',
  tooltip: '',
  command: '',
  show() {},
  hide() {},
  dispose() {},
}
const outputChannel = {
  appendLine(_msg) {},
  show() {},
  dispose() {},
}

const fakeVscode = {
  window: {
    createOutputChannel: () => outputChannel,
    createStatusBarItem: () => statusBarItem,
    createTerminal: () => ({ name: 'fake', dispose() {}, sendText() {} }),
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    terminals: [],
    onDidOpenTerminal: () => ({ dispose() {} }),
    onDidCloseTerminal: () => ({ dispose() {} }),
    onDidChangeActiveTerminal: () => ({ dispose() {} }),
  },
  workspace: {
    getConfiguration: () => ({
      get: (key, def) => (key === 'port' ? 19527 : def),
    }),
    name: 'hard-gate-e2e',
    workspaceFolders: [],
  },
  commands: {
    registerCommand: (name, cb) => {
      registeredCommands.set(name, cb)
      return { dispose() {} }
    },
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ThemeColor: class ThemeColor {},
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'vscode') return fakeVscode
  return originalLoad.call(this, request, parent, isMain)
}

const extension = require('../out/extension.js')

Module._load = originalLoad

const globalStateStore = new Map()
const fakeContext = {
  subscriptions: { push() {} },
  extensionPath: path.resolve(__dirname, '..'),
  globalState: {
    get: (key, def) => (globalStateStore.has(key) ? globalStateStore.get(key) : def),
    update: (key, value) => {
      globalStateStore.set(key, value)
      return Promise.resolve()
    },
    keys: () => Array.from(globalStateStore.keys()),
  },
  workspaceState: {
    get: (_key, def) => def,
    update: () => Promise.resolve(),
  },
}

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : ''
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 19527,
        path: pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let chunks = ''
        res.on('data', (c) => (chunks += c))
        res.on('end', () => {
          try {
            const parsed = chunks ? JSON.parse(chunks) : null
            resolve({ status: res.statusCode, body: parsed })
          } catch (err) {
            resolve({ status: res.statusCode, body: chunks, parseError: err })
          }
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`)
  }
}

async function waitForServer(maxMs = 3000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await request('GET', '/api/status')
      if (res.status === 200) return
    } catch (_err) {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('bridge server did not start within timeout')
}

async function main() {
  extension.activate(fakeContext)

  const startCommand = registeredCommands.get('agentBridge.start')
  if (!startCommand) throw new Error('agentBridge.start command was not registered')
  startCommand()

  await waitForServer()

  // --- Scenario 1: /api/status exposes hardGates block with enabled=true ---
  const statusRes = await request('GET', '/api/status')
  assert(statusRes.status === 200, `/api/status should return 200, got ${statusRes.status}`)
  assert(statusRes.body?.hardGates, '/api/status should expose hardGates block')
  assert(
    statusRes.body.hardGates.enabled === true,
    `hardGates.enabled should be true when AGENT_BRIDGE_HARD_GATES=1, got ${statusRes.body.hardGates.enabled}`
  )
  assert(
    statusRes.body.hardGates.envVar === 'AGENT_BRIDGE_HARD_GATES',
    `hardGates.envVar should be 'AGENT_BRIDGE_HARD_GATES', got ${statusRes.body.hardGates.envVar}`
  )
  console.log('  [1/6] /api/status exposes hardGates.enabled=true ✓')

  // --- Scenario 2: seed a simple task without consensus requirement ---
  const createRes = await request('POST', '/api/tasks', {
    id: 'e2e-task-1',
    owner: 'claude',
    title: 'E2E hard-gate task 1',
    status: 'in_progress',
  })
  assert(createRes.status === 200, `create task should succeed, got ${createRes.status}`)
  console.log('  [2/6] seeded e2e-task-1 ✓')

  // --- Scenario 3: POST /api/tasks/:id/complete with empty evidence → 400 ---
  const emptyEvidenceRes = await request('POST', '/api/tasks/e2e-task-1/complete', {
    evidence: {
      changedFiles: [],
      verificationRuns: [],
      risksNoted: [],
      nextStep: '',
    },
  })
  assert(
    emptyEvidenceRes.status === 400,
    `empty evidence should return 400, got ${emptyEvidenceRes.status}`
  )
  assert(
    emptyEvidenceRes.body?.ok === false,
    `empty evidence should return ok:false, got ${JSON.stringify(emptyEvidenceRes.body)}`
  )
  assert(
    Array.isArray(emptyEvidenceRes.body?.missing) && emptyEvidenceRes.body.missing.length === 4,
    `empty evidence should list all 4 missing fields, got ${JSON.stringify(emptyEvidenceRes.body?.missing)}`
  )
  console.log('  [3/6] POST /complete with empty evidence → 400 + missing[] ✓')

  // --- Scenario 4: POST /api/tasks/:id/complete with full evidence → 200 ---
  const fullEvidenceRes = await request('POST', '/api/tasks/e2e-task-1/complete', {
    evidence: {
      changedFiles: ['docs/vscode-agent-bridge/scripts/hard-gate-e2e.cjs'],
      verificationRuns: ['node scripts/hard-gate-e2e.cjs'],
      risksNoted: ['none: harness is self-contained'],
      nextStep: 'Enable AGENT_BRIDGE_HARD_GATES=1 in production.',
    },
  })
  assert(
    fullEvidenceRes.status === 200,
    `full evidence should return 200, got ${fullEvidenceRes.status} body=${JSON.stringify(fullEvidenceRes.body)}`
  )
  assert(
    fullEvidenceRes.body?.ok === true,
    `full evidence should return ok:true, got ${JSON.stringify(fullEvidenceRes.body)}`
  )
  console.log('  [4/6] POST /complete with full evidence → 200 ✓')

  // --- Scenario 5: requiresConsensus task, complete without approval → 409 ---
  await request('POST', '/api/tasks', {
    id: 'e2e-task-2',
    owner: 'claude',
    title: 'E2E consensus task',
    status: 'in_progress',
    requiresConsensus: true,
  })

  const noConsensusRes = await request('POST', '/api/tasks/e2e-task-2/complete', {
    evidence: {
      changedFiles: ['some-file'],
      verificationRuns: ['npm test'],
      risksNoted: ['none'],
      nextStep: 'follow-up',
    },
  })
  assert(
    noConsensusRes.status === 409,
    `requiresConsensus without approval should return 409, got ${noConsensusRes.status} body=${JSON.stringify(noConsensusRes.body)}`
  )
  assert(
    noConsensusRes.body?.error === 'hard-gate: consensus not approved',
    `expected consensus error string, got ${JSON.stringify(noConsensusRes.body)}`
  )
  console.log('  [5/6] requiresConsensus + no approval → 409 ✓')

  // --- Scenario 6: apply consensus approval, complete → 200 ---
  // CONSENSUS_APPROVAL_QUORUM defaults to 2; apply 2 approvals from different reviewers.
  await request('POST', '/api/tasks/e2e-task-2/consensus', {
    agentId: 'codex',
    decision: 'approved',
    summary: 'e2e test approval',
  })
  await request('POST', '/api/tasks/e2e-task-2/consensus', {
    agentId: 'qwen',
    decision: 'approved',
    summary: 'e2e test approval',
  })

  const approvedRes = await request('POST', '/api/tasks/e2e-task-2/complete', {
    evidence: {
      changedFiles: ['some-file'],
      verificationRuns: ['npm test'],
      risksNoted: ['none'],
      nextStep: 'follow-up',
    },
  })
  assert(
    approvedRes.status === 200,
    `consensus-approved task should complete with 200, got ${approvedRes.status} body=${JSON.stringify(approvedRes.body)}`
  )
  console.log('  [6/6] consensus approved + full evidence → 200 ✓')

  const stopCommand = registeredCommands.get('agentBridge.stop')
  if (stopCommand) stopCommand()

  console.log('hard-gate e2e: ok')
}

main().catch((err) => {
  console.error('hard-gate e2e FAILED:', err.message)
  const stopCommand = registeredCommands.get('agentBridge.stop')
  if (stopCommand) {
    try {
      stopCommand()
    } catch (_e) {
      /* ignore */
    }
  }
  process.exit(1)
})
