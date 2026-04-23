import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'
import { maybeAcceptTradeDisclaimer } from './support/tradeHelpers.mjs'

async function settle(page, waitMs = 1600) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function openPortfolioHome(page) {
  await page.goto(PORTFOLIO_BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 2200)
}

async function clickTab(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await settle(page, 1800)
}

test('holdings page surfaces target-price 404 as visible error UI', async ({ page }) => {
  await page.route('**/api/target-prices*', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'no target-price snapshot' }),
    })
  })

  await page.goto(new URL('/portfolio/me/holdings', PORTFOLIO_BASE_URL).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page, 2600)

  await expect(page.locator('[data-error="target-prices"]').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-error="target-prices"]').first()).toContainText('無券商目標價')
})

test('research page surfaces analyst-report 401 as visible error UI', async ({ page }) => {
  await page.route('**/api/analyst-reports', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    })
  })

  await openPortfolioHome(page)
  await clickTab(page, '深度研究')

  await expect(page.getByTestId('research-panel')).toBeVisible()
  await page.getByRole('button', { name: '補最新報告' }).click()

  await expect(page.locator('[data-error="analyst-reports"]').first()).toBeVisible({
    timeout: 15000,
  })
  await expect(page.locator('[data-error="analyst-reports"]').first()).toContainText(
    '此帳號暫無分析師報告存取權限'
  )
})

test('tracked-stocks 401 becomes visible on holdings after a failed sync attempt', async ({ page }) => {
  await page.route('**/api/tracked-stocks', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    })
  })

  await openPortfolioHome(page)
  await clickTab(page, '上傳成交')

  await expect(page.getByTestId('trade-panel')).toBeVisible()
  await maybeAcceptTradeDisclaimer(page)

  await page.getByTestId('manual-trade-code-input').fill('2454')
  await page.getByTestId('manual-trade-name-input').fill('聯發科')
  await page.getByTestId('manual-trade-action-select').selectOption('買進')
  await page.getByTestId('manual-trade-qty-input').fill('7')
  await page.getByTestId('manual-trade-price-input').fill('1250')
  await page.getByTestId('manual-trade-submit-btn').click()

  const skipMemoButton = page.getByRole('button', { name: '跳過備忘，先看預覽' })
  if (await skipMemoButton.isVisible().catch(() => false)) {
    await skipMemoButton.click()
    await page.getByTestId('trade-confirm-btn').click()
  }

  await settle(page, 2400)
  await clickTab(page, '持倉')

  await expect(page.locator('[data-error="tracked-stocks"]').first()).toBeVisible({
    timeout: 15000,
  })
  await expect(page.locator('[data-error="tracked-stocks"]').first()).toContainText(
    '登入狀態已過期'
  )
})
