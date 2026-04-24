import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL, stubOwnerCloudBootstrap } from './support/qaHelpers.mjs'

const SEEDED_PORTFOLIO_ID = 'me'
const SEEDED_RESEARCH_RESULT = {
  results: [
    {
      timestamp: 1713984000000,
      code: '2330',
      name: '台積電',
      mode: 'single',
      date: '2026-04-24',
      summary: '這裡原本會放單檔研究摘要。',
      rounds: [
        {
          title: '基本面深度分析',
          content: '這裡原本會放逐輪研究內容。',
        },
      ],
    },
  ],
}

const SEEDED_STORAGE = {
  'pf-portfolios-v1': [{ id: SEEDED_PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': SEEDED_PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  [`pf-${SEEDED_PORTFOLIO_ID}-holdings-v2`]: [
    { code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 },
  ],
  [`pf-${SEEDED_PORTFOLIO_ID}-log-v2`]: [],
  [`pf-${SEEDED_PORTFOLIO_ID}-targets-v1`]: {},
  [`pf-${SEEDED_PORTFOLIO_ID}-fundamentals-v1`]: {},
  [`pf-${SEEDED_PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${SEEDED_PORTFOLIO_ID}-analyst-reports-v1`]: {
    2330: {
      items: [
        {
          id: 'rss-1',
          title: '外資更新研究摘要',
          source: 'rss',
          publishedAt: '2026-04-24',
          summary: '公開來源仍有研究摘要可看。',
        },
      ],
    },
  },
  [`pf-${SEEDED_PORTFOLIO_ID}-holding-dossiers-v1`]: [
    {
      code: '2330',
      name: '台積電',
      thesis: { pillars: [{ status: 'stable' }] },
      freshness: {
        fundamentals: 'missing',
        targets: 'missing',
        research: 'missing',
      },
      position: { price: 950 },
    },
  ],
  [`pf-${SEEDED_PORTFOLIO_ID}-news-events-v1`]: [
    {
      id: 'market-1',
      source: 'market-cache',
      type: 'market-summary',
      date: '2026-04-24',
      title: '台股收高 0.8%',
      detail: '電子權值股撐盤。',
    },
  ],
  [`pf-${SEEDED_PORTFOLIO_ID}-analysis-history-v1`]: [
    {
      id: 'daily-gate',
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
    },
  ],
  [`pf-${SEEDED_PORTFOLIO_ID}-daily-report-v1`]: {
    id: 'daily-gate',
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
  },
  [`pf-${SEEDED_PORTFOLIO_ID}-research-history-v1`]: [],
  [`pf-${SEEDED_PORTFOLIO_ID}-brain-v1`]: null,
  [`pf-${SEEDED_PORTFOLIO_ID}-reversal-v1`]: {},
  [`pf-${SEEDED_PORTFOLIO_ID}-notes-v1`]: {},
  [`pf-${SEEDED_PORTFOLIO_ID}-report-refresh-meta-v1`]: {},
}
const RESEARCH_ROUTE_PATTERN = /\/api\/research(?:\?.*)?$/

async function settle(page, waitMs = 1800) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function seedApp(page, storage = SEEDED_STORAGE) {
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, storage)
}

async function clickTab(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await settle(page, 1200)
}

async function clickFirstResearchHolding(page) {
  const stockButton = page
    .getByText('想先深挖哪一檔：')
    .first()
    .locator('..')
    .getByRole('button')
    .first()
  await expect(stockButton).toBeVisible()
  await stockButton.click()
}

test('accuracy gate hard-blocks only affected sections and keeps CTA flows working', async ({
  page,
}) => {
  let researchRequestCount = 0

  await seedApp(page)
  await stubOwnerCloudBootstrap(page, {
    holdings: SEEDED_STORAGE[`pf-${SEEDED_PORTFOLIO_ID}-holdings-v2`],
    events: SEEDED_STORAGE[`pf-${SEEDED_PORTFOLIO_ID}-news-events-v1`],
    history: SEEDED_STORAGE[`pf-${SEEDED_PORTFOLIO_ID}-analysis-history-v1`],
  })
  await page.route(RESEARCH_ROUTE_PATTERN, async (route) => {
    researchRequestCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SEEDED_RESEARCH_RESULT),
    })
  })

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2400)

  const dashboardBlock = page.locator(
    '[data-testid="accuracy-gate-block"][data-resource="dashboard"]'
  )
  await expect(dashboardBlock).toBeVisible()
  await expect(page.getByText('Today in Markets')).toBeVisible()

  await clickTab(page, '收盤分析')
  await page.getByText('2026/04/24 收盤分析').click()
  await settle(page, 600)

  const dailyBlock = page.locator('[data-testid="accuracy-gate-block"][data-resource="daily"]')
  await expect(dailyBlock).toBeVisible()
  await expect(page.getByText('自動資料確認')).toBeVisible()

  await dailyBlock.getByTestId('accuracy-gate-dismiss').click()
  await expect(dailyBlock).toBeHidden()
  await expect(page.getByRole('button', { name: '前往深度研究' })).toBeVisible()

  await clickTab(page, '深度研究')
  const requestCountBeforeResearch = researchRequestCount
  await clickFirstResearchHolding(page)

  await expect.poll(() => researchRequestCount).toBeGreaterThan(requestCountBeforeResearch)

  const researchBlock = page.locator(
    '[data-testid="accuracy-gate-block"][data-resource="research"]'
  )
  await expect(researchBlock).toBeVisible()
  await expect(page.getByText('先補資料')).toBeVisible()
  await expect(page.getByRole('button', { name: '補最新報告', exact: true })).toBeVisible()

  await researchBlock.getByTestId('accuracy-gate-retry').click()
  await expect.poll(() => researchRequestCount).toBeGreaterThan(requestCountBeforeResearch + 1)
})

test('accuracy gate block does not cause horizontal overflow on mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedApp(page)
  await stubOwnerCloudBootstrap(page, {
    holdings: SEEDED_STORAGE[`pf-${SEEDED_PORTFOLIO_ID}-holdings-v2`],
    events: SEEDED_STORAGE[`pf-${SEEDED_PORTFOLIO_ID}-news-events-v1`],
    history: SEEDED_STORAGE[`pf-${SEEDED_PORTFOLIO_ID}-analysis-history-v1`],
  })
  await page.route(RESEARCH_ROUTE_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SEEDED_RESEARCH_RESULT),
    })
  })

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2200)
  await clickTab(page, '深度研究')
  await clickFirstResearchHolding(page)

  const researchBlock = page.locator(
    '[data-testid="accuracy-gate-block"][data-resource="research"]'
  )
  await expect(researchBlock).toBeVisible()

  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth > window.innerWidth
  })

  expect(hasOverflow).toBe(false)
})
