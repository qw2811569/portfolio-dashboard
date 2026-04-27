import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const VM_BASE_URL = (process.env.VM_BASE_URL || 'http://104.199.144.170').replace(/\/+$/, '')
const VERIFY_DIR = '.tmp/deploy-verify'
const EXPECTED_PATH = path.join(VERIFY_DIR, 'expected.json')
const LOG_PATH = path.join(VERIFY_DIR, 'log.jsonl')
const POLL_INTERVAL_MS = 5000
const POLL_ATTEMPTS = 36
const ASSET_KEYS = [
  { key: 'index', pattern: /^index-[\w-]+\.js$/ },
  { key: 'daily', pattern: /^route-daily-[\w-]+\.js$/ },
  { key: 'events', pattern: /^route-events-[\w-]+\.js$/ },
  { key: 'research', pattern: /^route-research-[\w-]+\.js$/ },
]

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function normalizeAssetPath(assetPath) {
  const normalized = String(assetPath || '').replace(/^https?:\/\/[^/]+/i, '')
  const match = normalized.match(/\/?assets\/([^"'<>\s)]+\.js)/)
  return match ? `/assets/${match[1]}` : ''
}

function collectAssetRefs(text) {
  const refs = new Set()
  const patterns = [
    /(?:src|href)=["']([^"']*\/assets\/[^"']+\.js)["']/g,
    /["'`](\/assets\/[^"'`]+\.js)["'`]/g,
    /["'`](assets\/[^"'`]+\.js)["'`]/g,
    /["'`](route-(?:daily|events|research)-[^"'`]+\.js)["'`]/g,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const ref = normalizeAssetPath(match[1]?.startsWith('route-') ? `/assets/${match[1]}` : match[1])
      if (ref) refs.add(ref)
    }
  }

  return refs
}

function filenameOf(assetPath) {
  return path.posix.basename(assetPath)
}

async function run(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 20,
    ...options,
  })
  return String(stdout || '').trim()
}

async function curl(url) {
  const { stdout } = await execFileAsync('curl', ['-fsSL', url], {
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 50,
  })
  return Buffer.from(stdout)
}

async function retryOnce(label, fn) {
  try {
    return await fn()
  } catch (error) {
    console.warn(`[verify-vm] ${label} failed once: ${error.message}`)
    return fn()
  }
}

async function buildExpectedManifest(expectedHead) {
  await rm('dist', { recursive: true, force: true })
  await run('npm', ['run', 'build', '--silent'])

  const html = await readFile('dist/index.html', 'utf8')
  const refs = collectAssetRefs(html)
  const assetDir = path.join('dist', 'assets')
  const files = await readdir(assetDir)
  for (const file of files) {
    if (ASSET_KEYS.some((item) => item.pattern.test(file))) {
      refs.add(`/assets/${file}`)
    }
  }

  const assets = {}
  for (const item of ASSET_KEYS) {
    const ref = Array.from(refs).find((candidate) => item.pattern.test(filenameOf(candidate)))
    if (!ref) throw new Error(`local build missing ${item.key} asset`)
    const buffer = await readFile(path.join('dist', ref.replace(/^\//, '')))
    assets[item.key] = {
      path: ref,
      file: filenameOf(ref),
      sha256: sha256(buffer),
    }
  }

  const manifest = {
    commit: expectedHead,
    generatedAt: new Date().toISOString(),
    assets,
  }
  await mkdir(VERIFY_DIR, { recursive: true })
  await writeFile(EXPECTED_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

async function servedManifest() {
  const htmlBuffer = await curl(`${VM_BASE_URL}/portfolio/me/overview`)
  const html = htmlBuffer.toString('utf8')
  const htmlRefs = collectAssetRefs(html)
  const indexRef = Array.from(htmlRefs).find((candidate) => /^index-[\w-]+\.js$/.test(filenameOf(candidate)))
  if (!indexRef) throw new Error('served HTML missing index asset')

  const indexBuffer = await curl(`${VM_BASE_URL}${indexRef}`)
  const indexText = indexBuffer.toString('utf8')
  const refs = new Set([indexRef, ...collectAssetRefs(indexText)])
  const assets = {
    index: {
      path: indexRef,
      file: filenameOf(indexRef),
      sha256: sha256(indexBuffer),
    },
  }

  for (const item of ASSET_KEYS.filter((asset) => asset.key !== 'index')) {
    const ref = Array.from(refs).find((candidate) => item.pattern.test(filenameOf(candidate)))
    if (!ref) throw new Error(`served bundle missing ${item.key} asset`)
    const buffer = await curl(`${VM_BASE_URL}${ref}`)
    assets[item.key] = {
      path: ref,
      file: filenameOf(ref),
      sha256: sha256(buffer),
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    assets,
  }
}

function compareManifests(expected, served) {
  const mismatches = []
  for (const item of ASSET_KEYS) {
    const expectedAsset = expected.assets[item.key]
    const servedAsset = served.assets[item.key]
    if (!servedAsset) {
      mismatches.push(`${item.key}: missing served asset`)
      continue
    }
    if (expectedAsset.file !== servedAsset.file) {
      mismatches.push(`${item.key}: file expected ${expectedAsset.file}, served ${servedAsset.file}`)
    }
    if (expectedAsset.sha256 !== servedAsset.sha256) {
      mismatches.push(`${item.key}: sha expected ${expectedAsset.sha256}, served ${servedAsset.sha256}`)
    }
  }
  return mismatches
}

async function forceVmRebuild() {
  const remoteCommand = [
    'cd /home/chenkuichen/app/portfolio-dashboard',
    'git fetch origin main',
    'git checkout main',
    'git pull --ff-only',
    'rm -rf dist',
    'npm install --ignore-scripts',
    'npx vite build',
    'bash scripts/vm-atomic-deploy.sh dist /var/www/app 2>/dev/null || true',
  ].join(' && ')

  await run('ssh', ['jcv-dev', remoteCommand], { maxBuffer: 1024 * 1024 * 30 })
}

async function pollUntilMatch(expected) {
  let lastServed = null
  let lastMismatches = []
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    try {
      lastServed = await retryOnce(`served poll ${attempt}`, servedManifest)
      lastMismatches = compareManifests(expected, lastServed)
      if (lastMismatches.length === 0) {
        return { pass: true, served: lastServed, mismatches: [] }
      }
      console.warn(`[verify-vm] poll ${attempt}/${POLL_ATTEMPTS}: ${lastMismatches.join('; ')}`)
    } catch (error) {
      lastMismatches = [error.message]
      console.warn(`[verify-vm] poll ${attempt}/${POLL_ATTEMPTS}: ${error.message}`)
    }
  }
  return { pass: false, served: lastServed, mismatches: lastMismatches }
}

async function appendRunLog(entry) {
  await mkdir(VERIFY_DIR, { recursive: true })
  await appendFile(LOG_PATH, `${JSON.stringify(entry)}\n`)
}

async function main() {
  const expectedHead = await run('git', ['rev-parse', 'HEAD'])
  const startedAt = new Date().toISOString()
  let expected = null
  let served = null
  let mismatches = []
  let pass = false
  let forcedRebuild = false

  try {
    expected = await retryOnce('local expected build', () => buildExpectedManifest(expectedHead))
    served = await retryOnce('served manifest', servedManifest)
    mismatches = compareManifests(expected, served)

    if (mismatches.length > 0) {
      console.warn(`[verify-vm] mismatch: ${mismatches.join('; ')}`)
      forcedRebuild = true
      await retryOnce('VM forced rebuild', forceVmRebuild)
      const pollResult = await pollUntilMatch(expected)
      served = pollResult.served
      mismatches = pollResult.mismatches
      pass = pollResult.pass
    } else {
      pass = true
    }

    await appendRunLog({
      timestamp: startedAt,
      commit: expectedHead,
      vmBaseUrl: VM_BASE_URL,
      forcedRebuild,
      pass,
      expected: expected?.assets,
      served: served?.assets || null,
      mismatches,
    })

    if (!pass) {
      console.error(`[verify-vm] FAIL: ${mismatches.join('; ')}`)
      process.exit(1)
    }

    console.log(`[verify-vm] PASS ${expectedHead}`)
    for (const item of ASSET_KEYS) {
      const asset = served.assets[item.key]
      console.log(`[verify-vm] ${item.key}: ${asset.file} ${asset.sha256}`)
    }
  } catch (error) {
    await appendRunLog({
      timestamp: startedAt,
      commit: expectedHead,
      vmBaseUrl: VM_BASE_URL,
      forcedRebuild,
      pass: false,
      expected: expected?.assets || null,
      served: served?.assets || null,
      mismatches: mismatches.length > 0 ? mismatches : [error.message],
    })
    console.error(`[verify-vm] FAIL: ${error.message}`)
    process.exit(1)
  }
}

main()
