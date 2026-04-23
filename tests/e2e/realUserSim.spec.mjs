import { expect, test } from '@playwright/test'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maybeAcceptTradeDisclaimer } from './support/tradeHelpers.mjs'

const ROOT_DIR = process.cwd()
const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()
const EVIDENCE_STAMP =
  String(process.env.UX25_EVIDENCE_STAMP || '')
    .trim()
    .replace(/[^0-9A-Za-z_.-]+/g, '-') ||
  new Date().toISOString().replace(/[:.]/g, '-')
const EVIDENCE_DIR = resolve(
  ROOT_DIR,
  `.tmp/ux-25-e2e-real-user-sim/evidence-${EVIDENCE_STAMP}`
)
const SCREENSHOT_DIR = resolve(EVIDENCE_DIR, 'screenshots')
const STEP_DIR = resolve(EVIDENCE_DIR, 'steps')
const CONSOLE_JSONL = resolve(EVIDENCE_DIR, 'console.jsonl')
const NETWORK_JSONL = resolve(EVIDENCE_DIR, 'network-errors.jsonl')
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures', import.meta.url))
const VALID_BACKUP_FIXTURE_PATH = resolve(FIXTURE_DIR, 'valid-backup.json')
const STEP_WAIT_MS = 1200

test.use({
  trace: 'on',
  video: 'on',
})

