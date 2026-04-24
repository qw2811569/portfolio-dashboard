import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import {
  AGENT_BRIDGE_BASE_URL,
  PORTFOLIO_BASE_URL,
  finalizeQaEvidence,
  installQaMonitor,
  mergeQaEvidence,
} from './support/qaHelpers.mjs'
import { diffHoldingCodes, getPersonaFixture, sortHoldingCodes } from './personaFixtures.mjs'
import { INIT_HOLDINGS_JINLIANCHENG, INIT_TARGETS_JINLIANCHENG } from '../../src/seedDataJinliancheng.js'

const ROOT_DIR = process.cwd()
const ROUND_DIR = resolve(ROOT_DIR, '.tmp/portfolio-r8-loop')
const STEP_LOG_DIR = resolve(ROUND_DIR, 'step-logs')
const UX21_DIR = resolve(ROOT_DIR, '.tmp/ux-21-mobile-header')
const UX21_SCREENSHOT_DIR = 'ux-21-verify'
const UX21_MEASUREMENT_PHASE = String(process.env.UX21_MEASUREMENT_PHASE || '').trim()
const UX21_MEASUREMENT_MODE = Boolean(UX21_MEASUREMENT_PHASE)
const UX21_RESULT_JSON_PATH = UX21_MEASUREMENT_MODE
  ? resolve(UX21_DIR, `${UX21_MEASUREMENT_PHASE}-measurements.json`)
  : ''
const UX21_RESULT_MD_PATH = UX21_MEASUREMENT_MODE
  ? resolve(UX21_DIR, `${UX21_MEASUREMENT_PHASE}-measurements.md`)
  : ''
