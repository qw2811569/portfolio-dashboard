import { chromium, webkit } from 'playwright'

const URL = `https://35.236.155.62.sslip.io/portfolio-report/architecture.html?v=${Date.now()}`

const desktop = await chromium.launch({ headless: true })
const dctx = await desktop.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
})
const dpage = await dctx.newPage()
await dpage.goto(URL, { waitUntil: 'networkidle' })
await dpage.waitForTimeout(3000)
await dpage.screenshot({
  path: 'docs/portfolio-spec-report/assets/architecture-desktop.png',
  fullPage: true,
})
await desktop.close()

const mobile = await webkit.launch({ headless: true })
const mctx = await mobile.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  ignoreHTTPSErrors: true,
})
const mpage = await mctx.newPage()
await mpage.goto(URL, { waitUntil: 'networkidle' })
await mpage.waitForTimeout(3000)
await mpage.screenshot({
  path: 'docs/portfolio-spec-report/assets/architecture-mobile.png',
  fullPage: true,
})
await mobile.close()

console.log('architecture desktop + mobile rendered')
