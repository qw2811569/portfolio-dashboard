import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

const EMPTY_PORTFOLIO_ID = 'p-empty-round2'
const EMPTY_PORTFOLIO_SEED = {
  'pf-portfolios-v1': [
    { id: 'me', name: '我', isOwner: true, createdAt: '2026-04-19' },
    {
      id: EMPTY_PORTFOLIO_ID,
      name: '空白測試組合',
      isOwner: false,
      createdAt: '2026-04-19',
    },
  ],
  'pf-active-portfolio-v1': EMPTY_PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  [`pf-${EMPTY_PORTFOLIO_ID}-holdings-v2`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-log-v2`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-targets-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-fundamentals-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-watchlist-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-analyst-reports-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-holding-dossiers-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-news-events-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-analysis-history-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-daily-report-v1`]: null,
  [`pf-${EMPTY_PORTFOLIO_ID}-research-history-v1`]: [],
  [`pf-${EMPTY_PORTFOLIO_ID}-brain-v1`]: null,
  [`pf-${EMPTY_PORTFOLIO_ID}-reversal-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-notes-v1`]: {},
  [`pf-${EMPTY_PORTFOLIO_ID}-report-refresh-meta-v1`]: {},
}

test('cold start shows a skeleton before the app hydrates', async ({ context, page }) => {
  await context.clearCookies()
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  const gotoPromise = page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-skeleton]').first()).toBeVisible({ timeout: 1000 })
  await gotoPromise
})

test('empty portfolio shows holdings onboarding instead of a blank state', async ({ page }) => {
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, EMPTY_PORTFOLIO_SEED)

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-empty-state="holdings"]')).toBeVisible()
  await expect(page.getByText('還沒加股')).toBeVisible()
})
