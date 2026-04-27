import { expect, test } from '@playwright/test'

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
  { name: '10-research-desktop', path: '/portfolio/me/research', viewport: { width: 1440, height: 900 }, full: true },
  { name: '10b-research-mobile', path: '/portfolio/me/research', viewport: { width: 390, height: 844 }, full: true },
]

for (const route of routes) {
  test(`audit ${route.name}`, async ({ page }) => {
    await page.setViewportSize(route.viewport)
    await page.addInitScript((shouldSeedResearch) => {
      window.localStorage.setItem('pf-onboarding-completed-v1', new Date().toISOString())
      if (!shouldSeedResearch) return

      const now = new Date().toISOString()
      const holdings = [
        {
          code: '2330',
          name: '台積電',
          qty: 1000,
          price: 950,
          cost: 820,
          type: '股票',
          industry: '半導體',
          strategy: '核心',
          note: 'visual audit research seed',
        },
        {
          code: '2454',
          name: '聯發科',
          qty: 200,
          price: 1180,
          cost: 1040,
          type: '股票',
          industry: 'IC 設計',
          strategy: '成長',
          note: 'visual audit research seed',
        },
      ]
      const holdingDossiers = [
        {
          code: '2330',
          name: '台積電',
          thesis: {
            statement: '先進製程與 AI 需求仍支撐長期競爭力。',
            pillars: [
              { text: '先進製程市占維持領先', status: 'ok' },
              { text: 'AI 伺服器需求延續', status: 'watch' },
            ],
          },
          fundamentals: { updatedAt: now, quarter: '2026Q1', eps: 12.5 },
          targets: { aggregate: { target: 1080, updatedAt: now } },
        },
        {
          code: '2454',
          name: '聯發科',
          thesis: {
            statement: '手機復甦與邊緣 AI 產品線是主要觀察點。',
            pillars: [{ text: '旗艦晶片毛利改善', status: 'ok' }],
          },
          fundamentals: { updatedAt: now, quarter: '2026Q1', eps: 18.2 },
          targets: { aggregate: { target: 1280, updatedAt: now } },
        },
      ]
      const researchHistory = [
        {
          id: 'visual-audit-research-seed',
          timestamp: now,
          mode: 'portfolio',
          title: '組合研究狀態摘要',
          summary: '投資理由狀態、資料新鮮度與待補研究項目已可供 visual audit 截圖比對。',
          codes: ['2330', '2454'],
        },
      ]

      window.localStorage.setItem(
        'pf-portfolios-v1',
        JSON.stringify([{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-27' }])
      )
      window.localStorage.setItem('pf-active-portfolio-v1', JSON.stringify('me'))
      window.localStorage.setItem('pf-view-mode-v1', JSON.stringify('portfolio'))
      window.localStorage.setItem('pf-me-holdings-v2', JSON.stringify(holdings))
      window.localStorage.setItem('pf-me-holding-dossiers-v1', JSON.stringify(holdingDossiers))
      window.localStorage.setItem('pf-me-research-history-v1', JSON.stringify(researchHistory))
    }, route.path.includes('/research'))
    await page.goto(`${BASE}${route.path.replace(/^\//, '')}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    if (route.path.includes('/research')) {
      await expect(page.getByTestId('research-thesis-status')).toContainText('投資理由狀態')
    }
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: route.full })
  })
}
