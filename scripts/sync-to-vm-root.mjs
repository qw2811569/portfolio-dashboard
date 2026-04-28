import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const REPO_ROOT = path.resolve(process.cwd())
const HOME_DIR = process.env.HOME || ''
const SSH_KEY =
  process.env.GCE_SSH_KEY || path.join(HOME_DIR, '.ssh', 'google_compute_engine')
// Default points to jcv-dev (your dev VM · 104.199.144.170 · 2026-04-28).
// Override with env vars to target bigstock (partner dev VM · 35.236.155.62) — see memory/project_vm_ip_migration_2026_04_25.md.
const VM_HOST = process.env.VM_HOST || 'chenkuichen@104.199.144.170'
const VM_APP_DIR = process.env.VM_APP_DIR || '/home/chenkuichen/app'
const VM_ROOT_DIR = process.env.VM_ROOT_DIR || '/home/chenkuichen/app/portfolio-dashboard/dist'
const ROOT_URL = process.env.VM_ROOT_URL || 'http://104.199.144.170/'
// Vercel cold backup URL retained for the legacy --mirror-vercel flag (rarely used post-disconnect 2026-04-28).
const DEFAULT_PROD_VERCEL_URL = 'https://jiucaivoice-dashboard.vercel.app'
const DEFAULT_PRESERVE_PATHS = ['portfolio-report']
const LOCAL_DIST_DIR = path.join(REPO_ROOT, 'dist')
const MIRROR_DIST_DIR = path.join(REPO_ROOT, 'dist-from-vercel')
const NO_CACHE_HEADERS = {
  'cache-control': 'no-cache',
  pragma: 'no-cache',
}
const MIRRORABLE_EXTENSIONS = new Set([
  '.avif',
  '.css',
  '.eot',
  '.gif',
  '.html',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.mjs',
  '.otf',
  '.png',
  '.svg',
  '.ttf',
  '.txt',
  '.wasm',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2',
])
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs', '.txt', '.webmanifest'])
const PARSEABLE_EXTENSIONS = new Set(['.css', '.html', '.js', '.mjs'])
const URL_ATTRIBUTE_PATTERN = /\b(?:src|href|poster|content)\s*=\s*["']([^"'<>]+)["']/giu
const SRCSET_PATTERN = /\bsrcset\s*=\s*["']([^"']+)["']/giu
const CSS_URL_PATTERN = /url\(([^)]+)\)/giu
const GENERIC_STRING_PATTERN = /["'`]([^"'`\r\n]+)["'`]/gu

/**
 * Default mode:
 *   local build -> dist/ -> VM root
 *
 * Emergency mode:
 *   --mirror-vercel -> fetch production Vercel assets into dist-from-vercel/ -> VM root
 *
 * Daily use stays on the default local-build path. The Vercel mirror is only for
 * hash-drift recovery when VM root must match production immediately.
 */

function parseArgs(argv) {
  const options = {
    dryRun: false,
    mirrorVercel: false,
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
    if (arg === '--mirror-vercel') {
      options.mirrorVercel = true
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

Modes:
  default                   Build locally into dist/ and sync that output to VM root.
  --mirror-vercel           Emergency mode: mirror Vercel production into dist-from-vercel/
                            and sync that output to VM root. Default mode stays unchanged.

Options:
  --dry-run                  Build/mirror and inspect only. Do not backup or sync remote files.
  --mirror-vercel            Fetch Vercel production assets instead of running local build.
  --backup-dir=<path>        Override remote backup path.
  --prod-url=<url>           Override production Vercel URL resolution.
  --api-base-url=<url>       Override build-time VITE_API_BASE_URL (default mode only).
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

function readIndexInfoFromDir(dirPath) {
  const html = readFileSync(path.join(dirPath, 'index.html'), 'utf8')
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

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function ensureCleanDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true })
  mkdirSync(dirPath, { recursive: true })
}

function writeBuffer(targetPath, buffer) {
  mkdirSync(path.dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, buffer)
}

function normalizeUrlCandidate(value = '') {
  return String(value || '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
}

function looksLikeMirrorUrlCandidate(value = '', { allowBareRelative = true } = {}) {
  const candidate = normalizeUrlCandidate(value)
  if (!candidate) return false
  if (candidate.includes('${')) return false
  if (
    candidate.startsWith('#') ||
    candidate.startsWith('blob:') ||
    candidate.startsWith('data:') ||
    candidate.startsWith('javascript:') ||
    candidate.startsWith('mailto:') ||
    candidate.startsWith('tel:')
  ) {
    return false
  }

  if (
    !allowBareRelative &&
    !/^https?:\/\//iu.test(candidate) &&
    !candidate.startsWith('/') &&
    !candidate.startsWith('./') &&
    !candidate.startsWith('../')
  ) {
    return false
  }

  return (
    /^https?:\/\//iu.test(candidate) ||
    candidate.startsWith('/') ||
    candidate.startsWith('./') ||
    candidate.startsWith('../') ||
    /\.(?:avif|css|eot|gif|html|ico|jpeg|jpg|js|json|mjs|otf|png|svg|ttf|txt|wasm|webmanifest|webp|woff|woff2)(?:[?#]|$)/iu.test(
      candidate
    )
  )
}

function shouldMirrorResolvedUrl(candidateUrl, origin, blockedPrefixes = []) {
  if (candidateUrl.origin !== origin) return false
  const pathname = candidateUrl.pathname || '/'
  if (!pathname || pathname === '/' || pathname.endsWith('/')) return false
  if (blockedPrefixes.some((prefix) => pathname.startsWith(prefix))) return false
  const extension = path.posix.extname(pathname).toLowerCase()
  return MIRRORABLE_EXTENSIONS.has(extension)
}

function shouldTreatAsText(pathname, contentType = '') {
  const normalized = String(contentType || '').toLowerCase()
  const extension = path.posix.extname(pathname || '').toLowerCase()
  return (
    normalized.startsWith('text/') ||
    normalized.includes('javascript') ||
    normalized.includes('json') ||
    normalized.includes('xml') ||
    TEXT_EXTENSIONS.has(extension)
  )
}

function shouldParseDependencies(pathname, contentType = '') {
  const normalized = String(contentType || '').toLowerCase()
  const extension = path.posix.extname(pathname || '').toLowerCase()
  return (
    normalized.startsWith('text/html') ||
    normalized.startsWith('text/css') ||
    normalized.includes('javascript') ||
    PARSEABLE_EXTENSIONS.has(extension)
  )
}

function relativeMirrorPathFromUrl(url, { rootEntry = false } = {}) {
  if (rootEntry) return 'index.html'
  const pathname = url.pathname || '/'
  const normalized = pathname.replace(/^\/+/u, '')
  return normalized || 'index.html'
}

function extractMirrorAssetUrls(text, parentUrl, blockedPrefixes = []) {
  const rawCandidates = new Set()
  const pushRaw = (value, options = {}) => {
    const normalized = normalizeUrlCandidate(value)
    if (!looksLikeMirrorUrlCandidate(normalized, options)) return
    rawCandidates.add(normalized)
  }

  for (const match of text.matchAll(URL_ATTRIBUTE_PATTERN)) {
    pushRaw(match[1], { allowBareRelative: true })
  }

  for (const match of text.matchAll(SRCSET_PATTERN)) {
    const entries = match[1].split(',')
    for (const entry of entries) {
      const [candidate] = entry.trim().split(/\s+/u)
      pushRaw(candidate, { allowBareRelative: true })
    }
  }

  for (const match of text.matchAll(CSS_URL_PATTERN)) {
    pushRaw(match[1], { allowBareRelative: true })
  }

  for (const match of text.matchAll(GENERIC_STRING_PATTERN)) {
    pushRaw(match[1], { allowBareRelative: false })
  }

  const resolved = new Set()
  for (const raw of rawCandidates) {
    try {
      const nextUrl = new URL(raw, parentUrl)
      nextUrl.hash = ''
      if (!shouldMirrorResolvedUrl(nextUrl, parentUrl.origin, blockedPrefixes)) continue
      resolved.add(nextUrl.toString())
    } catch {
      continue
    }
  }

  return Array.from(resolved).sort()
}

async function fetchUrl(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: NO_CACHE_HEADERS,
  })
  const body = await response.text()
  return {
    url: response.url || url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

async function fetchUrlBuffer(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: NO_CACHE_HEADERS,
  })
  const body = Buffer.from(await response.arrayBuffer())
  return {
    url: response.url || url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

async function collectRemoteState(rootUrl, fetchImpl = fetch) {
  const rootResponse = await fetchUrl(rootUrl, fetchImpl)
  return {
    root: {
      status: rootResponse.status,
      ...parseIndexInfo(rootResponse.body),
      bodyLength: rootResponse.body.length,
      lastModified: rootResponse.headers['last-modified'] || '',
    },
  }
}

function ensurePrerequisites({ dryRun }) {
  if (!dryRun && !existsSync(SSH_KEY)) {
    throw new Error(`SSH key not found: ${SSH_KEY}`)
  }
}

function buildLocalApp(apiBaseUrl) {
  console.log(`[sync-to-vm-root] npm run build (VITE_API_BASE_URL=${apiBaseUrl})`)
  run('npm', ['run', 'build'], {
    env: { VITE_API_BASE_URL: apiBaseUrl },
  })
}

async function buildVercelMirror({
  prodUrl,
  outputDir = MIRROR_DIST_DIR,
  preservePaths = DEFAULT_PRESERVE_PATHS,
  fetchImpl = fetch,
}) {
  const blockedPrefixes = [
    '/api/',
    '/agent-bridge/',
    ...preservePaths.map((value) => `/${normalizePreservePath(value)}/`).filter(Boolean),
  ]

  ensureCleanDir(outputDir)

  const rootResponse = await fetchUrlBuffer(prodUrl, fetchImpl)
  if (rootResponse.status !== 200) {
    throw new Error(`mirror root fetch failed: ${prodUrl} -> HTTP ${rootResponse.status}`)
  }

  const rootPageUrl = new URL(rootResponse.url || prodUrl)
  const rootHtml = rootResponse.body.toString('utf8')
  writeBuffer(path.join(outputDir, 'index.html'), rootResponse.body)

  const visited = new Set()
  const queue = extractMirrorAssetUrls(rootHtml, rootPageUrl, blockedPrefixes)
  const downloadedFiles = [
    {
      url: rootPageUrl.toString(),
      relativePath: 'index.html',
      bytes: rootResponse.body.length,
      sha256: sha256Hex(rootResponse.body),
      contentType: rootResponse.headers['content-type'] || '',
    },
  ]

  while (queue.length > 0) {
    const nextUrl = queue.shift()
    if (!nextUrl || visited.has(nextUrl)) continue
    visited.add(nextUrl)

    const response = await fetchUrlBuffer(nextUrl, fetchImpl)
    if (response.status !== 200) {
      throw new Error(`mirror asset fetch failed: ${nextUrl} -> HTTP ${response.status}`)
    }

    const resolvedUrl = new URL(response.url || nextUrl)
    const relativePath = relativeMirrorPathFromUrl(resolvedUrl)
    writeBuffer(path.join(outputDir, relativePath), response.body)

    downloadedFiles.push({
      url: resolvedUrl.toString(),
      relativePath,
      bytes: response.body.length,
      sha256: sha256Hex(response.body),
      contentType: response.headers['content-type'] || '',
    })

    if (shouldParseDependencies(resolvedUrl.pathname, response.headers['content-type'])) {
      const bodyText = shouldTreatAsText(resolvedUrl.pathname, response.headers['content-type'])
        ? response.body.toString('utf8')
        : ''
      if (bodyText) {
        const nestedUrls = extractMirrorAssetUrls(bodyText, resolvedUrl, blockedPrefixes)
        for (const nestedUrl of nestedUrls) {
          if (!visited.has(nestedUrl)) queue.push(nestedUrl)
        }
      }
    }
  }

  const indexInfo = readIndexInfoFromDir(outputDir)
  if (!indexInfo.mainAsset) {
    throw new Error('mirror root HTML missing expected /assets/index-*.js reference')
  }

  return {
    html: rootHtml,
    indexInfo,
    files: downloadedFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    distBytes: fileSizeBytes(outputDir),
  }
}

function readLocalAssetInfo(sourceDir, assetPath) {
  if (!assetPath) return null
  const relativePath = assetPath.replace(/^\/+/u, '')
  const absolutePath = path.join(sourceDir, relativePath)
  const buffer = readFileSync(absolutePath)
  return {
    path: assetPath,
    filePath: absolutePath,
    bytes: buffer.length,
    sha256: sha256Hex(buffer),
  }
}

async function fetchRemoteAssetInfo(baseUrl, assetPath, fetchImpl = fetch) {
  if (!assetPath) return null
  const targetUrl = new URL(assetPath, baseUrl).toString()
  const response = await fetchUrlBuffer(targetUrl, fetchImpl)
  return {
    path: assetPath,
    url: response.url || targetUrl,
    status: response.status,
    bytes: response.body.length,
    sha256: sha256Hex(response.body),
    lastModified: response.headers['last-modified'] || '',
  }
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

function uploadDistToTmp(sourceDir, tmpDir) {
  const sourceLabel = path.relative(REPO_ROOT, sourceDir) || sourceDir
  console.log(`[sync-to-vm-root] upload ${sourceLabel} -> ${tmpDir}`)
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
    sourceDir,
    `${VM_HOST}:${tmpDir}`,
  ])
  console.log(`[sync-to-vm-root] upload ${sourceLabel} complete`)
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

async function verifyRoutes(rootUrl, expectedMainAsset, fetchImpl = fetch) {
  const urls = [
    { name: 'root', url: rootUrl, expectHash: true },
    { name: 'agentBridge', url: new URL('/agent-bridge/dashboard/', rootUrl).toString() },
    { name: 'portfolioReport', url: new URL('/portfolio-report/', rootUrl).toString() },
  ]

  const results = {}
  for (const entry of urls) {
    const response = await fetchUrl(entry.url, fetchImpl)
    const parsed = parseIndexInfo(response.body)
    const includesHash = entry.expectHash ? response.body.includes(expectedMainAsset) : null
    results[entry.name] = {
      status: response.status,
      includesHash,
      mainAsset: parsed.mainAsset || '',
      cssAsset: parsed.cssAsset || '',
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

  ensurePrerequisites({ dryRun: options.dryRun })

  const envMap = loadEnvFile(path.join(REPO_ROOT, '.env.local'))
  const prodUrlResolution = resolveProdUrl(options, envMap)
  const apiBaseUrl = options.mirrorVercel ? '' : resolveApiBaseUrl(options, prodUrlResolution.url)
  const mode = options.mirrorVercel ? 'mirror-vercel' : 'local-build'
  const sourceDir = options.mirrorVercel ? MIRROR_DIST_DIR : LOCAL_DIST_DIR
  const stamp = timestampId()
  const backupDir = buildBackupDir(options.backupDir, stamp)
  const tmpDir = `/tmp/portfolio-sync-${stamp}`
  const gitSha = readGitSha()

  const warnings = []
  if (prodUrlResolution.warning) warnings.push(prodUrlResolution.warning)

  const remoteBefore = await collectRemoteState(options.rootUrl)

  let sourceBuild = null
  if (options.mirrorVercel) {
    console.log(`[sync-to-vm-root] mirror Vercel production -> ${path.relative(REPO_ROOT, sourceDir)}`)
    sourceBuild = await buildVercelMirror({
      prodUrl: prodUrlResolution.url,
      outputDir: sourceDir,
      preservePaths: options.preserve,
    })
  } else {
    buildLocalApp(apiBaseUrl)
    const localIndex = readIndexInfoFromDir(sourceDir)
    sourceBuild = {
      indexInfo: localIndex,
      distBytes: fileSizeBytes(sourceDir),
      files: [],
    }
  }

  const sourceIndex = sourceBuild.indexInfo
  const distBytes = sourceBuild.distBytes ?? fileSizeBytes(sourceDir)
  const sourceAssets = {
    main: readLocalAssetInfo(sourceDir, sourceIndex.mainAsset),
    css: readLocalAssetInfo(sourceDir, sourceIndex.cssAsset),
  }

  let upstreamAssets = null
  if (options.mirrorVercel) {
    upstreamAssets = {
      main: await fetchRemoteAssetInfo(prodUrlResolution.url, sourceIndex.mainAsset),
      css: await fetchRemoteAssetInfo(prodUrlResolution.url, sourceIndex.cssAsset),
    }

    if (upstreamAssets.main?.sha256 !== sourceAssets.main?.sha256) {
      throw new Error(`mirror main asset mismatch: ${sourceIndex.mainAsset}`)
    }
    if (sourceAssets.css && upstreamAssets.css?.sha256 !== sourceAssets.css?.sha256) {
      throw new Error(`mirror css asset mismatch: ${sourceIndex.cssAsset}`)
    }
  }

  if (remoteBefore.root.mainAsset && remoteBefore.root.mainAsset === sourceIndex.mainAsset) {
    warnings.push(`remote root already references ${sourceIndex.mainAsset}`)
  }

  if (!options.dryRun) {
    backupRemoteRoot({ backupDir, vmRootDir: options.vmRootDir })
    uploadDistToTmp(sourceDir, tmpDir)
    syncRemoteDist({
      tmpDir,
      vmRootDir: options.vmRootDir,
      preservePaths: options.preserve,
    })
  }

  console.log('[sync-to-vm-root] verify live routes')
  const verify = await verifyRoutes(options.rootUrl, sourceIndex.mainAsset)
  const remoteAssets = {
    main: await fetchRemoteAssetInfo(options.rootUrl, sourceIndex.mainAsset),
    css: await fetchRemoteAssetInfo(options.rootUrl, sourceIndex.cssAsset),
  }

  if (!options.dryRun) {
    if (verify.root.status !== 200) {
      throw new Error(`root verify failed: HTTP ${verify.root.status}`)
    }
    if (!verify.root.includesHash) {
      throw new Error(`root verify failed: HTML missing expected asset ${sourceIndex.mainAsset}`)
    }
    if (verify.root.mainAsset !== sourceIndex.mainAsset) {
      throw new Error(
        `root verify failed: VM references ${verify.root.mainAsset || '<missing>'}, expected ${sourceIndex.mainAsset}`
      )
    }
    if (remoteAssets.main?.status !== 200) {
      throw new Error(`main asset verify failed: HTTP ${remoteAssets.main?.status || 'unknown'}`)
    }
    if (remoteAssets.main?.sha256 !== sourceAssets.main?.sha256) {
      throw new Error(`main asset verify failed: sha mismatch for ${sourceIndex.mainAsset}`)
    }
    if (sourceAssets.css) {
      if (remoteAssets.css?.status !== 200) {
        throw new Error(`css asset verify failed: HTTP ${remoteAssets.css?.status || 'unknown'}`)
      }
      if (remoteAssets.css?.sha256 !== sourceAssets.css.sha256) {
        throw new Error(`css asset verify failed: sha mismatch for ${sourceIndex.cssAsset}`)
      }
    }
  }

  const summary = {
    ok: true,
    mode,
    dryRun: options.dryRun,
    gitSha,
    prodUrl: prodUrlResolution.url,
    prodUrlSource: prodUrlResolution.source,
    apiBaseUrl: options.mirrorVercel ? null : apiBaseUrl,
    sourceDir: path.relative(REPO_ROOT, sourceDir) || sourceDir,
    vmRootDir: options.vmRootDir,
    rootUrl: options.rootUrl,
    backupDir: options.dryRun ? null : backupDir,
    tmpDir: options.dryRun ? null : tmpDir,
    preservedPaths: options.preserve.map((value) => normalizePreservePath(value)).filter(Boolean),
    distSizeBytes: distBytes,
    distSizeHuman: formatBytes(distBytes),
    remoteBefore: remoteBefore.root,
    sourceBuild: {
      mainAsset: sourceIndex.mainAsset,
      cssAsset: sourceIndex.cssAsset,
      backgroundFallback: sourceIndex.backgroundFallback,
      downloadedFileCount: sourceBuild.files?.length ?? 0,
    },
    sourceAssets,
    upstreamAssets,
    verify: {
      ...verify,
      assets: remoteAssets,
    },
    durationMs: Date.now() - startedAt,
    syncedAt: new Date().toISOString(),
    warnings,
  }

  console.log(JSON.stringify(summary, null, 2))
}

export {
  MIRROR_DIST_DIR,
  buildVercelMirror,
  extractMirrorAssetUrls,
  parseArgs,
  parseIndexInfo,
  relativeMirrorPathFromUrl,
  shouldMirrorResolvedUrl,
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectExecution) {
  main().catch((error) => {
    console.error('[sync-to-vm-root] failed:', error?.message || error)
    process.exitCode = 1
  })
}
