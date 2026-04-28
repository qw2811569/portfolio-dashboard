import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  finalizeQaEvidence,
  installQaMonitor,
  mergeQaEvidence,
  savePageScreenshot,
} from './support/qaHelpers.mjs'

const BUG_HUNT_BASE_URL = String(
  process.env.BUG_HUNT_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    'http://104.199.144.170/'
).trim()
const BUG_HUNT_ROOT_URL = new URL('/', BUG_HUNT_BASE_URL).toString()
const BUG_HUNT_TRADE_URL = new URL('/portfolio/me/trade', BUG_HUNT_BASE_URL).toString()
const REPORT_DIR = resolve(process.cwd(), '.tmp/hostile-qa-codex')
const RAW_FINDINGS_PATH = resolve(REPORT_DIR, 'bug-hunt-findings.jsonl')
const findingsByTestId = new Map()

const NOW_ISO = '2026-04-24T09:30:00.000+08:00'
const NOW_MS = Date.parse(NOW_ISO)
const RAW_STORAGE_KEYS = new Set([
  'pf-cloud-sync-at',
  'pf-analysis-cloud-sync-at',
  'pf-research-cloud-sync-at',
  'pf-me-last-active-tab-v1',
  'pf-7865-last-active-tab-v1',
  'trade-disclaimer-v1-ack-at',
])

const OWNER_HOLDINGS = [{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, type: '股票' }]
const CLIENT_HOLDINGS = [{ code: '2489', name: '瑞軒', qty: 100, cost: 40, price: 42, type: '股票' }]
const DEFAULT_NEWS_ITEMS = [
  {
    id: 'news-1',
    source: 'rss',
    title: '台積電法說前夕供應鏈預期升溫',
    summary: 'AI 伺服器需求延續，法人觀望法說內容。',
    publishedAt: '2026-04-24T08:00:00.000+08:00',
    url: 'https://example.com/news-1',
    relatedStocks: [{ code: '2330', name: '台積電' }],
  },
  {
    id: 'news-2',
    source: 'rss',
    title: '瑞軒面板報價回穩',
    summary: '出貨節奏略優於上月。',
    publishedAt: '2026-04-24T07:30:00.000+08:00',
    url: 'https://example.com/news-2',
    relatedStocks: [{ code: '2489', name: '瑞軒' }],
  },
]
const DEFAULT_EVENTS = [
  {
    id: 'evt-me-1',
    eventType: 'earnings',
    type: 'earnings',
    title: '台積電法說',
    detail: '法說會與 Q1 財報',
    date: '2026-04-24',
    eventDate: '2026-04-24',
    stocks: ['台積電 2330'],
    recordType: 'event',
    impact: 'high',
  },
  {
    id: 'evt-7865-1',
    eventType: 'ex-dividend',
    eventSubType: 'ex-dividend',
    type: 'dividend',
    title: '瑞軒除息',
    detail: '預計配息 1.2 元',
    date: '2026-04-25',
    eventDate: '2026-04-25',
    stocks: ['瑞軒 2489'],
    recordType: 'event',
    impact: 'medium',
  },
]
const PRELIMINARY_DAILY_REPORT = {
  id: 'daily-prelim',
  date: '2026/04/24',
  time: '18:40',
  totalTodayPnl: 128,
  changes: [{ code: '2330', name: '台積電', price: 950, changePct: 1.2, todayPnl: 128 }],
  anomalies: [],
  eventCorrelations: [],
  eventAssessments: [],
  needsReview: [],
  aiInsight: '先看今天是否該加碼。',
  analysisStage: 't0-preliminary',
  analysisStageLabel: '收盤快版',
  analysisVersion: 1,
  finmindConfirmation: {
    expectedMarketDate: '2026-04-24',
    status: 'preliminary',
    pendingCodes: ['2330'],
  },
}

mkdirSync(REPORT_DIR, { recursive: true })

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function safeParseJson(value, fallback = {}) {
  try {
    return JSON.parse(String(value || ''))
  } catch {
    return fallback
  }
}

function buildPortfolioSeed(portfolioId, holdings, notes = {}) {
  return {
    [`pf-${portfolioId}-holdings-v2`]: holdings,
    [`pf-${portfolioId}-log-v2`]: [],
    [`pf-${portfolioId}-targets-v1`]: {},
    [`pf-${portfolioId}-fundamentals-v1`]: {},
    [`pf-${portfolioId}-watchlist-v1`]: [],
    [`pf-${portfolioId}-analyst-reports-v1`]: {},
    [`pf-${portfolioId}-report-refresh-meta-v1`]: {},
    [`pf-${portfolioId}-holding-dossiers-v1`]: [],
    [`pf-${portfolioId}-news-events-v1`]: DEFAULT_EVENTS.filter((event) =>
      event.stocks.join(' ').includes(portfolioId === 'me' ? '2330' : '2489')
    ),
    [`pf-${portfolioId}-analysis-history-v1`]: portfolioId === 'me' ? [PRELIMINARY_DAILY_REPORT] : [],
    [`pf-${portfolioId}-daily-report-v1`]: portfolioId === 'me' ? PRELIMINARY_DAILY_REPORT : null,
    [`pf-${portfolioId}-research-history-v1`]: [],
    [`pf-${portfolioId}-brain-v1`]: null,
    [`pf-${portfolioId}-reversal-v1`]: {},
    [`pf-${portfolioId}-notes-v1`]: {
      riskProfile: '',
      preferences: '',
      customNotes: '',
      ...notes,
    },
  }
}

