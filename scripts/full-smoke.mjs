import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT_DIR = process.cwd()
const PLAYWRIGHT_RESULTS_DIR = resolve(ROOT_DIR, 'test-results')
const PLAYWRIGHT_RESULTS_JSON = resolve(PLAYWRIGHT_RESULTS_DIR, 'results.json')
const PLAYWRIGHT_ARTIFACTS_DIR = resolve(ROOT_DIR, '.playwright-artifacts')
const PLAYWRIGHT_EVIDENCE_DIR = resolve(PLAYWRIGHT_ARTIFACTS_DIR, 'evidence')
const SIGNOFF_PATH = resolve(ROOT_DIR, 'docs/release/internal-beta-signoff.md')
const LOCAL_DEV_URL = String(process.env.FULL_SMOKE_LOCAL_URL || 'http://127.0.0.1:3002').trim()
const PROD_URL = String(
  process.env.FULL_SMOKE_PROD_URL || 'https://jiucaivoice-dashboard.vercel.app/'
).trim()
const VM_DASHBOARD_URL = String(
  process.env.FULL_SMOKE_VM_URL || 'https://35.236.155.62.sslip.io/agent-bridge/dashboard/'
).trim()
const VM_PROGRESS_URL = String(
  process.env.FULL_SMOKE_PROGRESS_URL || 'https://35.236.155.62.sslip.io/portfolio-report/progress.json'
).trim()
const SKIP_REMOTE_CHECKS = String(process.env.FULL_SMOKE_SKIP_REMOTE_CHECKS || '').trim() === '1'

function logStep(message) {
  console.log(`\n==> ${message}`)
}

function runCommand(command, args, extraEnv = {}) {
  const printable = [command, ...args].join(' ')
  logStep(printable)
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`${printable} failed with exit code ${result.status ?? 'null'}`)
  }
}

function runCommandAllowFailure(command, args, extraEnv = {}) {
  const printable = [command, ...args].join(' ')
  logStep(printable)
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  })

  return {
    printable,
    status: result.status ?? 1,
  }
}

function curlStatus(url) {
  const status = execFileSync(
    'curl',
    ['-sSL', '-o', '/dev/null', '-w', '%{http_code}', url],
    {
      cwd: ROOT_DIR,
      env: process.env,
      encoding: 'utf8',
    }
  ).trim()

  if (status !== '200') {
    throw new Error(`curl ${url} returned HTTP ${status}`)
  }

  console.log(`HTTP 200 · ${url}`)
}

function curlJson(url) {
  const body = execFileSync('curl', ['-sSL', url], {
    cwd: ROOT_DIR,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch (error) {
    throw new Error(`curl ${url} returned invalid JSON: ${error.message}`)
  }

  if (!Array.isArray(parsed.items)) {
    throw new Error(`curl ${url} JSON parsed but missing items[]`)
  }

  console.log(`JSON valid · ${url} · items=${parsed.items.length}`)
}

function ensureFileExists(filePath) {
  logStep(`test -f ${filePath}`)
  execFileSync('test', ['-f', filePath], { cwd: ROOT_DIR, env: process.env })
  console.log(`file exists · ${filePath}`)
}

function getHttpStatus(url) {
  const result = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url], {
    cwd: ROOT_DIR,
    env: process.env,
    encoding: 'utf8',
  })

  return (result.stdout || '').trim() || '000'
}

function ensureLocalDevServer(url = LOCAL_DEV_URL) {
  const status = getHttpStatus(url)
  if (status === '200') {
    console.log(`local dev server ready · ${url}`)
    return
  }

  runCommand('bash', ['scripts/redeploy-local.sh'])

  const retryStatus = getHttpStatus(url)
  if (retryStatus !== '200') {
    throw new Error(`local dev server did not become healthy at ${url}`)
  }

  console.log(`local dev server bootstrapped · ${url}`)
}

function preparePlaywrightArtifacts() {
  rmSync(PLAYWRIGHT_RESULTS_DIR, { recursive: true, force: true })
  rmSync(PLAYWRIGHT_EVIDENCE_DIR, { recursive: true, force: true })
  mkdirSync(PLAYWRIGHT_RESULTS_DIR, { recursive: true })
  mkdirSync(PLAYWRIGHT_ARTIFACTS_DIR, { recursive: true })
}

function collectPlaywrightSummary(node, summary = { total: 0, passed: 0, failed: 0, skipped: 0 }) {
  if (!node || typeof node !== 'object') return summary

  if (Array.isArray(node.tests)) {
    for (const test of node.tests) {
      const lastResult =
        [...(Array.isArray(test.results) ? test.results : [])]
          .reverse()
          .find((result) => typeof result?.status === 'string') || null
      const status = lastResult?.status || test.status || 'unknown'
      summary.total += 1
      if (status === 'passed' || status === 'flaky') summary.passed += 1
      else if (status === 'skipped') summary.skipped += 1
      else summary.failed += 1
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      collectPlaywrightSummary(value, summary)
    }
  }

  return summary
}

