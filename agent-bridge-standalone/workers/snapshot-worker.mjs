import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { del, get, list, put } from '@vercel/blob'
import {
  appendBlobJsonLine,
  buildManifestFileRecord,
  DAILY_SNAPSHOT_COLD_RETENTION_DAYS,
  DAILY_SNAPSHOT_HOT_RETENTION_DAYS,
  DAILY_SNAPSHOT_SCHEMA_VERSION,
  DAILY_SNAPSHOT_STALE_AFTER_HOURS,
  DAILY_SNAPSHOT_TIMEZONE,
  extractPortfolioStateFromBackup,
  formatDailySnapshotDate,
  getDailySnapshotBrainPrefix,
  getDailySnapshotDatedMarkerKey,
  getDailySnapshotLocalStorageKey,
  getDailySnapshotLogKey,
  getDailySnapshotManifestKey,
  getDailySnapshotPortfolioStatePrefix,
  getDailySnapshotResearchPrefix,
  inferArtifactSchemaVersion,
  readBlobText,
} from '../../api/_lib/daily-snapshot.js'
import { getPrivateBlobToken } from '../../api/_lib/blob-tokens.js'
import { loadLocalEnvIfPresent } from '../../api/_lib/local-env.js'
import { markCronFailure, markCronSuccess } from '../../src/lib/cronLastSuccess.js'

const SNAPSHOT_JOB = 'daily-snapshot'
const SNAPSHOT_RETRY_LIMIT = 3
const RETRY_BASE_DELAY_MS = 1000
const ALERTS_RELATIVE_PATH = path.join('coordination', 'llm-bus', 'alerts.jsonl')
const LOCAL_STORAGE_CHECKPOINT_PATH = path.join('.tmp', 'localstorage-backups', 'latest.json')
const DATA_DIR = 'data'
const ANALYSIS_HISTORY_PREFIX = 'analysis-history/'

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function getBlobToken() {
  return getPrivateBlobToken()
}

function buildAlertPath(repoRoot) {
  return path.join(repoRoot, ALERTS_RELATIVE_PATH)
}

async function appendJsonLine(filePath, payload) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
  await fsPromises.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8')
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function retryAsync(
  label,
  fn,
  {
    attempts = SNAPSHOT_RETRY_LIMIT,
    baseDelayMs = RETRY_BASE_DELAY_MS,
    logger = console,
  } = {}
) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      logger.warn?.(
        `[snapshot-worker] ${label} failed on attempt ${attempt}/${attempts}:`,
        error
      )
      if (attempt >= attempts) break
      await sleep(baseDelayMs * 2 ** (attempt - 1))
    }
  }

  throw lastError || new Error(`${label} failed`)
}

async function readTextFile(targetPath) {
  return fsPromises.readFile(targetPath, 'utf8')
}

async function readJsonFile(targetPath) {
  return JSON.parse(await readTextFile(targetPath))
}

async function readBlobJson(pathname, { token, getImpl = get } = {}) {
  const text = await readBlobText(pathname, { token, getImpl })
  return text ? JSON.parse(text) : null
}