function buildSeedStorage({
  activePortfolio = 'me',
  ownerLastActiveTab = '',
  clientLastActiveTab = '',
  disclaimerAckAt = NOW_ISO,
} = {}) {
  const seed = {
    'pf-portfolios-v1': [
      { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' },
      { id: '7865', name: '金聯成', isOwner: false, createdAt: '2026-04-24' },
    ],
    'pf-active-portfolio-v1': activePortfolio,
    'pf-view-mode-v1': 'portfolio',
    'pf-schema-version': 3,
    'pf-market-price-cache-v1': {
      marketDate: '2026-04-24',
      syncedAt: NOW_ISO,
      prices: {
        2330: { price: 950, change: 7, changePct: 0.74 },
        2308: { price: 1440, change: 12, changePct: 0.83 },
        2489: { price: 42, change: 0.25, changePct: 0.6 },
      },
    },
    'pf-market-price-sync-v1': {
      status: 'success',
      syncedAt: NOW_ISO,
      marketDate: '2026-04-24',
    },
    'pf-cloud-sync-at': String(NOW_MS),
    'pf-analysis-cloud-sync-at': String(NOW_MS),
    'pf-research-cloud-sync-at': String(NOW_MS),
    'trade-disclaimer-v1-ack-at': disclaimerAckAt,
    ...buildPortfolioSeed('me', OWNER_HOLDINGS),
    ...buildPortfolioSeed('7865', CLIENT_HOLDINGS),
  }

  if (ownerLastActiveTab) seed['pf-me-last-active-tab-v1'] = ownerLastActiveTab
  if (clientLastActiveTab) seed['pf-7865-last-active-tab-v1'] = clientLastActiveTab

  return seed
}

async function seedStorage(page, storage) {
  await page.addInitScript(
    ({ seed, rawKeys }) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      for (const [key, value] of Object.entries(seed || {})) {
        if (rawKeys.includes(key)) {
          window.localStorage.setItem(key, String(value ?? ''))
          continue
        }
        window.localStorage.setItem(key, JSON.stringify(value))
      }
    },
    { seed: storage, rawKeys: Array.from(RAW_STORAGE_KEYS) }
  )
}

async function installMockClock(page) {
  await page.addInitScript(() => {
    if (window.__bugHuntClockInstalled) return
    window.__bugHuntClockInstalled = true
    const RealDate = Date
    let offsetMs = 0

    class MockDate extends RealDate {
      constructor(...args) {
        super(...(args.length > 0 ? args : [RealDate.now() + offsetMs]))
      }

      static now() {
        return RealDate.now() + offsetMs
      }

      static parse(value) {
        return RealDate.parse(value)
      }

      static UTC(...args) {
        return RealDate.UTC(...args)
      }
    }

    window.__advanceBugHuntTime = (deltaMs) => {
      offsetMs += Number(deltaMs) || 0
      return offsetMs
    }

    window.Date = MockDate
    globalThis.Date = MockDate
  })
}

function startScenario(testInfo, scenario) {
  mergeQaEvidence(testInfo, { scenario })
  findingsByTestId.set(testInfo.testId, [])
}

function addFinding(testInfo, finding) {
  const current = findingsByTestId.get(testInfo.testId) || []
  current.push(finding)
  findingsByTestId.set(testInfo.testId, current)
}

async function recordFinding(page, testInfo, finding, screenshotName = '') {
  let screenshot = ''
  if (screenshotName) {
    screenshot = await savePageScreenshot(page, testInfo, screenshotName)
  }
  addFinding(testInfo, {
    ...finding,
    screenshot,
  })
}

async function settle(page, waitMs = 1200) {
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

async function openRoot(page) {
  await page.goto(BUG_HUNT_ROOT_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 2200)
}

async function openTradeRoute(page, { fallbackToTab = true } = {}) {
  await page.goto(BUG_HUNT_TRADE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 1800)

  const disclaimerModal = page.getByTestId('trade-disclaimer-modal')
  if (await disclaimerModal.isVisible().catch(() => false)) return

  const tradePanel = page.getByTestId('trade-panel')
  const manualTradeCodeInput = page.getByTestId('manual-trade-code-input')
  if (await manualTradeCodeInput.isVisible().catch(() => false)) return
  if ((await tradePanel.isVisible().catch(() => false)) && !fallbackToTab) return

  await page.evaluate(() => {
    localStorage.setItem('pf-me-last-active-tab-v1', 'trade')
  })
  const tradeTrigger = await firstExisting(
    page.getByTestId('tab-trade'),
    page.getByRole('button', { name: '上傳成交', exact: true })
  )
  if (!tradeTrigger) {
    throw new Error('missing trade trigger after direct trade route fallback')
  }
  await tradeTrigger.click()
  await settle(page, 1400)
  if (await disclaimerModal.isVisible().catch(() => false)) return
  await expect(manualTradeCodeInput).toBeVisible({ timeout: 10000 })
}

async function clickTab(page, key, label) {
  const tab = await requireLocator(
    `missing tab ${key}`,
    page.getByTestId(`tab-${key}`),
    page.getByRole('button', { name: label, exact: true })
  )
  await tab.click()
  await settle(page, 800)
}

async function getPortfolioSelect(page) {
  return requireLocator(
    'missing portfolio selector',
    page.getByTestId('portfolio-select'),
    page.locator('select')
  )
}

async function switchPortfolioFast(page, values = []) {
  const select = await firstExisting(page.getByTestId('portfolio-select'), page.locator('select'))
  if (select) {
    for (const value of values) {
      await expect(select).toBeEnabled({ timeout: 10000 })
      await select.selectOption(value)
      await page.waitForTimeout(120)
    }
    return true
  }

  const custIdInput = await firstExisting(
    page.getByTestId('cust-id-input'),
    page.getByLabel(/cust[_\s-]?id|客戶編號/i)
  )
  const loginButton = await firstExisting(
    page.getByTestId('login-btn'),
    page.getByRole('button', { name: /登入|login|enter/i })
  )
  if (!custIdInput || !loginButton) return false

  for (const value of values) {
    await custIdInput.fill(value)
    await loginButton.click()
  }
  return true
}

async function fillManualTrade(page, { code = '', name = '', action = '買進', qty = '', price = '' } = {}) {
  await page.getByTestId('manual-trade-code-input').fill(code)
  await page.getByTestId('manual-trade-name-input').fill(name)
  await page.getByTestId('manual-trade-action-select').selectOption(action)
  await page.getByTestId('manual-trade-qty-input').fill(qty)
  await page.getByTestId('manual-trade-price-input').fill(price)
}

async function submitManualTrade(page) {
  const submitButton = page.getByTestId('manual-trade-submit-btn')
  const isEnabled = await submitButton.isEnabled().catch(() => false)
  if (!isEnabled) {
    return { submitted: false, disabled: true }
  }

  try {
    await submitButton.click({ timeout: 1000 })
  } catch (error) {
    if (/not enabled|element is not enabled/i.test(String(error?.message || ''))) {
      return { submitted: false, disabled: true }
    }
    throw error
  }
  await page.waitForTimeout(200)
  return { submitted: true, disabled: false }
}

async function createPreviewFromManualTrade(page, trade = {}) {
  await fillManualTrade(page, {
    code: '2454',
    name: '聯發科',
    action: '買進',
    qty: '7',
    price: '1250',
    ...trade,
  })
  await submitManualTrade(page)
  await expect(page.getByTestId('trade-parse-results')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('skip-memo-btn').click()
  await expect(page.getByTestId('trade-preview-panel')).toBeVisible({ timeout: 5000 })
}

async function openCmdK(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cmdk:open'))
  })
  await expect(page.getByLabel('搜尋內容')).toBeVisible({ timeout: 5000 })
}

