import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL, stubOwnerCloudBootstrap } from './support/qaHelpers.mjs'

const BASE_SEED = {
  'pf-portfolios-v1': [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
  'pf-active-portfolio-v1': 'me',
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  'pf-me-holdings-v2': [
    {
      code: '2330',
      name: '台積電',
      qty: 10,
      price: 950,
      cost: 900,
      value: 9500,
      pnl: 500,
      pct: 5.56,
      type: '股票',
    },
  ],
  'pf-me-log-v2': [],
  'pf-me-targets-v1': {
    2330: {
      code: '2330',
      targetPrice: 1100,
      updatedAt: '2026-04-23T16:00:00.000+08:00',
    },
  },
  'pf-me-fundamentals-v1': {
    2330: {
      code: '2330',
      revenueMonth: '2026-03',
      revenueYoY: 12.3,
      revenueMoM: 1.1,
      updatedAt: '2026-04-20T16:00:00.000+08:00',
      source: 'seed',
    },
  },
  'pf-me-watchlist-v1': [],
  'pf-me-analyst-reports-v1': {},
  'pf-me-report-refresh-meta-v1': {},
  'pf-me-holding-dossiers-v1': [
    {
      code: '2330',
      name: '台積電',
      position: {
        code: '2330',
        name: '台積電',
        qty: 10,
        cost: 900,
        price: 950,
        value: 9500,
        type: '股票',
      },
      freshness: {
        fundamentals: 'fresh',
        targets: 'fresh',
      },
      fundamentals: {
        code: '2330',
        revenueMonth: '2026-03',
        revenueYoY: 12.3,
        revenueMoM: 1.1,
        updatedAt: '2026-04-20T16:00:00.000+08:00',
      },
      targets: [{ firm: 'Seed', target: 1100, date: '2026/04/23' }],
      targetAggregate: { lowerBound: 1000, upperBound: 1200 },
      thesis: { pillars: [{ id: 'p1', text: '先進製程', status: 'stable' }] },
    },
  ],
  'pf-me-news-events-v1': [],
  'pf-me-analysis-history-v1': [],
  'pf-me-daily-report-v1': null,
  'pf-me-reversal-v1': {},
  'pf-me-brain-v1': null,
  'pf-me-research-history-v1': [],
  'pf-me-notes-v1': {},
}

function buildFinMindSuccess(url) {
  const requestUrl = new URL(url)
  return {
    success: true,
    dataset: requestUrl.searchParams.get('dataset') || 'revenue',
    code: requestUrl.searchParams.get('code') || '2330',
    data: [],
    fetchedAt: '2026-04-24T09:30:00.000+08:00',
    source: 'finmind',
  }
}

async function settle(page, waitMs = 1800) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function seedOwnerState(page, overrides = {}) {
  const seed = { ...BASE_SEED, ...overrides }
  await page.addInitScript((payload) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(payload)) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, seed)
  await stubOwnerCloudBootstrap(page, {
    holdings: seed['pf-me-holdings-v2'],
    events: seed['pf-me-news-events-v1'],
  })
}

async function openHoldings(page) {
  await page.goto(PORTFOLIO_BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 2400)
  await page.getByRole('button', { name: '持倉', exact: true }).click()
  await settle(page, 1800)
}

async function routeStorm(page, status) {
  const message =
    status === 401 ? 'Unauthorized' : status >= 500 ? 'upstream_error' : 'unexpected error'

  await page.route('**/api/finmind*', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  })

  await page.route('**/api/target-prices*', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  })

  await page.route('**/api/tracked-stocks', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  })

  await page.route('**/api/morning-note*', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  })
}

async function routeStableApis(page) {
  await page.route('**/api/finmind*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildFinMindSuccess(route.request().url())),
    })
  })

  await page.route('**/api/target-prices*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '2330',
        targets: {
          reports: [{ firm: 'Seed', target: 1100, date: '2026/04/23' }],
          updatedAt: '2026-04-23T16:00:00.000+08:00',
          source: 'seed',
        },
      }),
    })
  })

  await page.route('**/api/tracked-stocks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        totalTracked: 1,
        lastSyncedAt: '2026-04-24T09:31:00.000+08:00',
      }),
    })
  })

  await page.route('**/api/morning-note*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ note: null }),
    })
  })
}

test('collapses four concurrent 401 upstream failures into one auth banner', async ({ page }) => {
  await seedOwnerState(page)
  await routeStorm(page, 401)

  await openHoldings(page)

  const banner = page.getByTestId('upstream-health-banner')
  await expect(banner).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="upstream-health-banner"]')).toHaveCount(1)
  await expect(banner).toContainText('需要重新登入')
  await expect(page.getByRole('link', { name: '前往登入' })).toBeVisible()
  await expect(page.locator('[data-testid="accuracy-gate-block"]')).toHaveCount(0)
  await expect(page.locator('[data-error="target-prices"]')).toHaveCount(0)
  await expect(page.locator('[data-error="tracked-stocks"]')).toHaveCount(0)
})

test('collapses four concurrent 500 upstream failures into one service banner', async ({ page }) => {
  await seedOwnerState(page)
  await routeStorm(page, 500)

  await openHoldings(page)

  const banner = page.getByTestId('upstream-health-banner')
  await expect(banner).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="upstream-health-banner"]')).toHaveCount(1)
  await expect(banner).toContainText(
    '資料源暫時卡住 · 系統先用前一版數字撐 · 稍後自動補正'
  )
  await expect(page.getByTestId('upstream-health-retry')).toBeVisible()
  await expect(page.locator('[data-testid="accuracy-gate-block"]')).toHaveCount(0)
  await expect(page.locator('[data-error="target-prices"]')).toHaveCount(0)
  await expect(page.locator('[data-error="tracked-stocks"]')).toHaveCount(0)
})

test('shows em dash for today pnl on holdings when quote changes are fallback zeroes', async ({
  page,
}) => {
  await seedOwnerState(page, {
    'pf-market-price-cache-v1': {
      marketDate: '2026-04-24',
      syncedAt: '2026-04-24T09:30:00.000+08:00',
      source: 'twse',
      status: 'failed',
      prices: {
        2330: {
          price: 950,
          yesterday: null,
          change: 0,
          changePct: 0,
        },
      },
    },
    'pf-market-price-sync-v1': {
      marketDate: '2026-04-24',
      syncedAt: '2026-04-24T09:30:00.000+08:00',
      status: 'failed',
      codes: ['2330'],
      failedCodes: ['2330'],
    },
  })
  await routeStableApis(page)
  await page.route('**/api/twse*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'twse unavailable' }),
    })
  })

  await page.goto(PORTFOLIO_BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 2400)

  await page.getByRole('button', { name: '持倉', exact: true }).click()
  await settle(page, 1800)
  await expect(page.getByTestId('holdings-summary-today-pnl')).toHaveText('—')
})
