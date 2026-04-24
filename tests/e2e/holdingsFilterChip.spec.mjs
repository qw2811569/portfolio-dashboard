import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
} from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'
const FILTER_STORAGE_KEY = `pf-${PORTFOLIO_ID}-holdings-filters-v1`
const STEP_WAIT_MS = 1800

const SEEDED_STORAGE = {
  'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
    { code: '00637L', name: '滬深300正2', qty: 10, cost: 19, price: 20, value: 200, type: 'ETF' },
    { code: '2308', name: '台達電', qty: 2, cost: 1287.5, price: 1440, value: 2880, type: '股票' },
    { code: '3017', name: '奇鋐', qty: 1, cost: 1400, price: 1905, value: 1905, type: '股票' },
    { code: '4583', name: '台灣精銳', qty: 1, cost: 734, price: 629, value: 629, type: '股票' },
  ],
  [`pf-${PORTFOLIO_ID}-holding-dossiers-v1`]: [
    {
      code: '2308',
      name: '台達電',
      thesis: {
        pillars: [{ id: 'p1', label: 'AI 伺服器與電源整合', status: 'on_track' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 1440 },
    },
    {
      code: '3017',
      name: '奇鋐',
      thesis: {
        pillars: [{ id: 'p2', label: '散熱與 GB 機櫃主線', status: 'watch' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 1905 },
    },
    {
      code: '4583',
      name: '台灣精銳',
      thesis: {
        pillars: [{ id: 'p3', label: '訂單與法說催化', status: 'broken' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 629 },
    },
  ],
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [
    {
      id: 'evt-4583-upcoming',
      status: 'pending',
      eventDate: '2026-05-12',
      title: '台灣精銳法說',
      stocks: ['台灣精銳 4583'],
    },
    {
      id: 'evt-4583-watch',
      status: 'tracking',
      eventDate: '2026-04-25',
      title: '台灣精銳追蹤中',
      stocks: ['台灣精銳 4583'],
    },
  ],
  [`pf-${PORTFOLIO_ID}-targets-v1`]: {},
  [`pf-${PORTFOLIO_ID}-fundamentals-v1`]: {},
  [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${PORTFOLIO_ID}-analyst-reports-v1`]: {},
  [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [],
  [`pf-${PORTFOLIO_ID}-daily-report-v1`]: null,
  [`pf-${PORTFOLIO_ID}-research-history-v1`]: [],
  [`pf-${PORTFOLIO_ID}-brain-v1`]: null,
  [`pf-${PORTFOLIO_ID}-reversal-v1`]: {},
  [`pf-${PORTFOLIO_ID}-notes-v1`]: {},
}

async function settle(page, waitMs = STEP_WAIT_MS) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function seedStorage(page, storage = SEEDED_STORAGE) {
  await page.addInitScript((seed) => {
    if (window.sessionStorage.getItem('__holdings-filter-chip-seeded') === '1') return
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
    window.sessionStorage.setItem('__holdings-filter-chip-seeded', '1')
  }, storage)
}

async function stubCommonApis(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let payload = null

    if (url.pathname === '/api/brain') {
      payload = { holdings: [], events: [], history: [], brain: null }
    } else if (url.pathname === '/api/research') {
      payload = { reports: [] }
    } else if (url.pathname === '/api/analyst-reports') {
      payload = { items: [], reports: [] }
    } else if (url.pathname === '/api/tracked-stocks') {
      payload = { trackedStocks: [] }
    } else if (url.pathname === '/api/target-prices') {
      payload = { reports: [], updatedAt: null, isNew: false }
    } else if (url.pathname === '/api/morning-note') {
      payload = { note: null }
    } else if (url.pathname === '/api/twse') {
      payload = { msgArray: [] }
    }

    if (payload == null) {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

async function clickHoldingsTab(page) {
  const tab = page.getByTestId('tab-holdings')
  await tab.scrollIntoViewIfNeeded()
  await tab.click()
  await settle(page)
}

async function openHoldings(page) {
  if (await page.getByTestId('holdings-filter-chip-bar').isVisible().catch(() => false)) return
  await clickHoldingsTab(page)
  await expect(page.getByTestId('holdings-panel')).toBeVisible()
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('holdings chip bar filters growth holdings, persists per portfolio, and clears back to full table', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-filter-chip-bar' })
  installQaMonitor(testInfo, page)

  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)

  await openHoldings(page)
  await expect(page.getByTestId('holdings-filter-chip-bar')).toBeVisible()
  await expect(page.getByTestId('holdings-filter-primary-row')).toBeVisible()

  await page.getByTestId('holdings-filter-primary-growth').click()
  await expect(page.getByText('持股明細 · 2檔')).toBeVisible()
  await expect(page.getByRole('button', { name: /展開 台達電 明細|收合 台達電 明細/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /展開 奇鋐 明細|收合 奇鋐 明細/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /展開 台灣精銳 明細|收合 台灣精銳 明細/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /展開 滬深300正2 明細|收合 滬深300正2 明細/ })).toHaveCount(0)

  const storedGrowthFilter = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), FILTER_STORAGE_KEY)
  expect(storedGrowthFilter.selectedPrimaryKeys || []).toEqual(['growth'])
  expect(storedGrowthFilter.focusedPrimaryKey).toBe('growth')

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2400)
  await openHoldings(page)

  await expect(page.getByTestId('holdings-filter-primary-growth')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('持股明細 · 2檔')).toBeVisible()

  await page.getByTestId('holdings-filter-clear').click()
  await expect(page.getByText('持股明細 · 4檔')).toBeVisible()
  await expect(page.getByTestId('holdings-filter-primary-growth')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: /展開 台灣精銳 明細|收合 台灣精銳 明細/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /展開 滬深300正2 明細|收合 滬深300正2 明細/ })).toHaveCount(1)
})

test('mobile holdings chip rows keep horizontal scroll and 44px tap targets', async ({ page }, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-filter-chip-bar-mobile' })
  installQaMonitor(testInfo, page)

  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)

  await openHoldings(page)

  const primaryRow = page.getByTestId('holdings-filter-primary-row')
  await expect(primaryRow).toBeVisible()

  const primaryRowMetrics = await primaryRow.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }))
  expect(primaryRowMetrics.scrollWidth).toBeGreaterThan(primaryRowMetrics.clientWidth)

  const growthChip = page.getByTestId('holdings-filter-primary-growth')
  const growthBox = await growthChip.boundingBox()
  expect(growthBox?.height || 0).toBeGreaterThanOrEqual(44)
  expect(growthBox?.width || 0).toBeGreaterThanOrEqual(44)
})
