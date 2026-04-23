import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { get } from '@vercel/blob'
import {
  appendBlobJsonLine,
  formatYearMonth,
  getDailySnapshotManifestKey,
  getRestoreRehearsalLogKey,
  readBlobText,
  sha256Text,
} from '../api/_lib/daily-snapshot.js'
import { getPrivateBlobToken } from '../api/_lib/blob-tokens.js'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'

const SOURCE_REPO = process.cwd()
const HOME_DIR = process.env.HOME || os.homedir()
const LOCAL_STAGE_URL = String(process.env.RESTORE_REHEARSAL_STAGE_URL || 'http://127.0.0.1:3002').trim()

function resolveMonth(value = new Date()) {
  return formatYearMonth(value)
}

function timestamp(value = new Date()) {
  return new Date(value).toISOString()
}

function resolveDefaultRoot(month) {
  return path.join(HOME_DIR, 'restore-drills', month)
}

function parseArgs(argv = []) {
  const parsed = {
    month: resolveMonth(),
    verifier: String(process.env.RESTORE_REHEARSAL_VERIFIER || process.env.USER || 'owner').trim(),
    autoConfirm: String(process.env.RESTORE_REHEARSAL_AUTO_CONFIRM || '').trim() === '1',
    skipCleanup: String(process.env.RESTORE_REHEARSAL_SKIP_CLEANUP || '').trim() === '1',
    force: false,
    snapshotDate: '',
    rootDir: '',
  }

  for (const arg of argv) {
    if (arg === '--auto-confirm') parsed.autoConfirm = true
    else if (arg === '--skip-cleanup') parsed.skipCleanup = true
    else if (arg === '--force') parsed.force = true
    else if (arg.startsWith('--month=')) parsed.month = arg.slice('--month='.length).trim() || parsed.month
    else if (arg.startsWith('--verifier=')) parsed.verifier = arg.slice('--verifier='.length).trim() || parsed.verifier
    else if (arg.startsWith('--snapshot-date=')) parsed.snapshotDate = arg.slice('--snapshot-date='.length).trim()
    else if (arg.startsWith('--root-dir=')) parsed.rootDir = arg.slice('--root-dir='.length).trim()
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!/^\d{4}-\d{2}$/.test(parsed.month)) {
    throw new Error('month must be YYYY-MM')
  }

  return parsed
}

function runCommand(command, args, { cwd = SOURCE_REPO, env = {}, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const printable = [command, ...args].join(' ')
    const output = capture ? `\n${result.stdout || ''}${result.stderr || ''}` : ''
    throw new Error(`${printable} failed with exit code ${result.status ?? 'null'}${output}`)
  }

  return capture ? result.stdout.trim() : ''
}

function ensureDir(targetPath) {
  mkdirSync(targetPath, { recursive: true })
}

function appendLocalJsonl(targetPath, payload) {
  ensureDir(path.dirname(targetPath))
  writeFileSync(targetPath, `${JSON.stringify(payload)}\n`, { flag: 'a' })
}

async function readJsonBlob(pathname, token) {
  const text = await readBlobText(pathname, { token, getImpl: get })
  return text ? JSON.parse(text) : null
}

async function downloadBlob(pathname, targetPath, token) {
  const blobResult = await get(pathname, {
    access: 'private',
    token,
    useCache: false,
  })
  if (!blobResult?.stream) {
    throw new Error(`blob missing: ${pathname}`)
  }

  const text = await new Response(blobResult.stream).text()
  ensureDir(path.dirname(targetPath))
  writeFileSync(targetPath, text, 'utf8')
  return text
}

function loadState(statePath, defaults) {
  if (!existsSync(statePath)) return defaults
  try {
    return {
      ...defaults,
      ...JSON.parse(readFileSync(statePath, 'utf8')),
    }
  } catch {
    return defaults
  }
}

function saveState(statePath, state) {
  ensureDir(path.dirname(statePath))
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

async function promptOwner(message, { autoConfirm = false } = {}) {
  if (autoConfirm || !process.stdin.isTTY) return

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    await rl.question(`${message}\n按 Enter 繼續。`)
  } finally {
    rl.close()
  }
}

function copyIfExists(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) return false
  ensureDir(path.dirname(targetPath))
  cpSync(sourcePath, targetPath, { recursive: true })
  return true
}

