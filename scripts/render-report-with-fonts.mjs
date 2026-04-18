import { chromium, webkit } from 'playwright'
import path from 'node:path'

const root = process.cwd()
const assetDir = path.resolve(root, 'docs/portfolio-spec-report/assets')
const baseUrl = new URL(
  process.env.REPORT_RENDER_BASE_URL ?? 'https://35.236.155.62.sslip.io/portfolio-report/',
)

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

function buildPageUrl(name) {
  return new URL(`pages/${name}.html`, baseUrl).toString()
}

function summarizeFontStatuses(statuses) {
  return statuses
    .map(({ family, weight, status }) => `${family}:${weight}:${status}`)
    .join(', ')
}

async function probeFonts(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const probes = [
      '400 1em "Source Han Sans TC"',
      '700 1em "Source Han Sans TC"',
      '400 1em "Source Han Serif TC"',
      '700 1em "Source Han Serif TC"',
    ]

    await document.fonts.ready

    let loaded = probes.every((font) => document.fonts.check(font))
    if (!loaded) {
      await sleep(2000)
      loaded = probes.every((font) => document.fonts.check(font))
    }

    return {
      loaded,
      sansLoaded: document.fonts.check('1em "Source Han Sans TC"'),
      serifLoaded: document.fonts.check('1em "Source Han Serif TC"'),
      status: Array.from(document.fonts).map((face) => ({
        family: face.family,
        weight: face.weight,
        status: face.status,
      })),
    }
  })
}

async function preparePage(page, url, label) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const responses = []
    const onResponse = (response) => {
      const responseUrl = response.url()
      if (responseUrl.includes('source-han-fonts.css') || responseUrl.includes('SourceHan')) {
        responses.push({
          url: responseUrl,
          status: response.status(),
          type: response.request().resourceType(),
        })
      }
    }

    page.on('response', onResponse)
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      const fontState = await probeFonts(page)
      await page.waitForTimeout(800)

      if (fontState.loaded) {
        console.log(
          `[${label}] fonts loaded on attempt ${attempt}: ${summarizeFontStatuses(fontState.status)}`,
        )
        return
      }

      console.warn(
        `[${label}] font check failed on attempt ${attempt}: sans=${fontState.sansLoaded} serif=${fontState.serifLoaded}`,
      )
      console.warn(`[${label}] font statuses: ${summarizeFontStatuses(fontState.status)}`)
      if (responses.length > 0) {
        console.warn(`[${label}] font requests: ${JSON.stringify(responses)}`)
      }

      if (attempt === 2) {
        throw new Error(`[${label}] Source Han fonts did not load after retry`)
      }
    } finally {
      page.off('response', onResponse)
    }
  }
}

async function renderDesktop() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const [name, desktopAsset, , viewport] of pairs) {
      const page = await browser.newPage({
        viewport,
        deviceScaleFactor: 1,
        colorScheme: 'light',
      })
      const url = buildPageUrl(name)
      try {
        await preparePage(page, url, `desktop:${name}`)
        await page.screenshot({
          path: path.resolve(assetDir, desktopAsset),
          clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
        })
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
}

async function renderMobile() {
  const browser = await webkit.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })

  try {
    for (const [name, , mobileAsset] of pairs) {
      const page = await context.newPage()
      const url = buildPageUrl(name)
      try {
        await preparePage(page, url, `mobile:${name}`)
        await page.screenshot({
          path: path.resolve(assetDir, mobileAsset),
          fullPage: true,
        })
      } finally {
        await page.close()
      }
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

console.log(`Rendering report previews from ${baseUrl.toString()}`)
await renderDesktop()
await renderMobile()
