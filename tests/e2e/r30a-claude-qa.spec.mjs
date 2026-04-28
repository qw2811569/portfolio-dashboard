import { test } from '@playwright/test'

const BASE = 'http://104.199.144.170/'

const seed = (path) => async (page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pf-onboarding-completed-v1', new Date().toISOString())
  })
  await page.goto(`${BASE}${path.replace(/^\//, '')}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1500)
}

const consoleLog = (page, label) => {
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('error') || t.includes('Error') || t.includes('fail') || t.includes('卡') || t.includes('SyntaxError')) {
      console.log(`[${label}] ${msg.type()}: ${t}`)
    }
  })
  page.on('pageerror', (err) => {
    console.log(`[${label}] PAGEERROR: ${err.message}`)
  })
}

test('R30A · 收盤分析 30s state observe', async ({ page }) => {
  consoleLog(page, 'daily')
  await seed('/portfolio/me/daily')(page)

  console.log('=== INITIAL STATE ===')
  const heroExists = await page.locator('[data-testid="daily-ritual-hero"]').count()
  console.log('hero count:', heroExists)
  if (heroExists > 0) {
    const heroText = await page.locator('[data-testid="daily-ritual-hero"]').first().textContent()
    console.log('hero text:', heroText?.slice(0, 200))
  }

  // count buttons mentioning 分析
  const analysisBtn = page.getByRole('button', { name: /分析|復盤|刷新/ })
  const btnCount = await analysisBtn.count()
  console.log('analysis-related buttons:', btnCount)

  for (let i = 0; i < btnCount; i++) {
    const txt = await analysisBtn.nth(i).textContent()
    const disabled = await analysisBtn.nth(i).isDisabled()
    console.log(`  btn[${i}]: ${txt?.trim()} disabled=${disabled}`)
  }

  // 30s observe state changes
  console.log('=== 30s OBSERVE ===')
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    if (i % 5 === 0) {
      const bodyText = await page.textContent('body')
      const hasAnalyzing = bodyText.includes('分析中')
      const hasStreaming = bodyText.includes('Streaming') || bodyText.includes('即時摘要')
      const hasWaiting = bodyText.includes('等明早')
      const hasReady = bodyText.includes('今日摘要')
      console.log(`t+${i}s analyzing=${hasAnalyzing} streaming=${hasStreaming} waiting=${hasWaiting} ready=${hasReady}`)
    }
  }
})

test('R30A · Holdings click drill-in', async ({ page }) => {
  consoleLog(page, 'holdings')
  await seed('/portfolio/me/holdings')(page)
  const stale = await page.textContent('body').then(t => t.includes('資料補齊') || t.includes('暫時'))
  console.log('holdings stale banner:', stale)

  // click first holding row
  const rows = await page.locator('[data-testid^="holding-row-"]').count()
  console.log('holding rows:', rows)
})

test('R30A · Research CTA click', async ({ page }) => {
  consoleLog(page, 'research')
  await seed('/portfolio/me/research')(page)
  const ctaBtn = page.getByRole('button', { name: /全組合研究|AI 策略/ })
  const cnt = await ctaBtn.count()
  console.log('research cta count:', cnt)
  if (cnt > 0) {
    const disabled = await ctaBtn.first().isDisabled()
    console.log('research cta disabled:', disabled)
  }
})

test('R30A · Trade wizard step traverse', async ({ page }) => {
  consoleLog(page, 'trade')
  await seed('/portfolio/me/trade')(page)
  const enterBtn = page.locator('[data-testid="trade-disclaimer-enter-btn"]')
  const ec = await enterBtn.count()
  console.log('trade disclaimer enter btn:', ec)
  if (ec > 0) {
    const checkbox = page.locator('[data-testid="trade-disclaimer-checkbox"]')
    if (await checkbox.count() > 0) {
      await checkbox.first().click()
      await page.waitForTimeout(500)
      const disabled = await enterBtn.first().isDisabled()
      console.log('after checkbox: disabled:', disabled)
    }
  }
})

test('R30A · Watchlist add form', async ({ page }) => {
  consoleLog(page, 'watchlist')
  await seed('/portfolio/me/watchlist')(page)
  const addBtn = page.getByRole('button', { name: /新增觀察股/ })
  const ac = await addBtn.count()
  console.log('add watchlist btn:', ac)
})

test('R30A · Events 待復盤 expand', async ({ page }) => {
  consoleLog(page, 'events')
  await seed('/portfolio/me/events')(page)
  const expiredSummary = page.getByText(/已過期 \d+ 件/)
  const exists = await expiredSummary.count()
  console.log('expired summary exists:', exists)
})
