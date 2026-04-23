import { execFileSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(process.cwd())
const HOME_DIR = process.env.HOME || ''
const SSH_KEY =
  process.env.GCE_SSH_KEY || path.join(HOME_DIR, '.ssh', 'google_compute_engine')
const VM_HOST = process.env.VM_HOST || 'chenkuichen@35.236.155.62'
const VM_APP_DIR = process.env.VM_APP_DIR || '/var/www/app'
const VM_ROOT_DIR = process.env.VM_ROOT_DIR || '/var/www/app/current/dist'
const ROOT_URL = process.env.VM_ROOT_URL || 'https://35.236.155.62.sslip.io/'
const DEFAULT_PROD_VERCEL_URL = 'https://jiucaivoice-dashboard.vercel.app'
const DEFAULT_PRESERVE_PATHS = ['portfolio-report']

function parseArgs(argv) {
  const options = {
    dryRun: false,
    backupDir: '',
    prodUrl: '',
    apiBaseUrl: '',
    vmRootDir: VM_ROOT_DIR,
    rootUrl: ROOT_URL,
    preserve: [...DEFAULT_PRESERVE_PATHS],
  }

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg.startsWith('--backup-dir=')) {
      options.backupDir = arg.slice('--backup-dir='.length).trim()
      continue
    }
    if (arg.startsWith('--prod-url=')) {
      options.prodUrl = arg.slice('--prod-url='.length).trim()
      continue
    }
    if (arg.startsWith('--api-base-url=')) {
      options.apiBaseUrl = arg.slice('--api-base-url='.length).trim()
      continue
    }
    if (arg.startsWith('--vm-root-dir=')) {
      options.vmRootDir = arg.slice('--vm-root-dir='.length).trim() || VM_ROOT_DIR
      continue
    }
    if (arg.startsWith('--root-url=')) {
      options.rootUrl = arg.slice('--root-url='.length).trim() || ROOT_URL
      continue
    }
    if (arg.startsWith('--preserve=')) {
      const next = arg
        .slice('--preserve='.length)
        .split(',')
        .map((value) => normalizePreservePath(value))
        .filter(Boolean)
      options.preserve = next.length > 0 ? next : [...DEFAULT_PRESERVE_PATHS]
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(`Usage: node scripts/sync-to-vm-root.mjs [options]

Options:
  --dry-run                  Build and inspect only. Do not backup or sync remote files.
  --backup-dir=<path>        Override remote backup path.
  --prod-url=<url>           Override PROD_VERCEL_URL resolution.
  --api-base-url=<url>       Override build-time VITE_API_BASE_URL.
  --vm-root-dir=<path>       Override remote nginx root dir. Default: ${VM_ROOT_DIR}
  --root-url=<url>           Override public root URL. Default: ${ROOT_URL}
  --preserve=a,b             Remote subpaths to preserve during rsync. Default: ${DEFAULT_PRESERVE_PATHS.join(',')}
`)
}

function normalizePreservePath(value = '') {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const result = {}
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/u)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u)
    if (!match) continue
    const [, key, rawValue] = match
    let value = rawValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function resolveProdUrl(options, envMap) {
  const candidates = [
    { value: options.prodUrl, source: 'cli' },
    { value: String(process.env.PROD_VERCEL_URL || '').trim(), source: 'process.env' },
    { value: String(envMap.PROD_VERCEL_URL || '').trim(), source: '.env.local' },
  ]

  for (const candidate of candidates) {
    if (candidate.value) return { url: candidate.value, source: candidate.source, warning: null }
  }

  return {
    url: DEFAULT_PROD_VERCEL_URL,
    source: 'default',
    warning: `PROD_VERCEL_URL missing in .env.local/process.env; using ${DEFAULT_PROD_VERCEL_URL}`,
  }
}

function resolveApiBaseUrl(options, prodUrl) {
  return (
    options.apiBaseUrl ||
    String(process.env.VITE_API_BASE_URL || '').trim() ||
    String(prodUrl || '').trim() ||
    DEFAULT_PROD_VERCEL_URL
  )
}