async function installStableApiRoutes(page, options = {}) {
  const tracker = {
    tradeAuditBodies: [],
    trackedStocksBodies: [],
    finmindRequests: [],
    newsFeedRequests: 0,
  }
  const {
    tradeAuditStatus = 200,
    tradeAuditDelayMs = 0,
    trackedStocksStatus = 200,
    trackedStocksDelayMs = 0,
    finmindStatus = 200,
    finmindDegradedReason = '',
    newsFeedStatus = 200,
    newsFeedDelayMs = 0,
  } = options

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (pathname === '/api/brain') {
      const body = safeParseJson(request.postData(), {})
      if (body?.action === 'load-events') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ events: DEFAULT_EVENTS }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ holdings: OWNER_HOLDINGS, events: DEFAULT_EVENTS, history: [], brain: null }),
      })
      return
    }

    if (pathname === '/api/research') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reports: [] }),
      })
      return
    }

    if (pathname === '/api/analyst-reports') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], reports: [] }),
      })
      return
    }

    if (pathname === '/api/target-prices') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: url.searchParams.get('code') || '2330',
          targets: {
            reports: [],
            updatedAt: NOW_ISO,
            source: 'rss',
          },
        }),
      })
      return
    }

    if (pathname === '/api/event-calendar') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          generatedAt: NOW_ISO,
          events: DEFAULT_EVENTS,
        }),
      })
      return
    }

    if (pathname === '/api/daily-snapshot-status') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          stale: false,
          badgeStatus: 'fresh',
          lastSuccessAt: NOW_ISO,
        }),
      })
      return
    }

    if (pathname === '/api/morning-note') {
      const portfolioId = String(url.searchParams.get('portfolioId') || 'me').trim()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          marketDate: '2026-04-24',
          portfolioId,
          snapshotStatus: 'fresh',
          note: {
            portfolioId,
            date: '2026/04/24',
            headline: portfolioId === '7865' ? '先看公開資訊節奏' : '今天先把節奏排好',
            summary: portfolioId === '7865' ? '這版只保留公開資訊。' : '08:30 後先看法說，再看主部位。',
            lead: portfolioId === '7865' ? '先看公開資訊與待驗證事項。' : '盤前先把最容易影響情緒的兩三件事放在前面。',
            focusPoints: [],
            sections: {
              todayEvents: [],
              holdingStatus: [],
              watchlistAlerts: [],
              announcements: [],
            },
          },
        }),
      })
      return
    }

    if (pathname === '/api/trade-audit') {
      tracker.tradeAuditBodies.push(safeParseJson(request.postData(), {}))
      if (tradeAuditDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, tradeAuditDelayMs))
      await route.fulfill({
        status: tradeAuditStatus,
        contentType: 'application/json',
        body: JSON.stringify(
          tradeAuditStatus >= 400 ? { error: `trade audit failed (${tradeAuditStatus})` } : { ok: true }
        ),
      })
      return
    }

    if (pathname === '/api/tracked-stocks') {
      tracker.trackedStocksBodies.push(safeParseJson(request.postData(), {}))
      if (trackedStocksDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, trackedStocksDelayMs))
      }
      await route.fulfill({
        status: trackedStocksStatus,
        contentType: 'application/json',
        body: JSON.stringify(
          trackedStocksStatus >= 400
            ? { error: `tracked stocks failed (${trackedStocksStatus})` }
            : {
                ok: true,
                lastSyncedAt: NOW_ISO,
                totalTracked:
                  safeParseJson(request.postData(), {})?.stocks?.length || OWNER_HOLDINGS.length,
              }
        ),
      })
      return
    }

    if (pathname === '/api/news-feed') {
      tracker.newsFeedRequests += 1
      if (newsFeedDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, newsFeedDelayMs))
      await route.fulfill({
        status: newsFeedStatus,
        contentType: 'application/json',
        body: JSON.stringify(
          newsFeedStatus >= 400 ? { error: `news feed failed (${newsFeedStatus})` } : { items: DEFAULT_NEWS_ITEMS }
        ),
      })
      return
    }

    if (pathname === '/api/finmind') {
      tracker.finmindRequests.push(request.url())
      if (finmindStatus >= 400) {
        await route.fulfill({
          status: finmindStatus,
          contentType: 'application/json',
          body: JSON.stringify({ error: `FinMind failed (${finmindStatus})` }),
        })
        return
      }

      if (!finmindDegradedReason) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            degraded: false,
            dataset: url.searchParams.get('dataset') || 'revenue',
            code: url.searchParams.get('code') || '2330',
            count: 0,
            data: [],
            source: 'bug-hunt-stub',
            fetchedAt: NOW_ISO,
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          degraded: true,
          dataset: url.searchParams.get('dataset') || 'revenue',
          code: url.searchParams.get('code') || '2330',
          count: 0,
          data: [],
          source: 'snapshot-fallback',
          fetchedAt: NOW_ISO,
          degradedMeta: {
            reason: finmindDegradedReason || 'api-timeout',
            fallbackAt: NOW_ISO,
            snapshotDate: '2026-04-23',
            hasFallbackSnapshot: true,
          },
        }),
      })
      return
    }

    await route.continue()
  })

  return tracker
}

