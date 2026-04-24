import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
} from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'
const HOLDINGS_ROUTE = `/portfolio/${PORTFOLIO_ID}/holdings`

const SEEDED_STORAGE = {
  'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
    { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500, type: '股票' },
    { code: '2454', name: '聯發科', qty: 4, cost: 1180, price: 1250, value: 5000, type: '股票' },
  ],
  [`pf-${PORTFOLIO_ID}-holding-dossiers-v1`]: [
    {
      code: '2330',
      name: '台積電',
      thesis: {
        summary: 'AI 需求延續',
        updatedAt: '2026-04-24T08:30:00.000Z',
        pillars: [
          { id: 'p1', label: '先進製程需求', status: 'on_track', lastChecked: '2026-04-24' },
          { id: 'p2', label: 'CoWoS 產能', status: 'watch', lastChecked: '2026-04-23' },
        ],
      },
      position: { price: 950 },
      targets: [{ firm: '元大', target: 1180, date: '2026-04-22' }],
      targetAggregate: { lowerBound: 900, upperBound: 1200, rateDate: '2026-04-22' },
      fundamentals: { updatedAt: '2026-04-20T08:00:00.000Z' },
      freshness: { targets: 'fresh', fundamentals: 'aging' },
      finmind: {
        valuation: [{ per: 24.5, pbr: 7.2, dividendYield: 0.021 }],
        institutional: [
          { date: '2026-04-24', foreign: 1200, investment: 100, dealer: -80 },
          { date: '2026-04-23', foreign: 800, investment: 50, dealer: -20 },
          { date: '2026-04-22', foreign: -300, investment: 20, dealer: 10 },
        ],
      },
    },
  ],
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [
    {
      id: 'evt-earnings',
      title: '台積電法說會',
      eventDate: '2026-04-25',
      status: 'pending',
      stocks: ['2330 台積電'],
      type: '法說',
    },
  ],
  [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [
    {
      id: 'daily-t0',
      date: '2026-04-23',
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      changes: [{ code: '2330', price: 940, changePct: -0.8, todayPnl: -80 }],
    },
  ],
  [`pf-${PORTFOLIO_ID}-daily-report-v1`]: {
    id: 'daily-t1',
    date: '2026-04-24',
    analysisStage: 't1-confirmed',
    analysisStageLabel: '資料確認版',
    changes: [{ code: '2330', price: 950, changePct: 1.2, todayPnl: 128 }],
    eventAssessments: [
      {
        eventId: 'evt-earnings',
        title: '台積電法說後追蹤',
        summary: '台積電法說顯示先進製程需求仍穩。',
      },
    ],
    aiInsight: '2330 法說後先看先進製程與 CoWoS 動能是否延續。',
  },
  [`pf-${PORTFOLIO_ID}-research-history-v1`]: [
    {
      id: 'research-1',
      timestamp: Date.parse('2026-04-24T09:10:00.000Z'),
      title: '台積電研究',
      summary: '整體研究摘要',
      stockSummaries: [{ code: '2330', summary: '先進製程擴產節奏仍在主線上。' }],
    },
  ],
  [`pf-${PORTFOLIO_ID}-brain-v1`]: {
    lastUpdate: '2026-04-24',
    evolution: '先進製程主線穩，但要追蹤 CoWoS 產能。',
    rules: [],
    candidateRules: [],
  },
  [`pf-${PORTFOLIO_ID}-targets-v1`]: {},
  [`pf-${PORTFOLIO_ID}-fundamentals-v1`]: {},
  [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${PORTFOLIO_ID}-analyst-reports-v1`]: {},
  [`pf-${PORTFOLIO_ID}-log-v2`]: [],
  [`pf-${PORTFOLIO_ID}-reversal-v1`]: {},
  [`pf-${PORTFOLIO_ID}-notes-v1`]: {},
}

async function seedStorage(page, storage = SEEDED_STORAGE) {
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, storage)
}

async function stubApis(page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/twse') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ msgArray: [] }),
      })
      return
    }
    if (pathname === '/api/valuation') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valuation: {
            lowerBound: 900,
            upperBound: 1200,
          },
        }),
      })
      return
    }
    await route.continue()
  })
}

async function openHoldingsRoute(page, search = '') {
  const url = new URL(`${HOLDINGS_ROUTE}${search}`, PORTFOLIO_BASE_URL).toString()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.getByTestId('holding-open-detail-2330')).toBeVisible()
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('desktop detail pane opens from row, closes via X and ESC, traps focus, and syncs browser history', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holding-detail-pane-desktop' })
  installQaMonitor(testInfo, page)
  await seedStorage(page)
  await stubApis(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openHoldingsRoute(page)

  const trigger = page.getByTestId('holding-open-detail-2330')
  await trigger.click()

  const pane = page.getByTestId('holding-detail-pane-desktop')
  await expect(pane).toBeVisible()
  await expect(page).toHaveURL(/stock=2330/)
  await expect(page.getByRole('dialog', { name: '台積電' })).toBeVisible()

  const axeResults = await new AxeBuilder({ page }).include('[data-testid="holding-detail-pane-desktop"]').analyze()
  expect(axeResults.violations).toEqual([])

  await expect(page.getByTestId('holding-detail-pane-close-top')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('holding-detail-pane-content')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('holding-detail-pane-close-bottom')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('holding-detail-pane-close-top')).toBeFocused()

  await page.goBack()
  await expect(pane).toHaveCount(0)
  await page.goForward()
  await expect(pane).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(pane).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(pane).toBeVisible()
  await page.getByTestId('holding-detail-pane-close-top').click()
  await expect(pane).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('deep link auto-opens the detail pane with ?stock=2330', async ({ page }, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holding-detail-pane-deeplink' })
  installQaMonitor(testInfo, page)
  await seedStorage(page)
  await stubApis(page)
  await openHoldingsRoute(page, '?stock=2330')

  await expect(page.getByTestId('holding-detail-pane-desktop')).toBeVisible()
  await expect(page.getByText('先進製程擴產節奏仍在主線上。')).toBeVisible()
})

test('mobile detail pane opens as a bottom drawer and closes on swipe down', async ({ page }, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'holding-detail-pane-mobile' })
  installQaMonitor(testInfo, page)
  await seedStorage(page)
  await stubApis(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openHoldingsRoute(page)

  await page.getByTestId('holding-open-detail-2330').click()

  const drawer = page.getByTestId('holding-detail-pane-mobile')
  const handle = page.getByTestId('holding-detail-pane-drag-handle')

  await expect(drawer).toBeVisible()

  const box = await handle.boundingBox()
  if (!box) {
    throw new Error('missing drawer handle bounding box')
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 180, { steps: 12 })
  await page.mouse.up()

  await expect(drawer).toHaveCount(0)
})
