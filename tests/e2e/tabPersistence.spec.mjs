import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
  savePageScreenshot,
} from './support/qaHelpers.mjs'

const STEP_WAIT_MS = 1600
const ME_TAB_KEY = 'pf-me-last-active-tab-v1'

async function settle(page, waitMs = STEP_WAIT_MS) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function firstExisting(...locators) {
  for (const locator of locators) {
    if ((await locator.count()) > 0) return locator.first()
  }

  return null
}

async function requireLocator(message, ...locators) {
  const locator = await firstExisting(...locators)
  if (!locator) throw new Error(message)
  return locator
}

async function clickTab(page, key, label) {
  const tab = await requireLocator(
    `missing tab: ${key}`,
    page.getByTestId(`tab-${key}`),
    page.getByRole('button', { name: label, exact: true })
  )
  await tab.scrollIntoViewIfNeeded()
  await tab.click()
  await settle(page)
}

async function getPortfolioSelect(page) {
  return requireLocator(
    'missing portfolio select',
    page.getByTestId('portfolio-select'),
    page.locator('select')
  )
}

async function switchToPortfolio(page, { portfolioId = '', portfolioLabel = '' } = {}) {
  const custIdInput = await firstExisting(
    page.getByTestId('cust-id-input'),
    page.getByLabel(/cust[_\s-]?id|客戶編號/i)
  )
  const loginButton = await firstExisting(
    page.getByTestId('login-btn'),
    page.getByRole('button', { name: /登入|login|enter/i })
  )

  if (custIdInput && loginButton && (await custIdInput.isVisible().catch(() => false))) {
    await custIdInput.fill(portfolioId)
    await loginButton.click()
    await settle(page, 2400)
    return { value: portfolioId, label: portfolioLabel || portfolioId }
  }

  const select = await getPortfolioSelect(page)
  const matchedValue = await select.evaluate(
    (element, target) => {
      const options = Array.from(element.options)
      const byValue = options.find((option) => String(option.value || '').trim() === target.portfolioId)
      if (byValue) return byValue.value

      const byLabel = options.find((option) =>
        String(option.textContent || '')
          .trim()
          .includes(target.portfolioLabel)
      )
      return byLabel?.value || ''
    },
    { portfolioId, portfolioLabel }
  )

  if (!matchedValue) {
    throw new Error(`missing ${portfolioId || portfolioLabel} option in portfolio selector`)
  }

  await select.selectOption(matchedValue)
  await settle(page, 2200)
  const selected = await select.evaluate((element) => ({
    value: element.value,
    label: element.options[element.selectedIndex]?.textContent?.trim() || '',
  }))
  return selected
}

async function expectActivePanel(page, key) {
  if (key === 'dashboard') {
    await expect(page.getByTestId('dashboard-headline')).toBeVisible()
    return
  }

  if (key === 'holdings') {
    await expect(page.getByTestId('holdings-panel')).toBeVisible()
    return
  }

  if (key === 'research') {
    await expect(page.getByTestId('research-panel')).toBeVisible()
    return
  }

  if (key === 'overview') {
    await expect(
      await requireLocator(
        'missing overview panel',
        page.getByTestId('overview-kpi-cards'),
        page.getByTestId('overview-summary-metrics-grid'),
        page.getByText(/全部總覽|總資產/)
      )
    ).toBeVisible()
  }
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('remembers the last active tab per portfolio and falls back to dashboard after localStorage.clear()', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'ux-27-tab-persistence' })
  installQaMonitor(testInfo, page)

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let payload = null

    if (url.pathname === '/api/brain') {
      payload = { holdings: [], events: [], history: [], brain: null }
    } else if (url.pathname === '/api/research') {
      payload = { reports: [] }
    } else if (url.pathname === '/api/analyst-reports') {
      payload = { items: [], reports: [] }
    } else if (url.pathname === '/api/tracked-stocks') {
      payload = { trackedStocks: [] }
    } else if (url.pathname === '/api/target-prices') {
      payload = { reports: [], updatedAt: null, isNew: false }
    }

    if (payload == null) {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })

  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('__ux27-tab-persistence-seeded') === '1') return
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.sessionStorage.setItem('__ux27-tab-persistence-seeded', '1')
  })

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)

  await expect(page).toHaveTitle(/持倉看板|Portfolio/)
  await expectActivePanel(page, 'dashboard')
  await savePageScreenshot(page, testInfo, 'ux-27-01-dashboard-default.png')

  await clickTab(page, 'holdings', '持倉')
  await expectActivePanel(page, 'holdings')
  expect(await page.evaluate((key) => window.localStorage.getItem(key), ME_TAB_KEY)).toBe('holdings')

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2400)
  await expectActivePanel(page, 'holdings')
  await savePageScreenshot(page, testInfo, 'ux-27-02-me-holdings-reload.png')

  const jinlianchengPortfolio = await switchToPortfolio(page, {
    portfolioId: '7865',
    portfolioLabel: '金聯成',
  })
  const jinlianchengTabKey = `pf-${jinlianchengPortfolio.value}-last-active-tab-v1`
  await clickTab(page, 'research', '深度研究')
  await expectActivePanel(page, 'research')
  expect(await page.evaluate((key) => window.localStorage.getItem(key), jinlianchengTabKey)).toBe('research')
  expect(await page.evaluate((key) => window.localStorage.getItem(key), ME_TAB_KEY)).toBe('holdings')

  await switchToPortfolio(page, { portfolioId: 'me', portfolioLabel: '我' })
  await expectActivePanel(page, 'holdings')

  await switchToPortfolio(page, { portfolioId: '7865', portfolioLabel: '金聯成' })
  await expectActivePanel(page, 'research')

  await clickTab(page, 'overview', '全組合')
  await expectActivePanel(page, 'overview')
  await savePageScreenshot(page, testInfo, 'ux-27-03-overview.png')

  const returnButton = await requireLocator(
    'missing return button from overview',
    page.getByRole('button', { name: /返回目前組合|返回組合/ }),
    page.getByRole('button', { name: /返回目前投組|返回/ })
  )
  await returnButton.click()
  await settle(page, 1600)
  await expectActivePanel(page, 'research')

  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)

  await expectActivePanel(page, 'dashboard')
  await savePageScreenshot(page, testInfo, 'ux-27-04-dashboard-after-clear.png')
})
