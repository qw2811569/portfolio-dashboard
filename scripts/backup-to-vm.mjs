import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const REPO_ROOT = path.resolve(process.cwd())
// Default points to jcv-dev (your dev VM · 104.199.144.170 · 2026-04-28).
// Override with VM_HOST=chenkuichen@35.236.155.62 to back up to bigstock (partner dev VM).
const VM_HOST = process.env.VM_HOST || 'chenkuichen@104.199.144.170'
const VM_BACKUP_DIR = process.env.VM_BACKUP_DIR || '/home/chenkuichen/portfolio-backups'
const SSH_KEY =
  process.env.GCE_SSH_KEY || path.join(process.env.HOME || '', '.ssh/google_compute_engine')
const LOCAL_MIRROR_DIR = path.join(REPO_ROOT, '.tmp', 'localstorage-backups')

function formatTaipeiDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function ensureDirectory(target) {
  if (!existsSync(target)) mkdirSync(target, { recursive: true })
}

function findLatestExportInDownloads() {
  const downloadsDir = path.join(process.env.HOME || '', 'Downloads')
  if (!existsSync(downloadsDir)) return ''

  const matches = readdirSync(downloadsDir)
    .filter((name) => /^portfolio-backup-\d{4}-\d{2}-\d{2}\.json$/u.test(name))
    .map((name) => path.join(downloadsDir, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)

  return matches[0] || ''
}

function pickInputPath() {
  const explicit = process.argv.slice(2).find((value) => value && !value.startsWith('--'))
  const envPath = String(process.env.PORTFOLIO_BACKUP_EXPORT || '').trim()
  const fallback = findLatestExportInDownloads()
  const candidates = [explicit, envPath, fallback].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    '找不到 localStorage 匯出 JSON。請先在 app 內執行「備份 / 匯出」，或用 `node scripts/backup-to-vm.mjs /path/to/portfolio-backup-YYYY-MM-DD.json` 指定檔案。'
  )
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('備份 JSON 格式錯誤：payload 必須是 object')
  }
  if (String(payload.app || '').trim() !== 'portfolio-dashboard') {
    throw new Error('備份 JSON 格式錯誤：app 必須是 portfolio-dashboard')
  }
  if (Number(payload.version || 0) !== 1) {
    throw new Error(`備份 JSON 版本不支援：${payload.version ?? 'unknown'}`)
  }

  const storage =
    payload.storage && typeof payload.storage === 'object' && !Array.isArray(payload.storage)
      ? payload.storage
      : null
  if (!storage) {
    throw new Error('備份 JSON 缺少 storage object')
  }

  const hasPortfolioKeys = Object.keys(storage).some(
    (key) => key === 'portfolios' || key === 'activePortfolioId' || key.startsWith('pf-')
  )
  if (!hasPortfolioKeys) {
    throw new Error('備份 JSON 不含任何 portfolio localStorage keys')
  }
}

function buildRemoteTargetPath(payload = {}) {
  const exportedAt = String(payload.exportedAt || '').trim()
  const date = /^\d{4}-\d{2}-\d{2}/.test(exportedAt)
    ? exportedAt.slice(0, 10)
    : formatTaipeiDate()
  return `${VM_BACKUP_DIR}/${date}.json`
}

function mirrorBackupLocally(sourcePath, payload = {}) {
  ensureDirectory(LOCAL_MIRROR_DIR)
  const exportedAt = String(payload.exportedAt || '').trim()
  const fileDate = /^\d{4}-\d{2}-\d{2}/.test(exportedAt) ? exportedAt.slice(0, 10) : formatTaipeiDate()
  const datedPath = path.join(LOCAL_MIRROR_DIR, `${fileDate}.json`)
  const latestPath = path.join(LOCAL_MIRROR_DIR, 'latest.json')
  copyFileSync(sourcePath, datedPath)
  copyFileSync(sourcePath, latestPath)
  return { datedPath, latestPath }
}

function ensureVmDirectory() {
  if (!existsSync(SSH_KEY)) {
    throw new Error(`SSH key not found: ${SSH_KEY}`)
  }

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
      `mkdir -p ${VM_BACKUP_DIR}`,
    ],
    { stdio: 'inherit' }
  )
}

function scpBackupToVm(localPath, remotePath) {
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
      `${VM_HOST}:${remotePath}`,
    ],
    { stdio: 'inherit' }
  )
}

function main() {
  const inputPath = pickInputPath()
  const payload = JSON.parse(readFileSync(inputPath, 'utf8'))
  validateBackupPayload(payload)

  const remotePath = buildRemoteTargetPath(payload)
  const { datedPath, latestPath } = mirrorBackupLocally(inputPath, payload)
  ensureVmDirectory()
  scpBackupToVm(inputPath, remotePath)

  const summary = {
    ok: true,
    inputPath,
    datedPath,
    latestPath,
    remotePath,
    exportedAt: payload.exportedAt || null,
    backedUpAt: new Date().toISOString(),
  }

  writeFileSync(path.join(LOCAL_MIRROR_DIR, 'latest.meta.json'), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

main()
