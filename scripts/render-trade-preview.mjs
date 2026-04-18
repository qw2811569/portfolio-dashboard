import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const htmlPath = path.resolve(root, 'design-mockups/inspiration-2026-04-17/mockup-trade-preview.html')
const outputPath = path.resolve(root, 'design-mockups/inspiration-2026-04-17/mockup-trade-preview.png')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
})

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1600, height: 1200 } })
await browser.close()

console.log(outputPath)
