import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const htmlPath = path.resolve(root, 'design-mockups/inspiration-2026-04-17/badge-comparison.html')
const outputPath = path.resolve(root, 'design-mockups/inspiration-2026-04-17/badge-comparison.png')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 520, deviceScaleFactor: 2 },
  colorScheme: 'light',
})

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
await page.screenshot({ path: outputPath, fullPage: true })
await browser.close()

console.log(outputPath)
