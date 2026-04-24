import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  saveLocatorScreenshot,
  stubOwnerCloudBootstrap,
} from './support/qaHelpers.mjs'

const ANXIETY_SEED = {
  'pf-portfolios-v1': [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': 'me',
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  'pf-market-price-cache-v1': {
    marketDate: '2026-04-24',
    syncedAt: '2026-04-24T06:00:00.000Z',
    prices: {
      2330: { price: 950, change: 7, changePct: 0.74 },
      2454: { price: 1220, change: -12, changePct: -0.97 },
    },
  },
  'pf-market-price-sync-v1': {
    status: 'success',
    syncedAt: '2026-04-24T06:00:00.000Z',
    marketDate: '2026-04-24',
  },
  'pf-me-holdings-v2': [
    { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 },
    { code: '2454', name: '聯發科', qty: 5, cost: 1200, price: 1220, value: 6100 },
  ],
  'pf-thesis-v1-me': [
    {
      id: 'thesis-2330',
      stockId: '2330',
      statement: 'AI 需求延續',
      status: 'active',
      pillars: [
        { id: 'p1', text: 'CoWoS 產能續開', status: 'broken' },
        { id: 'p2', text: '先進製程滿載', status: 'on_track' },
      ],
    },
    {
      id: 'thesis-2454',
      stockId: '2454',
      statement: '手機回補',
      status: 'active',
      pillars: [{ id: 'p3', text: '庫存去化', status: 'watch' }],
    },
  ],
  'pf-me-holding-dossiers-v1': [
    {
      code: '2330',
      name: '台積電',
      position: { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 },
      thesis: {
        stockId: '2330',
        statement: 'AI 需求延續',
        pillars: [
          { id: 'p1', text: 'CoWoS 產能續開', status: 'broken' },
          { id: 'p2', text: '先進製程滿載', status: 'on_track' },
        ],
      },
      finmind: {
        institutional: [
          { date: '2026-04-24', foreign: 100, investment: 30, dealer: -10 },
          { date: '2026-04-23', foreign: -20, investment: 10, dealer: 0 },
          { date: '2026-04-22', foreign: 10, investment: 5, dealer: 0 },
        ],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
    },
    {
      code: '2454',
      name: '聯發科',
      position: { code: '2454', name: '聯發科', qty: 5, cost: 1200, price: 1220, value: 6100 },
      thesis: {
        stockId: '2454',
        statement: '手機回補',
        pillars: [{ id: 'p3', text: '庫存去化', status: 'watch' }],
      },
      finmind: {
        institutional: [
          { date: '2026-04-24', foreign: -50, investment: 0, dealer: -10 },
          { date: '2026-04-23', foreign: -20, investment: 0, dealer: -5 },
        ],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
    },
  ],
  'pf-me-news-events-v1': [
    {
      id: 'evt-1',
      title: '台積電法說',
      status: 'pending',
      eventDate: '2026-04-25',
      stocks: ['台積電 2330'],
    },
    {
      id: 'evt-2',
      title: '聯發科法說',
      status: 'tracking',
      eventDate: '2026-04-27',
      stocks: ['聯發科 2454'],
    },
  ],
  'pf-me-notes-v1': { riskProfile: '', preferences: '', customNotes: '' },
}

async function seedDashboard(page) {
  await stubOwnerCloudBootstrap(page, {
    holdings: ANXIETY_SEED['pf-me-holdings-v2'],
    events: ANXIETY_SEED['pf-me-news-events-v1'],
  })
  await page.route('**/api/finmind*', async (route) => {
    const url = new URL(route.request().url())
    const dataset = url.searchParams.get('dataset')
    const code = url.searchParams.get('code')

    if (dataset === 'institutional' && code === '2330') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { date: '2026-04-24', foreign: 100, investment: 30, dealer: -10 },
            { date: '2026-04-23', foreign: -20, investment: 10, dealer: 0 },
            { date: '2026-04-22', foreign: 10, investment: 5, dealer: 0 },
          ],
        }),
      })
      return
    }

    if (dataset === 'institutional' && code === '2454') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { date: '2026-04-24', foreign: -50, investment: 0, dealer: -10 },
            { date: '2026-04-23', foreign: -20, investment: 0, dealer: -5 },
          ],
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
  await page.route('**/api/portfolio-benchmark-zscore*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'ready',
        portfolioId: 'me',
        benchmark: {
          code: '0050',
          label: '元大台灣50',
          proxyFor: '^TWII',
          source: 'finmind:TaiwanStockPrice',
        },
        marketDate: '2026-04-24',
        trailingWindow: 20,
        recentWindow: 7,
        zScore: 1.2,
        interpretation: 'outperform',
        latestPortfolioReturnPct: 1.1,
        latestBenchmarkReturnPct: 0.4,
        latestDiffPct: 0.7,
        volatilityPct: 0.58,
        sampleSize: 20,
        recentSeries: [
          { date: '2026-04-16', portfolioReturnPct: 0.8, benchmarkReturnPct: 0.4, diffPct: 0.4 },
          { date: '2026-04-17', portfolioReturnPct: 1.0, benchmarkReturnPct: 0.5, diffPct: 0.5 },
          { date: '2026-04-18', portfolioReturnPct: 0.7, benchmarkReturnPct: 0.3, diffPct: 0.4 },
          { date: '2026-04-21', portfolioReturnPct: 1.3, benchmarkReturnPct: 0.6, diffPct: 0.7 },
          { date: '2026-04-22', portfolioReturnPct: 0.9, benchmarkReturnPct: 0.5, diffPct: 0.4 },
          { date: '2026-04-23', portfolioReturnPct: 1.0, benchmarkReturnPct: 0.4, diffPct: 0.6 },
          { date: '2026-04-24', portfolioReturnPct: 1.1, benchmarkReturnPct: 0.4, diffPct: 0.7 },
        ],
      }),
    })
  })
  await page.route('**/api/tracked-stocks*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trackedStocks: [] }),
    })
  })

  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, ANXIETY_SEED)

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.getByTestId('anxiety-metrics-panel')).toBeVisible()
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('dashboard shows the unified X1-X5 anxiety metrics panel and handoff works', async ({
  page,
}, testInfo) => {
  installQaMonitor(testInfo, page)
  await seedDashboard(page)

  const panel = page.getByTestId('anxiety-metrics-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('anxiety-metric-question-x1')).toContainText('今天漲跌正常嗎？')
  await expect(page.getByTestId('anxiety-metric-question-x2')).toContainText('Thesis 還成立嗎？')
  await expect(page.getByTestId('anxiety-metric-question-x3')).toContainText(
    '法人在我持股怎麼動？'
  )
  await expect(page.getByTestId('anxiety-metric-question-x4')).toContainText(
    '部位集中度是否過高？'
  )
  await expect(page.getByTestId('anxiety-metric-question-x5')).toContainText(
    '三天內有沒有事件？'
  )
  await expect(page.getByText('+1.2σ')).toBeVisible()
  await expect(page.getByText(/0050 \+0\.4%/)).toBeVisible()
  await saveLocatorScreenshot(panel, testInfo, 'anxiety-metrics-panel-desktop.png')

  const panelAxeResults = await new AxeBuilder({ page })
    .include('[data-testid="anxiety-metrics-panel"]')
    .analyze()
  expect(panelAxeResults.violations).toEqual([])

  await page.getByTestId('anxiety-metric-toggle-x5').click()
  await expect(page.getByTestId('anxiety-metric-detail-x5')).toBeVisible()

  await page.getByTestId('anxiety-metric-handoff-x5').click()
  await expect(page.getByTestId('events-panel')).toBeVisible()
})

test('mobile keeps all five anxiety metrics readable and expandable', async ({ page }, testInfo) => {
  installQaMonitor(testInfo, page)
  await page.setViewportSize({ width: 375, height: 667 })
  await seedDashboard(page)

  const panel = page.getByTestId('anxiety-metrics-panel')
  await expect(panel).toBeVisible()
  await saveLocatorScreenshot(panel, testInfo, 'anxiety-metrics-panel-mobile.png')

  for (const id of ['x1', 'x2', 'x3', 'x4', 'x5']) {
    const card = page.getByTestId(`anxiety-metric-card-${id}`)
    await card.scrollIntoViewIfNeeded()
    await expect(card).toBeVisible()
  }

  await expect(page.getByTestId('anxiety-metric-detail-x2')).toBeVisible()

  const axeResults = await new AxeBuilder({ page })
    .include('[data-testid="anxiety-metrics-panel"]')
    .analyze()
  expect(axeResults.violations).toEqual([])
})
