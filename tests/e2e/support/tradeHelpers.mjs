import { expect } from '@playwright/test'

export async function maybeAcceptTradeDisclaimer(page) {
  const modal = page.getByTestId('trade-disclaimer-modal')
  if (!(await modal.isVisible().catch(() => false))) return false

  await page.getByTestId('trade-disclaimer-checkbox').check()
  await page.getByTestId('trade-disclaimer-enter-btn').click()
  await expect(modal).toBeHidden({ timeout: 15000 })
  return true
}
