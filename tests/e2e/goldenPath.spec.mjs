import { expect, test } from '@playwright/test'
import {
  DEFAULT_UPLOAD_FIXTURE_PATH,
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
  savePageScreenshot,
} from './support/qaHelpers.mjs'
import { maybeAcceptTradeDisclaimer } from './support/tradeHelpers.mjs'

const STEP_WAIT_MS = 1800
const GOLDEN_PATH_IGNORED_RESPONSE_PATTERNS = [
  /\/api\/target-prices\?code=/,
  /\/api\/analyst-reports(?:\?|$)/,
]
const GOLDEN_PATH_IGNORED_PAGEERROR_PATTERNS = [
  /\/api\/finmind\?.*due to access control checks\./i,
  /\/api\/analyst-reports.*due to access control checks\./i,
  /\/api\/tracked-stocks.*due to access control checks\./i,
]
const TARGET_PORTFOLIO_ID = String(process.env.GOLDEN_PATH_PORTFOLIO_ID || '7865').trim()
const TARGET_PORTFOLIO_LABEL = String(
  process.env.GOLDEN_PATH_PORTFOLIO_LABEL ||
    (TARGET_PORTFOLIO_ID === 'me' ? '我' : TARGET_PORTFOLIO_ID === '7865' ? '金聯成' : TARGET_PORTFOLIO_ID)
).trim()
const TARGET_PORTFOLIO_SCENARIO = String(
  process.env.GOLDEN_PATH_SCENARIO ||
    `golden-path-${TARGET_PORTFOLIO_ID === 'me' ? 'me' : TARGET_PORTFOLIO_ID}`
).trim()

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

async function waitForVisibleLocator(timeoutMs, ...locators) {
  for (const locator of locators) {
    const candidate = locator.first()
    try {
      await candidate.waitFor({ state: 'visible', timeout: timeoutMs })
      return candidate
    } catch {
      // try the next locator candidate
    }
  }

  return null
}

async function waitForAttachedLocator(timeoutMs, ...locators) {
  for (const locator of locators) {
    const candidate = locator.first()
    try {
      await candidate.waitFor({ state: 'attached', timeout: timeoutMs })
      return candidate
    } catch {
      // try the next locator candidate
    }
  }

  return null
}

async function ensureDashboardOpen(page) {
  const dashboardShell = await waitForVisibleLocator(
    1000,
    page.getByTestId('dashboard-headline'),
    page.locator('.dashboard-hero')
  )

  if (dashboardShell) return dashboardShell

  await clickTab(page, 'dashboard', '看板')
  return requireLocator(
    'missing dashboard shell after switching to dashboard tab',
    page.getByTestId('dashboard-headline'),
    page.locator('.dashboard-hero')
  )
}

async function clickTab(page, key, label) {
  const tab = await waitForAttachedLocator(
    5000,
    page.getByTestId(`tab-${key}`),
    page.getByRole('button', { name: label, exact: true })
  )
  if (!tab)
    throw new Error(
      `missing tab: ${key}`
    )
  await tab.scrollIntoViewIfNeeded()
  await tab.click()
  await settle(page)
}

async function getPortfolioSelect(page) {
  return requireLocator('missing portfolio select', page.getByTestId('portfolio-select'), page.locator('select'))
}

