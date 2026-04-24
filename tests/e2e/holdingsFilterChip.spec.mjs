import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
} from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'
const FILTER_STORAGE_KEY_V1 = `pf-${PORTFOLIO_ID}-holdings-filters-v1`
const FILTER_STORAGE_KEY_V2 = `pf-${PORTFOLIO_ID}-holdings-filters-v2`
const STEP_WAIT_MS = 1800

const BASE_STORAGE = {
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
      stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI', '電源'] },
      thesis: {
        statement: 'AI 電源與液冷主線還在',
        pillars: [{ id: 'p1', label: 'AI 伺服器與電源整合', status: 'on_track' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 1440 },
    },
    {
      code: '3017',
      name: '奇鋐',
      stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI', '散熱'] },
      thesis: {
        statement: '散熱與 GB 機櫃主線先繼續追',
        pillars: [{ id: 'p2', label: '散熱與 GB 機櫃主線', status: 'watch' }],
      },
      freshness: { fundamentals: 'stale', targets: 'fresh' },
      position: { price: 1905 },
    },
    {
      code: '4583',
      name: '台灣精銳',
      stockMeta: { industry: '精密機械', strategy: '事件驅動', themes: ['機器人'] },
      thesis: {
        statement: '法說催化若失靈就要動手',
        pillars: [{ id: 'p3', label: '訂單與法說催化', status: 'broken' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 629 },
    },
  ],
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [
    {
      id: 'evt-4583-earnings',
      status: 'pending',
      eventDate: '2026-04-28',
      title: '台灣精銳法說',
      stocks: ['台灣精銳 4583'],
      eventType: 'earnings',
      type: 'earnings',
    },
    {
      id: 'evt-3017-news',
      recordType: 'news',
      source: 'finmind-news',
      publishedAt: '2026-04-23',
      title: '散熱族群近 3 日新聞',
      stocks: ['奇鋐 3017'],
    },
    {
      id: 'evt-00637L-dividend',
      eventType: 'ex-dividend',
      type: 'dividend',
      source: 'finmind-dividend',
      eventDate: '2026-04-30',
      title: 'ETF 除權息窗口',
      stocks: ['滬深300正2 00637L'],
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

async function seedStorage(page, storage = BASE_STORAGE) {
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

test('legacy v1 holdings filter migrates into the v2 intent/type schema without losing the filtered result', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-filter-v1-migration' })
  installQaMonitor(testInfo, page)

  await seedStorage(page, {
    ...BASE_STORAGE,
    [FILTER_STORAGE_KEY_V1]: {
      focusedPrimaryKey: 'growth',
      selectedPrimaryKeys: ['growth'],
      secondaryFilters: {
        all: [],
        growth: ['AI/伺服器'],
        event: [],
      },
    },
  })
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2400)

  await openHoldings(page)

  await expect(page.getByTestId('holdings-filter-chip-bar')).toBeVisible()
  await expect(page.getByTestId('holdings-filter-type-growth')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.getByTestId('holdings-filter-sector-ai-伺服器')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.getByText('持股明細 · 2檔')).toBeVisible()

  const storedV2 = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), FILTER_STORAGE_KEY_V2)
  expect(storedV2.intentKey).toBe('all')
  expect(storedV2.filterGroups.type || []).toEqual(['growth'])
  expect(storedV2.filterGroups.sector || []).toEqual(['AI/伺服器'])

  const mirroredV1 = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), FILTER_STORAGE_KEY_V1)
  expect(mirroredV1.selectedPrimaryKeys || []).toEqual(['growth'])
})

test('mobile intent bar keeps 44px tap targets and exposes the advanced drawer toggle', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-filter-mobile-contract' })
  installQaMonitor(testInfo, page)

  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2400)

  await openHoldings(page)

  const primaryRow = page.getByTestId('holdings-filter-primary-row')
  await expect(primaryRow).toBeVisible()

  const primaryRowMetrics = await primaryRow.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }))
  expect(primaryRowMetrics.scrollWidth).toBeGreaterThan(primaryRowMetrics.clientWidth)

  const attentionChip = page.getByTestId('holdings-filter-primary-attention')
  const attentionBox = await attentionChip.boundingBox()
  expect(attentionBox?.height || 0).toBeGreaterThanOrEqual(44)
  expect(attentionBox?.width || 0).toBeGreaterThanOrEqual(44)

  const drawerToggle = page.getByTestId('holdings-filter-mobile-toggle')
  const toggleBox = await drawerToggle.boundingBox()
  expect(toggleBox?.height || 0).toBeGreaterThanOrEqual(44)
  await drawerToggle.click()
  await expect(page.getByTestId('holdings-filter-advanced-body')).toBeVisible()
})
