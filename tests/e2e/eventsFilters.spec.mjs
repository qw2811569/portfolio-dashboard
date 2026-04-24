import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
  savePageScreenshot,
} from './support/qaHelpers.mjs'

const STEP_WAIT_MS = 1800

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

test('events page surfaces TW-specific filters and keeps insider ex-dividend cards informationally safe', async ({
  page,
}, testInfo) => {
  mergeQaEvidence(testInfo, { scenario: 'tw-events-filters' })
  installQaMonitor(testInfo, page)

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/api/brain') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ holdings: [], events: [], history: [], brain: null }),
      })
      return
    }

    if (url.pathname === '/api/research') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reports: [] }),
      })
      return
    }

    if (url.pathname === '/api/analyst-reports') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], reports: [] }),
      })
      return
    }

    if (url.pathname === '/api/tracked-stocks') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trackedStocks: [] }),
      })
      return
    }

    if (url.pathname === '/api/target-prices') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reports: [], updatedAt: null, isNew: false }),
      })
      return
    }

    if (url.pathname === '/api/event-calendar') {
      const baseEvents = [
        {
          id: 'evt-earnings',
          date: '2026-05-12',
          eventType: 'earnings',
          type: 'earnings',
          source: 'auto-calendar',
          title: '聯發科 Q1 財報公布截止',
          detail: '財報窗口',
          stocks: ['聯發科 2454'],
          recordType: 'event',
          impact: 'high',
        },
        {
          id: 'evt-dividend',
          date: '2026-05-15',
          eventType: 'ex-dividend',
          eventSubType: 'ex-dividend',
          type: 'dividend',
          source: 'finmind-dividend',
          title: '台積電(2330) 除息',
          detail: '預計配息 4.0 元 / 股',
          cashDividend: 4,
          stocks: ['台積電 2330'],
          recordType: 'event',
          impact: 'medium',
        },
        {
          id: 'evt-shareholder',
          date: '2026-05-20',
          eventType: 'shareholding-meeting',
          type: 'shareholder',
          source: 'mops-shareholder',
          title: '台積電(2330) 股東會',
          detail: '紀念品 保溫瓶',
          souvenir: '保溫瓶',
          stocks: ['台積電 2330'],
          recordType: 'event',
          impact: 'high',
        },
        {
          id: 'evt-strategic',
          date: '2026-05-18',
          eventType: 'strategic',
          type: 'strategic',
          source: 'finmind-news',
          title: '台達電宣布重大併購與轉型',
          detail: '策略變動',
          stocks: ['台達電 2308'],
          recordType: 'event',
          impact: 'high',
        },
        {
          id: 'evt-info',
          date: '2026-05-21',
          eventType: 'informational',
          type: 'informational',
          source: 'finmind-news',
          title: '台積電紀念品領取提醒',
          detail: '資訊備查',
          stocks: ['台積電 2330'],
          recordType: 'event',
          impact: 'low',
        },
        {
          id: 'evt-7865-dividend',
          date: '2026-05-16',
          eventType: 'ex-dividend',
          eventSubType: 'ex-dividend',
          type: 'dividend',
          source: 'finmind-dividend',
          title: '金聯成(7865) 除息',
          detail: '預計配息 1.2 元 / 股',
          cashDividend: 1.2,
          stocks: ['金聯成 7865'],
          recordType: 'event',
          impact: 'medium',
        },
      ]

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          generatedAt: '2026-04-24T00:00:00.000Z',
          events: baseEvents,
        }),
      })
      return
    }

    await route.continue()
  })

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)

  await clickTab(page, 'events', '事件追蹤')
  await expect(page.getByRole('button', { name: '🔵 earnings' })).toBeVisible()
  await expect(page.getByRole('button', { name: '🟢 ex-dividend' })).toBeVisible()
  await expect(page.getByRole('button', { name: '🟡 shareholding-meeting' })).toBeVisible()
  await expect(page.getByRole('button', { name: '🔴 strategic' })).toBeVisible()
  await expect(page.getByRole('button', { name: '⚪ informational' })).toBeVisible()
  await expect(page.getByText('台積電(2330) 除息')).toBeVisible()
  await expect(page.getByText('台積電(2330) 股東會')).toBeVisible()
  await expect(page.getByText('台達電宣布重大併購與轉型')).toBeVisible()
  await expect(page.getByText('台積電紀念品領取提醒')).not.toBeVisible()
  await expect(page.getByTestId('events-informational-collapse')).toBeVisible()
  await savePageScreenshot(page, testInfo, 'events-filters-default.png')

  await page.getByRole('button', { name: '展開資訊型' }).click()
  await settle(page, 1200)
  await expect(page.getByText('台積電紀念品領取提醒')).toBeVisible()

  await page.getByRole('button', { name: '🟢 ex-dividend' }).click()
  await settle(page, 1200)
  await expect(page.getByText('台積電(2330) 除息')).toBeVisible()
  await expect(page.getByText('台積電(2330) 股東會')).not.toBeVisible()

  await switchToPortfolio(page, { portfolioId: '7865', portfolioLabel: '金聯成' })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2400)
  await clickTab(page, 'events', '事件追蹤')
  await expect(page.getByText('金聯成(7865) 除息')).toBeVisible()
  await expect(page.getByTestId('events-panel')).not.toContainText(/買進|賣出|加碼|減碼/)
  await savePageScreenshot(page, testInfo, 'events-filters-insider-7865.png')
})
