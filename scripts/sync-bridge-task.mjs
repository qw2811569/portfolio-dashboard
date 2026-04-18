#!/usr/bin/env node
// Usage: node scripts/sync-bridge-task.mjs <task-id> <status> [evidence-json]
// Example: node scripts/sync-bridge-task.mjs r121-T46 done '{"changedFiles":["api/_lib/auth-middleware.js"]}'
// Updates local agent-bridge-standalone/data/tasks.json + SCPs to VM + restarts pm2 agent-bridge
// Call after mark-todo-done.mjs to keep Agent Bridge dashboard in sync.

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const [, , taskId, statusArg, evidenceJson] = process.argv

if (!taskId || !statusArg) {
  console.error('Usage: node scripts/sync-bridge-task.mjs <task-id> <status> [evidence-json]')
  process.exit(1)
}

const VALID_STATUS = ['in-progress', 'done', 'blocked', 'rollback', 'pending']
if (!VALID_STATUS.includes(statusArg)) {
  console.error(`status must be one of: ${VALID_STATUS.join(', ')}`)
  process.exit(1)
}

const tasksPath = path.resolve(process.cwd(), 'agent-bridge-standalone/data/tasks.json')
const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'))

if (!tasks[taskId]) {
  // auto-create if missing
  tasks[taskId] = {
    id: taskId,
    owner: 'codex',
    requiresConsensus: false,
    consensusReviews: [],
    title: taskId,
    lane: 'autonomous',
    status: 'in-progress',
    priority: 'medium',
    dependsOn: [],
    writeScope: [],
    sourcePlanRef: 'docs/portfolio-spec-report/todo.md',
    summary: `Autonomous task ${taskId}`,
    dispatchPrompt: '',
    assignedSessionId: 'autonomous',
    lastDispatchedAt: Date.now(),
    dispatchCount: 1,
    evidence: { changedFiles: [], verificationRuns: [], risksNoted: [], nextStep: '' },
    completedAt: null,
    consensusState: 'none',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

const now = Date.now()
const t = tasks[taskId]
t.status = statusArg
t.updatedAt = now
if (statusArg === 'done') {
  t.completedAt = now
}

if (evidenceJson) {
  try {
    const ev = JSON.parse(evidenceJson)
    t.evidence = { ...t.evidence, ...ev }
  } catch (e) {
    console.warn('evidence JSON parse failed · skipped')
  }
}

fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2) + '\n')
console.log(`local tasks.json updated · ${taskId} → ${statusArg}`)

// SCP to VM
try {
  const SSH_KEY = process.env.GCE_SSH_KEY || `${process.env.HOME}/.ssh/google_compute_engine`
  const VM_HOST = process.env.VM_HOST || 'chenkuichen@35.236.155.62'
  const VM_PATH = process.env.VM_TASKS_PATH || '/home/chenkuichen/app/agent-bridge-standalone/data/tasks.json'
  execSync(
    `scp -q -i ${SSH_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=no ${tasksPath} ${VM_HOST}:${VM_PATH}`,
    { stdio: 'inherit' }
  )
  console.log('scp ok · VM synced')
  // Bridge auto-reloads tasks.json on file change · no pm2 restart needed for data-only update
} catch (e) {
  console.error('VM sync failed:', e.message)
  console.error('Local update saved · fix VM sync and retry · or manually scp')
  process.exit(2)
}