const stepLogsByTestId = new Map()
const PERSONA_A = getPersonaFixture('me')
const PERSONA_B = getPersonaFixture('7865')
const PERSONA_DRILL_PREFERENCES = {
  [PERSONA_A.personaId]: ['6274', '6862', '2308', '1503'],
  [PERSONA_B.personaId]: ['7865', '2489', '1799'],
}
const EMPTY_PORTFOLIO_ID = 'p-empty-round2'
const EMPTY_PORTFOLIO_NAME = '空白測試組合'
const UX21_VIEWPORTS = {
  'ios-safari': [
    { id: 'iphone-se', width: 375, height: 667, label: 'iPhone SE (375x667)' },
    { id: 'iphone-14', width: 390, height: 844, label: 'iPhone 13/14/15 class (390x844)' },
  ],
  chromium: [{ id: 'desktop-1280', width: 1280, height: 900, label: 'Desktop Chrome (1280x900)' }],
}
const EMPTY_PORTFOLIO_SEED = {
  'pf-portfolios-v1': [
    { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-19' },
    {
      id: EMPTY_PORTFOLIO_ID,
      name: EMPTY_PORTFOLIO_NAME,
      isOwner: false,
      createdAt: '2026-04-19',
    },
  ],
  'pf-active-portfolio-v1': EMPTY_PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  [`pf-${EMPTY_PORTFOLIO_ID}-holdings-v2`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-log-v2`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-targets-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-fundamentals-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-analyst-reports-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-holding-dossiers-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-news-events-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-analysis-history-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-daily-report-v1`]: null,
  [`pf-${EMPTY_PORTFOLIO_ID}-research-history-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-brain-v1`]: null,
  [`pf-${EMPTY_PORTFOLIO_ID}-reversal-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-notes-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-report-refresh-meta-v1`]: {},
}
const PERSONA_B_STORAGE_SEED = {
  'pf-portfolios-v1': [
    { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' },
    { id: '7865', name: '金聯成', isOwner: false, createdAt: '2026-04-24' },
  ],
  'pf-active-portfolio-v1': 'me',
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  'trade-disclaimer-v1-ack-at': '2026-04-24T09:30:00.000+08:00',
  'pf-cloud-sync-at': '1776994200000',
  'pf-analysis-cloud-sync-at': '1776994200000',
  'pf-research-cloud-sync-at': '1776994200000',
  'pf-7865-holdings-v2': INIT_HOLDINGS_JINLIANCHENG,
  'pf-7865-log-v2': [],
  'pf-7865-targets-v1': INIT_TARGETS_JINLIANCHENG,
  'pf-7865-fundamentals-v1': {},
  'pf-7865-watchlist-v1': [],
  'pf-7865-analyst-reports-v1': {},
  'pf-7865-report-refresh-meta-v1': {},
  'pf-7865-holding-dossiers-v1': [],
  'pf-7865-news-events-v1': [],
  'pf-7865-analysis-history-v1': [],
  'pf-7865-daily-report-v1': null,
  'pf-7865-research-history-v1': [],
  'pf-7865-brain-v1': null,
  'pf-7865-reversal-v1': {},
  'pf-7865-notes-v1': {},
}
const PERSONA_B_RAW_STORAGE_KEYS = new Set([
  'trade-disclaimer-v1-ack-at',
  'pf-cloud-sync-at',
  'pf-analysis-cloud-sync-at',
  'pf-research-cloud-sync-at',
])

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ensureDir(target) {
  mkdirSync(target, { recursive: true })
}

function loadJsonFile(filePath, fallbackValue) {
  if (!filePath || !existsSync(filePath)) return fallbackValue
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return fallbackValue
  }
}

function buildScreenshotPath(dirName, fileName) {
  return resolve(ROOT_DIR, 'tests/e2e/snapshots', dirName, fileName)
}

function buildRound2Dir(baseDir, testInfo) {
  if (testInfo.project.name === 'ios-safari') return `${baseDir}-ios`
  if (testInfo.project.name === 'chromium') return baseDir
  return `${baseDir}-${slugify(testInfo.project.name)}`
}

function buildRound2Scenario(baseScenario, testInfo) {
  return buildRound2Dir(baseScenario, testInfo)
}

async function settle(page, waitMs = 900) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function saveShot(page, testInfo, dirName, fileName, options = {}) {
  const absolutePath = buildScreenshotPath(dirName, fileName)
  ensureDir(dirname(absolutePath))
  await page.screenshot({ path: absolutePath, fullPage: false, ...options })
  const relativePath = relative(ROOT_DIR, absolutePath)
  mergeQaEvidence(testInfo, { screenshots: [relativePath] })
  return relativePath
}

function renderMeasurementLink(path) {
  return path ? `[shot](../${path})` : ''
}

function renderUx21MeasurementsMarkdown(rows = []) {
  const projectOrder = ['ios-safari', 'chromium']
  const sortedRows = [...rows].sort((left, right) => {
    const projectDelta =
      projectOrder.indexOf(left.projectName) - projectOrder.indexOf(right.projectName)
    if (projectDelta !== 0) return projectDelta
    if (left.viewportWidth !== right.viewportWidth) return left.viewportWidth - right.viewportWidth
    return String(left.scenarioLabel || '').localeCompare(String(right.scenarioLabel || ''), 'en')
  })

  const lines = [
    `# UX-21 ${UX21_MEASUREMENT_PHASE} measurements`,
    '',
    '| Project | Viewport | Scenario | View mode | Sticky px | Root px | Urgent | Notice | Screenshot |',
    '| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |',
  ]

  for (const row of sortedRows) {
    lines.push(
      [
        row.projectName,
        row.viewportLabel,
        row.scenarioLabel,
        row.viewMode,
        row.stickyHeight,
        row.rootHeight,
        row.hasUrgentAlert ? 'yes' : 'no',
        row.hasHeaderNotice ? 'yes' : 'no',
        renderMeasurementLink(row.screenshotPath),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')
    )
  }

  return `${lines.join('\n')}\n`
}

function persistUx21MeasurementRows(nextRows = []) {
  if (!UX21_MEASUREMENT_MODE) return

  ensureDir(UX21_DIR)
  const currentRows = Array.isArray(loadJsonFile(UX21_RESULT_JSON_PATH, []))
    ? loadJsonFile(UX21_RESULT_JSON_PATH, [])
    : []
  const merged = new Map()

  for (const row of [...currentRows, ...nextRows]) {
    const key = [
      row.phase,
      row.projectName,
      row.viewportId,
      row.scenarioKey,
    ]
      .filter(Boolean)
      .join('::')
    merged.set(key, row)
  }

  const rows = [...merged.values()]
  writeFileSync(UX21_RESULT_JSON_PATH, `${JSON.stringify(rows, null, 2)}\n`)
  writeFileSync(UX21_RESULT_MD_PATH, renderUx21MeasurementsMarkdown(rows))
}

function createScenarioState(testInfo, scenario, screenshotDir) {
  const state = {
    scenario,
    screenshotDir,
    steps: [],
    notes: [],
  }
  stepLogsByTestId.set(testInfo.testId, state)
  mergeQaEvidence(testInfo, { scenario })
  return state
}

function recordNote(state, note) {
  state.notes.push(note)
}

function recordStep(state, entry) {
  state.steps.push({
    at: new Date().toISOString(),
    ...entry,
  })
}

function getResponsePath(url) {
  try {
    const parsed = new URL(String(url || ''))
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return String(url || '')
  }
}

function classifyRound2ErrorResponse(response) {
  const status = Number(response?.status?.())
  if (![401, 404].includes(status)) return null

  const url = String(response?.url?.() || '')
  if (!url) return null

  if (url.includes('/api/analyst-reports')) {
    return {
      key: `${status}-analyst-reports`,
      fileToken: `${status}-analyst-reports`,
      label: 'analyst reports',
      note: `${response.request().method()} ${getResponsePath(url)}`,
    }
  }

  if (url.includes('/api/tracked-stocks')) {
    return {
      key: `${status}-tracked-stocks`,
      fileToken: `${status}-tracked-stocks`,
      label: 'tracked stocks',
      note: `${response.request().method()} ${getResponsePath(url)}`,
    }
  }

  if (url.includes('/api/target-prices')) {
    let code = 'unknown'
    try {
      code = new URL(url).searchParams.get('code') || 'unknown'
    } catch {
      code = 'unknown'
    }
    return {
      key: `${status}-target-prices-${code}`,
      fileToken: `${status}-target-prices-${slugify(code)}`,
      label: `target prices ${code}`,
      note: `${response.request().method()} ${getResponsePath(url)}`,
    }
  }

  return null
}

function installRound2ErrorCapture({ page, testInfo, state, personaPrefix, maxCaptures = 6 }) {
  const capturedKeys = new Set()
  let captureQueue = Promise.resolve()

  page.on('response', (response) => {
    const meta = classifyRound2ErrorResponse(response)
    if (!meta || capturedKeys.has(meta.key) || capturedKeys.size >= maxCaptures) return

    capturedKeys.add(meta.key)
    captureQueue = captureQueue
      .then(async () => {
        await page.waitForTimeout(500)
        const screenshot = await saveShot(
          page,
          testInfo,
          state.screenshotDir,
          `${personaPrefix}-error-${meta.fileToken}.png`
        )
        recordStep(state, {
          stepId: `ERR-${capturedKeys.size}`,
          label: `${personaPrefix} observed ${response.status()} ${meta.label}`,
          status: 'observed',
          note: meta.note,
          screenshot,
        })
      })
      .catch((error) => {
        recordNote(state, `error capture failed for ${meta.key}: ${error?.message || error}`)
      })
  })

  return {
    async flush() {
      await captureQueue
    },
  }
}

async function primeEmptyPortfolioSeed(page) {
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, EMPTY_PORTFOLIO_SEED)
}

async function primePersonaBSeed(page) {
  await page.addInitScript(({ seed, rawKeys }) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      if (rawKeys.includes(key)) {
        window.localStorage.setItem(key, String(value ?? ''))
        continue
      }
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, { seed: PERSONA_B_STORAGE_SEED, rawKeys: Array.from(PERSONA_B_RAW_STORAGE_KEYS) })
}

async function recordBlockedStep({
  page,
  testInfo,
  state,
  stepId,
  label,
  note,
  screenshotName = null,
}) {
  let screenshot = null
  if (screenshotName) {
    screenshot = await saveShot(page, testInfo, state.screenshotDir, screenshotName)
  }
  recordStep(state, {
    stepId,
    label,
    status: 'blocked',
    note,
    screenshot,
  })
}

async function runStep({ page, testInfo, state, stepId, label, screenshotName = null, action }) {
  let screenshot = null
  await test.step(label, async () => {
    await action()
    if (screenshotName) {
      screenshot = await saveShot(page, testInfo, state.screenshotDir, screenshotName)
    }
  })
  recordStep(state, {
    stepId,
    label,
    status: 'ok',
    screenshot,
  })
  return screenshot
}

async function firstExisting(...locators) {
  for (const locator of locators) {
    if ((await locator.count()) > 0) return locator.first()
  }
  return null
}

async function requireLocator(message, ...locators) {
  const locator = await firstExisting(...locators)
  if (!locator) throw new Error(message)
  return locator
}

async function getPortfolioSelect(page) {
  return requireLocator(
    'missing portfolio select',
    page.getByTestId('portfolio-select'),
    page.locator('select')
  )
}

async function selectPortfolio(
  page,
  { portfolioId = '', custId = '', portfolioLabel = '', portfolioLabels = [] } = {}
) {
  const custIdInput = await firstExisting(
    page.getByTestId('cust-id-input'),
    page.getByLabel(/cust[_\s-]?id|客戶編號/i)
  )
  const loginButton = await firstExisting(
    page.getByTestId('login-btn'),
    page.getByRole('button', { name: /登入|login|enter/i })
  )

  if (custIdInput && loginButton && (await custIdInput.isVisible().catch(() => false))) {
    await custIdInput.fill(String(custId || portfolioId || '').trim())
    await loginButton.click()
    await settle(page, 2500)
    return {
      value: String(portfolioId || custId || '').trim(),
      text: String(portfolioLabel || portfolioLabels[0] || portfolioId || custId || '').trim(),
    }
  }

  const select = await getPortfolioSelect(page)
  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: String(node.value || '').trim(),
      text: String(node.textContent || '').trim(),
    }))
  )
  const labelCandidates = Array.from(
    new Set(
      [portfolioLabel, ...(portfolioLabels || [])]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )

  const matched =
    options.find((option) => option.value === String(portfolioId || '').trim()) ||
    options.find((option) => option.value === String(custId || '').trim()) ||
    options.find((option) => labelCandidates.some((label) => option.text.includes(label)))

  if (!matched) {
    throw new Error(
      `missing portfolio option for ${portfolioId || custId || labelCandidates[0] || 'unknown persona'}`
    )
  }

  await select.selectOption(matched.value)
  await settle(page, 2200)
  return matched
}

