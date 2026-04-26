import { test, expect } from '@playwright/test'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()

test('mobile header stays single-row and bottom tab bar is visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'mobile nav regression is enforced on chromium')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })

  const header = page.locator('[data-testid="header-root"]')
  const bottomTabs = page.locator('[data-testid="mobile-bottom-tab-bar"]')

  await expect(header).toBeVisible({ timeout: 120000 })
  await expect(bottomTabs).toBeVisible()

  const headerHeight = await header.evaluate((node) =>
    Number(node.getBoundingClientRect().height.toFixed(2))
  )
  expect(headerHeight).toBeLessThanOrEqual(64)

  const tabBox = await bottomTabs.boundingBox()
  expect(tabBox).toBeTruthy()
  expect(tabBox.y + tabBox.height).toBeGreaterThan(820)

  await expect(bottomTabs.locator('[data-testid="tab-dashboard"]')).toBeVisible()
  await expect(bottomTabs.locator('[data-testid="tab-holdings"]')).toBeVisible()
  await expect(bottomTabs.locator('[data-testid="tab-events"]')).toBeVisible()
  await expect(bottomTabs.locator('[data-testid="tab-daily"]')).toBeVisible()
  await expect(bottomTabs.locator('[data-testid="tab-research"]')).toBeVisible()
})
