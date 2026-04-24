import { expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const ROOT_DIR = process.cwd()
const EVIDENCE_DIR = resolve(ROOT_DIR, '.playwright-artifacts/evidence')
const monitorByTestId = new Map()
const evidenceByTestId = new Map()

export const PORTFOLIO_BASE_URL =
  process.env.PORTFOLIO_BASE_URL || 'https://jiucaivoice-dashboard.vercel.app/'
export const AGENT_BRIDGE_BASE_URL =
  process.env.AGENT_BRIDGE_BASE_URL || 'https://35.236.155.62.sslip.io/agent-bridge'
export const DEFAULT_UPLOAD_FIXTURE_PATH = resolve(
  ROOT_DIR,
  'docs/portfolio-spec-report/assets/mockup-trade-preview.png'
)

const DEFAULT_IGNORED_RESPONSE_PATTERNS = [/\/api\/target-prices\?code=/]
const DEFAULT_IGNORED_PAGEERROR_PATTERNS = [/\/api\/finmind\?.*due to access control checks\./i]

function buildJsonFulfillOptions(payload, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mergeEvidenceState(testId, partial) {
  const current = evidenceByTestId.get(testId) || {}
  const next = { ...current, ...partial }

  if (partial.screenshots) {
    next.screenshots = [...(current.screenshots || []), ...partial.screenshots]
  }

  evidenceByTestId.set(testId, next)
  return next
}

function buildScreenshotPath(testInfo, fileName) {
  const snapshotDirName = process.env.PLAYWRIGHT_SNAPSHOT_DIR || testInfo.project.name
  return resolve(ROOT_DIR, 'tests/e2e/snapshots', snapshotDirName, fileName)
}

export function installQaMonitor(
  testInfo,
  page,
  {
    ignoredResponsePatterns = DEFAULT_IGNORED_RESPONSE_PATTERNS,
    ignoredPageErrorPatterns = DEFAULT_IGNORED_PAGEERROR_PATTERNS,
  } = {}
) {
  const state = {
    pageErrors: [],
    ignoredPageErrors: [],
    consoleErrors: [],
    responseErrors: [],
    ignoredResponseErrors: [],
  }

  monitorByTestId.set(testInfo.testId, state)

  page.on('pageerror', (error) => {
    if (ignoredPageErrorPatterns.some((pattern) => pattern.test(error.message))) {
      state.ignoredPageErrors.push(error.message)
      return
    }
    state.pageErrors.push(error.message)
  })

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/^Failed to load resource:/i.test(text)) return
    state.consoleErrors.push(text)
  })

  page.on('response', (response) => {
    if (response.status() < 400) return

    const entry = `${response.status()} ${response.request().resourceType()} ${response.url()}`
    if (ignoredResponsePatterns.some((pattern) => pattern.test(response.url()))) {
      state.ignoredResponseErrors.push(entry)
      return
    }

    state.responseErrors.push(entry)
  })

  return state
}

export function mergeQaEvidence(testInfo, partial) {
  return mergeEvidenceState(testInfo.testId, partial)
}

export async function savePageScreenshot(page, testInfo, fileName, options = {}) {
  const absolutePath = buildScreenshotPath(testInfo, fileName)
  mkdirSync(dirname(absolutePath), { recursive: true })
  await page.screenshot({ path: absolutePath, fullPage: true, ...options })
  const relativePath = relative(ROOT_DIR, absolutePath)
  mergeEvidenceState(testInfo.testId, { screenshots: [relativePath] })
  return relativePath
}

export async function saveLocatorScreenshot(locator, testInfo, fileName, options = {}) {
  const absolutePath = buildScreenshotPath(testInfo, fileName)
  mkdirSync(dirname(absolutePath), { recursive: true })
  await locator.scrollIntoViewIfNeeded()
  await locator.screenshot({ path: absolutePath, ...options })
  const relativePath = relative(ROOT_DIR, absolutePath)
  mergeEvidenceState(testInfo.testId, { screenshots: [relativePath] })
  return relativePath
}

export function finalizeQaEvidence(testInfo) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })

  const monitor = monitorByTestId.get(testInfo.testId) || {
    pageErrors: [],
    ignoredPageErrors: [],
    consoleErrors: [],
    responseErrors: [],
    ignoredResponseErrors: [],
  }
  const evidence = evidenceByTestId.get(testInfo.testId) || {}
  const blockingErrors = [
    ...monitor.pageErrors.map((message) => `pageerror: ${message}`),
    ...monitor.consoleErrors.map((message) => `console: ${message}`),
    ...monitor.responseErrors.map((message) => `response: ${message}`),
  ]

  const payload = {
    project: testInfo.project.name,
    title: testInfo.title,
    status: testInfo.status,
    scenario: evidence.scenario || slugify(testInfo.title),
    screenshots: evidence.screenshots || [],
    blockingErrorCount: blockingErrors.length,
    ignoredPageErrorCount: monitor.ignoredPageErrors.length,
    ignoredResponseErrorCount: monitor.ignoredResponseErrors.length,
    blockingErrors,
    ignoredPageErrors: monitor.ignoredPageErrors,
    ignoredResponseErrors: monitor.ignoredResponseErrors,
  }

  const evidencePath = resolve(
    EVIDENCE_DIR,
    `${slugify(testInfo.project.name)}-${payload.scenario || slugify(testInfo.title)}.json`
  )
  writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`)
  return payload
}

export function expectNoBlockingQaErrors(testInfo) {
  const payload = finalizeQaEvidence(testInfo)
  expect(payload.blockingErrors).toEqual([])
  return payload
}

export async function stubOwnerCloudBootstrap(
  page,
  {
    holdings = [],
    events = [],
    history = [],
    reports = [],
    brain = null,
  } = {}
) {
  await page.route('**/api/brain**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())

    if (method === 'GET') {
      const action = url.searchParams.get('action')
      if (action === 'brain') {
        await route.fulfill(buildJsonFulfillOptions({ brain }))
        return
      }
      if (action === 'history') {
        await route.fulfill(buildJsonFulfillOptions({ history }))
        return
      }
    }

    if (method === 'POST') {
      let action = ''
      try {
        action = JSON.parse(request.postData() || '{}')?.action || ''
      } catch {
        action = ''
      }

      if (action === 'load-holdings') {
        await route.fulfill(buildJsonFulfillOptions({ holdings }))
        return
      }
      if (action === 'load-events') {
        await route.fulfill(buildJsonFulfillOptions({ events }))
        return
      }
      if (['save-holdings', 'save-events', 'save-brain'].includes(action)) {
        await route.fulfill(buildJsonFulfillOptions({ ok: true }))
        return
      }
    }

    await route.continue()
  })

  await page.route('**/api/research*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }

    await route.fulfill(buildJsonFulfillOptions({ reports }))
  })
}