async function clickTab(page, key, label) {
  const tab = await requireLocator(
    `missing tab: ${key}`,
    page.getByTestId(`tab-${key}`),
    page.getByRole('button', { name: label, exact: true })
  )
  await tab.scrollIntoViewIfNeeded()
  await tab.click()
  await settle(page, 1400)
}

async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(400)
}

async function scrollToBottom(page) {
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
  )
  await page.waitForTimeout(500)
}

async function scrollBy(page, amount = 600, times = 1, waitMs = 350) {
  for (let index = 0; index < times; index += 1) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), amount)
    await page.waitForTimeout(waitMs)
  }
}

async function clickFirstMatchingButton(page, names = []) {
  for (const name of names) {
    const button = page.getByRole('button', { name }).first()
    if ((await button.count()) === 0) continue
    await button.scrollIntoViewIfNeeded()
    await button.click()
    await settle(page, 1200)
    return true
  }
  return false
}

async function measureHeaderBoundingBoxes(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.app-shell')
    const sticky =
      document.querySelector('[data-testid="header-sticky-zone"]') ||
      document.querySelector('.app-shell')
    const rootRect = root?.getBoundingClientRect?.()
    const stickyRect = sticky?.getBoundingClientRect?.()
    const rootText = String(root?.textContent || '')
    const hasUrgentAlert = rootText.includes('今日 ·')
    const hasHeaderNotice = Boolean(document.querySelector('[data-testid="header-notice-toggle"]'))

    return {
      rootHeight: rootRect ? Number(rootRect.height.toFixed(2)) : 0,
      stickyHeight: stickyRect ? Number(stickyRect.height.toFixed(2)) : 0,
      hasUrgentAlert,
      hasHeaderNotice,
    }
  })
}

