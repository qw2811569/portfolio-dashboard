import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

const PORTFOLIO_ID = 'me'

function routeUrl(path) {
  return `${PORTFOLIO_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function buildRevenueRows() {
  const rows = []
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    for (let month = 1; month <= 12; month += 1) {
      rows.push({
        year,
        month,
        revenue: 8000000000 + year * 1000000 + month * 120000000,
        revenueYoY: month % 3 === 0 ? 8 : 3,
      })
    }
  }
  return rows
}

async function seedStorage(page) {
  const seed = {
    'pf-portfolios-v1': [{ id: PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-04-24' }],
    'pf-active-portfolio-v1': PORTFOLIO_ID,
    'pf-view-mode-v1': 'portfolio',
    'pf-onboarding-completed-v1': '2026-04-26T00:00:00.000Z',
    'pf-schema-version': 3,
    [`pf-${PORTFOLIO_ID}-holdings-v2`]: [
      { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, type: '股票' },
    ],
    [`pf-${PORTFOLIO_ID}-watchlist-v1`]: [
      {
        code: '2454',
        name: '聯發科',
        price: 1200,
        target: 1260,
        status: '觀察中',
        catalyst: '法說追蹤',
        createdAt: '2026-04-24T00:00:00.000Z',
      },
    ],
    [`pf-${PORTFOLIO_ID}-news-events-v1`]: [
      {
        id: 'evt-this-week-1',
        title: '台積電法說會',
        date: '2026-04-29',
        eventType: 'earnings',
        recordType: 'event',
        needsThesisReview: true,
        stocks: ['台積電 2330'],
      },
      {
        id: 'evt-next-week-1',
        title: '聯發科除息',
        date: '2026-05-06',
        eventType: 'ex-dividend',
        recordType: 'event',
        stocks: ['聯發科 2454'],
      },
      {
        id: 'evt-later-1',
        title: '台積電股東會',
        date: '2026-05-18',
        eventType: 'shareholding-meeting',
        recordType: 'event',
        stocks: ['台積電 2330'],
      },
    ],
    [`pf-${PORTFOLIO_ID}-daily-report-v1`]: null,
    [`pf-${PORTFOLIO_ID}-analysis-history-v1`]: [],
    [`pf-${PORTFOLIO_ID}-research-history-v1`]: [],
    [`fm-cache-revenue-2330`]: { data: buildRevenueRows() },
  }

  await page.addInitScript((storageSeed) => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    for (const [key, value] of Object.entries(storageSeed)) {
      window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
  }, seed)
}

test('mobile scroll end leaves final route action clear of the fixed bottom nav', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await page.goto(routeUrl('/portfolio/me/events'), { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('events-panel')).toBeVisible()
  await expect(page.getByTestId('header-mobile-route-label')).toHaveText('· 事件追蹤')
  const result = await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const nav = document.querySelector('[data-testid="mobile-bottom-tab-bar"]')
    const routeContent = document.querySelector('.route-content')
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
    ]
    const actions = Array.from(routeContent?.querySelectorAll(selectors.join(',')) || []).filter(
      (element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
      }
    )
    const lastAction = actions.at(-1)

    return {
      navTop: nav?.getBoundingClientRect().top ?? 0,
      lastActionBottom: lastAction?.getBoundingClientRect().bottom ?? 0,
      paddingBottom: routeContent ? window.getComputedStyle(routeContent).paddingBottom : '',
      lastActionText: lastAction?.textContent?.trim() || '',
    }
  })

  expect(Number.parseFloat(result.paddingBottom)).toBeGreaterThanOrEqual(104)
  expect(result.lastActionText).not.toBe('')
  expect(result.lastActionBottom + 16).toBeLessThanOrEqual(result.navTop)
})

test('seasonality heatmap exposes all 12 months in a mobile 2-row layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page)
  await page.goto(routeUrl('/portfolio/me/research'), { waitUntil: 'domcontentloaded' })

  const mobileHeatmap = page.getByTestId('seasonality-heatmap-mobile-2330')
  await expect(mobileHeatmap).toBeVisible()

  const metrics = await mobileHeatmap.evaluate((shell) => {
    const grid = shell.querySelector('.seasonality-heatmap-mobile-grid')
    const firstCell = grid?.querySelector('div:nth-child(16)')
    return {
      scrollWidth: shell.scrollWidth,
      clientWidth: shell.clientWidth,
      cellWidth: firstCell?.getBoundingClientRect().width ?? 0,
      monthLabels: Array.from(grid?.children || [])
        .slice(1, 14)
        .map((node) => node.textContent?.trim())
        .filter(Boolean),
    }
  })

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  expect(metrics.cellWidth).toBeGreaterThanOrEqual(42)
  expect(metrics.monthLabels).toEqual([
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ])
})
