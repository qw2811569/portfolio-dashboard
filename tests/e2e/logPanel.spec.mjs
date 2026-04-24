import { expect, test } from '@playwright/test'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()
const BASE_HOSTNAME = new URL(BASE_URL).hostname
const IS_LOCAL_BASE_URL = ['127.0.0.1', 'localhost'].includes(BASE_HOSTNAME)

function buildTradeLogEntry({ projectName, suffix }) {
  return {
    id: Number(`${Date.now()}${suffix}`),
    action: '買進',
    code: '9910',
    name: `Log-E2E-${projectName}-${suffix}`,
    qty: 7,
    price: 12.34,
    date: '2026/04/24',
    time: '上午08:44',
    qa: [
      { q: '為什麼選這檔？核心邏輯是什麼？', a: 'E2E 驗證 log panel audit merge。' },
      { q: '進場的技術或籌碼依據？', a: '' },
      { q: '出場計畫：目標價？停損價？', a: '' },
    ],
  }
}

function buildSeedStorage(tradeLog) {
  return {
    portfolios: [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' }],
    activePortfolio: 'me',
    viewMode: 'portfolio',
    schemaVersion: 3,
    marketCache: {
      marketDate: '2026-04-24',
      syncedAt: '2026-04-24T06:00:00.000Z',
      prices: {
        2330: { price: 950, changePct: 2.1 },
      },
    },
    marketSync: {
      status: 'success',
      syncedAt: '2026-04-24T06:00:00.000Z',
      marketDate: '2026-04-24',
    },
    holdings: [{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, type: '股票' }],
    tradeLog,
    notes: { riskProfile: '', preferences: '', customNotes: '' },
  }
}

async function seedLogStorage(page, tradeLog) {
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })

  await page.evaluate((seed) => {
    localStorage.clear()
    localStorage.setItem('pf-portfolios-v1', JSON.stringify(seed.portfolios))
    localStorage.setItem('pf-active-portfolio-v1', JSON.stringify(seed.activePortfolio))
    localStorage.setItem('pf-view-mode-v1', JSON.stringify(seed.viewMode))
    localStorage.setItem('pf-schema-version', JSON.stringify(seed.schemaVersion))
    localStorage.setItem('pf-market-price-cache-v1', JSON.stringify(seed.marketCache))
    localStorage.setItem('pf-market-price-sync-v1', JSON.stringify(seed.marketSync))
    localStorage.setItem('pf-me-holdings-v2', JSON.stringify(seed.holdings))
    localStorage.setItem('pf-me-log-v2', JSON.stringify(seed.tradeLog))
    localStorage.setItem('pf-me-notes-v1', JSON.stringify(seed.notes))
  }, buildSeedStorage(tradeLog))

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
}

async function routeTradeAudit(page, tradeEntry) {
  await page.route('**/api/trade-audit**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [
          {
            ts: '2026-04-24T03:05:53.671Z',
            userId: 'xiaokui',
            portfolioId: 'me',
            action: 'trade.confirm',
            disclaimerAckedAt: '2026-04-24T00:44:50.723Z',
            before: {
              holdings: [{ code: '2330', qty: 10 }],
              tradeLogCount: 0,
            },
            after: {
              holdings: [
                { code: '2330', qty: 10 },
                { code: '9910', qty: tradeEntry.qty },
              ],
              tradeLogCount: 1,
              appendedTradeLogEntries: [tradeEntry],
              targetPriceUpdates: [],
              memoAnswers: tradeEntry.qa.map((item) => item.a || ''),
            },
            sourceFile: 'trade-audit-2026-04.jsonl',
          },
        ],
        summary: {
          portfolioId: 'me',
          count: 1,
          lastUpdatedAt: '2026-04-24T03:05:53.671Z',
        },
      }),
    })
  })
}

async function openLogTab(page) {
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })

  const logTab = page.getByTestId('tab-log')
  await logTab.click()
  await expect(page.getByTestId('trade-log-panel')).toBeVisible()
}

test('log tab shows trade audit entries and opens detail for a selected row', async ({
  page,
}, testInfo) => {
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for log panel QA')

  const uniqueSuffix = `${Date.now()}-01`
  const tradeEntry = buildTradeLogEntry({
    projectName: testInfo.project.name,
    suffix: uniqueSuffix,
  })

  await routeTradeAudit(page, tradeEntry)
  await seedLogStorage(page, [tradeEntry])
  await openLogTab(page)

  const panel = page.getByTestId('trade-log-panel')
  await expect(panel).toContainText(tradeEntry.name)
  await expect(panel).toContainText('交易稽核')

  const row = page
    .locator('[data-testid="trade-log-entry-button"][data-source="trade-audit"]')
    .filter({ hasText: tradeEntry.name })
    .first()
  await row.click()

  const detail = page.getByTestId('trade-log-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('Trade Audit')
  await expect(detail).toContainText('免責聲明確認')
  await expect(detail).toContainText('trade-audit-')
})

test('log panel uses the mobile single-column branch without horizontal overflow', async ({
  page,
}, testInfo) => {
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for log panel QA')

  const uniqueSuffix = `${Date.now()}-02`
  const tradeEntry = buildTradeLogEntry({
    projectName: testInfo.project.name,
    suffix: uniqueSuffix,
  })

  await routeTradeAudit(page, tradeEntry)
  await page.setViewportSize({ width: 390, height: 844 })
  await seedLogStorage(page, [tradeEntry])
  await openLogTab(page)

  await expect(page.getByTestId('trade-log-panel')).toHaveAttribute(
    'data-layout',
    'mobile-single-column'
  )
  await expect(page.getByTestId('trade-log-layout')).toBeVisible()

  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth > window.innerWidth
  })

  expect(hasOverflow).toBe(false)

  const row = page
    .locator('[data-testid="trade-log-entry-button"][data-source="trade-audit"]')
    .filter({ hasText: tradeEntry.name })
    .first()
  await row.click()
  await expect(page.getByTestId('trade-log-detail')).toBeVisible()
})