async function recordUx21Measurement({
  page,
  testInfo,
  state,
  viewport,
  scenarioKey,
  scenarioLabel,
  viewMode,
}) {
  await scrollToTop(page)
  await settle(page, 1200)
  const metrics = await measureHeaderBoundingBoxes(page)
  const screenshotPath = await saveShot(
    page,
    testInfo,
    UX21_SCREENSHOT_DIR,
    `${UX21_MEASUREMENT_PHASE}-${slugify(testInfo.project.name)}-${viewport.id}-${scenarioKey}.png`
  )

  const row = {
    phase: UX21_MEASUREMENT_PHASE,
    projectName: testInfo.project.name,
    viewportId: viewport.id,
    viewportLabel: viewport.label,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    scenarioKey,
    scenarioLabel,
    viewMode,
    stickyHeight: metrics.stickyHeight,
    rootHeight: metrics.rootHeight,
    hasUrgentAlert: metrics.hasUrgentAlert,
    hasHeaderNotice: metrics.hasHeaderNotice,
    screenshotPath,
  }

  recordNote(
    state,
    `UX-21 ${scenarioKey} @ ${viewport.label}: sticky=${row.stickyHeight}px root=${row.rootHeight}px urgent=${row.hasUrgentAlert} notice=${row.hasHeaderNotice}`
  )
  persistUx21MeasurementRows([row])
}

async function runUx21ViewportScenario(page, testInfo, viewport, scenario, state) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await openPortfolioHome(page, scenario.persona)

  if (scenario.kind === 'overview') {
    const opened = await clickFirstMatchingButton(page, [/全部總覽/, /All overview/i])
    if (!opened) throw new Error('missing overview toggle button')
  }

  await recordUx21Measurement({
    page,
    testInfo,
    state,
    viewport,
    scenarioKey: scenario.key,
    scenarioLabel: scenario.label,
    viewMode: scenario.viewMode,
  })
}

async function runUx21HeaderMeasurementMatrix(page, testInfo, state, scenarios = []) {
  if (!UX21_MEASUREMENT_MODE) return false

  const viewports = UX21_VIEWPORTS[testInfo.project.name] || []
  if (viewports.length === 0) return false

  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      await runUx21ViewportScenario(page, testInfo, viewport, scenario, state)
    }
  }

  return true
}

function holdingRow(page, code) {
  return page.locator(`[data-holding-code="${String(code || '').trim()}"]`).first()
}

async function toggleHolding(page, code) {
  const row = holdingRow(page, code)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await row.count()) > 0) {
      await row.scrollIntoViewIfNeeded()
      const toggle = row.locator('button').last()
      await toggle.click()
      await settle(page, 900)
      return { row, toggle }
    }
    await page.waitForTimeout(700)
  }
  return null
}

async function clickMorningNoteButton(page, labelPattern) {
  const button = await firstExisting(page.getByRole('button', { name: labelPattern }))
  if (!button) return false
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await settle(page, 1200)
  return true
}

async function clickFirstResearchHistory(page) {
  const item = page.getByText(/\d+\s*輪分析/).first()

  if ((await item.count()) === 0) return false
  await item.scrollIntoViewIfNeeded()
  await item.click()
  await settle(page, 1000)
  return true
}

async function hasResearchHistory(page) {
  return (await page.getByText(/\d+\s*輪分析/).count()) > 0
}

async function clickFirstEventMarker(page) {
  const candidates = [
    page.locator('.events-timeline__marker').first(),
    page.locator('.events-timeline__mobile-item').first(),
  ]

  for (const candidate of candidates) {
    if ((await candidate.count()) === 0) continue
    if (!(await candidate.isVisible().catch(() => false))) continue
    await candidate.scrollIntoViewIfNeeded()
    await candidate.click({ force: true })
    await settle(page, 800)
    return true
  }

  return false
}

async function hasEventMarker(page) {
  return (await page.locator('.events-timeline__marker').count()) > 0
}

async function clickFirstEventFilter(page, name) {
  const button = page.getByRole('button', { name, exact: true }).first()
  if ((await button.count()) === 0) return false
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await settle(page, 800)
  return true
}

async function hasEventFilter(page, name) {
  return (await page.getByRole('button', { name, exact: true }).count()) > 0
}

async function clickFirstNewsAction(page, buttonName) {
  const button = page.getByRole('button', { name: buttonName }).first()
  if ((await button.count()) === 0) return false
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await settle(page, 900)
  return true
}

async function hasNewsAction(page, buttonName) {
  return (await page.getByRole('button', { name: buttonName }).count()) > 0
}

