import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
} from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'
const SAVED_FILTERS_KEY = `pf-${PORTFOLIO_ID}-saved-filters-v1`
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
  [`pf-thesis-v1-${PORTFOLIO_ID}`]: [
    {
      id: 'thesis-2308',
      stockId: '2308',
      status: 'active',
      statement: 'AI 電源與液冷主線還在',
      reason: 'AI 電源',
      pillars: [{ id: 'p1', label: 'AI 伺服器與電源整合', status: 'on_track', trend: 'stable' }],
      risks: [],
      updateLog: [],
      targetPrice: 1650,
      stopLoss: 1150,
    },
    {
      id: 'thesis-3017',
      stockId: '3017',
      status: 'active',
      statement: '散熱與 GB 機櫃主線先繼續追',
      reason: '散熱主線',
      pillars: [{ id: 'p2', label: '散熱與 GB 機櫃主線', status: 'watch', trend: 'stable' }],
      risks: [],
      updateLog: [],
      targetPrice: 2200,
      stopLoss: 1600,
    },
    {
      id: 'thesis-4583',
      stockId: '4583',
      status: 'active',
      statement: '法說催化若失靈就要動手',
      reason: '法說催化',
      pillars: [{ id: 'p3', label: '訂單與法說催化', status: 'broken', trend: 'down' }],
      risks: [],
      updateLog: [],
      targetPrice: 760,
      stopLoss: 660,
    },
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
  [`pf-${PORTFOLIO_ID}-targets-v1`]: {
    2308: {
      reports: [{ firm: '元大', target: 1650, date: '2026-04-23' }],
    },
    3017: {
      reports: [{ firm: '凱基', target: 2200, date: '2026-04-20' }],
    },
    4583: {
      reports: [{ firm: '群益', target: 760, date: '2026-04-20' }],
    },
  },
  [`pf-${PORTFOLIO_ID}-fundamentals-v1`]: {
    2308: {
      updatedAt: '2026-04-21T08:00:00.000Z',
      revenueMonth: '2026-03',
      revenueYoY: 25.4,
    },
    3017: {
      updatedAt: '2026-02-01T08:00:00.000Z',
      revenueMonth: '2026-01',
      revenueYoY: 18.1,
    },
    4583: {
      updatedAt: '2026-04-20T08:00:00.000Z',
      revenueMonth: '2026-03',
      revenueYoY: 9.2,
    },
  },
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
    if (window.sessionStorage.getItem('__holdings-intent-filter-seeded') === '1') return
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
    window.sessionStorage.setItem('__holdings-intent-filter-seeded', '1')
  }, storage)
}

async function stubCommonApis(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(route.request().url())
    let payload = null

    if (url.pathname === '/api/brain') {
      if (request.method() === 'GET') {
        const action = url.searchParams.get('action')
        if (action === 'brain') {
          payload = { brain: null }
        } else if (action === 'history') {
          payload = { history: [] }
        } else {
          payload = { holdings: [], events: [], history: [], brain: null }
        }
      } else if (request.method() === 'POST') {
        let action = ''
        try {
          action = JSON.parse(request.postData() || '{}')?.action || ''
        } catch {
          action = ''
        }

        if (action === 'load-holdings') {
          payload = { holdings: SEEDED_STORAGE[`pf-${PORTFOLIO_ID}-holdings-v2`] }
        } else if (action === 'load-events') {
          payload = { events: SEEDED_STORAGE[`pf-${PORTFOLIO_ID}-news-events-v1`] }
        } else if (['save-holdings', 'save-events', 'save-brain'].includes(action)) {
          payload = { ok: true }
        } else {
          payload = { holdings: [], events: [], history: [], brain: null }
        }
      }
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
  if (
    await page
      .getByTestId('holdings-filter-chip-bar')
      .isVisible()
      .catch(() => false)
  )
    return
  await clickHoldingsTab(page)
  await expect(page.getByTestId('holdings-panel')).toBeVisible()
}

async function waitForSearchDebounce(page) {
  await page.waitForTimeout(320)
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('fresh storage keeps the default holdings table visible instead of falling into onboarding empty state', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-fresh-default-visible' })
  installQaMonitor(testInfo, page)

  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  await expect(page.getByText(/持股明細 · 4檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-2308')).toBeVisible()
  await expect(page.getByText('還沒加股')).toHaveCount(0)

  const storedV2 = await page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) || '{}'),
    `pf-${PORTFOLIO_ID}-holdings-filters-v2`
  )
  expect(storedV2.intentKey).toBe('all')
})

