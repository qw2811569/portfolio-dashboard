import { webkit } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const pages = [
  ['dashboard', 'mobile-dashboard-preview.png'],
  ['holdings', 'mobile-holdings-preview.png'],
  ['daily', 'mobile-daily-preview.png'],
  ['log', 'mobile-log-preview.png'],
]

const browser = await webkit.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

for (const [name, asset] of pages) {
  const page = await context.newPage()
  const url = pathToFileURL(path.resolve(root, `docs/portfolio-spec-report/pages/${name}.html`)).href
  await page.goto(url)
  await page.screenshot({
    path: path.resolve(root, `docs/portfolio-spec-report/assets/${asset}`),
    fullPage: true,
  })
  await page.close()
}

await browser.close()