async function withNetworkProfile(page, profile, callback) {
  const session = await page.context().newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latency,
    downloadThroughput: profile.downloadThroughput,
    uploadThroughput: profile.uploadThroughput,
    connectionType: profile.connectionType,
  })
  try {
    return await callback()
  } finally {
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'none',
    })
  }
}

async function captureFocusState(page) {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!active) return { label: '', tag: '', withinDialog: false }
    const dialog = active.closest?.('[role="dialog"]')
    return {
      label:
        active.getAttribute('aria-label') ||
        active.textContent ||
        active.getAttribute('data-testid') ||
        active.getAttribute('name') ||
        '',
      tag: active.tagName.toLowerCase(),
      withinDialog: Boolean(dialog),
      testId: active.getAttribute('data-testid') || '',
    }
  })
}

test.describe('hostile bug hunt', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Hostile QA targets chromium only')

  test.afterEach(async ({}, testInfo) => {
    const evidence = finalizeQaEvidence(testInfo)
    const findings = findingsByTestId.get(testInfo.testId) || []
    const summary = {
      project: testInfo.project.name,
      title: testInfo.title,
      scenario: evidence.scenario,
      status: testInfo.status,
      findings,
      blockingErrors: evidence.blockingErrors,
      screenshots: evidence.screenshots,
    }
    appendFileSync(RAW_FINDINGS_PATH, `${JSON.stringify(summary)}\n`)
    findingsByTestId.delete(testInfo.testId)
  })

  test('interaction bomb surfaces stale state, overflow, and duplicate confirm writes', async ({
    page,
  }, testInfo) => {
    startScenario(testInfo, 'interaction-bomb')
    installQaMonitor(testInfo, page, {
      ignoredResponsePatterns: [/\/api\/finmind/],
    })
    await seedStorage(page, buildSeedStorage())
    await installStableApiRoutes(page)

    await page.goto(BUG_HUNT_ROOT_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    })
    await page.getByTestId('tab-holdings').click().catch(() => {})
    await settle(page, 1800)

    await page.evaluate(() => {
      const order = ['dashboard', 'holdings', 'events']
      for (let i = 0; i < 10; i += 1) {
        for (const key of order) {
          document.querySelector(`[data-testid="tab-${key}"]`)?.click()
        }
      }
    })
    await settle(page, 1600)
    const eventsPanelVisible = await page.getByTestId('events-panel').isVisible().catch(() => false)
    if (!eventsPanelVisible) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Rapid dashboard/holdings/events switching leaves the app off the requested tab',
          step: 'exploratory interaction bomb > rapid tab churn',
          reproducer: ['Open dashboard', 'Click Dashboard -> Holdings -> Events 10 rounds quickly'],
          suggestedFix:
            'Debounce or serialize tab transitions so the final requested tab wins even under rapid input.',
          effort: '1-2 hr',
        },
        'interaction-tab-churn.png'
      )
    }

    const switchedPortfolio = await switchPortfolioFast(page, ['7865', 'me'])
    await settle(page, 2000)

    const selectionLabel = switchedPortfolio
      ? await page
          .locator('select')
          .first()
          .evaluate((element) => element.options[element.selectedIndex]?.textContent?.trim() || '')
          .catch(() => '')
      : ''
    const portfolioContext = await firstExisting(page.getByTestId('portfolio-context-label'))
    const portfolioContextText = (await portfolioContext?.textContent().catch(() => '')) || ''
    if (switchedPortfolio && (/金聯成/.test(selectionLabel) || /金聯成/.test(portfolioContextText))) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Fast portfolio switching leaves stale portfolio context on screen',
          step: 'exploratory interaction bomb > portfolio selector churn',
          reproducer: ['Open portfolio selector', 'Switch me -> 7865 -> me without waiting'],
          suggestedFix:
            'Track in-flight portfolio transitions and ignore stale renders after a newer portfolio selection.',
          effort: '2-3 hr',
        },
        'interaction-portfolio-stale.png'
      )
    }

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 900 },
      { width: 375, height: 667 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(160)
    }
    await clickTab(page, 'dashboard', '看板')
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    if (hasOverflow) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Viewport churn leaves horizontal overflow on dashboard',
          step: 'exploratory interaction bomb > viewport resize churn',
          reproducer: ['Resize 390 -> 1280 -> 375 -> 1024 while the dashboard is active'],
          suggestedFix: 'Re-check responsive breakpoints and grid min-width rules around the dashboard hero.',
          effort: '1-2 hr',
        },
        'interaction-dashboard-overflow.png'
      )
    }

    const tradePage = await page.context().newPage()
    await seedStorage(tradePage, buildSeedStorage())
    const tradeTracker = await installStableApiRoutes(tradePage, {
      tradeAuditDelayMs: 1400,
    })
    await openTradeRoute(tradePage)
    await createPreviewFromManualTrade(tradePage)
    const confirmButton = tradePage.getByTestId('trade-confirm-btn')
    await confirmButton.evaluate((element) => {
      for (let index = 0; index < 20; index += 1) {
        element.click()
      }
    })
    await tradePage.waitForTimeout(2600)

    const matchingWrites = tradeTracker.tradeAuditBodies.filter((entry) =>
      Array.isArray(entry?.after?.appendedTradeLogEntries)
        ? entry.after.appendedTradeLogEntries.some((row) => row.code === '2454')
        : false
    )
    if (matchingWrites.length > 1) {
      await recordFinding(
        tradePage,
        testInfo,
        {
          severity: 'critical',
          title: 'Rapid confirm clicks submit the same trade batch multiple times',
          step: 'exploratory interaction bomb > 20x confirm click',
          reproducer: [
            'Open /portfolio/me/trade',
            'Create a valid manual trade preview',
            'Spam the confirm button 20 times before the first network roundtrip returns',
          ],
          suggestedFix:
            'Use a ref-based in-flight guard inside confirmTradePreview/finalizeTradeSubmit so duplicate clicks cannot re-enter before React re-renders.',
          effort: '1-2 hr',
        },
        'interaction-double-confirm.png'
      )
    }
    await tradePage.close()

    const findings = findingsByTestId.get(testInfo.testId) || []
    const evidence = finalizeQaEvidence(testInfo)
    expect(
      findings.length + evidence.blockingErrors.length,
      `hostile interaction issues: ${findings
        .map((item) => item.title)
        .concat(evidence.blockingErrors)
        .join(' | ')}`
    ).toBe(0)
  })

  test('input bombing rejects malformed manual trades and keeps memo/search inputs safe', async ({
    page,
  }, testInfo) => {
    startScenario(testInfo, 'input-bomb')
    const dialogs = []
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss().catch(() => {})
    })
    installQaMonitor(testInfo, page, {
      ignoredResponsePatterns: [/\/api\/finmind/],
    })
    await seedStorage(page, buildSeedStorage())
    await installStableApiRoutes(page)
    await openTradeRoute(page)

    const invalidTradeCases = [
      {
        label: '200-char code',
        trade: { code: 'A'.repeat(200), name: 'TooLong', qty: '7', price: '12.34' },
        severity: 'high',
      },
      {
        label: 'script payload code',
        trade: { code: "<script>alert('x')</script>", name: 'Script', qty: '7', price: '12.34' },
        severity: 'high',
      },
      {
        label: 'emoji code',
        trade: { code: '🚀', name: 'Emoji', qty: '7', price: '12.34' },
        severity: 'medium',
      },
      {
        label: 'negative quantity',
        trade: { code: '2330', name: '台積電', qty: '-1', price: '12.34' },
        severity: 'critical',
      },
      {
        label: 'negative price',
        trade: { code: '2330', name: '台積電', qty: '7', price: '-1' },
        severity: 'critical',
      },
    ]

    for (const invalidCase of invalidTradeCases) {
      await openTradeRoute(page)
      await fillManualTrade(page, invalidCase.trade)
      const submitState = await submitManualTrade(page)
      if (submitState.disabled) {
        continue
      }
      const accepted = await page.getByTestId('trade-parse-results').isVisible().catch(() => false)
      if (accepted) {
        await recordFinding(
          page,
          testInfo,
          {
            severity: invalidCase.severity,
            title: `Manual trade accepts invalid payload: ${invalidCase.label}`,
            step: 'input bombing > manual trade entry',
            reproducer: [
              'Open /portfolio/me/trade',
              `Submit manual trade with ${invalidCase.label}`,
            ],
            suggestedFix:
              'Add schema validation on manual trade input before setParsed: stock code format, positive quantity, and positive price.',
            effort: '1-2 hr',
          },
          `input-${slugify(invalidCase.label)}.png`
        )
      }
    }

    await openTradeRoute(page)
    await fillManualTrade(page, { code: '2330', name: '台積電', qty: '7', price: '12.34' })
    await submitManualTrade(page)
    await expect(page.getByTestId('trade-parse-results')).toBeVisible({ timeout: 5000 })

    const memoInput = page.locator('textarea').first()
    await memoInput.fill('   ')
    const memoSubmitDisabled = await page
      .getByRole('button', { name: /下一題|完成備忘/ })
      .isDisabled()
      .catch(() => false)
    if (!memoSubmitDisabled) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'medium',
          title: 'Whitespace-only memo can still advance the trade preview flow',
          step: 'input bombing > memo textarea whitespace payload',
          reproducer: ['Create a valid trade preview', 'Fill the memo textarea with only whitespace'],
          suggestedFix: 'Keep the memo submit button disabled unless the trimmed textarea contains content.',
          effort: '0.5-1 hr',
        },
        'input-whitespace-memo.png'
      )
    }

    await memoInput.fill("'; DROP TABLE holdings;--")
    await page.getByRole('button', { name: /下一題|完成備忘/ }).click()
    await memoInput.fill("<script>alert('memo-xss')</script>")
    await page.getByRole('button', { name: /下一題|完成備忘/ }).click()
    await memoInput.fill('正常備忘')
    await page.getByRole('button', { name: /下一題|完成備忘/ }).click()
    await expect(page.getByTestId('trade-preview-panel')).toBeVisible({ timeout: 5000 })

    if (dialogs.length > 0) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'critical',
          title: 'Memo payload executes script code in the trade flow',
          step: 'input bombing > memo XSS payload',
          reproducer: [
            'Create a valid trade preview',
            "Enter <script>alert('memo-xss')</script> in the memo textarea",
          ],
          suggestedFix: 'Render memo content as plain text only and avoid any HTML insertion path.',
          effort: '1-2 hr',
        },
        'input-memo-xss.png'
      )
    }

    await openRoot(page)
    await openCmdK(page)
    const searchInput = page.getByLabel('搜尋內容')
    await searchInput.fill(''.padEnd(512, 'A'))
    await searchInput.fill('.*')
    await searchInput.evaluate((element) => {
      element.value = 'ticker\u0000query'
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const cmdkStillOpen = await page.getByRole('dialog', { name: '全局搜尋' }).isVisible().catch(() => false)
    if (!cmdkStillOpen) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'medium',
          title: 'Cmd+K search collapses under long or malformed query input',
          step: 'input bombing > command palette query',
          reproducer: ['Open global search', 'Enter very long text, regex-like text, and a null-byte payload'],
          suggestedFix:
            'Normalize search input more defensively and avoid letting malformed strings close the palette.',
          effort: '1-2 hr',
        },
        'input-cmdk-query.png'
      )
    }

    const findings = findingsByTestId.get(testInfo.testId) || []
    const evidence = finalizeQaEvidence(testInfo)
    expect(
      findings.length + evidence.blockingErrors.length,
      `hostile input issues: ${findings
        .map((item) => item.title)
        .concat(evidence.blockingErrors)
        .join(' | ')}`
    ).toBe(0)
  })

  test('error states surface degraded UX instead of silent failure', async ({ page }, testInfo) => {
    test.setTimeout(180000)
    startScenario(testInfo, 'error-states')
    installQaMonitor(testInfo, page, {
      ignoredResponsePatterns: [/\/api\/news-feed/, /\/api\/finmind/, /\/api\/tracked-stocks/],
    })
    await seedStorage(page, buildSeedStorage())
    await installStableApiRoutes(page, {
      trackedStocksStatus: 403,
      finmindStatus: 503,
      newsFeedDelayMs: 2400,
    })

    await openRoot(page)
    await page.route(
      '**/api/news-feed**',
      async (route) => {
        await route.abort('internetdisconnected')
      },
      { times: 1 }
    )
    await clickTab(page, 'news', '新聞')
    const offlineNewsCopy = await page
      .getByText('網路不穩 · 自動重連中')
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (!offlineNewsCopy) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Offline news fetch fails without explicit degraded/offline copy',
          step: 'error states > offline network',
          reproducer: ['Open dashboard', 'Toggle browser offline', 'Open the News tab'],
          suggestedFix: 'Ensure the News panel always renders DataError copy when the feed fetch fails offline.',
          effort: '1-2 hr',
        },
        'error-offline-news.png'
      )
    }

    await clickTab(page, 'holdings', '持倉')
    const finmindGateVisible = await page.getByTestId('accuracy-gate-block').isVisible().catch(() => false)
    if (!finmindGateVisible) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'FinMind 503 does not surface an AccuracyGateBlock on holdings',
          step: 'error states > FinMind 503',
          reproducer: ['Mock /api/finmind as 503', 'Open the Holdings tab'],
          suggestedFix:
            'Map FinMind 5xx failures into the existing degraded accuracy gate path instead of leaving the page silent.',
          effort: '2-3 hr',
        },
        'error-finmind-503.png'
      )
    }

    await page.waitForTimeout(5600)
    const trackedStocksErrorVisible = await page
      .getByText(/服務暫時不穩|重新登入|登入狀態已過期/)
      .isVisible()
      .catch(() => false)
    if (!trackedStocksErrorVisible) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Tracked-stocks blob 403 is silent on the holdings page',
          step: 'error states > blob 403',
          reproducer: ['Mock /api/tracked-stocks POST as 403', 'Open Holdings and wait for sync'],
          suggestedFix:
            'Promote tracked-stocks sync failures into a visible DataError instead of only writing failed state to storage.',
          effort: '1-2 hr',
        },
        'error-tracked-stocks-403.png'
      )
    }

    const quotaErrorName = await page.evaluate(() => {
      try {
        const chunk = Array(1e6).fill('x').join('')
        for (let index = 0; index < 20; index += 1) {
          localStorage.setItem(`bug-hunt-quota-${index}`, chunk)
        }
        return ''
      } catch (error) {
        return error?.name || 'QuotaError'
      }
    })
    await clickTab(page, 'events', '事件')
    const shellAlive = await page.getByTestId('events-panel').isVisible().catch(() => false)
    if (quotaErrorName && !shellAlive) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Storage-quota exhaustion can leave the app shell unusable',
          step: 'error states > localStorage quota full',
          reproducer: ['Fill localStorage until QuotaExceededError', 'Try switching tabs'],
          suggestedFix: 'Wrap persistence writes with quota-aware fallback paths and avoid breaking tab navigation.',
          effort: '2-3 hr',
        },
        'error-storage-quota.png'
      )
    }

    for (const profile of [
      {
        label: '3g',
        latency: 350,
        downloadThroughput: 750 * 1024,
        uploadThroughput: 250 * 1024,
        connectionType: 'cellular3g',
      },
    ]) {
      await withNetworkProfile(page, profile, async () => {
        await openRoot(page)
        await clickTab(page, 'news', '新聞')
        const loadingCopyVisible = await page
          .getByText('新聞脈絡整理中')
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true)
          .catch(() => false)
        if (!loadingCopyVisible) {
          await recordFinding(
            page,
            testInfo,
            {
              severity: 'low',
              title: `No visible loading state under ${profile.label.toUpperCase()} news fetch delay`,
              step: 'error states > slow network throttle',
              reproducer: [
                `Throttle the browser to ${profile.label.toUpperCase()}`,
                'Open the News route while the feed request is delayed',
              ],
              suggestedFix:
                'Keep the loading skeleton visible immediately whenever the news feed fetch is in flight.',
              effort: '0.5-1 hr',
            },
            `error-slow-network-${profile.label}.png`
          )
        }
        await settle(page, 2600)
      })
    }

    const findings = findingsByTestId.get(testInfo.testId) || []
    const evidence = finalizeQaEvidence(testInfo)
    expect(
      findings.length + evidence.blockingErrors.length,
      `hostile error-state issues: ${findings
        .map((item) => item.title)
        .concat(evidence.blockingErrors)
        .join(' | ')}`
    ).toBe(0)
  })

  test('session churn and cross-feature states stay coherent', async ({ browser, page }, testInfo) => {
    startScenario(testInfo, 'session-cross-feature')
    installQaMonitor(testInfo, page, {
      ignoredResponsePatterns: [/\/api\/finmind/],
    })
    await installMockClock(page)
    await seedStorage(page, buildSeedStorage())
    await installStableApiRoutes(page, {
      finmindStatus: 503,
    })

    await openRoot(page)
    await page.evaluate(() => {
      window.__advanceBugHuntTime?.(10 * 60 * 1000)
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    await clickTab(page, 'holdings', '持倉')
    if (!(await page.getByTestId('holdings-panel').isVisible().catch(() => false))) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Returning after a mocked 10-minute idle leaves the holdings page unusable',
          step: 'session > 10 minute idle',
          reproducer: ['Open the app', 'Advance time by 10 minutes', 'Return and switch to Holdings'],
          suggestedFix: 'Re-check idle-time refresh paths and stale sync state handling after visibility/focus events.',
          effort: '2-3 hr',
        },
        'session-idle-return.png'
      )
    }

    const newUserPage = await browser.newPage()
    await seedStorage(newUserPage, buildSeedStorage({ disclaimerAckAt: NOW_ISO, ownerLastActiveTab: '' }))
    await installStableApiRoutes(newUserPage)
    await openRoot(newUserPage)
    const newUserOnDashboard = Boolean(
      await firstExisting(
        newUserPage.getByTestId('dashboard-compare-strip'),
        newUserPage.getByTestId('dashboard-reminder-toggle'),
        newUserPage.getByText('投資組合')
      )
    )
    await newUserPage.close()
    if (!newUserOnDashboard) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'First-visit owner flow no longer lands on the dashboard by default',
          step: 'cross-feature > dashboard default vs tab persistence',
          reproducer: ['Seed a fresh owner with no pf-me-last-active-tab-v1', 'Open the root app URL'],
          suggestedFix:
            'Keep the default-dashboard rule ahead of persisted-tab restoration when no stored tab exists.',
          effort: '1-2 hr',
        },
        'cross-default-dashboard.png'
      )
    }

    const returningUserPage = await browser.newPage()
    await seedStorage(
      returningUserPage,
      buildSeedStorage({ disclaimerAckAt: NOW_ISO, ownerLastActiveTab: 'events' })
    )
    await installStableApiRoutes(returningUserPage)
    await openRoot(returningUserPage)
    const returningUserOnEvents = await returningUserPage.getByTestId('events-panel').isVisible().catch(() => false)
    await returningUserPage.close()
    if (!returningUserOnEvents) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Persisted last-active-tab is ignored for returning users',
          step: 'cross-feature > dashboard default vs tab persistence',
          reproducer: ['Seed pf-me-last-active-tab-v1=events', 'Open the root app URL'],
          suggestedFix: 'Restore the persisted per-portfolio tab after boot finishes and before the first tab render.',
          effort: '1-2 hr',
        },
        'cross-persisted-tab.png'
      )
    }

    await page.setViewportSize({ width: 375, height: 667 })
    await clickTab(page, 'dashboard', '看板')
    const compareStrip = page.getByTestId('dashboard-compare-strip')
    const compareVisible = await compareStrip.isVisible().catch(() => false)
    if (!compareVisible) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Compare strip disappears on the small viewport dashboard',
          step: 'cross-feature > M-VIEW compare strip',
          reproducer: ['Seed two portfolios', 'Resize to iPhone SE width', 'Open dashboard'],
          suggestedFix: 'Keep the compare strip rendered in the mobile layout and collapse content instead of dropping it.',
          effort: '1-2 hr',
        },
        'cross-compare-strip-missing.png'
      )
    } else {
      const overlap = await page.evaluate(() => {
        const hero = document.querySelector('.dashboard-hero')
        const strip = document.querySelector('[data-testid="dashboard-compare-strip"]')
        if (!hero || !strip) return false
        const heroBox = hero.getBoundingClientRect()
        const stripBox = strip.getBoundingClientRect()
        return stripBox.top < heroBox.top || stripBox.left < 0 || stripBox.right > window.innerWidth
      })
      if (overlap) {
        await recordFinding(
          page,
          testInfo,
          {
            severity: 'high',
            title: 'Dashboard compare strip overlaps the hero region on small viewport',
            step: 'cross-feature > M-VIEW compare strip',
            reproducer: ['Resize to 375x667', 'Open dashboard with compare strip enabled'],
            suggestedFix: 'Reflow the hero/compare layout into a single-column stack at the mobile breakpoint.',
            effort: '1-2 hr',
          },
          'cross-compare-strip-overlap.png'
        )
      }
    }

    await clickTab(page, 'daily', '收盤分析')
    const dailyGateCount = await page.locator('[data-testid="accuracy-gate-block"]').count()
    await clickTab(page, 'holdings', '持倉')
    const holdingsGateCount = await page.locator('[data-testid="accuracy-gate-block"]').count()
    if (dailyGateCount > 1 || holdingsGateCount > 1) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'medium',
          title: 'Accuracy gate blocks stack on top of each other under combined stale + degraded conditions',
          step: 'cross-feature > daily accuracy gate + FinMind degraded mode',
          reproducer: [
            'Seed a preliminary daily report',
            'Mock FinMind as 503',
            'Switch between Daily and Holdings tabs',
          ],
          suggestedFix: 'Only render one gate per surface and clear dismissed keys when the active resource changes.',
          effort: '1-2 hr',
        },
        'cross-double-gate.png'
      )
    }

    await page.context().clearCookies()
    await seedStorage(page, buildSeedStorage({ disclaimerAckAt: '' }))
    await openTradeRoute(page)
    const modal = page.getByTestId('trade-disclaimer-modal')
    const modalVisible = await modal.isVisible().catch(() => false)
    if (!modalVisible) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Direct /trade navigation does not gate the page with the trade disclaimer modal',
          step: 'cross-feature > direct trade navigation',
          reproducer: ['Clear trade-disclaimer-v1-ack-at', 'Open /portfolio/me/trade directly'],
          suggestedFix: 'Run the trade disclaimer check on direct route entry, not just from the tab-triggered flow.',
          effort: '1-2 hr',
        },
        'cross-direct-trade-no-modal.png'
      )
    }

    const focusSamples = []
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press('Tab')
      focusSamples.push(await captureFocusState(page))
    }
    if (focusSamples.some((sample) => !sample.withinDialog)) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'high',
          title: 'Keyboard focus escapes behind the trade disclaimer modal',
          step: 'cross-feature > modal focus trap',
          reproducer: ['Open /portfolio/me/trade with disclaimer required', 'Press Tab repeatedly'],
          suggestedFix: 'Trap focus inside the modal while it is open and restore focus on close.',
          effort: '1-2 hr',
        },
        'cross-trade-modal-focus-escape.png'
      )
    }

    const secondTab = await browser.newPage()
    await seedStorage(secondTab, buildSeedStorage())
    await installStableApiRoutes(secondTab)
    await openRoot(secondTab)
    await clickTab(secondTab, 'holdings', '持倉')
    await page.evaluate(() => {
      localStorage.setItem(
        'pf-me-tracked-sync-v1',
        JSON.stringify({
          portfolioId: 'me',
          status: 'fresh',
          lastAttemptAt: '2026-04-24T09:30:00.000+08:00',
          lastSyncedAt: '2026-04-24T09:30:00.000+08:00',
          totalTracked: 1,
          source: 'live-sync',
          lastError: '',
          errorStatus: null,
        })
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'pf-me-tracked-sync-v1',
          newValue: localStorage.getItem('pf-me-tracked-sync-v1'),
        })
      )
    })
    const secondTabBadgeVisible = await secondTab
      .getByTestId('tracked-stocks-sync-badge')
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    await secondTab.close()
    if (!secondTabBadgeVisible) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'medium',
          title: 'Second tab does not react to tracked-sync storage updates',
          step: 'session > two-tab synchronization',
          reproducer: ['Open Holdings in two tabs', 'Update pf-me-tracked-sync-v1 in tab A'],
          suggestedFix:
            'Keep the storage-event listener wired so tracked-sync badge state refreshes across tabs.',
          effort: '1-2 hr',
        },
        'session-two-tab-sync.png'
      )
    }

    const findings = findingsByTestId.get(testInfo.testId) || []
    const evidence = finalizeQaEvidence(testInfo)
    expect(
      findings.length + evidence.blockingErrors.length,
      `hostile session/cross-feature issues: ${findings
        .map((item) => item.title)
        .concat(evidence.blockingErrors)
        .join(' | ')}`
    ).toBe(0)
  })

  test('axe and keyboard-only audit list accessibility regressions across core surfaces', async ({
    page,
  }, testInfo) => {
    startScenario(testInfo, 'a11y-audit')
    installQaMonitor(testInfo, page, {
      ignoredResponsePatterns: [/\/api\/finmind/],
    })
    await seedStorage(page, buildSeedStorage({ disclaimerAckAt: '' }))
    await installStableApiRoutes(page)

    const surfaces = [
      {
        label: 'dashboard',
        open: () => openRoot(page),
        ready: () => page.getByTestId('tab-dashboard'),
      },
      {
        label: 'holdings',
        open: async () => {
          await openRoot(page)
          await clickTab(page, 'holdings', '持倉')
        },
        ready: () => page.getByTestId('holdings-panel'),
      },
      {
        label: 'events',
        open: async () => {
          await openRoot(page)
          await clickTab(page, 'events', '事件')
        },
        ready: () => page.getByTestId('events-panel'),
      },
      {
        label: 'news',
        open: async () => {
          await openRoot(page)
          await clickTab(page, 'news', '新聞')
        },
        ready: () => page.getByText(/新聞脈絡整理中|這些新聞跟你組合有關/),
      },
      {
        label: 'trade-route',
        open: () => openTradeRoute(page),
        ready: () => page.getByTestId('trade-panel'),
      },
    ]

    for (const surface of surfaces) {
      await surface.open()
      await expect(surface.ready()).toBeVisible({ timeout: 15000 })
      const results = await new AxeBuilder({ page }).analyze()

      for (const violation of results.violations) {
        await recordFinding(
          page,
          testInfo,
          {
            severity: violation.impact || 'minor',
            title: `axe ${surface.label}: ${violation.id}`,
            step: 'a11y scan > axe-core',
            reproducer: [`Open ${surface.label}`, 'Run axe-core'],
            suggestedFix: violation.help,
            effort: '1-3 hr',
          },
          `a11y-${surface.label}-${slugify(violation.id)}.png`
        )
      }
    }

    await openTradeRoute(page)
    const modal = page.getByTestId('trade-disclaimer-modal')
    await expect(modal).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    const escClosedModal = !(await modal.isVisible().catch(() => false))
    const focusAfterEscape = await captureFocusState(page)
    const escHandledSafely =
      escClosedModal ||
      (focusAfterEscape.withinDialog &&
        ['trade-disclaimer-checkbox', 'trade-disclaimer-enter-btn'].includes(
          focusAfterEscape.testId
        ))
    if (!escHandledSafely) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'serious',
          title: 'Trade disclaimer modal ignores Escape',
          step: 'a11y scan > keyboard-only navigation',
          reproducer: ['Open /portfolio/me/trade with disclaimer required', 'Press Escape'],
          suggestedFix:
            'Either close the modal on Escape or keep focus anchored to a safe control inside the required disclaimer gate.',
          effort: '1-2 hr',
        },
        'a11y-trade-modal-esc.png'
      )
    }

    await openRoot(page)
    const focusOrder = []
    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press('Tab')
      focusOrder.push(await captureFocusState(page))
    }
    if (focusOrder.some((sample) => !sample.label && sample.tag === 'body')) {
      await recordFinding(
        page,
        testInfo,
        {
          severity: 'moderate',
          title: 'Keyboard tab order falls back to body instead of a visible interactive target',
          step: 'a11y scan > keyboard-only navigation',
          reproducer: ['Open the root app URL', 'Press Tab through the first 10 interactive elements'],
          suggestedFix: 'Ensure every early interactive control is focusable and visible at boot.',
          effort: '1-2 hr',
        },
        'a11y-focus-order.png'
      )
    }

    const findings = findingsByTestId.get(testInfo.testId) || []
    const evidence = finalizeQaEvidence(testInfo)
    expect(
      findings.length + evidence.blockingErrors.length,
      `hostile a11y issues: ${findings
        .map((item) => item.title)
        .concat(evidence.blockingErrors)
        .join(' | ')}`
    ).toBe(0)
  })
})
