import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'

const SEED = {
  'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-onboarding-completed-v1': '2026-04-26T00:00:00.000Z',
  'pf-schema-version': 3,
  [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
    { code: '2308', name: '台達電', qty: 2, cost: 1000, price: 1440, value: 2880, type: '股票' },
    { code: '3017', name: '奇鋐', qty: 1, cost: 1400, price: 1905, value: 1905, type: '股票' },
    { code: '4583', name: '台灣精銳', qty: 1, cost: 734, price: 629, value: 629, type: '股票' },
  ],
  [`pf-${PORTFOLIO_ID}-holding-dossiers-v1`]: [
    {
      code: '2308',
      name: '台達電',
      thesis: {
        statement: 'AI 電源主線仍在',
        pillars: [{ id: 'p1', label: 'AI 電源', status: 'on_track' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 1440 },
    },
    {
      code: '3017',
      name: '奇鋐',
      thesis: {
        statement: '散熱主線需要追蹤',
        pillars: [{ id: 'p2', label: '散熱', status: 'watch' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 1905 },
    },
    {
      code: '4583',
      name: '台灣精銳',
      thesis: {
        statement: '法說催化失效',
        pillars: [{ id: 'p3', label: '法說', status: 'broken' }],
      },
      freshness: { fundamentals: 'fresh', targets: 'fresh' },
      position: { price: 629 },
    },
  ],
  [`pf-thesis-v1-${PORTFOLIO_ID}`]: [
    {
      id: 'thesis-2308',
      stockId: '2308',
      statement: 'AI 電源主線仍在',
      pillars: [{ id: 'p1', label: 'AI 電源', status: 'on_track' }],
    },
    {
      id: 'thesis-3017',
      stockId: '3017',
      statement: '散熱主線需要追蹤',
      pillars: [{ id: 'p2', label: '散熱', status: 'watch' }],
    },
    {
      id: 'thesis-4583',
      stockId: '4583',
      statement: '法說催化失效',
      pillars: [{ id: 'p3', label: '法說', status: 'broken' }],
    },
  ],
  [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [],
  [`pf-${PORTFOLIO_ID}-daily-report-v1`]: null,
  [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [],
  [`pf-${PORTFOLIO_ID}-research-history-v1`]: [],
}

function routeUrl(path) {
  return `${PORTFOLIO_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function seedStorage(page) {
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed)) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, SEED)
}

async function waitForApp(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1200)
}

test('mobile fold 1 shows one primary today CTA before holdings and anxiety', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await page.goto(routeUrl('/portfolio/me/overview'), { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  const actionCard = page.getByTestId('dashboard-mobile-today-action')
  await expect(actionCard).toContainText('今天先做 1 件事')
  await expect(actionCard.getByTestId('dashboard-mobile-primary-cta')).toHaveCount(1)

  const foldBottom = 844
  const anxietyTop = await page
    .getByTestId('anxiety-metrics-panel')
    .first()
    .boundingBox()
    .then((box) => box?.y ?? 0)
  const holdingsRingTop = await page
    .getByTestId('dashboard-poster-hero')
    .boundingBox()
    .then((box) => (box ? box.y + box.height : 0))

  expect(anxietyTop).toBeGreaterThan(foldBottom)
  expect(holdingsRingTop).toBeGreaterThan(260)
})

test('holdings mobile P&L quick entries sort winners and losers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await page.goto(routeUrl('/portfolio/me/holdings'), { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  await expect(page.getByTestId('holdings-mobile-pnl-quick-entries')).toContainText('賺最多')
  await expect(page.getByTestId('holdings-mobile-pnl-quick-entries')).toContainText('賠最多')
  await page.getByTestId('holdings-mobile-pnl-loser').click()
  await expect(page.locator('main')).toContainText('台灣精銳')
})

test('research thesis status appears before data repair controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await page.goto(routeUrl('/portfolio/me/research'), { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  const status = page.getByTestId('research-thesis-status')
  await expect(status).toContainText('投資理由狀態')
  await expect(status).toContainText('3 個持倉投資理由中 1 個維持 / 2 個鬆動')

  const statusBox = await status.boundingBox()
  const controlsBox = await page.getByText('登入、補資料與個股入口').boundingBox()
  expect(statusBox?.y ?? 9999).toBeLessThan(controlsBox?.y ?? 0)
})