async function readRequiredJsonArtifact(
  localPath,
  blobPath,
  {
    token,
    getImpl = get,
  } = {}
) {
  try {
    return await readJsonFile(localPath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const payload = await readBlobJson(blobPath, { token, getImpl })
  if (payload == null) {
    throw new Error(`missing required artifact: ${localPath} / ${blobPath}`)
  }
  return payload
}

async function listAllBlobs(prefix, { token, listImpl = list } = {}) {
  const blobs = []
  let cursor

  do {
    const page = await listImpl({
      prefix,
      token,
      cursor,
      limit: 1000,
    })

    blobs.push(...(Array.isArray(page?.blobs) ? page.blobs : []))
    cursor = page?.cursor || null
  } while (cursor)

  return blobs
}

function analysisHistoryFileNameToPathname(fileName = '') {
  return String(fileName || '').replace(/__/g, '/')
}

function sha256Text(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

function inferJsonSchemaVersion(value, fallback = DAILY_SNAPSHOT_SCHEMA_VERSION) {
  const inferred = inferArtifactSchemaVersion(value)
  return inferred ?? fallback
}

async function loadAnalysisHistoryArtifacts(
  repoRoot,
  {
    token,
    listImpl = list,
    getImpl = get,
  } = {}
) {
  const dataDir = path.join(repoRoot, DATA_DIR)
  const artifacts = []

  try {
    const entries = await fsPromises.readdir(dataDir)
    for (const fileName of entries) {
      if (!fileName.startsWith('analysis-history__') || !fileName.endsWith('.json')) continue
      const pathname = analysisHistoryFileNameToPathname(fileName)
      artifacts.push({
        pathname,
        payload: await readJsonFile(path.join(dataDir, fileName)),
        source: `local:${path.join(DATA_DIR, fileName)}`,
      })
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  if (artifacts.length > 0) {
    return artifacts.sort((left, right) => left.pathname.localeCompare(right.pathname))
  }

  const blobs = await listAllBlobs(ANALYSIS_HISTORY_PREFIX, { token, listImpl })
  const remoteArtifacts = []
  for (const blob of blobs) {
    remoteArtifacts.push({
      pathname: blob.pathname,
      payload: await readBlobJson(blob.pathname, { token, getImpl }),
      source: `blob:${blob.pathname}`,
    })
  }

  return remoteArtifacts.sort((left, right) => left.pathname.localeCompare(right.pathname))
}

async function loadLocalStorageCheckpoint(repoRoot) {
  const checkpointPath = path.join(repoRoot, LOCAL_STORAGE_CHECKPOINT_PATH)
  const text = await readTextFile(checkpointPath)
  const payload = JSON.parse(text)
  return {
    checkpointPath,
    text,
    payload,
  }
}

function buildResearchArtifactRecords({
  snapshotDate,
  researchIndex,
  backupState,
}) {
  const prefix = getDailySnapshotResearchPrefix(snapshotDate)
  const records = [
    buildManifestFileRecord({
      pathname: `${prefix}/research-index.json`,
      content: researchIndex,
      schemaVersion: inferJsonSchemaVersion(researchIndex),
      source: 'canonical:research-index.json',
    }),
  ]

  for (const portfolioId of backupState.portfolioIds) {
    const storageKey = `pf-${portfolioId}-research-history-v1`
    records.push(
      buildManifestFileRecord({
        pathname: `${prefix}/portfolio-${portfolioId}-research-history.json`,
        content: backupState.storage[storageKey] || [],
        schemaVersion: backupState.global.schemaVersion || DAILY_SNAPSHOT_SCHEMA_VERSION,
        source: `backup:${storageKey}`,
      })
    )
  }

  return records
}

function buildBrainArtifactRecords({
  snapshotDate,
  strategyBrain,
  analysisHistoryIndex,
  analysisHistoryArtifacts,
}) {
  const prefix = getDailySnapshotBrainPrefix(snapshotDate)
  const records = [
    buildManifestFileRecord({
      pathname: `${prefix}/strategy-brain.json`,
      content: strategyBrain,
      schemaVersion: inferJsonSchemaVersion(strategyBrain),
      source: 'canonical:strategy-brain.json',
    }),
    buildManifestFileRecord({
      pathname: `${prefix}/analysis-history-index.json`,
      content: analysisHistoryIndex,
      schemaVersion: inferJsonSchemaVersion(analysisHistoryIndex),
      source: 'canonical:analysis-history-index.json',
    }),
  ]

  for (const artifact of analysisHistoryArtifacts) {
    const relativePath = artifact.pathname.replace(/^analysis-history\/?/, '')
    records.push(
      buildManifestFileRecord({
        pathname: `${prefix}/analysis-history/${relativePath}`,
        content: artifact.payload,
        schemaVersion: inferJsonSchemaVersion(artifact.payload),
        source: artifact.source,
      })
    )
  }

  return records
}

function buildPortfolioStateArtifactRecords({ snapshotDate, backupState }) {
  const prefix = getDailySnapshotPortfolioStatePrefix(snapshotDate)
  const records = []

  for (const portfolioId of backupState.portfolioIds) {
    const files = backupState.portfolios[portfolioId] || {}
    for (const [fileName, value] of Object.entries(files)) {
      records.push(
        buildManifestFileRecord({
          pathname: `${prefix}/${portfolioId}/${fileName}`,
          content: value,
          schemaVersion: backupState.global.schemaVersion || DAILY_SNAPSHOT_SCHEMA_VERSION,
          source: `backup:pf-${portfolioId}-${fileName.replace(/\.json$/, '')}`,
        })
      )
    }
  }

  return records
}

function buildLocalStorageArtifactRecord({
  snapshotDate,
  checkpointText,
  checkpointPayload,
  checkpointPath,
  repoRoot,
}) {
  return buildManifestFileRecord({
    pathname: getDailySnapshotLocalStorageKey(snapshotDate),
    content: checkpointText,
    schemaVersion: Number(checkpointPayload?.version || 0) || DAILY_SNAPSHOT_SCHEMA_VERSION,
    source: `local:${path.relative(repoRoot, checkpointPath)}`,
  })
}

function buildSnapshotManifest({
  snapshotDate,
  now,
  backupState,
  files,
  retention,
}) {
  return {
    schemaVersion: DAILY_SNAPSHOT_SCHEMA_VERSION,
    snapshotDate,
    generatedAt: new Date(now).toISOString(),
    timeZone: DAILY_SNAPSHOT_TIMEZONE,
    source: 'vm-worker',
    staleAfterHours: DAILY_SNAPSHOT_STALE_AFTER_HOURS,
    retention,
    portfolios: backupState.portfolioIds,
    counts: {
      totalFiles: files.length,
      researchFiles: files.filter((file) => file.pathname.startsWith(`snapshot/research/${snapshotDate}/`))
        .length,
      brainFiles: files.filter((file) => file.pathname.startsWith(`snapshot/brain/${snapshotDate}/`))
        .length,
      portfolioStateFiles: files.filter((file) =>
        file.pathname.startsWith(`snapshot/portfolio-state/${snapshotDate}/`)
      ).length,
      checkpointFiles: files.filter((file) => file.pathname === getDailySnapshotLocalStorageKey(snapshotDate))
        .length,
    },
    files: files.map(({ pathname, checksum, url, schemaVersion, sizeBytes, source, contentType }) => ({
      pathname,
      checksum,
      url,
      schemaVersion,
      sizeBytes,
      source,
      contentType,
    })),
  }
}

function parseDateFromPathname(pathname = '') {
  const normalized = String(pathname || '').trim()
  const match =
    normalized.match(/^snapshot\/(?:research|brain|portfolio-state)\/(\d{4}-\d{2}-\d{2})\//) ||
    normalized.match(/^snapshot\/(?:localStorage-checkpoint|daily-manifest)\/(\d{4}-\d{2}-\d{2})\.json$/) ||
    normalized.match(/^last-success\/daily-snapshot\/(\d{4}-\d{2}-\d{2})\.txt$/)
  return match ? match[1] : ''
}

function daysBetween(fromDate, toDate) {
  const from = Date.parse(`${String(fromDate || '').trim()}T00:00:00.000Z`)
  const to = Date.parse(`${String(toDate || '').trim()}T00:00:00.000Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
  return Math.floor((to - from) / (24 * 60 * 60 * 1000))
}

export async function purgeExpiredDailySnapshots({
  now = new Date(),
  token = getBlobToken(),
  keepDays = DAILY_SNAPSHOT_COLD_RETENTION_DAYS,
  listImpl = list,
  delImpl = del,
  logger = console,
  dryRun = false,
} = {}) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for daily snapshot retention')
  }

  const today = formatDailySnapshotDate(now)
  const prefixes = [
    'snapshot/research/',
    'snapshot/brain/',
    'snapshot/portfolio-state/',
    'snapshot/localStorage-checkpoint/',
    'snapshot/daily-manifest/',
    'last-success/daily-snapshot/',
  ]

  const candidates = []
  for (const prefix of prefixes) {
    const blobs = await listAllBlobs(prefix, { token, listImpl })
    for (const blob of blobs) {
      const snapshotDate = parseDateFromPathname(blob.pathname)
      if (!snapshotDate) continue
      if (daysBetween(snapshotDate, today) <= keepDays) continue
      candidates.push(blob.pathname)
    }
  }

  if (!dryRun && candidates.length > 0) {
    for (let index = 0; index < candidates.length; index += 100) {
      await delImpl(candidates.slice(index, index + 100), { token })
    }
  }

  if (candidates.length > 0) {
    logger.info?.(
      `[snapshot-worker] ${dryRun ? 'would purge' : 'purged'} ${candidates.length} daily snapshot artifact(s) older than ${keepDays} days`
    )
  }

  return {
    dryRun,
    keepDays,
    deletedCount: candidates.length,
    deletedPathnames: candidates,
  }
}

async function writeSnapshotArtifacts(records, { token, putImpl = put } = {}) {
  const written = []

  for (const record of records) {
    const result = await putImpl(record.pathname, record.content, {
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      access: 'private',
      contentType: record.contentType,
    })

    written.push({
      ...record,
      url: result?.url || null,
    })
  }

  return written
}

async function generateSnapshotBundle({
  now = new Date(),
  repoRoot = resolveRepoRoot(),
  token = getBlobToken(),
  listImpl = list,
  getImpl = get,
} = {}) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for daily snapshot worker')
  }

  const snapshotDate = formatDailySnapshotDate(now)
  const checkpoint = await loadLocalStorageCheckpoint(repoRoot)
  const backupState = extractPortfolioStateFromBackup(checkpoint.payload)
  const researchIndex = await readRequiredJsonArtifact(
    path.join(repoRoot, DATA_DIR, 'research-index.json'),
    'research-index.json',
    { token, getImpl }
  )
  const strategyBrain = await readRequiredJsonArtifact(
    path.join(repoRoot, DATA_DIR, 'strategy-brain.json'),
    'strategy-brain.json',
    { token, getImpl }
  )
  const analysisHistoryIndex = await readRequiredJsonArtifact(
    path.join(repoRoot, DATA_DIR, 'analysis-history-index.json'),
    'analysis-history-index.json',
    { token, getImpl }
  )
  const analysisHistoryArtifacts = await loadAnalysisHistoryArtifacts(repoRoot, {
    token,
    listImpl,
    getImpl,
  })

  const records = [
    ...buildResearchArtifactRecords({
      snapshotDate,
      researchIndex,
      backupState,
    }),
    ...buildBrainArtifactRecords({
      snapshotDate,
      strategyBrain,
      analysisHistoryIndex,
      analysisHistoryArtifacts,
    }),
    ...buildPortfolioStateArtifactRecords({
      snapshotDate,
      backupState,
    }),
    buildLocalStorageArtifactRecord({
      snapshotDate,
      checkpointText: checkpoint.text,
      checkpointPayload: checkpoint.payload,
      checkpointPath: checkpoint.checkpointPath,
      repoRoot,
    }),
  ]

  return {
    snapshotDate,
    backupState,
    records,
  }
}

function buildAlertPayload({ error, now, snapshotDate, attempts }) {
  return {
    ts: new Date(now).toISOString(),
    kind: SNAPSHOT_JOB,
    level: 'error',
    status: 'failed',
    snapshotDate: snapshotDate || formatDailySnapshotDate(now),
    attempts,
    error: error?.message || 'snapshot worker failed',
  }
}

export async function runSnapshotWorker({
  now = new Date(),
  repoRoot = resolveRepoRoot(),
  token = getBlobToken(),
  putImpl = put,
  getImpl = get,
  listImpl = list,
  delImpl = del,
  logger = console,
} = {}) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for daily snapshot worker')
  }

  const attemptState = { count: 0, snapshotDate: formatDailySnapshotDate(now) }

  try {
    const writtenRecords = await retryAsync(
      'daily snapshot',
      async (attempt) => {
        attemptState.count = attempt
        const bundle = await generateSnapshotBundle({
          now,
          repoRoot,
          token,
          listImpl,
          getImpl,
        })
        attemptState.snapshotDate = bundle.snapshotDate

        const writtenArtifacts = await writeSnapshotArtifacts(bundle.records, {
          token,
          putImpl,
        })
        const retention = await purgeExpiredDailySnapshots({
          now,
          token,
          listImpl,
          delImpl,
          logger,
        })
        const manifest = buildSnapshotManifest({
          snapshotDate: bundle.snapshotDate,
          now,
          backupState: bundle.backupState,
          files: writtenArtifacts,
          retention: {
            hotDays: DAILY_SNAPSHOT_HOT_RETENTION_DAYS,
            coldDays: DAILY_SNAPSHOT_COLD_RETENTION_DAYS,
            purgeAfterDays: DAILY_SNAPSHOT_COLD_RETENTION_DAYS,
            mode: 'manual-purge-script',
            deletedOnThisRun: retention.deletedCount,
          },
        })

        const manifestText = JSON.stringify(manifest, null, 2)
        const manifestResult = await putImpl(getDailySnapshotManifestKey(bundle.snapshotDate), manifestText, {
          token,
          addRandomSuffix: false,
          allowOverwrite: true,
          access: 'private',
          contentType: 'application/json',
        })

        const markerText = `${new Date(now).toISOString()}\n`
        await putImpl(getDailySnapshotDatedMarkerKey(bundle.snapshotDate), markerText, {
          token,
          addRandomSuffix: false,
          allowOverwrite: true,
          access: 'private',
          contentType: 'text/plain; charset=utf-8',
        })

        return {
          bundle,
          writtenArtifacts,
          manifest: {
            ...manifest,
            manifestKey: getDailySnapshotManifestKey(bundle.snapshotDate),
            manifestUrl: manifestResult?.url || null,
            manifestChecksum: sha256Text(manifestText),
          },
          retention,
        }
      },
      { attempts: SNAPSHOT_RETRY_LIMIT, logger }
    )

    await appendBlobJsonLine(
      getDailySnapshotLogKey(now),
      {
        ts: new Date(now).toISOString(),
        snapshotDate: writtenRecords.bundle.snapshotDate,
        status: 'success',
        attempts: attemptState.count,
        fileCount: writtenRecords.manifest.counts.totalFiles,
        manifestKey: writtenRecords.manifest.manifestKey,
        manifestChecksum: writtenRecords.manifest.manifestChecksum,
        retentionDeletedCount: writtenRecords.retention.deletedCount,
        portfolios: writtenRecords.bundle.backupState.portfolioIds,
      },
      { token, getImpl, putImpl }
    )

    await markCronSuccess(SNAPSHOT_JOB, {
      token,
      now,
      expectedCadence: 'daily',
      maxDayGap: 1,
      access: 'private',
      getImpl,
      listImpl,
      putImpl,
      logger,
    })

    logger.info?.(
      `[snapshot-worker] completed ${writtenRecords.bundle.snapshotDate} (${writtenRecords.manifest.counts.totalFiles} files)`
    )

    return {
      ok: true,
      snapshotDate: writtenRecords.bundle.snapshotDate,
      attempts: attemptState.count,
      manifestKey: writtenRecords.manifest.manifestKey,
      manifestUrl: writtenRecords.manifest.manifestUrl,
      fileCount: writtenRecords.manifest.counts.totalFiles,
      retentionDeletedCount: writtenRecords.retention.deletedCount,
    }
  } catch (error) {
    await markCronFailure(SNAPSHOT_JOB, {
      token,
      now,
      expectedCadence: 'daily',
      maxDayGap: 1,
      access: 'private',
      getImpl,
      listImpl,
      putImpl,
      logger,
      error,
    })

    await appendJsonLine(
      buildAlertPath(repoRoot),
      buildAlertPayload({
        error,
        now,
        snapshotDate: attemptState.snapshotDate,
        attempts: attemptState.count || SNAPSHOT_RETRY_LIMIT,
      })
    )

    throw error
  }
}

function parseCliArgs(argv = []) {
  const parsed = {}

  for (const arg of argv) {
    if (arg.startsWith('--date=')) parsed.date = arg.slice('--date='.length).trim()
    if (arg === '--retention-dry-run') parsed.retentionDryRun = true
  }

  return parsed
}

function resolveCliDate(value) {
  const normalized = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return new Date()
  return new Date(`${normalized}T03:00:00+08:00`)
}

async function main() {
  const repoRoot = resolveRepoRoot()
  loadLocalEnvIfPresent({ cwd: repoRoot })
  const args = parseCliArgs(process.argv.slice(2))

  try {
    if (args.retentionDryRun) {
      const result = await purgeExpiredDailySnapshots({
        now: resolveCliDate(args.date),
        repoRoot,
        dryRun: true,
      })
      console.log(JSON.stringify(result, null, 2))
      return
    }

    const result = await runSnapshotWorker({
      now: resolveCliDate(args.date),
      repoRoot,
      logger: console,
    })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('[snapshot-worker] fatal error:', error)
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