async function getSelectedOptionLabel(selectLocator) {
  return selectLocator.evaluate(
    (element) => element.options[element.selectedIndex]?.textContent?.trim() || ''
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
    await settle(page, 2500)
    return
  }

  const select = await getPortfolioSelect(page)
  const matchedValue = await select.evaluate(
    (element, target) => {
      const options = Array.from(element.options)
      const exact = options.find((item) => String(item.value || '').trim() === target.portfolioId)
      if (exact) return exact.value

      const byLabel = options.find((item) =>
        String(item.textContent || '')
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
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('golden path smoke covers holdings, research, events, news, daily, log, upload, and logout', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: TARGET_PORTFOLIO_SCENARIO })
  installQaMonitor(testInfo, page, {
    ignoredResponsePatterns: GOLDEN_PATH_IGNORED_RESPONSE_PATTERNS,
    ignoredPageErrorPatterns: GOLDEN_PATH_IGNORED_PAGEERROR_PATTERNS,
  })

  await test.step('step 1: open home', async () => {
    await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await settle(page, 2600)
    await expect(page).toHaveTitle(/持倉看板|Portfolio/)
    await switchToPortfolio(page, {
      portfolioId: TARGET_PORTFOLIO_ID,
      portfolioLabel: TARGET_PORTFOLIO_LABEL,
    })

    const select = await getPortfolioSelect(page)
    await expect.soft(select).toBeVisible()
    expect(await getSelectedOptionLabel(select)).toMatch(
      new RegExp(TARGET_PORTFOLIO_ID === 'me' ? '我' : TARGET_PORTFOLIO_LABEL)
    )
    await expect(await ensureDashboardOpen(page)).toBeVisible()
    await savePageScreenshot(page, testInfo, '01-home.png')
  })

  await test.step('step 2: verify holdings shell', async () => {
    await clickTab(page, 'holdings', '持倉')
    await expect(
      await requireLocator(
        'missing holdings shell after portfolio switch',
        page.getByTestId('holdings-panel'),
        page.getByText(/持股明細/)
      )
    ).toBeVisible()
    await savePageScreenshot(page, testInfo, '02-owner-holdings.png')
  })

  await test.step('step 3: deep research renders', async () => {
    await clickTab(page, 'research', '深度研究')
    await expect(
      await requireLocator(
        'missing research panel',
        page.getByTestId('research-panel'),
        page.getByText(/AI 投資助手/),
        page.getByRole('button', { name: /AI 策略建議/ })
      )
    ).toBeVisible()
    await savePageScreenshot(page, testInfo, '03-research.png')
  })

  await test.step('step 4: events render', async () => {
    await clickTab(page, 'events', '事件追蹤')
    await expect(page.locator('body')).toContainText('全部主題', { timeout: 20000 })
    await expect(page.locator('body')).toContainText('財報公司產業總經技術', {
      timeout: 20000,
    })
    await savePageScreenshot(page, testInfo, '04-events.png')
  })

  await test.step('step 5: news render', async () => {
    await clickTab(page, 'news', '新聞聚合')
    await expect(
      await requireLocator(
        'missing news panel',
        page.getByTestId('news-panel'),
        page.getByTestId('news-hero-title'),
        page.getByText(/今天市場在說什麼|這些新聞跟你組合有關|新聞脈絡整理中/)
      )
    ).toBeVisible()
    await savePageScreenshot(page, testInfo, '05-news.png')
  })

  await test.step('step 6: daily report renders', async () => {
    await clickTab(page, 'daily', '收盤分析')
    await expect(
      await requireLocator(
        'missing daily panel',
        page.getByTestId('daily-panel'),
        page.getByText(/收盤快版|資料確認版|每日交易備忘/)
      )
    ).toBeVisible()
    await savePageScreenshot(page, testInfo, '06-daily.png')
  })

  await test.step('step 7: trade log route renders', async () => {
    await clickTab(page, 'log', '交易日誌')
    await expect(
      await requireLocator(
        'missing trade log panel',
        page.getByTestId('trade-log-panel'),
        page.getByText(/還沒有交易記錄|買進|賣出/)
      )
    ).toBeVisible()
    await savePageScreenshot(page, testInfo, '07-trade-log.png')
  })

  await test.step('step 8: upload route writes a manual trade and shows it in log', async () => {
    await clickTab(page, 'trade', '上傳成交')
    await expect(
      await requireLocator(
        'missing trade panel',
        page.getByTestId('trade-panel'),
        page.getByTestId('manual-trade-entry'),
        page.getByText(/手動新增交易/)
      )
    ).toBeVisible()
    await maybeAcceptTradeDisclaimer(page)

    const uploadInput = await requireLocator(
      'missing upload input',
      page.getByTestId('trade-upload-input'),
      page.locator('input[type="file"]').last()
    )
    await uploadInput.setInputFiles(DEFAULT_UPLOAD_FIXTURE_PATH)
    await settle(page)

    const codeInput = await requireLocator(
      'missing manual trade code input',
      page.getByTestId('manual-trade-code-input'),
      page.getByPlaceholder('股票代碼').first()
    )
    const nameInput = await requireLocator(
      'missing manual trade name input',
      page.getByTestId('manual-trade-name-input'),
      page.getByPlaceholder('名稱（選填）')
    )
    const actionSelect = await requireLocator(
      'missing manual trade action select',
      page.getByTestId('manual-trade-action-select'),
      page.locator('select').nth(1)
    )
    const qtyInput = await requireLocator(
      'missing manual trade qty input',
      page.getByTestId('manual-trade-qty-input'),
      page.getByPlaceholder('股數')
    )
    const priceInput = await requireLocator(
      'missing manual trade price input',
      page.getByTestId('manual-trade-price-input'),
      page.getByPlaceholder('價格')
    )
    const addButton = await requireLocator(
      'missing manual trade submit button',
      page.getByTestId('manual-trade-submit-btn'),
      page.getByRole('button', { name: '新增', exact: true })
    )

    await codeInput.fill('9910')
    await nameInput.fill(`E2E-${testInfo.project.name}`)
    await actionSelect.selectOption('買進')
    await qtyInput.fill('7')
    await priceInput.fill('12.34')
    await addButton.click()
    await settle(page)

    await expect(
      await requireLocator(
        'missing parse results after manual trade add',
        page.getByTestId('trade-parse-results'),
        page.getByText(/解析結果/)
      )
    ).toBeVisible()

    const skipMemoButton = await requireLocator(
      'missing skip memo button',
      page.getByTestId('skip-memo-btn'),
      page.getByRole('button', { name: '跳過備忘，先看預覽', exact: true })
    )
    await skipMemoButton.click()
    await page.getByTestId('trade-confirm-btn').click()
    await expect(page.locator('body')).toContainText(/已寫入 \d+ 筆成交/, { timeout: 20000 })

    await clickTab(page, 'log', '交易日誌')
    const tradeLogPanel = await requireLocator(
      'missing trade log panel after manual trade add',
      page.getByTestId('trade-log-panel'),
      page.getByText(/還沒有交易記錄|買進|賣出/)
    )
    await expect(tradeLogPanel).not.toContainText('還沒有交易記錄', { timeout: 20000 })
    await expect(tradeLogPanel).toContainText('9910')
    await savePageScreenshot(page, testInfo, '08-upload-log.png')
  })

  await test.step('step 9: logout by clearing site data', async () => {
    const logoutButton = await firstExisting(
      page.getByTestId('logout-btn'),
      page.getByRole('button', { name: /登出|logout/i })
    )

    if (logoutButton && (await logoutButton.isVisible().catch(() => false))) {
      await logoutButton.click()
      await settle(page, 2200)
    } else {
      await page.context().clearCookies()
      const clearedStorageState = await page.evaluate(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        return {
          localKeys: Object.keys(window.localStorage),
          sessionKeys: Object.keys(window.sessionStorage),
        }
      })
      expect(clearedStorageState.localKeys).toEqual([])
      expect(clearedStorageState.sessionKeys).toEqual([])

      if (testInfo.project.name === 'chromium') {
        await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'commit', timeout: 20000 })
        await page.waitForTimeout(3000)
      } else {
        await savePageScreenshot(page, testInfo, '09-logout.png')
        return
      }
    }

    const custIdInput = await firstExisting(
      page.getByTestId('cust-id-input'),
      page.getByLabel(/cust[_\s-]?id|客戶編號/i)
    )
    if (custIdInput && (await custIdInput.isVisible().catch(() => false))) {
      await expect(custIdInput).toBeVisible()
    } else {
      const postLogoutShell = await requireLocator(
        'missing post-logout shell',
        page.getByTestId('portfolio-select'),
        page.getByText(/Portfolio OS|正在啟動投組工作台|目前組合/)
      )
      await expect(postLogoutShell).toBeVisible()

      if (await page.getByTestId('portfolio-select').count()) {
        const select = await getPortfolioSelect(page)
        expect(await getSelectedOptionLabel(select)).toMatch(/我|主要投資|owner/i)
      }
    }
    await savePageScreenshot(page, testInfo, '09-logout.png')
  })
})
