import path from 'node:path'
import { chromium, webkit } from 'playwright'

const root = process.cwd()
const baseUrl = (process.env.PORTFOLIO_REPORT_BASE_URL || 'https://35.236.155.62.sslip.io/portfolio-report').replace(/\/$/, '')
const stamp = Date.now()

const reports = [
  {
    name: 'architecture',
    page: 'architecture.html',
    desktopAsset: 'architecture-desktop.png',
    mobileAsset: 'architecture-mobile.png',
  },
  {
    name: 'todo',
    page: 'todo.html',
    desktopAsset: 'todo-desktop.png',
    mobileAsset: 'todo-mobile.png',
  },
]

const desktop = await chromium.launch({ headless: true })
const dctx = await desktop.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
})

for (const report of reports) {
  const page = await dctx.newPage()
  const url = `${baseUrl}/${report.page}?v=${stamp}-${report.name}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({
    path: path.resolve(root, `docs/portfolio-spec-report/assets/${report.desktopAsset}`),
    fullPage: true,
  })
  await page.close()
}

await dctx.close()
await desktop.close()

const mobile = await webkit.launch({ headless: true })
const mctx = await mobile.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  ignoreHTTPSErrors: true,
})

for (const report of reports) {
  const page = await mctx.newPage()
  const url = `${baseUrl}/${report.page}?v=${stamp}-${report.name}-mobile`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({
    path: path.resolve(root, `docs/portfolio-spec-report/assets/${report.mobileAsset}`),
    fullPage: true,
  })
  await page.close()
}

await mctx.close()
await mobile.close()

console.log('architecture + todo desktop/mobile previews rendered')
