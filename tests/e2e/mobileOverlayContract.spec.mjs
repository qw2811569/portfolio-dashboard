import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'
const DISCLAIMER_STORAGE_KEY = 'trade-disclaimer-v1-ack-at'

const BASE_SEED = {
  'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': PORTFOLIO_ID,
  'pf-view-mode-v1': 'portfolio',
  'pf-onboarding-completed-v1': '2026-04-26T00:00:00.000Z',
  'pf-schema-version': 3,
  [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
    { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, type: '股票' },
  ],
  [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [
    {
      code: '2330',
      name: '台積電',
      price: 950,
      target: 1000,
      status: '觀察中',
      catalyst: '法說追蹤',
      note: '等營收確認',
      scKey: 'info',
      createdAt: '2026-04-24T00:00:00.000Z',
    },
  ],
  [`pf-${PORTFOLIO_ID}-news-events-v1`]: [],
  [`pf-${PORTFOLIO_ID}-daily-report-v1`]: null,
  [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [],
  [`pf-${PORTFOLIO_ID}-research-history-v1`]: [],
}

function routeUrl(path) {
  return `${PORTFOLIO_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function seedStorage(page, extra = {}) {
  await page.addInitScript(
    ({ seed, extraSeed }) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      for (const [key, value] of Object.entries({ ...seed, ...extraSeed })) {
        window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
      }
    },
    { seed: BASE_SEED, extraSeed: extra }
  )
}

async function expectBottomNavVisibility(page, visibility) {
  const bottomTabs = page.getByTestId('mobile-bottom-tab-bar')
  await expect(bottomTabs).toHaveCSS('visibility', visibility)
  return bottomTabs
}

test('trade disclaimer portal owns CTA hit-test and blocks mobile nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await page.goto(routeUrl('/portfolio/me/trade'), { waitUntil: 'domcontentloaded' })

  const modal = page.getByTestId('trade-disclaimer-modal')
  const cta = page.getByTestId('trade-disclaimer-enter-btn')
  await expect(modal).toBeVisible()
  await expectBottomNavVisibility(page, 'hidden')

  const hitTestId = await cta.evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return hit?.closest('[data-testid]')?.getAttribute('data-testid') || ''
  })
  expect(hitTestId).toBe('trade-disclaimer-enter-btn')

  await page.getByTestId('trade-disclaimer-checkbox').check()
  await cta.click()
  await expect(modal).toBeHidden()
  await expectBottomNavVisibility(page, 'visible')
})

test('stacked watchlist overlays keep mobile nav hidden until parent closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page, { [DISCLAIMER_STORAGE_KEY]: '2026-04-24T00:00:00.000Z' })
  await page.goto(routeUrl('/portfolio/me/watchlist'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('watchlist-panel')).toBeVisible()
  await page.getByRole('button', { name: '編輯' }).first().click()

  const editor = page.getByTestId('watchlist-editor-overlay')
  await expect(editor).toBeVisible()
  await expectBottomNavVisibility(page, 'hidden')

  await editor.getByRole('button', { name: '刪除' }).click()
  const confirmDialog = page.getByRole('dialog', { name: '刪除觀察股' })
  await expect(confirmDialog).toBeVisible()
  await expectBottomNavVisibility(page, 'hidden')

  await confirmDialog.getByRole('button', { name: '取消' }).click()
  await expect(confirmDialog).toBeHidden()
  await expect(editor).toBeVisible()
  await expectBottomNavVisibility(page, 'hidden')

  await editor.getByRole('button', { name: '關閉' }).click()
  await expect(editor).toBeHidden()
  await expectBottomNavVisibility(page, 'visible')
})
