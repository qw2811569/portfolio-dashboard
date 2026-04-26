import { expect, test } from '@playwright/test'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()

test('first reload opens onboarding and walks four steps', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.removeItem('pf-onboarding-completed-v1'))
  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('onboarding-tour')).toBeVisible()
  await page.getByTestId('onboarding-next').click()
  await page.getByTestId('onboarding-next').click()
  await page.getByTestId('onboarding-next').click()
  await page.getByTestId('onboarding-next').click()

  await expect(page.getByTestId('onboarding-tour')).toBeHidden()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pf-onboarding-completed-v1')))
    .toMatch(/^\d{4}-\d{2}-\d{2}T/)
})