function collectScreenshotPaths(evidenceDir) {
  if (!existsSync(evidenceDir)) return []
  return readdirSync(evidenceDir)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort()
    .map((name) => path.join(evidenceDir, name))
}

function toDataFileName(downloadRoot, filePath) {
  const relative = path.relative(downloadRoot, filePath)
  if (relative.endsWith('strategy-brain.json')) return 'strategy-brain.json'
  if (relative.endsWith('analysis-history-index.json')) return 'analysis-history-index.json'
  if (relative.endsWith('research-index.json')) return 'research-index.json'
  return relative
}

async function copySnapshotIntoStage({ downloadRoot, repoDir, snapshotDate }) {
  const sourceDataDir = path.join(downloadRoot, 'snapshot')
  const targetDataDir = path.join(repoDir, 'data')
  ensureDir(targetDataDir)

  const files = []

  function walk(dir) {
    const results = []
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) results.push(...walk(full))
      else results.push(full)
    }
    return results
  }

  for (const filePath of walk(sourceDataDir)) {
    const relative = path.relative(sourceDataDir, filePath)
    if (relative === `brain/${snapshotDate}/strategy-brain.json`) {
      cpSync(filePath, path.join(targetDataDir, 'strategy-brain.json'))
      files.push('data/strategy-brain.json')
    } else if (relative === `brain/${snapshotDate}/analysis-history-index.json`) {
      cpSync(filePath, path.join(targetDataDir, 'analysis-history-index.json'))
      files.push('data/analysis-history-index.json')
    } else if (relative.startsWith(`brain/${snapshotDate}/analysis-history/`)) {
      const nested = relative.replace(`brain/${snapshotDate}/analysis-history/`, 'analysis-history__')
      const targetName = nested.replace(/\//g, '__')
      cpSync(filePath, path.join(targetDataDir, targetName))
      files.push(`data/${targetName}`)
    } else if (relative === `research/${snapshotDate}/research-index.json`) {
      cpSync(filePath, path.join(targetDataDir, 'research-index.json'))
      files.push('data/research-index.json')
    } else if (relative === `portfolio-state/${snapshotDate}/me/holdings.json`) {
      cpSync(filePath, path.join(targetDataDir, 'holdings.json'))
      files.push('data/holdings.json')
    } else if (relative === `portfolio-state/${snapshotDate}/me/newsEvents.json`) {
      cpSync(filePath, path.join(targetDataDir, 'events.json'))
      files.push('data/events.json')
    }
  }

  return files
}

function buildDocEntry({
  month,
  verifier,
  stageSha,
  snapshotDate,
  checkpointPath,
  checksumPath,
  stepStatuses,
  elapsedMs,
  screenshotPaths,
  notes,
  followUp,
}) {
  const marker = `<!-- restore-rehearsal:${month} -->`
  const timestampLabel = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(',', '')

  const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000))

  return `${marker}
## ${timestampLabel} CST · monthly restore rehearsal

- date: ${month}
- verifier: ${verifier}
- git sha: ${stageSha}
- snapshot source: ${snapshotDate}
- localStorage checkpoint: ${checkpointPath}
- checksum manifest: ${checksumPath}
- step outcome: ${stepStatuses}
- elapsed: ${elapsedSeconds}s
- screenshots: ${screenshotPaths.length > 0 ? screenshotPaths.join(', ') : 'none'}
- verifier notes: ${notes || 'none'}
- follow-up: ${followUp || 'none'}
`
}

function upsertDocEntry(logPath, marker, entry) {
  const body = readFileSync(logPath, 'utf8')
  const pattern = new RegExp(`${marker}[\\s\\S]*?(?=\\n<!-- restore-rehearsal:|\\n## Entries|\\s*$)`, 'm')
  const updatedBody = pattern.test(body)
    ? body.replace(pattern, entry.trimEnd())
    : body.replace('## Entries', `## Entries\n\n${entry.trimEnd()}`)
  writeFileSync(logPath, updatedBody)
}

