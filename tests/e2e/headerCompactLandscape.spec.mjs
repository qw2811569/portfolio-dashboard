import { test, expect } from '@playwright/test'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()
const BASE_HOSTNAME = new URL(BASE_URL).hostname
const IS_LOCAL_BASE_URL = ['127.0.0.1', 'localhost'].includes(BASE_HOSTNAME)

async function measureHeaderHeight(page) {
  await page.waitForSelector('[data-testid="header-root"]', { timeout: 120000 })
  await page.waitForTimeout(1200)
  return page.locator('[data-testid="header-root"]').evaluate((node) => {
    return Number(node.getBoundingClientRect().height.toFixed(2))
  })
}

test('desktop header does not grow past the current baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'desktop baseline is enforced on chromium only')
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for local header QA')

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })

  const headerHeight = await measureHeaderHeight(page)
  expect(headerHeight).toBeLessThanOrEqual(165)
})

test('ios landscape header collapses to 80px or less without growing portrait', async (
  { page },
  testInfo
) => {
  test.skip(testInfo.project.name !== 'ios-safari', 'mobile header regression is enforced on ios-safari only')
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for local header QA')

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })

  await page.setViewportSize({ width: 375, height: 844 })
  const portraitHeaderHeight = await measureHeaderHeight(page)
  expect(portraitHeaderHeight).toBeLessThanOrEqual(104)

  await page.setViewportSize({ width: 844, height: 390 })
  const landscapeHeaderHeight = await measureHeaderHeight(page)
  expect(landscapeHeaderHeight).toBeLessThanOrEqual(80)
  expect(landscapeHeaderHeight).toBeLessThan(portraitHeaderHeight)
})
