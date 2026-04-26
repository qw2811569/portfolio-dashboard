import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const BASE = process.env.PERSONA_WALKTHROUGH_BASE_URL || 'http://104.199.144.170/'
const OUT = resolve(process.cwd(), '.tmp/r156-full-execute/round11/walkthrough')
const WAIT_MS = 900

const routes = [
  { key: 'overview', label: '看板', path: '/portfolio/me/overview' },
  { key: 'holdings', label: '持倉', path: '/portfolio/me/holdings' },
  { key: 'events', label: '事件追蹤', path: '/portfolio/me/events' },
  { key: 'daily', label: '收盤分析', path: '/portfolio/me/daily' },
  { key: 'watchlist', label: '觀察股', path: '/portfolio/me/watchlist' },
  { key: 'trade', label: '上傳成交', path: '/portfolio/me/trade' },
  { key: 'research', label: '深度研究', path: '/portfolio/me/research' },
  { key: 'log', label: '交易日誌', path: '/portfolio/me/log' },
]

const personas = [
  { key: 'persona-a-mobile', viewport: { width: 390, height: 844 } },
  { key: 'persona-b-desktop', viewport: { width: 1440, height: 900 } },
]

function routeUrl(path) {
  return `${BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function safeName(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function waitForApp(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(WAIT_MS)
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function clickTabOrGo(page, route) {
  const tab = page
    .getByTestId(`tab-${route.key}`)
    .or(page.getByRole('button', { name: new RegExp(route.label) }))
    .first()

  if ((await tab.count()) > 0 && (await tab.isVisible().catch(() => false))) {
    await tab.scrollIntoViewIfNeeded()
    await tab.click()
    await waitForApp(page)
    return
  }

  await page.goto(routeUrl(route.path), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForApp(page)
}

async function capture(page, persona, route, step, note) {
  const dir = resolve(OUT, persona.key)
  mkdirSync(dir, { recursive: true })
  const prefix = `${String(step).padStart(2, '0')}-${route.key}-${safeName(note)}`
  const screenshot = resolve(dir, `${prefix}.png`)
  const domPath = resolve(dir, `${prefix}.json`)

  await page.screenshot({ path: screenshot, fullPage: true })
  const dom = await page.evaluate(() => {
    const visibleText = (node) => (node?.innerText || '').replace(/\s+/g, ' ').trim()
    const main = document.querySelector('main') || document.body
    const buttons = Array.from(document.querySelectorAll('button, a, input, select, textarea'))
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
      })
      .slice(0, 80)
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          text: visibleText(el) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '',
          testId: el.getAttribute('data-testid') || '',
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          borderRadius: style.borderRadius,
          color: style.color,
          backgroundColor: style.backgroundColor,
        }
      })

    const samples = Array.from(main.querySelectorAll('h1,h2,h3,p,li,td,th,[class*="chip"],[class*="badge"]'))
      .filter((el) => visibleText(el))
      .slice(0, 120)
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          text: visibleText(el).slice(0, 220),
          className: String(el.className || '').slice(0, 160),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
        }
      })

    return {
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      bodyText: visibleText(main).slice(0, 10000),
      buttons,
      samples,
    }
  })

  writeFileSync(domPath, `${JSON.stringify(dom, null, 2)}\n`)
}

async function clickableTargets(page) {
  return page
    .locator('main button:not([disabled]), main a[href], main input:not([disabled]), main select:not([disabled])')
    .filter({ hasNotText: /^$/ })
}

for (const persona of personas) {
  test(`${persona.key} hostile walkthrough capture`, async ({ page }) => {
    test.setTimeout(240000)
    await page.setViewportSize(persona.viewport)
    await page.addInitScript(() => {
      window.localStorage.setItem('pf-onboarding-completed-v1', new Date().toISOString())
    })

    await page.goto(routeUrl('/portfolio/me/overview'), {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await waitForApp(page)

    let step = 1
    for (const route of routes) {
      await clickTabOrGo(page, route)
      await capture(page, persona, route, step++, 'initial')

      const targets = await clickableTargets(page)
      const count = Math.min(await targets.count(), 5)
      for (let index = 0; index < count; index += 1) {
        const target = targets.nth(index)
        const label = await target
          .evaluate((el) => (el.innerText || el.getAttribute('aria-label') || el.value || '').trim())
          .catch(() => `target-${index + 1}`)
        await target.scrollIntoViewIfNeeded().catch(() => {})
        await target.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(WAIT_MS)
        await capture(page, persona, route, step++, `click-${index + 1}-${label || 'control'}`)
      }
    }
  })
}