test('intent chips switch between need-attention, stable, action, and all', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-primary-switch' })
  installQaMonitor(testInfo, page)

  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  await page.getByTestId('holdings-filter-primary-attention').click()
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-4583')).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-2308')).toHaveCount(0)

  await page.getByTestId('holdings-filter-primary-stable').click()
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-2308')).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-3017')).toHaveCount(0)

  await page.getByTestId('holdings-filter-primary-action').click()
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-3017')).toBeVisible()

  await page.getByTestId('holdings-filter-primary-all').click()
  await expect(page.getByText(/持股明細 · 4檔/)).toBeVisible()
})

test('secondary chips compose with AND logic and URL sync stays readable', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-secondary-and-url' })
  installQaMonitor(testInfo, page)

  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  await page.getByTestId('holdings-filter-type-growth').click()
  await page.getByTestId('holdings-filter-risk-stale').click()
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-3017')).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-2308')).toHaveCount(0)

  await expect(page).toHaveURL(/type=growth/)
  await expect(page).toHaveURL(/risk=stale/)
})

test('search stacks with chip filters and saved filters can be stored then re-applied', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-search-and-saved-filter' })
  installQaMonitor(testInfo, page)

  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  await page.getByTestId('holdings-filter-type-growth').click()
  await page.getByTestId('holdings-filter-search').fill('散熱')
  await waitForSearchDebounce(page)
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-3017')).toBeVisible()

  await page.getByTestId('holdings-filter-search').fill('')
  await waitForSearchDebounce(page)
  await page.getByTestId('holdings-filter-risk-stale').click()
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()

  await page.getByTestId('holdings-filter-save').click()
  await page.getByLabel('filter 名稱').fill('散熱先處理')
  await page.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByTestId('holdings-filter-saved-select')).toContainText('散熱先處理')

  await page.getByTestId('holdings-filter-clear').click()
  await expect(page.getByText(/持股明細 · 4檔/)).toBeVisible()
  await page.getByTestId('holdings-filter-saved-select').selectOption({ label: '散熱先處理' })
  await expect(page.getByText(/持股明細 · 1檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-3017')).toBeVisible()

  const savedFilters = await page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) || '[]'),
    SAVED_FILTERS_KEY
  )
  expect(savedFilters.map((item) => item.name)).toContain('散熱先處理')
})

test('legacy v1 all-pillars state migrates to the all intent instead of hiding the table', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-legacy-all-pillars' })
  installQaMonitor(testInfo, page)

  await seedStorage(page, {
    ...SEEDED_STORAGE,
    [`pf-${PORTFOLIO_ID}-holdings-filters-v1`]: {
      focusedPrimaryKey: 'all',
      selectedPrimaryKeys: [],
      secondaryFilters: {
        all: ['broken', 'weakened', 'intact'],
        growth: [],
        event: [],
      },
    },
  })
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  await expect(page.getByText(/持股明細 · 4檔/)).toBeVisible()
  await expect(page.getByTestId('holding-open-detail-2308')).toBeVisible()
  await expect(page.getByText('還沒加股')).toHaveCount(0)

  const storedV2 = await page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) || '{}'),
    `pf-${PORTFOLIO_ID}-holdings-filters-v2`
  )
  expect(storedV2.intentKey).toBe('all')
})

test('zero-match results use the filtered empty state and can clear back to all holdings', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-zero-match-empty-state' })
  installQaMonitor(testInfo, page)

  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  await page.getByTestId('holdings-filter-type-growth').click()
  await page.getByTestId('holdings-filter-eventWindow-monthdividend').click()

  await expect(page.getByTestId('holdings-filtered-empty-state')).toBeVisible()
  await expect(page.getByText('目前篩選沒符合')).toBeVisible()
  await expect(page.getByText('還沒加股')).toHaveCount(0)

  await page.getByTestId('holdings-filtered-empty-clear').click()
  await expect(page.getByText(/持股明細 · 4檔/)).toBeVisible()
})

test('mobile advanced drawer opens cleanly and the filter bar passes axe', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holdings-intent-mobile-a11y' })
  installQaMonitor(testInfo, page)

  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await stubCommonApis(page)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await openHoldings(page)

  const drawerToggle = page.getByTestId('holdings-filter-mobile-toggle')
  const toggleBox = await drawerToggle.boundingBox()
  expect(toggleBox?.height || 0).toBeGreaterThanOrEqual(44)

  await drawerToggle.click()
  await expect(page.getByTestId('holdings-filter-advanced-body')).toBeVisible()

  const axeResults = await new AxeBuilder({ page })
    .include('[data-testid="holdings-filter-chip-bar"]')
    .analyze()
  expect(axeResults.violations).toEqual([])
})
