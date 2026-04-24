import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

async function settle(page, waitMs = 1800) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

function buildDegradedPayload(url, reason) {
  const requestUrl = new URL(url)
  const code = requestUrl.searchParams.get('code') || '2308'

  return {
    success: true,
    degraded: true,
    dataset: requestUrl.searchParams.get('dataset') || 'revenue',
    code,
    count: 0,
    data: [],
    source: 'snapshot-fallback',
    fetchedAt: '2026-04-24T09:30:00.000+08:00',
    degradedMeta: {
      reason,
      fallbackAt: '2026-04-23T16:00:00.000+08:00',
      snapshotDate: '2026-04-23',
      hasFallbackSnapshot: true,
    },
    fallbackSnapshot: {
      snapshotDate: '2026-04-23',
      updatedAt: '2026-04-23T16:00:00.000+08:00',
      portfolioId: 'me',
      fundamentals: {
        code,
        revenueMonth: '2026-02',
        revenueYoY: 12.3,
        revenueMoM: 1.5,
        updatedAt: '2026-03-20T16:00:00.000+08:00',
      },
      targetsEntry: {
        reports: [{ firm: '快照券商', target: 1480, date: '2026/03/18' }],
        updatedAt: '2026-03-18T12:00:00.000+08:00',
      },
    },
  }
}

async function routeFinMindDegraded(page, reason = 'api-timeout') {
  await page.route('**/api/finmind*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDegradedPayload(route.request().url(), reason)),
    })
  })
}

async function routeTargetPrices(page) {
  await page.route('**/api/target-prices*', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: url.searchParams.get('code') || '2308',
        targets: {
          reports: [],
          updatedAt: '2026-04-23T16:00:00.000+08:00',
          source: 'rss',
        },
      }),
    })
  })
}

async function seedSingleStockPortfolio(page) {
  await page.addInitScript(() => {
    const seed = {
      'pf-portfolios-v1': [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }],
      'pf-active-portfolio-v1': 'me',
      'pf-view-mode-v1': 'portfolio',
      'pf-schema-version': 3,
      'pf-me-holdings-v2': [
        {
          code: '2308',
          name: '台達電',
          qty: 2,
          price: 1440,
          cost: 1287.5,
          value: 2880,
          pnl: 305,
          pct: 11.84,
          type: '股票',
        },
      ],
      'pf-me-log-v2': [],
      'pf-me-targets-v1': {},
      'pf-me-fundamentals-v1': {},
      'pf-me-watchlist-v1': [],
      'pf-me-analyst-reports-v1': {},
      'pf-me-report-refresh-meta-v1': {},
      'pf-me-holding-dossiers-v1': [],
      'pf-me-news-events-v1': [],
      'pf-me-analysis-history-v1': [],
      'pf-me-daily-report-v1': null,
      'pf-me-reversal-v1': {},
      'pf-me-brain-v1': null,
      'pf-me-research-history-v1': [],
      'pf-me-notes-v1': {},
    }

    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed)) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  })
}

async function openHoldings(page) {
  await page.goto(PORTFOLIO_BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 2600)
  await page.getByRole('button', { name: '持倉', exact: true }).click()
  await settle(page, 1800)
}

test('FinMind timeout degraded mode shows stale fallback badge and keeps holdings content visible', async ({
  page,
}) => {
  await seedSingleStockPortfolio(page)
  await routeFinMindDegraded(page, 'api-timeout')
  await routeTargetPrices(page)

  await openHoldings(page)

  await expect(page.getByTestId('holdings-panel')).toBeVisible()
  await expect(page.getByTestId('accuracy-gate-block')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('accuracy-gate-block')).toHaveAttribute(
    'data-reason',
    'api-timeout'
  )
  await expect(page.getByText('總市值')).toBeVisible()

  await page.getByRole('button', { name: /展開 台達電 明細/ }).click()

  await expect(page.getByTestId('holding-fundamentals-stale-badge-2308')).toBeVisible()
  await expect(page.getByText(/這裡的數字是 .*前 · 現在的盤還沒拉到。/)).toBeVisible()
})

test('FinMind quota degraded mode shows quota gate without breaking the holdings summary', async ({
  page,
}) => {
  await seedSingleStockPortfolio(page)
  await routeFinMindDegraded(page, 'quota-exceeded')
  await routeTargetPrices(page)

  await openHoldings(page)

  await expect(page.getByTestId('accuracy-gate-block')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('accuracy-gate-block')).toHaveAttribute(
    'data-reason',
    'quota-exceeded'
  )
  await expect(page.getByText(/FinMind/i)).toBeVisible()
  await expect(page.getByText('總成本')).toBeVisible()
})

test('mobile degraded layout keeps the FinMind gate inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSingleStockPortfolio(page)
  await routeFinMindDegraded(page, 'api-timeout')
  await routeTargetPrices(page)

  await openHoldings(page)

  const gate = page.getByTestId('accuracy-gate-block')
  await expect(gate).toBeVisible({ timeout: 15000 })

  const box = await gate.boundingBox()
  expect(box).toBeTruthy()
  expect(box.width).toBeLessThanOrEqual(390)
})