function ensureDir(target) {
  mkdirSync(target, { recursive: true })
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ensureEvidenceDirs() {
  ensureDir(EVIDENCE_DIR)
  ensureDir(SCREENSHOT_DIR)
  ensureDir(STEP_DIR)
}

function appendJsonl(targetPath, payload) {
  ensureDir(dirname(targetPath))
  appendFileSync(targetPath, `${JSON.stringify(payload)}\n`, 'utf8')
}

function projectPrefix(testInfo) {
  return slugify(testInfo.project.name || 'unknown-project')
}

function buildEvidenceShotPath(testInfo, fileName) {
  return resolve(SCREENSHOT_DIR, `${projectPrefix(testInfo)}-${fileName}`)
}

function classifyNetworkIssue(url) {
  const href = String(url || '')
  if (href.includes('/api/brain')) return 'brain-api'
  if (href.includes('/api/research')) return 'research-api'
  if (href.includes('/api/target-prices')) return 'target-prices'
  if (href.includes('/api/finmind')) return 'finmind'
  return 'other'
}

function summarizeNetworkIssues(entries = []) {
  const groups = new Map()
  for (const entry of entries) {
    const key = `${entry.issue}:${entry.status}`
    const current = groups.get(key) || {
      issue: entry.issue,
      status: entry.status,
      count: 0,
      sampleUrl: entry.url,
    }
    current.count += 1
    groups.set(key, current)
  }
  return [...groups.values()].sort((left, right) => right.count - left.count)
}

function countGridColumns(template = '') {
  return String(template || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

async function settle(page, waitMs = STEP_WAIT_MS) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
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

async function routeDailySnapshotStatus(page, payload) {
  await page.route('**/api/daily-snapshot-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

async function saveShot(page, testInfo, fileName, options = {}) {
  ensureEvidenceDirs()
  const targetPath = buildEvidenceShotPath(testInfo, fileName)
  await page.screenshot({
    path: targetPath,
    fullPage: false,
    animations: 'disabled',
    ...options,
  })
  return relative(ROOT_DIR, targetPath)
}

async function getPortfolioSelect(page) {
  return requireLocator('missing portfolio select', page.getByTestId('portfolio-select'), page.locator('select'))
}

async function getSelectedOptionLabel(select) {
  return select.evaluate(
    (element) => element.options[element.selectedIndex]?.textContent?.trim() || ''
  )
}

async function selectPortfolioByLabel(page, labelPattern) {
  const select = await getPortfolioSelect(page)
  const matchedValue = await select.evaluate((element, pattern) => {
    const matcher = new RegExp(pattern, 'i')
    const matched = Array.from(element.options).find((option) =>
      matcher.test(String(option.textContent || '').trim())
    )
    return matched?.value || ''
  }, String(labelPattern))

  if (!matchedValue) {
    throw new Error(`missing portfolio option matching ${labelPattern}`)
  }

  await select.selectOption(matchedValue)
  await settle(page, 2200)
  return {
    value: matchedValue,
    label: await getSelectedOptionLabel(select),
  }
}

async function clickTab(page, key, label) {
  const tab = await waitForAttachedLocator(
    5000,
    page.getByTestId(`tab-${key}`),
    page.getByRole('button', { name: label, exact: true })
  )
  if (!tab) throw new Error(`missing tab: ${key}`)
  await tab.scrollIntoViewIfNeeded()
  await tab.click()
  await settle(page)
}

async function waitForVisibleLocator(timeoutMs, ...locators) {
  for (const locator of locators) {
    const candidate = locator.first()
    try {
      await candidate.waitFor({ state: 'visible', timeout: timeoutMs })
      return candidate
    } catch {
      // try the next locator candidate
    }
  }

  return null
}

async function waitForAttachedLocator(timeoutMs, ...locators) {
  for (const locator of locators) {
    const candidate = locator.first()
    try {
      await candidate.waitFor({ state: 'attached', timeout: timeoutMs })
      return candidate
    } catch {
      // try the next locator candidate
    }
  }

  return null
}

async function ensureDashboardOpen(page) {
  const dashboardShell = await waitForVisibleLocator(
    1000,
    page.getByTestId('dashboard-headline'),
    page.locator('.dashboard-hero')
  )

  if (dashboardShell) return dashboardShell

  await clickTab(page, 'dashboard', '看板')
  return requireLocator(
    'missing dashboard shell after switching to dashboard tab',
    page.getByTestId('dashboard-headline'),
    page.locator('.dashboard-hero')
  )
}

async function returnToPortfolioView(page) {
  const button = await firstExisting(
    page.getByRole('button', { name: /返回目前組合|返回組合/ }),
    page.getByRole('button', { name: /返回目前投組|返回/ })
  )
  if (!button) return false
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await settle(page, 1200)
  return true
}

async function openTabAndAssert(page, key, label) {
  await clickTab(page, key, label)

  if (key === 'dashboard') {
    await expect(page.getByTestId('dashboard-headline')).toBeVisible()
    return
  }
  if (key === 'holdings') {
    await expect(page.getByTestId('holdings-panel')).toBeVisible()
    return
  }
  if (key === 'events') {
    const panel = await requireLocator(
      'missing events panel',
      page.getByTestId('events-panel'),
      page.getByText(/全部主題|事件追蹤/)
    )
    await expect(panel).toBeVisible()
    return
  }
  if (key === 'news') {
    await expect(page.getByTestId('news-panel')).toBeVisible()
    return
  }
  if (key === 'daily') {
    await expect(page.getByTestId('daily-panel')).toBeVisible()
    return
  }
  if (key === 'research') {
    await expect(page.getByTestId('research-panel')).toBeVisible()
    return
  }
  if (key === 'trade') {
    await expect(page.getByTestId('trade-panel')).toBeVisible()
    await maybeAcceptTradeDisclaimer(page)
    return
  }
  if (key === 'log') {
    await expect(page.getByTestId('trade-log-panel')).toBeVisible()
    return
  }
  if (key === 'overview') {
    const panel = await requireLocator(
      'missing overview panel',
      page.getByTestId('overview-kpi-cards'),
      page.getByText(/全部總覽|總資產/)
    )
    await expect(panel).toBeVisible()
  }
}

async function readCapturedClipboard(page) {
  return page.evaluate(() => {
    const writes = Array.isArray(window.__ux25ClipboardWrites) ? window.__ux25ClipboardWrites : []
    return String(writes[writes.length - 1] || '').trim()
  })
}

async function installClipboardCapture(page) {
  await page.addInitScript(() => {
    const writes = []
    const currentClipboard = navigator.clipboard || {}
    const originalWriteText =
      typeof currentClipboard.writeText === 'function'
        ? currentClipboard.writeText.bind(currentClipboard)
        : null
    const originalReadText =
      typeof currentClipboard.readText === 'function'
        ? currentClipboard.readText.bind(currentClipboard)
        : null

    window.__ux25ClipboardWrites = writes

    const wrappedClipboard = {
      ...currentClipboard,
      async writeText(text) {
        writes.push(String(text ?? ''))
        if (originalWriteText) {
          try {
            return await originalWriteText(text)
          } catch {
            return undefined
          }
        }
        return undefined
      },
      async readText() {
        if (writes.length > 0) return writes[writes.length - 1]
        if (originalReadText) {
          try {
            return await originalReadText()
          } catch {
            return ''
          }
        }
        return ''
      },
    }

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: wrappedClipboard,
      })
    } catch {
      // no-op: some browsers keep navigator.clipboard non-configurable
    }
  })
}

async function measureDashboardValue(page) {
  return page.getByTestId('dashboard-headline').evaluate((element) => {
    const siblings = Array.from(element.parentElement?.children || [])
    const totalAssetLabelIndex = siblings.findIndex(
      (node) => String(node.textContent || '').trim() === '總資產'
    )
    const valueNode =
      totalAssetLabelIndex >= 0
        ? siblings[totalAssetLabelIndex + 1]
        : siblings.find((node) => /\d/.test(String(node.textContent || '')))
    if (!valueNode) return { text: '', fontSizePx: 0 }
    return {
      text: String(valueNode.textContent || '').trim(),
      fontSizePx: Number.parseFloat(getComputedStyle(valueNode).fontSize || '0'),
    }
  })
}

async function expandFirstHolding(page) {
  const firstRow = page.locator('[data-holding-code]').first()
  const code = String((await firstRow.getAttribute('data-holding-code')) || '').trim()
  if (!code) throw new Error('missing holding row code')

  const toggle = firstRow.locator('button').last()
  await toggle.scrollIntoViewIfNeeded()
  await toggle.click()
  await settle(page, 1500)

  const drill = page.locator(`[data-testid="holding-drill-${code}"]`)
  await expect(drill).toBeVisible()
  const text = String((await drill.textContent()) || '').replace(/\s+/g, ' ').trim()
  const hasMeaningfulContent =
    /thesis|pillar|valuation|估值|目標價|財報|aggregate|合規模式|資料新鮮度|買進理由/i.test(text) &&
    text.length >= 12

  expect(hasMeaningfulContent).toBeTruthy()
  return { code, text }
}

async function measureMobileLayout(page) {
  return page.evaluate(() => {
    const sticky =
      document.querySelector('[data-testid="header-sticky-zone"]') ||
      document.querySelector('[data-testid="header-root"]')
    const newsLayout = document.querySelector('[data-testid="news-layout"]')
    const heroGrid = document.querySelector('[data-testid="news-hero-grid"]')
    const stickyRect = sticky?.getBoundingClientRect?.()

    return {
      stickyTop: stickyRect ? Number(stickyRect.top.toFixed(2)) : null,
      stickyHeight: stickyRect ? Number(stickyRect.height.toFixed(2)) : null,
      newsGridTemplateColumns: newsLayout ? getComputedStyle(newsLayout).gridTemplateColumns : '',
      heroGridTemplateColumns: heroGrid ? getComputedStyle(heroGrid).gridTemplateColumns : '',
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }
  })
}

function assertWeeklyExportContent(text) {
  const value = String(text || '').trim()
  const hasMarkdownHeading = /(^|\n)##\s+\S/m.test(value)
  const hasHtmlHeading = /<h2\b/i.test(value)
  const hasMarkdownTable = /\|/.test(value)
  const hasHtmlTable = /<table\b/i.test(value)
  const hasMarkdownQuote = /(^|\n)>\s+\S/m.test(value)
  const notPlainNumeric = !/^[\d\s.,+\-/%]+$/.test(value)
  const hasKeywords = /本週損益|損益|論述|Weekly Narrative|金聯成|7865|持倉/i.test(value)
  const structuralSignals = [hasMarkdownHeading || hasHtmlHeading, hasMarkdownTable || hasHtmlTable, hasMarkdownQuote || hasHtmlTable].filter(Boolean).length

  expect(value.length).toBeGreaterThan(120)
  expect(notPlainNumeric).toBeTruthy()
  expect(hasKeywords).toBeTruthy()
  expect(structuralSignals).toBeGreaterThanOrEqual(2)

  return {
    length: value.length,
    hasMarkdownHeading,
    hasMarkdownTable,
    hasMarkdownQuote,
    hasHtmlHeading,
    hasHtmlTable,
    hasKeywords,
  }
}

async function captureWeeklyExport(page, testInfo) {
  const weeklyButton = await requireLocator(
    'missing weekly report button',
    page.getByRole('button', { name: /週報/ }),
    page.getByRole('button', { name: /copyWeeklyReport/i })
  )
  const downloadPromise = page
    .waitForEvent('download', { timeout: 3000 })
    .then((download) => ({ kind: 'download', download }))
    .catch(() => null)

  await weeklyButton.scrollIntoViewIfNeeded()
  await weeklyButton.click()
  await settle(page, 900)

  const downloadResult = await downloadPromise
  if (downloadResult?.download) {
    const suggestedFilename = downloadResult.download.suggestedFilename()
    const targetPath = resolve(EVIDENCE_DIR, 'downloads', `${projectPrefix(testInfo)}-${suggestedFilename}`)
    ensureDir(dirname(targetPath))
    await downloadResult.download.saveAs(targetPath)
    return {
      method: 'download',
      path: relative(ROOT_DIR, targetPath),
      fileName: suggestedFilename,
      content: readFileSync(targetPath, 'utf8'),
    }
  }

  const clipboardText = await readCapturedClipboard(page)
  if (!clipboardText) {
    throw new Error('weekly export produced neither download nor clipboard payload')
  }

  return {
    method: 'clipboard',
    content: clipboardText,
  }
}

async function captureBackupExport(page, testInfo) {
  const downloadPromise = page.waitForEvent('download', { timeout: 7000 })
  const button = await requireLocator(
    'missing backup export button',
    page.getByRole('button', { name: '備份', exact: true })
  )
  await button.scrollIntoViewIfNeeded()
  await button.click()

  const download = await downloadPromise
  const suggestedFilename = download.suggestedFilename()
  const targetPath = resolve(EVIDENCE_DIR, 'downloads', `${projectPrefix(testInfo)}-${suggestedFilename}`)
  ensureDir(dirname(targetPath))
  await download.saveAs(targetPath)
  return {
    fileName: suggestedFilename,
    path: targetPath,
    relativePath: relative(ROOT_DIR, targetPath),
  }
}

async function confirmImportDialog(page, title, buttonLabel) {
  const dialog = page.getByRole('dialog').filter({ hasText: title }).first()
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: buttonLabel, exact: true }).click()
  await settle(page, 500)
}

