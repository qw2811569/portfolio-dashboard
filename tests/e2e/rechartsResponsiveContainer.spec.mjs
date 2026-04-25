import { test, expect } from '@playwright/test'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()
const BASE_HOSTNAME = new URL(BASE_URL).hostname
const IS_LOCAL_BASE_URL = ['127.0.0.1', 'localhost'].includes(BASE_HOSTNAME)
const RECHARTS_NEGATIVE_SIZE_WARNING = /The width\(-1\) and height\(-1\) of chart should be greater than 0/i

test('desktop boot and panel switches do not emit Recharts negative-size warnings', async (
  { page },
  testInfo
) => {
  test.skip(testInfo.project.name !== 'chromium', 'warning regression is enforced on chromium only')
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for local Recharts QA')

  const chartWarnings = []
  page.on('console', (msg) => {
    if (msg.type() !== 'warning') return
    const text = msg.text()
    if (RECHARTS_NEGATIVE_SIZE_WARNING.test(text)) {
      chartWarnings.push(text)
    }
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(2000)

  await page.getByTestId('tab-holdings').click()
  await page.waitForTimeout(1200)

  await page.getByTestId('tab-dashboard').click()
  await page.waitForTimeout(1200)

  const optionCount = await page.locator('[data-testid="portfolio-select"] option').count()
  if (optionCount > 1) {
    const firstValue = await page.locator('[data-testid="portfolio-select"] option').nth(0).getAttribute('value')
    const secondValue = await page.locator('[data-testid="portfolio-select"] option').nth(1).getAttribute('value')

    if (secondValue && firstValue && secondValue !== firstValue) {
      await page.getByTestId('portfolio-select').selectOption(secondValue)
      await page.waitForTimeout(1200)
      await page.getByTestId('portfolio-select').selectOption(firstValue)
      await page.waitForTimeout(1200)
    }
  }

  expect(chartWarnings).toEqual([])
})