async function executeStep(state, stepId, label, task, { force = false, logContext }) {
  if (!force && state.steps?.[stepId]?.status === 'pass') {
    return state.steps[stepId].data
  }

  const startedAt = timestamp()
  try {
    const data = await task()
    state.steps[stepId] = {
      status: 'pass',
      label,
      startedAt,
      completedAt: timestamp(),
      data,
    }
    saveState(logContext.statePath, state)
    const payload = {
      ts: timestamp(),
      runId: state.runId,
      stepId,
      label,
      status: 'pass',
      data,
    }
    appendLocalJsonl(logContext.localLogPath, payload)
    await appendBlobJsonLine(logContext.remoteLogKey, payload, { token: logContext.token })
    return data
  } catch (error) {
    state.steps[stepId] = {
      status: 'fail',
      label,
      startedAt,
      completedAt: timestamp(),
      error: error?.message || String(error),
    }
    saveState(logContext.statePath, state)
    const payload = {
      ts: timestamp(),
      runId: state.runId,
      stepId,
      label,
      status: 'fail',
      error: error?.message || String(error),
    }
    appendLocalJsonl(logContext.localLogPath, payload)
    await appendBlobJsonLine(logContext.remoteLogKey, payload, { token: logContext.token })
    throw error
  }
}

async function main() {
  loadLocalEnvIfPresent({ cwd: SOURCE_REPO })
  const token = getPrivateBlobToken()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for restore rehearsal')
  }

  const args = parseArgs(process.argv.slice(2))
  const rootDir = args.rootDir || resolveDefaultRoot(args.month)
  const repoDir = path.join(rootDir, 'repo')
  const downloadDir = path.join(rootDir, 'download')
  const evidenceDir = path.join(rootDir, 'evidence')
  const statePath = path.join(rootDir, 'state.json')
  const localLogPath = path.join(evidenceDir, 'restore-rehearsal.jsonl')
  const remoteLogKey = getRestoreRehearsalLogKey(new Date(`${args.month}-01T10:00:00+08:00`))
  const defaults = {
    month: args.month,
    verifier: args.verifier,
    runId: `${args.month}-${Date.now().toString(36)}`,
    startedAt: timestamp(),
    rootDir,
    repoDir,
    downloadDir,
    evidenceDir,
    steps: {},
  }
  const state = loadState(statePath, defaults)
  const logContext = {
    statePath,
    localLogPath,
    remoteLogKey,
    token,
  }

  const startedAtMs = Date.now()

  await executeStep(
    state,
    '0',
    'preflight and staging isolation',
    async () => {
      ensureDir(rootDir)
      ensureDir(downloadDir)
      ensureDir(evidenceDir)
      if (!existsSync(repoDir)) {
        runCommand('git', ['worktree', 'add', repoDir, 'HEAD'])
      }
      const checkpointMirror = path.join(SOURCE_REPO, '.tmp', 'localstorage-backups', 'latest.json')
      if (!existsSync(checkpointMirror)) {
        throw new Error('missing .tmp/localstorage-backups/latest.json')
      }
      return {
        rootDir,
        repoDir,
        checkpointMirror,
      }
    },
    { force: args.force, logContext }
  )

  const selected = await executeStep(
    state,
    '1',
    'select latest daily snapshot manifest',
    async () => {
      if (args.snapshotDate) {
        const manifest = await readJsonBlob(getDailySnapshotManifestKey(args.snapshotDate), token)
        if (!manifest) {
          throw new Error(`snapshot manifest not found: ${args.snapshotDate}`)
        }
        state.snapshotDate = args.snapshotDate
        state.manifestKey = getDailySnapshotManifestKey(args.snapshotDate)
        return {
          snapshotDate: args.snapshotDate,
          manifestKey: state.manifestKey,
        }
      }

      const output = execFileSync(
        'node',
        [
          '--input-type=module',
          '-e',
          `
            import { list } from '@vercel/blob'
            const token = process.env.BLOB_READ_WRITE_TOKEN
            const page = await list({ prefix: 'snapshot/daily-manifest/', token, limit: 1000 })
            for (const blob of page.blobs || []) console.log(blob.pathname)
          `,
        ],
        {
          cwd: SOURCE_REPO,
          env: process.env,
          encoding: 'utf8',
        }
      )

      const dates = output
        .split(/\r?\n/u)
        .map((line) => {
          const match = line.match(/snapshot\/daily-manifest\/(\d{4}-\d{2}-\d{2})\.json$/)
          return match ? match[1] : ''
        })
        .filter(Boolean)
        .sort()

      const snapshotDate = dates.at(-1) || ''
      if (!snapshotDate) throw new Error('no snapshot manifests found')
      state.snapshotDate = snapshotDate
      state.manifestKey = getDailySnapshotManifestKey(snapshotDate)
      return {
        snapshotDate,
        manifestKey: state.manifestKey,
      }
    },
    { force: args.force, logContext }
  )

  const manifest = await executeStep(
    state,
    '2',
    'download snapshot artifacts into staging',
    async () => {
      rmSync(downloadDir, { recursive: true, force: true })
      ensureDir(downloadDir)

      const manifestPayload = await readJsonBlob(state.manifestKey, token)
      if (!manifestPayload) {
        throw new Error(`manifest missing: ${state.manifestKey}`)
      }

      const manifestTarget = path.join(downloadDir, state.manifestKey)
      ensureDir(path.dirname(manifestTarget))
      writeFileSync(manifestTarget, JSON.stringify(manifestPayload, null, 2), 'utf8')

      for (const file of manifestPayload.files || []) {
        await downloadBlob(file.pathname, path.join(downloadDir, file.pathname), token)
      }

      return {
        manifestPath: manifestTarget,
        fileCount: Array.isArray(manifestPayload.files) ? manifestPayload.files.length : 0,
      }
    },
    { force: args.force, logContext }
  )

  const verification = await executeStep(
    state,
    '3',
    'checksum and schema validation',
    async () => {
      const manifestPayload = JSON.parse(
        readFileSync(path.join(downloadDir, state.manifestKey), 'utf8')
      )
      const checksumLines = []

      for (const file of manifestPayload.files || []) {
        const targetPath = path.join(downloadDir, file.pathname)
        const text = readFileSync(targetPath, 'utf8')
        const checksum = sha256Text(text)
        if (checksum !== file.checksum) {
          throw new Error(`checksum mismatch for ${file.pathname}`)
        }
        JSON.parse(text)
        checksumLines.push(`${checksum}  ${file.pathname}`)
      }

      const checkpointPath = path.join(
        downloadDir,
        'snapshot',
        'localStorage-checkpoint',
        `${state.snapshotDate}.json`
      )
      const checkpointPayload = JSON.parse(readFileSync(checkpointPath, 'utf8'))
      if (String(checkpointPayload?.app || '').trim() !== 'portfolio-dashboard') {
        throw new Error('localStorage checkpoint app mismatch')
      }
      if (Number(checkpointPayload?.version || 0) !== 1) {
        throw new Error('localStorage checkpoint version mismatch')
      }
      if (!Number.isFinite(Number(checkpointPayload?.storage?.['pf-schema-version']))) {
        throw new Error('localStorage checkpoint missing pf-schema-version')
      }

      const checksumPath = path.join(evidenceDir, 'checksums.sha256')
      ensureDir(path.dirname(checksumPath))
      writeFileSync(checksumPath, `${checksumLines.join('\n')}\n`, 'utf8')
      state.checksumPath = checksumPath
      return {
        checksumPath,
        validatedFiles: checksumLines.length,
      }
    },
    { force: args.force, logContext }
  )

  await executeStep(
    state,
    '4',
    'apply snapshot into staging and wait for owner import',
    async () => {
      const copiedFiles = await copySnapshotIntoStage({
        downloadRoot: downloadDir,
        repoDir,
        snapshotDate: state.snapshotDate,
      })

      runCommand('bash', ['scripts/redeploy-local.sh'], { cwd: repoDir })

      const checkpointPath = path.join(
        downloadDir,
        'snapshot',
        'localStorage-checkpoint',
        `${state.snapshotDate}.json`
      )
      await promptOwner(
        [
          `請在 staging app 匯入 checkpoint：${checkpointPath}`,
          `staging URL：${LOCAL_STAGE_URL}`,
          '建議確認 active portfolio、notes、trade log、news events 都已載回。',
        ].join('\n'),
        { autoConfirm: args.autoConfirm }
      )

      return {
        copiedFiles,
        checkpointPath,
        stagingUrl: LOCAL_STAGE_URL,
      }
    },
    { force: args.force, logContext }
  )

  await executeStep(
    state,
    '5',
    'run staging full-smoke',
    async () => {
      runCommand('node', ['scripts/full-smoke.mjs'], {
        cwd: repoDir,
        env: {
          FULL_SMOKE_SKIP_REMOTE_CHECKS: '1',
          FULL_SMOKE_LOCAL_URL: LOCAL_STAGE_URL,
          PORTFOLIO_BASE_URL: `${LOCAL_STAGE_URL.replace(/\/$/, '')}/`,
        },
      })

      return {
        fullSmoke: 'passed',
      }
    },
    { force: args.force, logContext }
  )

  await executeStep(
    state,
    '6',
    'manual ui verification',
    async () => {
      runCommand('curl', ['-sI', LOCAL_STAGE_URL])
      await promptOwner(
        [
          '請再看一次 staging UI：持倉 / 研究 / 收盤分析 / 金聯成合規語氣。',
          `URL：${LOCAL_STAGE_URL}`,
        ].join('\n'),
        { autoConfirm: args.autoConfirm }
      )

      return {
        stagingUrl: LOCAL_STAGE_URL,
      }
    },
    { force: args.force, logContext }
  )

  await executeStep(
    state,
    '7',
    'persist evidence and upsert restore drill log',
    async () => {
      const persistentDir = path.join(SOURCE_REPO, 'docs', 'qa', `restore-rehearsal-${args.month}`)
      ensureDir(persistentDir)

      const persistentChecksums = path.join(persistentDir, 'checksums.sha256')
      copyIfExists(state.checksumPath, persistentChecksums)

      const persistentManifest = path.join(persistentDir, 'daily-manifest.json')
      copyIfExists(path.join(downloadDir, state.manifestKey), persistentManifest)

      const checkpointSourcePath = path.join(
        downloadDir,
        'snapshot',
        'localStorage-checkpoint',
        `${state.snapshotDate}.json`
      )
      const persistentCheckpoint = path.join(persistentDir, 'localStorage-checkpoint.json')
      copyIfExists(checkpointSourcePath, persistentCheckpoint)

      const localStepLogSource = localLogPath
      const persistentStepLog = path.join(persistentDir, 'restore-rehearsal.jsonl')
      copyIfExists(localStepLogSource, persistentStepLog)

      const screenshotSourceDir = path.join(repoDir, '.playwright-artifacts', 'evidence')
      const screenshotTargetDir = path.join(persistentDir, 'screenshots')
      if (existsSync(screenshotTargetDir)) rmSync(screenshotTargetDir, { recursive: true, force: true })
      copyIfExists(screenshotSourceDir, screenshotTargetDir)

      const reportSourceDir = path.join(repoDir, 'docs', 'qa')
      const reportTargetDir = path.join(persistentDir, 'playwright-report')
      if (existsSync(reportTargetDir)) rmSync(reportTargetDir, { recursive: true, force: true })
      const reportCandidates = existsSync(reportSourceDir)
        ? readdirSync(reportSourceDir)
            .filter((name) => name.startsWith('playwright-report-'))
            .sort()
        : []
      const latestReport = reportCandidates.at(-1)
      if (latestReport) {
        copyIfExists(path.join(reportSourceDir, latestReport), reportTargetDir)
      }

      const screenshotPaths = collectScreenshotPaths(screenshotTargetDir).map((value) =>
        path.relative(SOURCE_REPO, value)
      )
      const stageSha = runCommand('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoDir, capture: true })
      const stepStatuses = Object.entries(state.steps)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([stepId, step]) => `Step${stepId}=${step.status}`)
        .join('; ')

      const docLogPath = path.join(SOURCE_REPO, 'docs', 'runbooks', 'restore-drill-log.md')
      const marker = `<!-- restore-rehearsal:${args.month} -->`
      const entry = buildDocEntry({
        month: args.month,
        verifier: args.verifier,
        stageSha,
        snapshotDate: state.snapshotDate,
        checkpointPath: path.relative(SOURCE_REPO, persistentCheckpoint),
        checksumPath: path.relative(SOURCE_REPO, persistentChecksums),
        stepStatuses,
        elapsedMs: Date.now() - startedAtMs,
        screenshotPaths,
        notes: 'manual restore import completed in staging',
        followUp: 'none',
      })
      upsertDocEntry(docLogPath, marker, entry)

      return {
        persistentDir,
        screenshotCount: screenshotPaths.length,
      }
    },
    { force: args.force, logContext }
  )

  await executeStep(
    state,
    '8',
    'cleanup staging worktree',
    async () => {
      if (args.skipCleanup) {
        return {
          skipped: true,
          rootDir,
        }
      }

      runCommand('git', ['worktree', 'remove', repoDir, '--force'])
      rmSync(rootDir, { recursive: true, force: true })

      return {
        cleaned: true,
      }
    },
    { force: args.force, logContext }
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        month: args.month,
        snapshotDate: state.snapshotDate,
        checksumPath: state.checksumPath,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[restore-rehearsal] failed:', error)
  process.exitCode = 1
})