function createState(testInfo) {
  return {
    project: testInfo.project.name,
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    currentStepId: null,
    steps: [],
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
  }
}

function installRuntimeCapture(page, testInfo, state) {
  page.on('pageerror', (error) => {
    const entry = {
      at: new Date().toISOString(),
      project: testInfo.project.name,
      stepId: state.currentStepId,
      kind: 'pageerror',
      message: String(error?.message || error || ''),
    }
    state.pageErrors.push(entry)
    appendJsonl(CONSOLE_JSONL, entry)
  })

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = String(message.text() || '').trim()
    if (!text || /^Failed to load resource:/i.test(text)) return
    const entry = {
      at: new Date().toISOString(),
      project: testInfo.project.name,
      stepId: state.currentStepId,
      kind: 'console',
      message: text,
    }
    state.consoleErrors.push(entry)
    appendJsonl(CONSOLE_JSONL, entry)
  })

  page.on('response', (response) => {
    if (response.status() < 400) return
    const entry = {
      at: new Date().toISOString(),
      project: testInfo.project.name,
      stepId: state.currentStepId,
      status: response.status(),
      issue: classifyNetworkIssue(response.url()),
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      url: response.url(),
    }
    state.networkErrors.push(entry)
    appendJsonl(NETWORK_JSONL, entry)
  })
}

