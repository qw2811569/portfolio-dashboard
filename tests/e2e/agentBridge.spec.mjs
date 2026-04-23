import { expect, test } from '@playwright/test'
import {
  AGENT_BRIDGE_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
  saveLocatorScreenshot,
} from './support/qaHelpers.mjs'

async function settle(page, waitMs = 1500) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('agent bridge dashboard login renders hero, focus, and week sections', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, {
    scenario: String(process.env.AGENT_BRIDGE_SCENARIO || 'agent-bridge').trim(),
  })
  installQaMonitor(testInfo, page, { ignoredResponsePatterns: [] })

  await page.goto(`${AGENT_BRIDGE_BASE_URL}/dashboard/login.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await settle(page)

  await expect(page).toHaveTitle(/Agent Bridge/i)
  await page.locator('#pin').fill('0306')
  await page.locator('#submitPin').click()
  await settle(page, 2600)

  await expect(page).toHaveURL(/\/dashboard\/?$/)
  await expect(page.locator('body')).toContainText(/Agent Bridge/i)

  const heroSection = page.locator('[data-label="HERO"]').first()
  const focusSection = page.locator('[data-label="FOCUS"]').first()
  const pendingSection = page.locator('[data-label="PENDING"]').first()
  const weekSection = page.locator('[data-label="WEEK"]').first()

  await expect(heroSection).toBeVisible()
  await expect(focusSection).toBeVisible()
  await expect(weekSection).toBeVisible()

  await saveLocatorScreenshot(heroSection, testInfo, 'agent-01-hero.png')
  await saveLocatorScreenshot(focusSection, testInfo, 'agent-02-focus.png')

  if ((await pendingSection.count()) > 0) {
    await expect(pendingSection).toBeVisible()
    await saveLocatorScreenshot(pendingSection, testInfo, 'agent-03-pending.png')
    await saveLocatorScreenshot(weekSection, testInfo, 'agent-04-week.png')
    return
  }

  await saveLocatorScreenshot(weekSection, testInfo, 'agent-03-week.png')
})
