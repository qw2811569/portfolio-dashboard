import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { maybeAcceptTradeDisclaimer } from './support/tradeHelpers.mjs'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()
const BASE_HOSTNAME = new URL(BASE_URL).hostname
const IS_LOCAL_BASE_URL = ['127.0.0.1', 'localhost'].includes(BASE_HOSTNAME)
const TRADE_ROUTE_URL = new URL('/portfolio/me/trade', BASE_URL).toString()
const DISCLAIMER_STORAGE_KEY = 'trade-disclaimer-v1-ack-at'

function buildSeedStorage() {
  return {
    portfolios: [{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-24' }],
    activePortfolio: 'me',
    viewMode: 'portfolio',
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
    notes: { riskProfile: '', preferences: '', customNotes: '' },
  }
}

async function seedTradeStorage(page, { disclaimerAckAt = '' } = {}) {
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await page.evaluate(
    ({ seed, disclaimerAckAt: nextAckAt, disclaimerKey }) => {
      localStorage.clear()
      localStorage.setItem('pf-portfolios-v1', JSON.stringify(seed.portfolios))
      localStorage.setItem('pf-active-portfolio-v1', JSON.stringify(seed.activePortfolio))
      localStorage.setItem('pf-view-mode-v1', JSON.stringify(seed.viewMode))
      localStorage.setItem('pf-market-price-cache-v1', JSON.stringify(seed.marketCache))
      localStorage.setItem('pf-market-price-sync-v1', JSON.stringify(seed.marketSync))
      localStorage.setItem('pf-me-holdings-v2', JSON.stringify(seed.holdings))
      localStorage.setItem('pf-me-notes-v1', JSON.stringify(seed.notes))
      if (nextAckAt) {
        localStorage.setItem(disclaimerKey, nextAckAt)
      }
    },
    {
      seed: buildSeedStorage(),
      disclaimerAckAt,
      disclaimerKey: DISCLAIMER_STORAGE_KEY,
    }
  )
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
}

async function mockDateOnNextNavigation(page, mockedNowIso) {
  await page.addInitScript((value) => {
    const RealDate = Date
    const fixedNow = new RealDate(value).getTime()

    class MockDate extends RealDate {
      constructor(...args) {
        super(...(args.length > 0 ? args : [fixedNow]))
      }

      static now() {
        return fixedNow
      }

      static parse(raw) {
        return RealDate.parse(raw)
      }

      static UTC(...args) {
        return RealDate.UTC(...args)
      }
    }

    window.Date = MockDate
    globalThis.Date = MockDate
  }, mockedNowIso)
}

async function openTradeRoute(page) {
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: '上傳成交', exact: true }).click()
  await expect(page.getByTestId('trade-panel')).toBeVisible()
}

function readTradeAuditEntries() {
  const filePath = path.resolve(
    process.cwd(),
    'logs',
    `trade-audit-${new Date().toISOString().slice(0, 7)}.jsonl`
  )
  if (!existsSync(filePath)) return []
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('trade disclaimer appears on first visit, persists, and re-prompts after 90 days', async ({
  page,
}) => {
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for trade disclaimer QA')

  await seedTradeStorage(page)
  await openTradeRoute(page)

  const modal = page.getByTestId('trade-disclaimer-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('交易記錄僅供參考')

  await page.getByTestId('trade-disclaimer-checkbox').check()
  await page.getByTestId('trade-disclaimer-enter-btn').click()
  await expect(modal).toBeHidden()

  const acknowledgedAt = await page.evaluate((storageKey) => {
    return localStorage.getItem(storageKey)
  }, DISCLAIMER_STORAGE_KEY)
  expect(acknowledgedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByRole('button', { name: '上傳成交', exact: true }).click()
  await expect(page.getByTestId('trade-panel')).toBeVisible()
  await expect(page.getByTestId('trade-disclaimer-modal')).toBeHidden()

  const rePromptAt = new Date(
    new Date(acknowledgedAt).getTime() + 91 * 24 * 60 * 60 * 1000
  ).toISOString()
  await mockDateOnNextNavigation(page, rePromptAt)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByRole('button', { name: '上傳成交', exact: true }).click()
  await expect(page.getByTestId('trade-panel')).toBeVisible()
  await expect(page.getByTestId('trade-disclaimer-modal')).toBeVisible()
})

test('trade preview-confirm flow appends an audit entry after disclaimer ack', async ({
  page,
}, testInfo) => {
  test.skip(!IS_LOCAL_BASE_URL, 'Set PORTFOLIO_BASE_URL to localhost for trade disclaimer QA')

  const auditCountBefore = readTradeAuditEntries().length
  await seedTradeStorage(page)
  await openTradeRoute(page)
  await maybeAcceptTradeDisclaimer(page)

  const tradeName = `E2E-${testInfo.project.name}`

  await page.getByTestId('manual-trade-code-input').fill('9910')
  await page.getByTestId('manual-trade-name-input').fill(tradeName)
  await page.getByTestId('manual-trade-action-select').selectOption('買進')
  await page.getByTestId('manual-trade-qty-input').fill('7')
  await page.getByTestId('manual-trade-price-input').fill('12.34')
  await page.getByTestId('manual-trade-submit-btn').click()

  await expect(page.getByTestId('trade-parse-results')).toBeVisible()
  await page.getByRole('button', { name: '跳過備忘，先看預覽' }).click()
  await expect(page.getByTestId('trade-preview-panel')).toBeVisible()
  await expect(page.getByTestId('trade-preview-panel')).toContainText(tradeName)

  const disclaimerAckedAt = await page.evaluate((storageKey) => {
    return localStorage.getItem(storageKey)
  }, DISCLAIMER_STORAGE_KEY)

  await page.getByTestId('trade-confirm-btn').click()

  await expect
    .poll(() => readTradeAuditEntries().length, { timeout: 15000 })
    .toBeGreaterThan(auditCountBefore)

  const matchingEntry = readTradeAuditEntries()
    .slice()
    .reverse()
    .find((entry) =>
      Array.isArray(entry?.after?.appendedTradeLogEntries)
        ? entry.after.appendedTradeLogEntries.some((trade) => trade.name === tradeName)
        : false
    )

  expect(matchingEntry).toBeTruthy()
  expect(matchingEntry).toMatchObject({
    portfolioId: 'me',
    action: 'trade.confirm',
    disclaimerAckedAt,
  })
  expect(matchingEntry.after.appendedTradeLogEntries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: '9910',
        name: tradeName,
        action: '買進',
        qty: 7,
        price: 12.34,
      }),
    ])
  )
})
