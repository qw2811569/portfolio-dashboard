import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
  saveLocatorScreenshot,
  stubOwnerCloudBootstrap,
} from './support/qaHelpers.mjs'

const HERO_SEED = {
  'pf-portfolios-v1': [{ id: 'me', name: '小奎主要投資', isOwner: true, createdAt: '2026-04-24' }],
  'pf-active-portfolio-v1': 'me',
  'pf-view-mode-v1': 'portfolio',
  'pf-schema-version': 3,
  'pf-market-price-cache-v1': {
    marketDate: '2026-04-24',
    syncedAt: '2026-04-24T06:00:00.000Z',
    prices: {
      2330: { price: 950, change: 7, changePct: 0.74 },
      2454: { price: 1220, change: -10, changePct: -0.81 },
    },
  },
  'pf-market-price-sync-v1': {
    status: 'success',
    syncedAt: '2026-04-24T06:00:00.000Z',
    marketDate: '2026-04-24',
  },
  'pf-me-holdings-v2': [
    { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 },
    { code: '2454', name: '聯發科', qty: 2, cost: 1200, price: 1220, value: 2440 },
  ],
  'pf-me-news-events-v1': [
    {
      id: 'evt-me-1',
      title: '台積電法說',
      status: 'pending',
      eventDate: '2026-04-24',
      pred: 'up',
      predReason: 'AI 需求延續',
      stocks: ['台積電 2330'],
    },
  ],
  'pf-me-notes-v1': { riskProfile: '', preferences: '', customNotes: '' },
}

async function seedHeroDashboard(page) {
  await stubOwnerCloudBootstrap(page, {
    holdings: HERO_SEED['pf-me-holdings-v2'],
    events: HERO_SEED['pf-me-news-events-v1'],
  })
  await page.addInitScript((seed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(seed || {})) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, HERO_SEED)
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.getByTestId('dashboard-poster-hero')).toBeVisible()
}

async function expectPosterHero(page, testInfo, { fileName, maxHeight }) {
  const hero = page.getByTestId('dashboard-poster-hero')
  const headline = page.getByTestId('dashboard-headline')
  const totalAssets = page.getByTestId('dashboard-total-assets-value')

  const heroBox = await hero.boundingBox()
  expect(heroBox?.height || 0).toBeGreaterThan(0)
  expect(heroBox?.height || 0).toBeLessThan(maxHeight)

  const headlineStyle = await headline.evaluate((element) => {
    const style = getComputedStyle(element)
    return { fontFamily: style.fontFamily, fontWeight: style.fontWeight }
  })
  expect(headlineStyle.fontFamily).toMatch(/Inter|system-ui/i)
  expect(headlineStyle.fontFamily).not.toMatch(/Source Serif|Noto Serif/i)
  expect(Number(headlineStyle.fontWeight)).toBeGreaterThanOrEqual(700)

  const totalStyle = await totalAssets.evaluate((element) => {
    const style = getComputedStyle(element)
    return { fontFamily: style.fontFamily, fontWeight: style.fontWeight }
  })
  expect(totalStyle.fontFamily).toMatch(/Inter|system-ui/i)
  expect(totalStyle.fontFamily).not.toMatch(/Source Serif|Noto Serif/i)
  expect(Number(totalStyle.fontWeight)).toBeGreaterThanOrEqual(800)

  if (testInfo.project.name === 'chromium') {
    await expect(hero).toHaveScreenshot(fileName, { maxDiffPixelRatio: 0.02 })
    mergeQaEvidence(testInfo, { screenshots: [`tests/e2e/snapshots/chromium/${fileName}`] })
    return
  }

  await saveLocatorScreenshot(hero, testInfo, fileName)
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('dashboard poster hero stays compact and sans on desktop and mobile', async ({
  page,
}, testInfo) => {
  installQaMonitor(testInfo, page)

  await page.setViewportSize({ width: 1440, height: 900 })
  await seedHeroDashboard(page)
  await expectPosterHero(page, testInfo, {
    fileName: 'dashboard-hero-poster-desktop.png',
    maxHeight: 800,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await seedHeroDashboard(page)
  const heroGridColumns = await page
    .locator('.dashboard-hero')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(heroGridColumns.split(' ').length).toBe(1)
  await expectPosterHero(page, testInfo, {
    fileName: 'dashboard-hero-poster-mobile.png',
    maxHeight: 600,
  })
})
