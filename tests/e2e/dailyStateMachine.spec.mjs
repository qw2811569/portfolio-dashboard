import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'

const BASE_SEED = {
  'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-onboarding-completed-v1': '2026-04-26T00:00:00.000Z',
  'pf-schema-version': 3,
  [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
    { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, type: '股票' },
  ],
  [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [],
  [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [
    {
      id: 'history-ready',
      date: '2026/04/25',
      aiInsight: '昨日摘要',
      hitRate: 80,
      eventAssessments: [{ correct: true }],
    },
  ],
  [`pf-${PORTFOLIO_ID}-research-history-v1`]: [],
}

function routeUrl(path) {
  return `${PORTFOLIO_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function seedStorage(page, dailyReport, extra = {}) {
  await page.addInitScript(
    ({ seed, report, extraSeed }) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      for (const [key, value] of Object.entries({ ...seed, ...extraSeed })) {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
      window.localStorage.setItem(`pf-${'me'}-daily-report-v1`, JSON.stringify(report))
    },
    { seed: BASE_SEED, report: dailyReport, extraSeed: extra }
  )
}

test('partial daily report hides holding actions until insight exists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page, {
    id: 'partial',
    date: '2026/04/26',
    changes: [{ code: '2330', name: '台積電', changePct: 3.2 }],
    analysisStage: 't0-preliminary',
  })
  await page.goto(routeUrl('/portfolio/me/daily'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('daily-panel')).toHaveAttribute('data-daily-state', 'partial')
  await expect(page.getByTestId('daily-ritual-hero')).toContainText('資料已收齊 · 點下方按鈕開始分析')
  await expect(page.getByTestId('daily-partial-pending-cta')).toBeVisible()
  await expect(page.getByTestId('daily-partial-analyze-cta')).toBeVisible()
  await expect(page.getByTestId('daily-holding-actions')).toHaveCount(0)
  await expect(page.getByTestId('daily-hit-rate-chart')).toHaveCount(0)
})

test('waiting daily report shows tomorrow copy and no actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page, null, { [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [] })
  await page.goto(routeUrl('/portfolio/me/daily'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('daily-panel')).toHaveAttribute('data-daily-state', 'waiting')
  await expect(page.getByTestId('daily-ritual-hero')).toContainText('等明早')
  await expect(page.getByTestId('daily-holding-actions')).toHaveCount(0)
})
