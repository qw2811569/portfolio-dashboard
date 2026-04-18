import { chromium, webkit } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const pairs = [
  ['dashboard', 'mockup-dashboard-preview.png', 'mobile-dashboard-preview.png', { width: 2568, height: 2648 }],
  ['holdings', 'mockup-holdings-preview.png', 'mobile-holdings-preview.png', { width: 2568, height: 3178 }],
  ['events', 'mockup-events-preview.png', 'mobile-events-preview.png', { width: 1600, height: 1200 }],
  ['news', 'mockup-news-preview.png', 'mobile-news-preview.png', { width: 1600, height: 1200 }],
  ['daily', 'mockup-daily-preview.png', 'mobile-daily-preview.png', { width: 1600, height: 1200 }],
  ['research', 'mockup-research-preview.png', 'mobile-research-preview.png', { width: 1600, height: 1200 }],
  ['trade', 'mockup-trade-preview.png', 'mobile-trade-preview.png', { width: 1600, height: 1200 }],
  ['log', 'mockup-log-preview.png', 'mobile-log-preview.png', { width: 1600, height: 1200 }],
]

const desktop = await chromium.launch({ headless: true })
for (const [name, desktopAsset, , viewport] of pairs) {
  const page = await desktop.newPage({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
  })
  const url = pathToFileURL(path.resolve(root, `docs/portfolio-spec-report/pages/${name}.html`)).href
  await page.goto(url, { waitUntil: 'load' })
  await page.screenshot({
    path: path.resolve(root, `docs/portfolio-spec-report/assets/${desktopAsset}`),
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
  })
  await page.close()
}
await desktop.close()

const mobile = await webkit.launch()
const context = await mobile.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

for (const [name, , mobileAsset] of pairs) {
  const page = await context.newPage()
  const url = pathToFileURL(path.resolve(root, `docs/portfolio-spec-report/pages/${name}.html`)).href
  await page.goto(url, { waitUntil: 'load' })
  await page.screenshot({
    path: path.resolve(root, `docs/portfolio-spec-report/assets/${mobileAsset}`),
    fullPage: true,
  })
  await page.close()
}

await context.close()
await mobile.close()