async function runStep(state, page, testInfo, { id, label, screenshotName = null, optional = false, action }) {
  const beforeConsole = state.consoleErrors.length
  const beforePageErrors = state.pageErrors.length
  const beforeNetworkErrors = state.networkErrors.length
  state.currentStepId = id

  let status = optional ? 'skipped' : 'passed'
  let note = ''
  let metadata = {}
  let screenshot = null

  try {
    const result = await action()
    status = result?.status || 'passed'
    note = String(result?.note || '').trim()
    metadata = result?.metadata || {}
  } catch (error) {
    status = optional ? 'blocked' : 'failed'
    note = String(error?.message || error || 'unknown error')
  }

  if (!note) {
    const newConsoleErrors = state.consoleErrors.length - beforeConsole
    const newPageErrors = state.pageErrors.length - beforePageErrors
    if (newConsoleErrors > 0 || newPageErrors > 0) {
      status = 'failed'
      note = `new runtime errors detected: console +${newConsoleErrors}, pageerror +${newPageErrors}`
    }
  }

  if (!note) {
    const newNetworkErrors = state.networkErrors.length - beforeNetworkErrors
    if (newNetworkErrors > 0) {
      note = `network errors observed +${newNetworkErrors}`
    }
  }

  if (screenshotName) {
    try {
      screenshot = await saveShot(page, testInfo, screenshotName)
    } catch (error) {
      const shotError = String(error?.message || error || '')
      note = note ? `${note}; screenshot failed: ${shotError}` : `screenshot failed: ${shotError}`
    }
  }

  const entry = {
    id,
    label,
    status,
    note,
    screenshot,
    metadata,
    recordedAt: new Date().toISOString(),
  }
  state.steps.push(entry)
  state.currentStepId = null
  return entry
}

