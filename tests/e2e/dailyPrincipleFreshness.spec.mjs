import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL, stubOwnerCloudBootstrap } from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'
const TARGET_STALE_AT = '2026-04-15'
const FUNDAMENTALS_STALE_AT = '2026-03-23T08:00:00.000Z'
const MACRO_STALE_AT = '2026-04-22T01:20:00.000Z'

const SEEDED_STORAGE = {
  'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
    { code: '2330', name: '台積電', qty: 1, cost: 900, price: 950, value: 950 },
  ],
  [`pf-${PORTFOLIO_ID}-log-v2`]: [],
  [`pf-${PORTFOLIO_ID}-targets-v1`]: {
    2330: {
      reports: [{ firm: '元大', target: 1200, date: TARGET_STALE_AT }],
    },
  },
  [`pf-${PORTFOLIO_ID}-fundamentals-v1`]: {
    2330: {
      updatedAt: FUNDAMENTALS_STALE_AT,
      revenueMonth: '2026-03',
      revenueYoY: 22.4,
      revenueMoM: 3.1,
    },
  },
  [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${PORTFOLIO_ID}-holding-dossiers-v1`]: [
    {
      code: '2330',
      name: '台積電',
      position: { price: 950, qty: 1 },
      thesis: {
        statement: 'AI 需求延續',
        pillars: [{ title: 'AI 需求', status: 'stable' }],
      },
      targets: [{ firm: '元大', target: 1200, date: TARGET_STALE_AT }],
      targetSource: 'analyst',
      fundamentals: {
        updatedAt: FUNDAMENTALS_STALE_AT,
        revenueMonth: '2026-03',
        revenueYoY: 22.4,
      },
      freshness: {
        targets: 'aging',
        fundamentals: 'stale',
      },
    },
  ],
  [`pf-${PORTFOLIO_ID}-analyst-reports-v1`]: {
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
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [
    {
      id: 'macro-1',
      source: 'dgbas-calendar',
      type: 'macro',
      date: '2026-04-30',
      time: '16:00',
      title: '2026 Q1 GDP 概估',
      detail: '主計總處更新第一季經濟成長輪廓',
      sourceUpdatedAt: MACRO_STALE_AT,
    },
  ],
  [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [],
  [`pf-${PORTFOLIO_ID}-daily-report-v1`]: null,
  [`pf-${PORTFOLIO_ID}-research-history-v1`]: [],
  [`pf-${PORTFOLIO_ID}-brain-v1`]: null,
  [`pf-${PORTFOLIO_ID}-reversal-v1`]: {},
  [`pf-${PORTFOLIO_ID}-notes-v1`]: {},
  [`pf-${PORTFOLIO_ID}-report-refresh-meta-v1`]: {},
  'fm-cache-revenue-2330': {
    data: Array.from({ length: 5 }, (_, yearOffset) =>
      Array.from({ length: 12 }, (_, monthOffset) => ({
        revenueYear: 2021 + yearOffset,
        revenueMonth: monthOffset + 1,
        revenue: monthOffset >= 9 ? 22000000000 : monthOffset <= 2 ? 5500000000 : 10000000000,
      }))
    ).flat(),
    ts: Date.now(),
  },
}

async function settle(page, waitMs = 1600) {
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

async function routeFreshDailySnapshot(page) {
  await page.route('**/api/daily-snapshot-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        stale: false,
        badgeStatus: 'fresh',
        lastSuccessAt: '2026-04-24T02:55:00.000Z',
      }),
    })
  })
}

async function routePendingValuation(page) {
  await page.route('**/api/valuation?code=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
}

async function expandHolding(page, code) {
  const row = page.locator(`[data-holding-code="${code}"]`).first()
  await expect(row).toBeVisible()
  const toggle = row.locator('button').last()
  await toggle.scrollIntoViewIfNeeded()
  await toggle.click()
  await settle(page, 1200)
}

test('dashboard principle and freshness badges follow the merged B5/B6 contract', async ({
  page,
}) => {
  await seedApp(page)
  await stubOwnerCloudBootstrap(page, {
    holdings: SEEDED_STORAGE[`pf-${PORTFOLIO_ID}-holdings-v2`],
    events: SEEDED_STORAGE[`pf-${PORTFOLIO_ID}-news-events-v1`],
    history: SEEDED_STORAGE[`pf-${PORTFOLIO_ID}-analysis-history-v1`],
  })
  await routeFreshDailySnapshot(page)
  await routePendingValuation(page)

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2200)

  await expect(page.getByTestId('daily-principle-card')).toBeVisible()
  await expect(page.getByTestId('daily-principle-copy')).not.toBeEmpty()
  await expect(page.getByTestId('today-in-markets-stale-badge')).toContainText(/昨天|\d+\s*天前/)

  await clickTab(page, '持倉')
  await expandHolding(page, '2330')
  await expect(page.getByTestId('holding-targets-stale-badge-2330')).toContainText(/\d+\s*天前/)

  await clickTab(page, '深度研究')
  await expect(page.getByTestId('research-fundamentals-stale-badge-2330')).toContainText(
    /\d+\s*天前/
  )
})