async function clickFirstDailySummary(page) {
  const card = page
    .locator('[data-testid="daily-panel"] .ui-card')
    .filter({ hasText: /收盤分析/ })
    .first()
  if ((await card.count()) === 0) return false
  await card.scrollIntoViewIfNeeded()
  await card.click()
  await settle(page, 900)
  return true
}

async function hasDailySummary(page) {
  return (
    (await page
      .locator('[data-testid="daily-panel"] .ui-card')
      .filter({ hasText: /收盤分析/ })
      .count()) > 0
  )
}

async function getVisibleHoldingCodes(page) {
  const rows = page.locator('[data-holding-code]')
  return sortHoldingCodes(
    await rows.evaluateAll((nodes) =>
      nodes
        .map((node) => String(node.getAttribute('data-holding-code') || '').trim())
        .filter(Boolean)
    )
  )
}

async function assertPersonaHoldingsAligned(page, persona, state = null) {
  const actual = await getVisibleHoldingCodes(page)
  const expected = sortHoldingCodes(persona.canonicalHoldings)
  const diff = diffHoldingCodes(actual, expected)

  if (state) {
    recordNote(
      state,
      `persona ${persona.personaId} canonical holdings → actual=${actual.length}, expected=${expected.length}, missing=${diff.missing.join(', ') || 'none'}, extra=${diff.extra.join(', ') || 'none'}`
    )
  }

  expect(actual, `persona ${persona.personaId} holdings drift`).toEqual(expected)
  return { actual, expected, diff }
}

async function ensurePersonaHoldingsAligned(page, persona, state = null, attempts = 3) {
  let lastResult = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const actual = await getVisibleHoldingCodes(page)
    const expected = sortHoldingCodes(persona.canonicalHoldings)
    const diff = diffHoldingCodes(actual, expected)
    lastResult = { actual, expected, diff }

    if (state) {
      recordNote(
        state,
        `persona ${persona.personaId} alignment attempt ${attempt + 1}/${attempts} → actual=${actual.length}, expected=${expected.length}, missing=${diff.missing.join(', ') || 'none'}, extra=${diff.extra.join(', ') || 'none'}`
      )
    }

    if (diff.missing.length === 0 && diff.extra.length === 0) {
      return lastResult
    }

    if (attempt === attempts - 1) break

    await selectPortfolio(page, persona)
    await clickTab(page, 'holdings', '持倉')
    await settle(page, 1800)
  }

  expect(lastResult?.actual || [], `persona ${persona.personaId} holdings drift`).toEqual(
    lastResult?.expected || []
  )
  return lastResult
}

function pickPersonaDrillCodes(persona, limit = 1) {
  const preferred = PERSONA_DRILL_PREFERENCES[persona.personaId] || []
  const prioritized = preferred.filter((code) => persona.canonicalHoldings.includes(code))
  const fallback = persona.canonicalHoldings.filter((code) => !prioritized.includes(code))
  return [...prioritized, ...fallback].slice(0, limit)
}

async function logoutOrReset(page) {
  const logoutButton = await firstExisting(
    page.getByTestId('logout-btn'),
    page.getByRole('button', { name: /登出|logout/i })
  )

  if (logoutButton && (await logoutButton.isVisible().catch(() => false))) {
    await logoutButton.click()
    await settle(page, 2200)
    return 'button'
  }

  await page.context().clearCookies()
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  return 'storage-reset'
}

async function openPortfolioHome(page, { portfolioId, custId, portfolioLabel, portfolioLabels }) {
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await expect(page).toHaveTitle(/持倉看板|Portfolio/)
  return selectPortfolio(page, { portfolioId, custId, portfolioLabel, portfolioLabels })
}

async function ensureHoldingReady(
  page,
  {
    code,
    portfolioId = '',
    custId = '',
    portfolioLabel = '',
    portfolioLabels = [],
    retries = 3,
    waitMs = 1600,
  }
) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if ((await holdingRow(page, code).count()) > 0) {
      return { ready: true, attempts: attempt + 1 }
    }

    await page.waitForTimeout(waitMs)

    if (
      attempt < retries - 1 &&
      (portfolioId || custId || portfolioLabel || portfolioLabels.length > 0)
    ) {
      await selectPortfolio(page, { portfolioId, custId, portfolioLabel, portfolioLabels })
    }
  }

  return { ready: false, attempts: retries }
}

