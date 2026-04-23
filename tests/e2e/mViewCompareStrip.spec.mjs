import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  saveLocatorScreenshot,
} from './support/qaHelpers.mjs'

const M_VIEW_SEED = {
  'pf-portfolios-v1': [
    { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' },
    { id: '7865', name: '金聯成', isOwner: false, createdAt: '2026-04-24' },
  ],
  'pf-active-portfolio-v1': 'me',
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  'pf-market-price-cache-v1': {
    marketDate: '2026-04-24',
    syncedAt: '2026-04-24T06:00:00.000Z',
    prices: {
      2330: { price: 950, change: 7, changePct: 0.74 },
      2489: { price: 42, change: 0.25, changePct: 0.6 },
    },
  },
  'pf-market-price-sync-v1': {
    status: 'success',
    syncedAt: '2026-04-24T06:00:00.000Z',
    marketDate: '2026-04-24',
  },
  'pf-me-holdings-v2': [{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950 }],
  'pf-me-news-events-v1': [
    {
      id: 'evt-me-1',
      title: '台積電法說',
      status: 'pending',
      eventDate: '2026-04-24',
      pred: 'up',
      predReason: 'AI 需求延續',
    },
  ],
  'pf-me-notes-v1': { riskProfile: '', preferences: '', customNotes: '' },
  'pf-7865-holdings-v2': [{ code: '2489', name: '瑞軒', qty: 100, cost: 40, price: 42 }],
  'pf-7865-news-events-v1': [
    {
      id: 'evt-7865-1',
      title: '瑞軒法說',
      status: 'pending',
      eventDate: '2026-04-24',
      pred: 'flat',
      predReason: '先看出貨',
    },
  ],
  'pf-7865-notes-v1': { riskProfile: '', preferences: '', customNotes: '' },
}

async function seedDashboard(page) {
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, M_VIEW_SEED)

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.getByTestId('dashboard-headline')).toBeVisible()
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('desktop shows compare strip below dashboard hero and click opens overview', async ({
  page,
}, testInfo) => {
  installQaMonitor(testInfo, page)
  await seedDashboard(page)

  const compareStrip = page.getByTestId('dashboard-compare-strip')
  await expect(compareStrip).toBeVisible()
  await expect(page.getByTestId('dashboard-compare-summary')).toContainText('今日差距 +0.1pp')
  await saveLocatorScreenshot(compareStrip, testInfo, 'desktop-dashboard-compare.png')

  await compareStrip.getByText('今日差距 +0.1pp').click()
  await expect(page.getByTestId('overview-summary-metrics-grid')).toBeVisible()
  await saveLocatorScreenshot(
    page.getByTestId('overview-summary-metrics-grid'),
    testInfo,
    'desktop-overview-summary-grid.png'
  )
})

test('iphone se overview summary metrics collapse without breaking layout', async ({
  page,
}, testInfo) => {
  installQaMonitor(testInfo, page)
  await page.setViewportSize({ width: 375, height: 667 })
  await seedDashboard(page)

  await page.getByTestId('dashboard-compare-summary').click()
  const summaryGrid = page.getByTestId('overview-summary-metrics-grid')
  await expect(summaryGrid).toBeVisible()

  const gridTemplateColumns = await summaryGrid.evaluate(
    (element) => element.style.gridTemplateColumns
  )
  expect(gridTemplateColumns.replace(/\s+/g, '')).toBe('minmax(0px,1fr)')
  await saveLocatorScreenshot(summaryGrid, testInfo, 'iphone-se-overview-summary-grid.png')
})

test('iphone se keeps the compare strip readable on dashboard', async ({ page }, testInfo) => {
  installQaMonitor(testInfo, page)
  await page.setViewportSize({ width: 375, height: 667 })
  await seedDashboard(page)

  const compareStrip = page.getByTestId('dashboard-compare-strip')
  await expect(compareStrip).toBeVisible()
  await expect(page.getByTestId('dashboard-compare-summary')).toContainText('小奎主要投資')
  await expect(page.getByTestId('dashboard-compare-insight')).toContainText('主要拉動是 台積電')
  await saveLocatorScreenshot(compareStrip, testInfo, 'iphone-se-dashboard-compare.png')
})