function timestampId(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/:/g, '')
  return `${fmt.replace(/-/g, '')}${parts}`
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`
}

function run(command, args, options = {}) {
  const { capture = false, input, env, cwd = REPO_ROOT, stdio } = options
  const defaultStdio = capture
    ? ['pipe', 'pipe', 'pipe']
    : input != null
      ? ['pipe', 'inherit', 'inherit']
      : 'inherit'
  const execOptions = {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: 'utf8',
    stdio: stdio || defaultStdio,
  }
  if (input != null) execOptions.input = input
  return execFileSync(command, args, execOptions)
}

function sshArgs(extraArgs = []) {
  return [
    '-i',
    SSH_KEY,
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'StrictHostKeyChecking=no',
    ...extraArgs,
    VM_HOST,
  ]
}

function runRemoteScript(script, options = {}) {
  return run('ssh', [...sshArgs(), 'bash -se'], {
    ...options,
    capture: options.capture ?? false,
    input: script,
  })
}

function readGitSha() {
  return run('git', ['rev-parse', '--short', 'HEAD'], { capture: true }).trim()
}

function buildBackupDir(overrideValue, stamp) {
  if (overrideValue) return overrideValue
  return `${VM_APP_DIR}/backup-before-r136-${stamp}`
}

function parseIndexInfo(html = '') {
  const mainAssetMatch = html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/u)
  const cssAssetMatch = html.match(/<link[^>]+href="(\/assets\/[^"]+\.css)"/u)
  const backgroundMatch = html.match(/body\s*\{\s*background:\s*var\(--app-bg,\s*([^)]+)\)\s*;/u)
  return {
    mainAsset: mainAssetMatch ? mainAssetMatch[1] : '',
    cssAsset: cssAssetMatch ? cssAssetMatch[1] : '',
    backgroundFallback: backgroundMatch ? backgroundMatch[1].trim() : '',
  }
}

function readLocalIndexInfo() {
  const html = readFileSync(path.join(REPO_ROOT, 'dist', 'index.html'), 'utf8')
  return { html, ...parseIndexInfo(html) }
}

function fileSizeBytes(targetPath) {
  const stat = statSync(targetPath)
  if (stat.isFile()) return stat.size
  if (!stat.isDirectory()) return 0
  return readdirSync(targetPath).reduce(
    (sum, entry) => sum + fileSizeBytes(path.join(targetPath, entry)),
    0
  )
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  const body = await response.text()
  return {
    url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

async function collectRemoteState(rootUrl) {
  const rootResponse = await fetchUrl(rootUrl)
  return {
    root: {
      status: rootResponse.status,
      ...parseIndexInfo(rootResponse.body),
      bodyLength: rootResponse.body.length,
      lastModified: rootResponse.headers['last-modified'] || '',
    },
  }
}

function ensurePrerequisites() {
  if (!existsSync(SSH_KEY)) {
    throw new Error(`SSH key not found: ${SSH_KEY}`)
  }
}

function buildLocalApp(apiBaseUrl) {
  console.log(`[sync-to-vm-root] npm run build (VITE_API_BASE_URL=${apiBaseUrl})`)
  run('npm', ['run', 'build'], {
    env: { VITE_API_BASE_URL: apiBaseUrl },
  })
}

function backupRemoteRoot({ backupDir, vmRootDir }) {
  console.log(`[sync-to-vm-root] remote backup -> ${backupDir}`)
  const script = `
set -euo pipefail
if ! sudo -n true >/dev/null 2>&1; then
  echo "sudo is required for remote backup into ${VM_APP_DIR}" >&2
  exit 1
fi
BACKUP_DIR=${shQuote(backupDir)}
VM_ROOT_DIR=${shQuote(vmRootDir)}
sudo rm -rf "$BACKUP_DIR"
sudo mkdir -p "$BACKUP_DIR"
if sudo sh -lc 'command -v rsync >/dev/null 2>&1'; then
  echo "[sync-to-vm-root] backup method: sudo rsync"
  sudo rsync -a "$VM_ROOT_DIR/" "$BACKUP_DIR/"
else
  echo "[sync-to-vm-root] backup method: sudo cp -a fallback"
  sudo cp -a "$VM_ROOT_DIR/." "$BACKUP_DIR/"
fi
`
  runRemoteScript(script)
  console.log('[sync-to-vm-root] remote backup complete')
}

function uploadDistToTmp(tmpDir) {
  console.log(`[sync-to-vm-root] upload dist -> ${tmpDir}`)
  runRemoteScript(
    `
set -euo pipefail
TMP_DIR=${shQuote(tmpDir)}
rm -rf "$TMP_DIR"
`
  )
  run('scp', [
    '-i',
    SSH_KEY,
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-r',
    path.join(REPO_ROOT, 'dist'),
    `${VM_HOST}:${tmpDir}`,
  ])
  console.log('[sync-to-vm-root] upload dist complete')
}

function syncRemoteDist({ tmpDir, vmRootDir, preservePaths }) {
  const normalized = preservePaths.map((value) => normalizePreservePath(value)).filter(Boolean)
  const excludeArgs = normalized
    .map((value) => `--exclude=${shQuote(`/${value}/`)}`)
    .join(' ')
  const preserveCase =
    normalized.length > 0
      ? normalized.map((value) => `/${value}/`).join('|')
      : ''

  console.log(`[sync-to-vm-root] sync remote dist -> ${vmRootDir}`)
  const script = `
