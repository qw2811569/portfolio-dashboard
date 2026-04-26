import { test } from '@playwright/test'

const BASE = process.env.AUDIT_BASE_URL || 'http://104.199.144.170/'
const OUT = process.env.AUDIT_OUT_DIR || '.tmp/r156-full-execute/round12/screenshots'

const routes = [
  { name: '01-overview-desktop', path: '/portfolio/me/overview', viewport: { width: 1440, height: 900 }, full: true },
  { name: '02-overview-mobile', path: '/portfolio/me/overview', viewport: { width: 390, height: 844 }, full: true },
  { name: '03-holdings-desktop', path: '/portfolio/me/holdings', viewport: { width: 1440, height: 900 }, full: true },
  { name: '04-holdings-mobile', path: '/portfolio/me/holdings', viewport: { width: 390, height: 844 }, full: true },
  { name: '05-daily-desktop', path: '/portfolio/me/daily', viewport: { width: 1440, height: 900 }, full: true },
  { name: '05b-daily-mobile', path: '/portfolio/me/daily', viewport: { width: 390, height: 844 }, full: true },
  { name: '06-trade-desktop', path: '/portfolio/me/trade', viewport: { width: 1440, height: 900 }, full: true },
  { name: '06b-trade-mobile', path: '/portfolio/me/trade', viewport: { width: 390, height: 844 }, full: true },
  { name: '07-events-desktop', path: '/portfolio/me/events', viewport: { width: 1440, height: 900 }, full: true },
  { name: '07b-events-mobile', path: '/portfolio/me/events', viewport: { width: 390, height: 844 }, full: true },
  { name: '08-watchlist-desktop', path: '/portfolio/me/watchlist', viewport: { width: 1440, height: 900 }, full: true },
  { name: '08b-watchlist-mobile', path: '/portfolio/me/watchlist', viewport: { width: 390, height: 844 }, full: true },
  { name: '09-news-desktop', path: '/portfolio/me/news', viewport: { width: 1440, height: 900 }, full: true },
  { name: '09b-news-mobile', path: '/portfolio/me/news', viewport: { width: 390, height: 844 }, full: true },
]

for (const route of routes) {
  test(`audit ${route.name}`, async ({ page }) => {
    await page.setViewportSize(route.viewport)
    await page.addInitScript(() => {
      window.localStorage.setItem('pf-onboarding-completed-v1', new Date().toISOString())
    })
    await page.goto(`${BASE}${route.path.replace(/^\//, '')}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: route.full })
  })
}