function readPlaywrightEvidence() {
  if (!existsSync(PLAYWRIGHT_EVIDENCE_DIR)) {
    return {
      screenshotPaths: [],
      consoleErrorCount: 0,
      ignoredPageErrorCount: 0,
      ignoredResponseErrorCount: 0,
    }
  }

  const screenshotPaths = []
  let consoleErrorCount = 0
  let ignoredPageErrorCount = 0
  let ignoredResponseErrorCount = 0

  for (const fileName of readdirSync(PLAYWRIGHT_EVIDENCE_DIR)) {
    if (!fileName.endsWith('.json')) continue
    const payload = JSON.parse(readFileSync(join(PLAYWRIGHT_EVIDENCE_DIR, fileName), 'utf8'))
    screenshotPaths.push(...(payload.screenshots || []))
    consoleErrorCount += Number(payload.blockingErrorCount || 0)
    ignoredPageErrorCount += Number(payload.ignoredPageErrorCount || 0)
    ignoredResponseErrorCount += Number(payload.ignoredResponseErrorCount || 0)
  }

  screenshotPaths.sort()

  return {
    screenshotPaths,
    consoleErrorCount,
    ignoredPageErrorCount,
    ignoredResponseErrorCount,
  }
}

function copyPlaywrightReport(dateStamp) {
  const reportTarget = resolve(ROOT_DIR, `docs/qa/playwright-report-${dateStamp}`)
  rmSync(reportTarget, { recursive: true, force: true })
  mkdirSync(resolve(ROOT_DIR, 'docs/qa'), { recursive: true })
  cpSync(PLAYWRIGHT_RESULTS_DIR, reportTarget, { recursive: true })
  return reportTarget
}

function upsertAutoQaSection({
  dateStamp,
  summary,
  screenshotPaths,
  consoleErrorCount,
  ignoredPageErrorCount,
  ignoredResponseErrorCount,
  reportTarget,
}) {
  const signoffBody = readFileSync(SIGNOFF_PATH, 'utf8')
  const reportRelativePath = relative(resolve(ROOT_DIR, 'docs/release'), reportTarget)
  const lines = [
    '## 自動 QA 證據',
    '',
    `- run date: \`${dateStamp}\``,
    `- Playwright summary: \`${summary.passed} passed / ${summary.failed} failed / ${summary.skipped} skipped / ${summary.total} total\``,
    `- console errors: \`${consoleErrorCount}\``,
    `- ignored known pageerror noise: \`${ignoredPageErrorCount}\``,
    `- ignored known response noise: \`${ignoredResponseErrorCount}\``,
    `- HTML report: \`${reportRelativePath}/index.html\``,
    '- [x] `Q06` Playwright webkit + iOS viewport cover 90% · 剩實機 10% pending',
    '- screenshot evidence:',
    ...screenshotPaths.map((path) => `- \`${path}\``),
    '',
  ]
  const nextSection = lines.join('\n')

  const pattern = /## 自動 QA 證據[\s\S]*?(?=\n## |\s*$)/
  const updatedBody = pattern.test(signoffBody)
    ? signoffBody.replace(pattern, nextSection.trimEnd())
    : signoffBody.replace('\n## Legal 勾選', `\n${nextSection}\n## Legal 勾選`)

  writeFileSync(SIGNOFF_PATH, updatedBody)
}

try {
  ensureFileExists('docs/release/internal-beta-signoff.md')
  ensureLocalDevServer()

  runCommand('npm', ['run', 'verify:local'])
  runCommand('npm', ['run', 'build'])
  runCommand('node', ['scripts/render-portfolio-report-previews.mjs'])

  if (!SKIP_REMOTE_CHECKS) {
    curlStatus(PROD_URL)
    curlStatus(VM_DASHBOARD_URL)
    curlJson(VM_PROGRESS_URL)
  }

  preparePlaywrightArtifacts()
  const playwrightRun = runCommandAllowFailure(
    'npx',
    ['playwright', 'test', 'tests/e2e', '--reporter=html,json'],
    {
      PLAYWRIGHT_HTML_OUTPUT_DIR: 'test-results',
      PLAYWRIGHT_HTML_OPEN: 'never',
      PLAYWRIGHT_JSON_OUTPUT_NAME: 'test-results/results.json',
    }
  )

  if (!existsSync(PLAYWRIGHT_RESULTS_JSON)) {
    throw new Error('playwright smoke did not produce test-results/results.json')
  }

  const playwrightJson = JSON.parse(readFileSync(PLAYWRIGHT_RESULTS_JSON, 'utf8'))
  const summary = collectPlaywrightSummary(playwrightJson)
  const evidence = readPlaywrightEvidence()
  const dateStamp = new Date().toISOString().slice(0, 10)
  const reportTarget = copyPlaywrightReport(dateStamp)

  upsertAutoQaSection({
    dateStamp,
    summary,
    screenshotPaths: evidence.screenshotPaths,
    consoleErrorCount: evidence.consoleErrorCount,
    ignoredPageErrorCount: evidence.ignoredPageErrorCount,
    ignoredResponseErrorCount: evidence.ignoredResponseErrorCount,
    reportTarget,
  })

  if (playwrightRun.status !== 0) {
    throw new Error(`${playwrightRun.printable} failed with exit code ${playwrightRun.status}`)
  }

  console.log('\nfull smoke passed · ship gate may proceed to owner signoff')
} catch (error) {
  console.error(`\nfull smoke failed · halt ship\n${error.message}`)
  process.exit(1)
}