async function writeScenarioLog(testInfo) {
  const state = stepLogsByTestId.get(testInfo.testId)
  if (!state) return
  ensureDir(STEP_LOG_DIR)
  const filePath = resolve(STEP_LOG_DIR, `${slugify(state.scenario)}.json`)
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        scenario: state.scenario,
        screenshotDir: state.screenshotDir,
        steps: state.steps,
        notes: state.notes,
      },
      null,
      2
    )}\n`
  )
}

test.afterEach(async ({}, testInfo) => {
  try {
    const payload = finalizeQaEvidence(testInfo)
    ensureDir(STEP_LOG_DIR)
    writeFileSync(
      resolve(STEP_LOG_DIR, `${slugify(testInfo.title)}-evidence.json`),
      `${JSON.stringify(payload, null, 2)}\n`
    )
  } finally {
    await writeScenarioLog(testInfo)
  }
})

test('ux simulation round2 persona A (me) runs live audit with error-state capture', async ({
  page,
}, testInfo) => {
  test.setTimeout(8 * 60 * 1000)

  const scenario = buildRound2Scenario('ux-round2-me', testInfo)
  const state = createScenarioState(testInfo, scenario, scenario)
  installQaMonitor(testInfo, page, {
    ignoredPageErrorPatterns: [],
    ignoredResponsePatterns: [],
  })
  const errorCapture = installRound2ErrorCapture({
    page,
    testInfo,
    state,
    personaPrefix: 'me',
  })
  const personaADrillCodes = pickPersonaDrillCodes(PERSONA_A, 1)

  try {
    if (
      await runUx21HeaderMeasurementMatrix(page, testInfo, state, [
        {
          key: 'me',
          label: 'me / retail',
          viewMode: 'portfolio',
          kind: 'portfolio',
          persona: PERSONA_A,
        },
        {
          key: 'overview',
          label: 'overview',
          viewMode: 'overview',
          kind: 'overview',
          persona: PERSONA_A,
        },
      ])
    ) {
      return
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A01',
      label: 'Persona A · open home and select me portfolio',
      screenshotName: '01-home-top.png',
      action: async () => {
        const matched = await openPortfolioHome(page, PERSONA_A)
        recordNote(state, `live me option resolved to "${matched.text}"`)
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A02',
      label: 'Persona A · scroll home to bottom',
      screenshotName: '01-home-bottom.png',
      action: async () => {
        await scrollToBottom(page)
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A03',
      label: 'Persona A · click holdings tab from home state',
      screenshotName: '02-holdings-initial.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'holdings', '持倉')
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A04',
      label: 'Persona A · canonical holdings aligned with fixture contract',
      action: async () => {
        await assertPersonaHoldingsAligned(page, PERSONA_A, state)
        recordNote(
          state,
          `persona A drill candidates from canonical fixture: ${personaADrillCodes.join(', ') || 'none'}`
        )
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A05',
      label: 'Persona A · scroll holdings table mid state',
      screenshotName: '02-holdings-scroll-mid.png',
      action: async () => {
        await scrollBy(page, 520, 3)
      },
    })

    if (personaADrillCodes[0]) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A06',
        label: `Persona A · canonical drill open ${personaADrillCodes[0]}`,
        screenshotName: `02-holdings-detail-${personaADrillCodes[0]}-fallback.png`,
        action: async () => {
          const result = await toggleHolding(page, personaADrillCodes[0])
          if (!result)
            throw new Error(`missing canonical holding ${personaADrillCodes[0]} for persona A`)
        },
      })

      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A07',
        label: `Persona A · canonical drill scroll ${personaADrillCodes[0]} detail`,
        screenshotName: `02-holdings-detail-${personaADrillCodes[0]}-scroll.png`,
        action: async () => {
          await scrollBy(page, 260, 1)
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A08',
      label: 'Persona A · click research tab',
      screenshotName: '03-research-initial.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'research', '深度研究')
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A09',
      label: 'Persona A · scroll research page',
      screenshotName: '03-research-scroll.png',
      action: async () => {
        await scrollBy(page, 540, 2)
      },
    })

    if (await hasResearchHistory(page)) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A10',
        label: 'Persona A · click first research history detail',
        screenshotName: '03-research-detail.png',
        action: async () => {
          await clickFirstResearchHistory(page)
        },
      })
    } else {
      await recordBlockedStep({
        page,
        testInfo,
        state,
        stepId: 'A10',
        label: 'Persona A · research detail click unavailable',
        note: 'No clickable research history item was found in live me portfolio state.',
        screenshotName: '03-research-detail-missing.png',
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A11',
      label: 'Persona A · click events tab',
      screenshotName: '04-events-initial.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'events', '事件追蹤')
      },
    })

    if (await hasEventMarker(page)) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A12',
        label: 'Persona A · click event marker drill',
        screenshotName: '04-events-drill.png',
        action: async () => {
          await clickFirstEventMarker(page)
        },
      })
    } else {
      await recordBlockedStep({
        page,
        testInfo,
        state,
        stepId: 'A12',
        label: 'Persona A · event drill unavailable',
        note: 'No clickable event timeline marker existed in the current live view.',
        screenshotName: '04-events-drill-missing.png',
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A13',
      label: 'Persona A · click news tab',
      screenshotName: '04-news-initial.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'news', '新聞聚合')
      },
    })

    if (await hasNewsAction(page, '標記已看')) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A14',
        label: 'Persona A · mark first news item as read',
        screenshotName: '04-news-mark-read.png',
        action: async () => {
          await clickFirstNewsAction(page, '標記已看')
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A15',
      label: 'Persona A · click daily tab',
      screenshotName: '05-daily-initial.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'daily', '收盤分析')
      },
    })

    if (await hasDailySummary(page)) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A16',
        label: 'Persona A · expand daily summary card',
        screenshotName: '05-daily-expanded.png',
        action: async () => {
          await clickFirstDailySummary(page)
          await saveShot(page, testInfo, 'ux-06-verify', 'me-daily.png')
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A17',
      label: 'Persona A · scroll daily page',
      screenshotName: '05-daily-scroll.png',
      action: async () => {
        await scrollBy(page, 520, 3)
      },
    })

    const diffButton = page.getByTestId('daily-diff-toggle').first()
    if ((await diffButton.count()) === 0) {
      await recordBlockedStep({
        page,
        testInfo,
        state,
        stepId: 'A18',
        label: 'Persona A · same-day diff control missing',
        note: 'Live me daily page has no diff button, so t0/t1 comparison drill cannot be executed.',
        screenshotName: '05-daily-diff-missing.png',
      })
    } else {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'A18',
        label: 'Persona A · open same-day diff pane',
        screenshotName: '05-daily-diff-open.png',
        action: async () => {
          await diffButton.scrollIntoViewIfNeeded()
          await diffButton.click()
          await expect(page.getByTestId('daily-diff-pane')).toBeVisible()
          await saveShot(page, testInfo, 'ux-06-verify', 'me-daily-diff.png')
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A19',
      label: 'Persona A · click trade log tab',
      screenshotName: '06-log-initial.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'log', '交易日誌')
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'A20',
      label: 'Persona A · logout/reset state',
      screenshotName: '09-logout.png',
      action: async () => {
        const mode = await logoutOrReset(page)
        recordNote(state, `logout completed via ${mode}`)
      },
    })
  } finally {
    await errorCapture.flush()
    await writeScenarioLog(testInfo)
  }
})

test('ux simulation round2 persona B (7865 / 金聯成) runs live audit with compliance trace', async ({
  page,
}, testInfo) => {
  test.setTimeout(8 * 60 * 1000)
  await primePersonaBSeed(page)

  const scenario = buildRound2Scenario('ux-round2-7865', testInfo)
  const state = createScenarioState(testInfo, scenario, scenario)
  installQaMonitor(testInfo, page, {
    ignoredPageErrorPatterns: [],
    ignoredResponsePatterns: [],
  })
  const errorCapture = installRound2ErrorCapture({
    page,
    testInfo,
    state,
    personaPrefix: '7865',
  })

  try {
    if (
      await runUx21HeaderMeasurementMatrix(page, testInfo, state, [
        {
          key: '7865',
          label: '7865 / insider-compressed',
          viewMode: 'portfolio',
          kind: 'portfolio',
          persona: PERSONA_B,
        },
      ])
    ) {
      return
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B01',
      label: 'Persona B · open home and select 金聯成 portfolio',
      screenshotName: '7865-01-home.png',
      action: async () => {
        const matched = await openPortfolioHome(page, PERSONA_B)
        recordNote(
          state,
          `live 7865 option resolved to "${matched.text}" with value "${matched.value}"`
        )
        const ready = await ensureHoldingReady(page, {
          code: '7865',
          portfolioId: matched.value,
          custId: PERSONA_B.custId,
          portfolioLabel: PERSONA_B.portfolioLabel,
          portfolioLabels: PERSONA_B.portfolioLabels,
          retries: 3,
        })
        recordNote(state, `7865 holding ready after ${ready.attempts} attempt(s): ${ready.ready}`)
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B02',
      label: 'Persona B · scroll home to inspect anxiety indicators',
      screenshotName: '7865-01-home-scroll.png',
      action: async () => {
        await scrollBy(page, 520, 2)
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B03',
      label: 'Persona B · open self holding 7865',
      screenshotName: '7865-02-holdings-self.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'holdings', '持倉')
        await ensurePersonaHoldingsAligned(page, PERSONA_B, state)
        const ready = await ensureHoldingReady(page, {
          code: '7865',
          custId: PERSONA_B.custId,
          portfolioLabel: PERSONA_B.portfolioLabel,
          portfolioLabels: PERSONA_B.portfolioLabels,
          retries: 2,
        })
        recordNote(state, `persona B self holding 7865 ready in holdings tab: ${ready.ready}`)
        const result = await toggleHolding(page, '7865')
        if (!result) throw new Error('missing canonical holding 7865 for persona B')
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B04',
      label: 'Persona B · open 2489 holding for alternative-info audit',
      screenshotName: '7865-02-holdings-2489.png',
      action: async () => {
        await toggleHolding(page, '7865')
        const result = await toggleHolding(page, '2489')
        if (!result) throw new Error('missing canonical holding 2489 for persona B')
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B05',
      label: 'Persona B · open 1799 holding for negative-EPS style audit',
      screenshotName: '7865-02-holdings-1799.png',
      action: async () => {
        await toggleHolding(page, '2489')
        const result = await toggleHolding(page, '1799')
        if (!result) throw new Error('missing canonical holding 1799 for persona B')
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B06',
      label: 'Persona B · click research tab',
      screenshotName: '7865-03-research.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'research', '深度研究')
      },
    })

    if (await hasResearchHistory(page)) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'B07',
        label: 'Persona B · click first research history item',
        screenshotName: '7865-03-research-detail.png',
        action: async () => {
          await clickFirstResearchHistory(page)
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B08',
      label: 'Persona B · click events tab',
      screenshotName: '7865-04-events.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'events', '事件追蹤')
      },
    })

    if (await hasEventFilter(page, '財報')) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'B09',
        label: 'Persona B · filter events to 財報',
        screenshotName: '7865-04-events-filter-financial.png',
        action: async () => {
          await clickFirstEventFilter(page, '財報')
        },
      })
    }

    if (!(await hasEventMarker(page))) {
      await recordBlockedStep({
        page,
        testInfo,
        state,
        stepId: 'B10',
        label: 'Persona B · event marker drill unavailable',
        note: 'Live 金聯成 events page currently shows an empty timeline state, so no event marker drill exists.',
        screenshotName: '7865-04-events-drill-missing.png',
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B11',
      label: 'Persona B · click news tab',
      screenshotName: '7865-04-news.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'news', '新聞聚合')
      },
    })

    if (await hasNewsAction(page, '標記已看')) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'B12',
        label: 'Persona B · mark first news item as read',
        screenshotName: '7865-04-news-mark-read.png',
        action: async () => {
          await clickFirstNewsAction(page, '標記已看')
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B13',
      label: 'Persona B · click daily tab',
      screenshotName: '7865-05-daily.png',
      action: async () => {
        await scrollToTop(page)
        await clickTab(page, 'daily', '收盤分析')
      },
    })

    if (await hasDailySummary(page)) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'B14',
        label: 'Persona B · expand daily summary',
        screenshotName: '7865-05-daily-expanded.png',
        action: async () => {
          await clickFirstDailySummary(page)
          await saveShot(page, testInfo, 'ux-06-verify', '7865-daily.png')
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B15',
      label: 'Persona B · scroll daily page',
      screenshotName: '7865-05-daily-scroll.png',
      action: async () => {
        await scrollBy(page, 520, 2)
      },
    })

    const diffButton = page.getByTestId('daily-diff-toggle').first()
    if ((await diffButton.count()) === 0) {
      await recordBlockedStep({
        page,
        testInfo,
        state,
        stepId: 'B16',
        label: 'Persona B · same-day diff control missing',
        note: 'Live 金聯成 daily page has no t0/t1 diff control to validate aggregate-only behavior.',
        screenshotName: '7865-05-daily-diff-missing.png',
      })
    } else {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'B16',
        label: 'Persona B · open aggregate-only same-day diff pane',
        screenshotName: '7865-05-daily-diff-open.png',
        action: async () => {
          await diffButton.scrollIntoViewIfNeeded()
          await diffButton.click()
          await expect(page.getByTestId('daily-diff-pane')).toBeVisible()
          await expect(page.getByTestId('daily-diff-pane')).toContainText(
            't0/t1 差異為 aggregate · 不顯示個股細節'
          )
          await saveShot(page, testInfo, 'ux-06-verify', '7865-daily-diff.png')
        },
      })
    }

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'B17',
      label: 'Persona B · logout/reset state',
      screenshotName: '7865-09-logout.png',
      action: async () => {
        const mode = await logoutOrReset(page)
        recordNote(state, `logout completed via ${mode}`)
      },
    })
  } finally {
    await errorCapture.flush()
    await writeScenarioLog(testInfo)
  }
})

test('ux simulation agent bridge scroll capture records four desktop states', async ({
  page,
}, testInfo) => {
  test.setTimeout(6 * 60 * 1000)

  const state = createScenarioState(testInfo, 'ux-round1-agent-bridge', 'ux-round1-agent-bridge')
  installQaMonitor(testInfo, page, {
    ignoredPageErrorPatterns: [],
    ignoredResponsePatterns: [],
  })

  try {
    await runStep({
      page,
      testInfo,
      state,
      stepId: 'G01',
      label: 'Agent Bridge · login and capture hero',
      screenshotName: 'agent-01-hero.png',
      action: async () => {
        await page.goto(`${AGENT_BRIDGE_BASE_URL}/dashboard/login.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        })
        await settle(page, 1800)
        await page.locator('#pin').fill('0306')
        await page.locator('#submitPin').click()
        await settle(page, 2600)
        await expect(page).toHaveURL(/\/dashboard\/?$/)
      },
    })

    await runStep({
      page,
      testInfo,
      state,
      stepId: 'G02',
      label: 'Agent Bridge · scroll to focus section',
      screenshotName: 'agent-02-focus.png',
      action: async () => {
        const focusSection = page.locator('[data-label="FOCUS"]').first()
        await focusSection.scrollIntoViewIfNeeded()
        await page.waitForTimeout(400)
      },
    })

    const pendingSection = page.locator('[data-label="PENDING"]').first()
    const weekSection = page.locator('[data-label="WEEK"]').first()

    if ((await pendingSection.count()) > 0) {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'G03',
        label: 'Agent Bridge · scroll to pending section',
        screenshotName: 'agent-03-pending.png',
        action: async () => {
          await pendingSection.scrollIntoViewIfNeeded()
          await page.waitForTimeout(400)
        },
      })

      await runStep({
        page,
        testInfo,
        state,
        stepId: 'G04',
        label: 'Agent Bridge · scroll to week section',
        screenshotName: 'agent-04-week.png',
        action: async () => {
          await weekSection.scrollIntoViewIfNeeded()
          await page.waitForTimeout(400)
        },
      })
    } else {
      await runStep({
        page,
        testInfo,
        state,
        stepId: 'G03',
        label: 'Agent Bridge · scroll to week section (no pending section present)',
        screenshotName: 'agent-03-week.png',
        action: async () => {
          await weekSection.scrollIntoViewIfNeeded()
          await page.waitForTimeout(400)
        },
      })

      await runStep({
        page,
        testInfo,
        state,
        stepId: 'G04',
        label: 'Agent Bridge · capture lower dashboard state',
        screenshotName: 'agent-04-bottom.png',
        action: async () => {
          await scrollToBottom(page)
        },
      })
    }
  } finally {
    await writeScenarioLog(testInfo)
  }
})