function writeStepLog(testInfo, state) {
  ensureEvidenceDirs()
  const networkSummary = summarizeNetworkIssues(state.networkErrors)
  const payload = {
    project: testInfo.project.name,
    baseUrl: BASE_URL,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    stepCounts: {
      passed: state.steps.filter((step) => step.status === 'passed').length,
      failed: state.steps.filter((step) => step.status === 'failed').length,
      blocked: state.steps.filter((step) => step.status === 'blocked').length,
      skipped: state.steps.filter((step) => step.status === 'skipped').length,
    },
    steps: state.steps,
    consoleErrors: state.consoleErrors,
    pageErrors: state.pageErrors,
    networkErrorCount: state.networkErrors.length,
    networkSummary,
  }

  const targetPath = resolve(STEP_DIR, `${projectPrefix(testInfo)}.json`)
  writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

async function copyTraceAndVideoArtifacts(testInfo) {
  ensureEvidenceDirs()
  const traceDir = resolve(EVIDENCE_DIR, 'traces')
  const videoDir = resolve(EVIDENCE_DIR, 'videos')
  ensureDir(traceDir)
  ensureDir(videoDir)

  const candidates = existsSync(testInfo.outputDir) ? readdirSync(testInfo.outputDir) : []
  for (const fileName of candidates) {
    const sourcePath = resolve(testInfo.outputDir, fileName)
    const extension = extname(fileName).toLowerCase()
    if (extension === '.zip') {
      copyFileSync(sourcePath, resolve(traceDir, `${projectPrefix(testInfo)}-${basename(fileName)}`))
    }
    if (extension === '.webm') {
      copyFileSync(sourcePath, resolve(videoDir, `${projectPrefix(testInfo)}-${basename(fileName)}`))
    }
  }

  for (const attachment of testInfo.attachments || []) {
    if (!attachment?.path || !existsSync(attachment.path)) continue
    const extension = extname(attachment.path).toLowerCase()
    if (extension === '.zip') {
      copyFileSync(
        attachment.path,
        resolve(traceDir, `${projectPrefix(testInfo)}-${basename(attachment.path)}`)
      )
    }
    if (extension === '.webm') {
      copyFileSync(
        attachment.path,
        resolve(videoDir, `${projectPrefix(testInfo)}-${basename(attachment.path)}`)
      )
    }
  }
}

test.afterEach(async ({ page }, testInfo) => {
  if (!testInfo?.status) return
  await page.waitForTimeout(100)
  await copyTraceAndVideoArtifacts(testInfo)
})

test('dashboard shows a stale snapshot badge when the daily snapshot marker is older than 36 hours', async ({
  page,
}) => {
  await routeDailySnapshotStatus(page, {
    ok: false,
    stale: true,
    badgeStatus: 'stale',
    lastSuccessAt: '2026-04-22T18:00:00.000Z',
    lastAttemptAt: '2026-04-22T18:00:00.000Z',
    lastAttemptStatus: 'success',
  })

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await maybeAcceptTradeDisclaimer(page)

  await expect(page.getByTestId('daily-snapshot-status-card')).toBeVisible()
  await expect(page.getByTitle('daily snapshot freshness')).toContainText('stale')
  await expect(page.getByTestId('daily-snapshot-status-copy')).toContainText('已超過 36 小時')
})

test('dashboard hides the stale snapshot badge when the daily snapshot marker is fresh', async ({
  page,
}) => {
  await routeDailySnapshotStatus(page, {
    ok: true,
    stale: false,
    badgeStatus: 'fresh',
    lastSuccessAt: '2026-04-24T02:55:00.000Z',
    lastAttemptAt: '2026-04-24T02:55:00.000Z',
    lastAttemptStatus: 'success',
  })

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await maybeAcceptTradeDisclaimer(page)

  await expect(page.getByTestId('daily-snapshot-status-card')).toHaveCount(0)
})

test('real user simulation covers golden path, clipboard/download correctness, backup import/export, and mobile scroll evidence', async ({
  page,
}, testInfo) => {
  test.setTimeout(12 * 60 * 1000)
  ensureEvidenceDirs()
  await installClipboardCapture(page)

  const state = createState(testInfo)
  installRuntimeCapture(page, testInfo, state)

  await runStep(state, page, testInfo, {
    id: '01',
    label: 'Open app on dashboard default tab',
    screenshotName: '00-dashboard.png',
    action: async () => {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
      await settle(page, 2600)

      await expect(page).toHaveTitle(/持倉看板/)
      await ensureDashboardOpen(page)
      const headline = page.getByTestId('dashboard-headline')
      await expect(headline).toBeVisible()
      await expect(headline).toContainText(
        /論述仍穩|接近估值|主力剛進|資料補齊中|首頁結論|整體資料大致到位|整體論述仍穩/
      )

      const valueMeta = await measureDashboardValue(page)
      expect(valueMeta.fontSizePx).toBeGreaterThanOrEqual(48)

      return {
        metadata: {
          headline: await headline.textContent(),
          valueText: valueMeta.text,
          valueFontSizePx: valueMeta.fontSizePx,
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '02',
    label: 'Switch to 金聯成 portfolio',
    screenshotName: '01-portfolio-7865.png',
    action: async () => {
      const selected = await selectPortfolioByLabel(page, '金聯成')
      expect(selected.label).toMatch(/金聯成/)
      expect(selected.label).not.toMatch(/^P-/i)
      return {
        metadata: {
          selectedValue: selected.value,
          selectedLabel: selected.label,
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '03',
    label: 'Visit dashboard, holdings, events, news, daily, research, trade, log, and overview tabs',
    action: async () => {
      const tabs = [
        ['dashboard', '看板', '02-tab-dashboard.png'],
        ['holdings', '持倉', '03-tab-holdings.png'],
        ['events', '事件追蹤', '04-tab-events.png'],
        ['news', '新聞聚合', '05-tab-news.png'],
        ['daily', '收盤分析', '06-tab-daily.png'],
        ['research', '深度研究', '07-tab-research.png'],
        ['trade', '上傳成交', '08-tab-trade.png'],
        ['log', '交易日誌', '09-tab-log.png'],
        ['overview', '全組合', '10-tab-overview.png'],
      ]
      const visited = []
      for (const [key, label, screenshotName] of tabs) {
        await openTabAndAssert(page, key, label)
        const screenshot = await saveShot(page, testInfo, screenshotName)
        visited.push({ key, label, screenshot })
      }
      await returnToPortfolioView(page)
      return { metadata: { visited } }
    },
  })

  await runStep(state, page, testInfo, {
    id: '04',
    label: 'Expand first holding drill pane and verify rendered content',
    screenshotName: '11-holdings-drill.png',
    action: async () => {
      await clickTab(page, 'holdings', '持倉')
      const result = await expandFirstHolding(page)
      return {
        metadata: {
          holdingCode: result.code,
          preview: result.text.slice(0, 220),
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '05',
    label: 'Open daily diff pane when present',
    screenshotName: '12-daily-diff.png',
    optional: true,
    action: async () => {
      await clickTab(page, 'daily', '收盤分析')
      const diffButton = page.getByTestId('daily-diff-toggle').first()
      if ((await diffButton.count()) === 0) {
        return {
          status: 'blocked',
          note: 'daily diff toggle is not present for the current live portfolio state',
        }
      }

      await diffButton.scrollIntoViewIfNeeded()
      await diffButton.click()
      await expect(page.getByTestId('daily-diff-pane')).toBeVisible()

      const text = String((await page.getByTestId('daily-diff-pane').textContent()) || '')
      return {
        metadata: {
          preview: text.slice(0, 240),
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '06',
    label: 'Weekly export returns structured markdown/html instead of plain text',
    action: async () => {
      await clickTab(page, 'overview', '全組合')
      const result = await captureWeeklyExport(page, testInfo)
      const content =
        result.method === 'clipboard'
          ? result.content
          : ''
      const shape = assertWeeklyExportContent(content)

      return {
        metadata: {
          method: result.method,
          fileName: result.fileName || null,
          path: result.path || null,
          shape,
          preview: content.slice(0, 320),
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '07',
    label: 'Backup export downloads valid JSON with expected schema fields',
    action: async () => {
      const backup = await captureBackupExport(page, testInfo)
      const payload = JSON.parse(readFileSync(backup.path, 'utf8'))

      expect(payload && typeof payload === 'object').toBeTruthy()
      expect(Number(payload.version || 0)).toBe(1)
      expect(String(payload.app || '').trim()).toBe('portfolio-dashboard')
      expect(payload.storage && typeof payload.storage === 'object').toBeTruthy()
      const storageKeys = Object.keys(payload.storage || {})
      expect(storageKeys.some((key) => key.includes('portfolios'))).toBeTruthy()
      expect(storageKeys.some((key) => key.includes('schema-version'))).toBeTruthy()

      return {
        metadata: {
          fileName: backup.fileName,
          relativePath: backup.relativePath,
          storageKeyCount: storageKeys.length,
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '08',
    label: 'Import valid backup fixture and confirm success notice',
    screenshotName: '13-import-success.png',
    action: async () => {
      await page.locator('input[type="file"]').setInputFiles(VALID_BACKUP_FIXTURE_PATH)
      await confirmImportDialog(page, '匯入本機備份', '下一步')
      await confirmImportDialog(page, '再次確認匯入內容', '確認匯入')
      await expect(page.locator('body')).toContainText(/已匯入\s+\d+\s+項本機資料|已匯入本機備份/, {
        timeout: 10000,
      })

      return {
        metadata: {
          fixturePath: relative(ROOT_DIR, VALID_BACKUP_FIXTURE_PATH),
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '09',
    label: 'iOS Safari mobile portrait and landscape stay in mobile branch',
    optional: testInfo.project.name !== 'ios-safari',
    action: async () => {
      if (testInfo.project.name !== 'ios-safari') {
        return {
          status: 'skipped',
          note: 'mobile-only assertions run on ios-safari project',
        }
      }

      await page.setViewportSize({ width: 390, height: 844 })
      await settle(page, 1200)
      await clickTab(page, 'news', '新聞聚合')
      const portrait = await measureMobileLayout(page)
      expect(portrait.stickyHeight).toBeLessThanOrEqual(100)
      expect(countGridColumns(portrait.newsGridTemplateColumns)).toBe(1)
      await saveShot(page, testInfo, 'mobile-00-news-portrait.png')

      await clickTab(page, 'dashboard', '看板')
      await saveShot(page, testInfo, 'mobile-01-dashboard-portrait.png')

      await page.setViewportSize({ width: 844, height: 390 })
      await settle(page, 1200)
      await clickTab(page, 'news', '新聞聚合')
      const landscape = await measureMobileLayout(page)
      expect(landscape.stickyHeight).toBeLessThanOrEqual(100)
      expect(countGridColumns(landscape.newsGridTemplateColumns)).toBe(1)
      await saveShot(page, testInfo, 'mobile-02-news-landscape.png')

      return {
        metadata: {
          portrait,
          landscape,
        },
      }
    },
  })

  await runStep(state, page, testInfo, {
    id: '10',
    label: 'Scroll down like a real user and verify sticky header plus non-blank page tail',
    screenshotName: '14-scroll-check.png',
    action: async () => {
      await clickTab(page, 'news', '新聞聚合')

      const before = await page.evaluate(() => {
        const sticky =
          document.querySelector('[data-testid="header-sticky-zone"]') ||
          document.querySelector('[data-testid="header-root"]')
        const rect = sticky?.getBoundingClientRect?.()
        return {
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          stickyTop: rect ? Number(rect.top.toFixed(2)) : null,
        }
      })

      if (testInfo.project.name === 'ios-safari') {
        for (let index = 0; index < 5; index += 1) {
          await page.evaluate(() => window.scrollBy(0, 420))
          await page.waitForTimeout(280)
        }
      } else {
        for (let index = 0; index < 5; index += 1) {
          await page.mouse.wheel(0, 420)
          await page.waitForTimeout(280)
        }
      }

      const after = await page.evaluate(() => {
        const sticky =
          document.querySelector('[data-testid="header-sticky-zone"]') ||
          document.querySelector('[data-testid="header-root"]')
        const rect = sticky?.getBoundingClientRect?.()
        const cards = Array.from(document.querySelectorAll('[data-testid="news-article-card"]'))
        return {
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          stickyTop: rect ? Number(rect.top.toFixed(2)) : null,
          bodyTail: String(document.body.innerText || '').slice(-220),
          cardCount: cards.length,
          lastCardPreview: String(cards.at(-1)?.textContent || '').slice(0, 120),
        }
      })

      expect(after.scrollY).toBeGreaterThan(before.scrollY)
      expect(after.cardCount).toBeGreaterThan(0)
      expect(after.bodyTail.trim().length).toBeGreaterThan(40)
      expect(after.scrollY).toBeLessThanOrEqual(after.scrollHeight - after.innerHeight + 12)
      expect(Math.abs(Number(after.stickyTop ?? 0))).toBeLessThanOrEqual(4)

      return {
        metadata: {
          before,
          after,
        },
      }
    },
  })

  const summary = writeStepLog(testInfo, state)
  const failingSteps = summary.steps.filter((step) => step.status === 'failed')
  expect(failingSteps, `see ${relative(ROOT_DIR, resolve(STEP_DIR, `${projectPrefix(testInfo)}.json`))}`).toEqual([])
})