set -euo pipefail
TMP_DIR=${shQuote(tmpDir)}
VM_ROOT_DIR=${shQuote(vmRootDir)}
preserve_match() {
  case "/$1/" in
    ${preserveCase || "''"}) return 0 ;;
    *) return 1 ;;
  esac
}
if command -v rsync >/dev/null 2>&1; then
  echo "[sync-to-vm-root] sync method: rsync"
  rsync -a --delete ${excludeArgs} "$TMP_DIR/" "$VM_ROOT_DIR/"
else
  echo "[sync-to-vm-root] sync method: cp -a fallback"
  find "$VM_ROOT_DIR" -mindepth 1 -maxdepth 1 | while IFS= read -r existing; do
    name=$(basename "$existing")
    if preserve_match "$name"; then
      continue
    fi
    rm -rf "$existing"
  done
  find "$TMP_DIR" -mindepth 1 -maxdepth 1 | while IFS= read -r incoming; do
    name=$(basename "$incoming")
    if preserve_match "$name"; then
      continue
    fi
    cp -a "$incoming" "$VM_ROOT_DIR/"
  done
fi
rm -rf /tmp/portfolio-sync-*
`
  runRemoteScript(script)
  console.log('[sync-to-vm-root] sync remote dist complete')
}

async function verifyRoutes(rootUrl, expectedMainAsset) {
  const urls = [
    { name: 'root', url: rootUrl, expectHash: true },
    { name: 'agentBridge', url: new URL('/agent-bridge/dashboard/', rootUrl).toString() },
    { name: 'portfolioReport', url: new URL('/portfolio-report/', rootUrl).toString() },
  ]

  const results = {}
  for (const entry of urls) {
    const response = await fetchUrl(entry.url)
    const includesHash = entry.expectHash ? response.body.includes(expectedMainAsset) : null
    results[entry.name] = {
      status: response.status,
      includesHash,
      bodyLength: response.body.length,
      lastModified: response.headers['last-modified'] || '',
    }
  }
  return results
}

async function main() {
  const startedAt = Date.now()
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  ensurePrerequisites()

  const envMap = loadEnvFile(path.join(REPO_ROOT, '.env.local'))
  const prodUrlResolution = resolveProdUrl(options, envMap)
  const apiBaseUrl = resolveApiBaseUrl(options, prodUrlResolution.url)
  const stamp = timestampId()
  const backupDir = buildBackupDir(options.backupDir, stamp)
  const tmpDir = `/tmp/portfolio-sync-${stamp}`
  const gitSha = readGitSha()

  const warnings = []
  if (prodUrlResolution.warning) warnings.push(prodUrlResolution.warning)

  const remoteBefore = await collectRemoteState(options.rootUrl)

  buildLocalApp(apiBaseUrl)
  const localIndex = readLocalIndexInfo()
  const distBytes = fileSizeBytes(path.join(REPO_ROOT, 'dist'))

  if (remoteBefore.root.mainAsset && remoteBefore.root.mainAsset === localIndex.mainAsset) {
    warnings.push(`remote root already references ${localIndex.mainAsset}`)
  }

  if (!options.dryRun) {
    backupRemoteRoot({ backupDir, vmRootDir: options.vmRootDir })
    uploadDistToTmp(tmpDir)
    syncRemoteDist({
      tmpDir,
      vmRootDir: options.vmRootDir,
      preservePaths: options.preserve,
    })
  }

  console.log('[sync-to-vm-root] verify live routes')
  const verify = await verifyRoutes(options.rootUrl, localIndex.mainAsset)
  if (!options.dryRun) {
    if (verify.root.status !== 200) {
      throw new Error(`root verify failed: HTTP ${verify.root.status}`)
    }
    if (!verify.root.includesHash) {
      throw new Error(`root verify failed: HTML missing expected asset ${localIndex.mainAsset}`)
    }
  }

  const summary = {
    ok: true,
    dryRun: options.dryRun,
    gitSha,
    prodUrl: prodUrlResolution.url,
    prodUrlSource: prodUrlResolution.source,
    apiBaseUrl,
    vmRootDir: options.vmRootDir,
    rootUrl: options.rootUrl,
    backupDir: options.dryRun ? null : backupDir,
    tmpDir: options.dryRun ? null : tmpDir,
    preservedPaths: options.preserve.map((value) => normalizePreservePath(value)).filter(Boolean),
    distSizeBytes: distBytes,
    distSizeHuman: formatBytes(distBytes),
    remoteBefore: remoteBefore.root,
    localBuild: {
      mainAsset: localIndex.mainAsset,
      cssAsset: localIndex.cssAsset,
      backgroundFallback: localIndex.backgroundFallback,
    },
    verify,
    durationMs: Date.now() - startedAt,
    syncedAt: new Date().toISOString(),
    warnings,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('[sync-to-vm-root] failed:', error?.message || error)
  process.exitCode = 1
})
