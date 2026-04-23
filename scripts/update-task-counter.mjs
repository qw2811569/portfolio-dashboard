import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(process.cwd())
const COUNTER_PATH = path.join(REPO_ROOT, '.tmp', 'portfolio-r8-loop', 'task-counter.json')
const DEFAULT_STATE = {
  counter: 0,
  lastSyncAt: null,
  lastSyncSha: null,
  tasksCompleted: [],
}
const DEFAULT_THRESHOLD = 5

function parseArgs(argv) {
  const options = {
    add: 0,
    threshold: DEFAULT_THRESHOLD,
    help: false,
    reset: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--reset') {
      options.reset = true
      continue
    }
    if (arg.startsWith('--add=')) {
      options.add = Number(arg.slice('--add='.length))
      continue
    }
    if (arg.startsWith('--threshold=')) {
      options.threshold = Number(arg.slice('--threshold='.length))
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(options.add) || options.add < 0) {
    throw new Error('--add must be a non-negative number')
  }
  if (!Number.isFinite(options.threshold) || options.threshold <= 0) {
    throw new Error('--threshold must be a positive number')
  }
  return options
}

function printHelp() {
  console.log(`Usage: node scripts/update-task-counter.mjs --add=<count> [--threshold=5]
       node scripts/update-task-counter.mjs --reset

When the counter reaches the threshold, this script runs:
  node scripts/sync-to-vm-root.mjs
and resets the counter back to 0 on success.`)
}

function ensureCounterDir() {
  mkdirSync(path.dirname(COUNTER_PATH), { recursive: true })
}

function readState() {
  ensureCounterDir()
  if (!existsSync(COUNTER_PATH)) return { ...DEFAULT_STATE }
  try {
    const parsed = JSON.parse(readFileSync(COUNTER_PATH, 'utf8'))
    return {
      counter: Number(parsed?.counter) || 0,
      lastSyncAt: parsed?.lastSyncAt || null,
      lastSyncSha: parsed?.lastSyncSha || null,
      tasksCompleted: Array.isArray(parsed?.tasksCompleted) ? parsed.tasksCompleted : [],
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function writeState(state) {
  ensureCounterDir()
  writeFileSync(COUNTER_PATH, `${JSON.stringify(state, null, 2)}\n`)
}

function gitSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim()
}

function runSync() {
  execFileSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'sync-to-vm-root.mjs')], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (options.reset) {
    const resetState = {
      counter: 0,
      lastSyncAt: new Date().toISOString(),
      lastSyncSha: gitSha(),
      tasksCompleted: [],
    }
    writeState(resetState)
    console.log(
      JSON.stringify(
        {
          ok: true,
          didSync: false,
          reset: true,
          threshold: options.threshold,
          ...resetState,
        },
        null,
        2
      )
    )
    return
  }

  const state = readState()
  state.counter += options.add

  let didSync = false
  if (state.counter >= options.threshold) {
    runSync()
    state.counter = 0
    state.lastSyncAt = new Date().toISOString()
    state.lastSyncSha = gitSha()
    didSync = true
  }

  writeState(state)
  console.log(
    JSON.stringify(
      {
        ok: true,
        didSync,
        threshold: options.threshold,
        ...state,
      },
      null,
      2
    )
  )
}

main()
