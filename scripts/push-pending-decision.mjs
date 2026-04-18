import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import {
  appendPendingDecision,
  getPendingDecisionsPath,
} from '../api/_lib/pending-decisions-store.js'

const VM_HOST = process.env.VM_HOST || 'chenkuichen@35.236.155.62'
const VM_PENDING_DECISIONS_PATH =
  process.env.VM_PENDING_DECISIONS_PATH
  || '/home/chenkuichen/app/coordination/llm-bus/pending-decisions.jsonl'
const SSH_KEY =
  process.env.GCE_SSH_KEY || path.join(process.env.HOME || '', '.ssh/google_compute_engine')

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return String(process.argv[index + 1] || '').trim()
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function required(name) {
  const value = readArg(name)
  if (!value) throw new Error(`Missing required arg: ${name}`)
  return value
}

function buildOptions() {
  return [
    { key: 'A', label: required('--optionA') },
    { key: 'B', label: required('--optionB') },
  ]
}

function syncToVm(localPath) {
  if (hasFlag('--skip-vm-sync')) {
    return { synced: false, reason: 'skip-vm-sync' }
  }
  if (!fs.existsSync(SSH_KEY)) {
    throw new Error(`SSH key not found: ${SSH_KEY}`)
  }

  const remoteDir = path.dirname(VM_PENDING_DECISIONS_PATH)
  execFileSync(
    'ssh',
    [
      '-i',
      SSH_KEY,
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'StrictHostKeyChecking=no',
      VM_HOST,
      `mkdir -p ${remoteDir}`,
    ],
    { stdio: 'inherit' },
  )
  execFileSync(
    'scp',
    [
      '-i',
      SSH_KEY,
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'StrictHostKeyChecking=no',
      localPath,
      `${VM_HOST}:${VM_PENDING_DECISIONS_PATH}`,
    ],
    { stdio: 'inherit' },
  )
  return { synced: true, remotePath: VM_PENDING_DECISIONS_PATH }
}

async function main() {
  const decision = await appendPendingDecision({
    id: required('--id'),
    question: required('--question'),
    options: buildOptions(),
    recommendation: readArg('--recommendation'),
    recommendationReason: readArg('--reason'),
    context: readArg('--context'),
    askedBy: readArg('--askedBy', 'claude'),
    deadlineSoft: readArg('--deadlineSoft'),
    nextExpectedDecisionAt: readArg('--nextExpectedDecisionAt'),
  })

  const localPath = getPendingDecisionsPath()
  const vmSync = syncToVm(localPath)
  console.log(
    JSON.stringify(
      {
        ok: true,
        localPath,
        vmSync,
        decision,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
