import { expect, test } from '@playwright/test'
import { readTrackedStocksForPortfolio } from '../../api/_lib/tracked-stocks.js'
import { DEFAULT_UPLOAD_FIXTURE_PATH, PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'
import { maybeAcceptTradeDisclaimer } from './support/tradeHelpers.mjs'

const baseUrl = new URL(PORTFOLIO_BASE_URL)
const baseOrigin = `${baseUrl.protocol}//${baseUrl.host}`
const isLocalBaseUrl = ['127.0.0.1', 'localhost'].includes(baseUrl.hostname)

async function waitForTrackedStocksBlob(code) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const record = await readTrackedStocksForPortfolio('me', {
      origin: baseOrigin,
      logger: { info() {}, warn() {}, error() {} },
    })
    if (record?.trackedStocks?.some((stock) => stock.code === code)) {
      return record
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`tracked-stocks blob never contained ${code}`)
}

test('trade route syncs tracked stocks into blob and shows last-synced badge', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Local verification only runs on chromium')
  test.skip(!isLocalBaseUrl, 'Set PORTFOLIO_BASE_URL to localhost for this local-only spec')
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN, 'BLOB_READ_WRITE_TOKEN is required')

  await page.addInitScript(() => {
    localStorage.clear()
  })

  await page.goto(new URL('/portfolio/me/trade', PORTFOLIO_BASE_URL).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: '上傳成交' }).click()
  await expect(page.getByTestId('trade-panel')).toBeVisible()
  await maybeAcceptTradeDisclaimer(page)

  const uploadInput = page.getByTestId('trade-upload-input')
  await uploadInput.setInputFiles(DEFAULT_UPLOAD_FIXTURE_PATH)

  await page.getByTestId('manual-trade-code-input').fill('2454')
  await page.getByTestId('manual-trade-name-input').fill('聯發科')
  await page.getByTestId('manual-trade-action-select').selectOption('買進')
  await page.getByTestId('manual-trade-qty-input').fill('7')
  await page.getByTestId('manual-trade-price-input').fill('1250')
  await page.getByTestId('manual-trade-submit-btn').click()

  await expect(page.getByRole('button', { name: '跳過備忘，先看預覽' })).toBeVisible()

  const syncResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/tracked-stocks') &&
      response.request().method() === 'POST' &&
      response.request().postData()?.includes('"2454"'),
    { timeout: 15000 }
  )

  await page.getByRole('button', { name: '跳過備忘，先看預覽' }).click()
  await page.getByTestId('trade-confirm-btn').click()
  const syncResponse = await syncResponsePromise

  expect(syncResponse.status()).toBe(200)

  const storedState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pf-me-tracked-sync-v1') || 'null')
  )
  const storedHoldings = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pf-me-holdings-v2') || '[]')
  )

  expect(storedState).toMatchObject({
    portfolioId: 'me',
    status: 'fresh',
    source: 'live-sync',
  })
  expect(storedState.lastSyncedAt).toBeTruthy()
  expect(storedHoldings).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: '2454', name: '聯發科', qty: 7 })])
  )

  const blobRecord = await waitForTrackedStocksBlob('2454')
  expect(blobRecord.trackedStocks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: '2454', name: '聯發科', type: '股票' }),
    ])
  )

  await page.goto(new URL('/portfolio/me/holdings', PORTFOLIO_BASE_URL).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await expect(page.getByTestId('tracked-stocks-sync-badge')).toContainText('已同步')
})
