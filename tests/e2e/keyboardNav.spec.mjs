import { expect, test } from '@playwright/test'
import {
  PORTFOLIO_BASE_URL,
  expectNoBlockingQaErrors,
  installQaMonitor,
  mergeQaEvidence,
  savePageScreenshot,
} from './support/qaHelpers.mjs'

const STEP_WAIT_MS = 1800
const TARGET_PORTFOLIO_ID = String(process.env.GOLDEN_PATH_PORTFOLIO_ID || '7865').trim()
const TARGET_PORTFOLIO_LABEL = String(
  process.env.GOLDEN_PATH_PORTFOLIO_LABEL ||
    (TARGET_PORTFOLIO_ID === 'me' ? '我' : TARGET_PORTFOLIO_ID === '7865' ? '金聯成' : TARGET_PORTFOLIO_ID)
).trim()
const TAB_STEPS = 5

async function settle(page, waitMs = STEP_WAIT_MS) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(waitMs)
}

async function firstExisting(...locators) {
  for (const locator of locators) {
    if ((await locator.count()) > 0) return locator.first()
  }

  return null
}

async function requireLocator(message, ...locators) {
  const locator = await firstExisting(...locators)
  if (!locator) throw new Error(message)
  return locator
}

async function getPortfolioSelect(page) {
  return requireLocator('missing portfolio select', page.getByTestId('portfolio-select'), page.locator('select'))
}

async function switchToPortfolio(page, { portfolioId = '', portfolioLabel = '' } = {}) {
  const custIdInput = await firstExisting(
    page.getByTestId('cust-id-input'),
    page.getByLabel(/cust[_\s-]?id|客戶編號/i)
  )
  const loginButton = await firstExisting(
    page.getByTestId('login-btn'),
    page.getByRole('button', { name: /登入|login|enter/i })
  )

  if (custIdInput && loginButton && (await custIdInput.isVisible().catch(() => false))) {
    await custIdInput.fill(portfolioId)
    await loginButton.click()
    await settle(page, 2500)
    return
  }

  const select = await getPortfolioSelect(page)
  const matchedValue = await select.evaluate(
    (element, target) => {
      const options = Array.from(element.options)
      const exact = options.find((item) => String(item.value || '').trim() === target.portfolioId)
      if (exact) return exact.value

      const byLabel = options.find((item) =>
        String(item.textContent || '')
          .trim()
          .includes(target.portfolioLabel)
      )

      return byLabel?.value || ''
    },
    { portfolioId, portfolioLabel }
  )

  if (!matchedValue) {
    throw new Error(`missing ${portfolioId || portfolioLabel} option in portfolio selector`)
  }

  await select.selectOption(matchedValue)
  await settle(page, 2200)
}

test.afterEach(async ({}, testInfo) => {
  expectNoBlockingQaErrors(testInfo)
})

test('keyboard navigation keeps a visible focus ring with sufficient contrast', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ios-safari', 'Desktop Tab navigation verification only')

  mergeQaEvidence(testInfo, { scenario: 'keyboard-nav' })
  installQaMonitor(testInfo, page)

  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await expect(page).toHaveTitle(/持倉看板|Portfolio/)

  await switchToPortfolio(page, {
    portfolioId: TARGET_PORTFOLIO_ID,
    portfolioLabel: TARGET_PORTFOLIO_LABEL,
  })

  await expect(
    await requireLocator(
      'missing holdings shell after portfolio switch',
      page.getByTestId('holdings-panel'),
      page.getByText(/持股明細/)
    )
  ).toBeVisible()

  await page.evaluate(() => {
    document.activeElement?.blur?.()
  })

  for (let step = 1; step <= TAB_STEPS; step += 1) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(120)
    await savePageScreenshot(page, testInfo, `keyboard-tab-${String(step).padStart(2, '0')}.png`)

    const focusState = await page.evaluate(() => {
      function parseColor(color) {
        if (typeof color !== 'string') return null
        const match = color
          .trim()
          .match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i)
        if (!match) return null

        return {
          r: Number(match[1]),
          g: Number(match[2]),
          b: Number(match[3]),
          a: match[4] == null ? 1 : Number(match[4]),
        }
      }

      function resolveBackgroundColor(element) {
        let current = element

        while (current) {
          const parsed = parseColor(window.getComputedStyle(current).backgroundColor)
          if (parsed && parsed.a > 0) return parsed
          current = current.parentElement
        }

        return parseColor(window.getComputedStyle(document.body).backgroundColor) || {
          r: 255,
          g: 255,
          b: 255,
          a: 1,
        }
      }

      function srgbToLinear(channel) {
        const normalized = channel / 255
        return normalized <= 0.03928
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4)
      }

      function relativeLuminance(color) {
        const r = srgbToLinear(color.r)
        const g = srgbToLinear(color.g)
        const b = srgbToLinear(color.b)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }

      function contrastRatio(a, b) {
        const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
        return (lighter + 0.05) / (darker + 0.05)
      }

      const activeElement = document.activeElement
      if (!activeElement || activeElement === document.body) {
        return {
          id: null,
          label: null,
          tagName: activeElement?.tagName || null,
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: null,
          contrastRatio: 0,
          passed: false,
          reason: 'focus stayed on body',
        }
      }

      const style = window.getComputedStyle(activeElement)
      const outlineWidth = Number.parseFloat(style.outlineWidth || '0')
      const outlineColor = parseColor(style.outlineColor)
      const backgroundColor = resolveBackgroundColor(activeElement)
      const label =
        activeElement.getAttribute('aria-label') ||
        activeElement.textContent ||
        activeElement.getAttribute('data-testid') ||
        activeElement.getAttribute('placeholder') ||
        activeElement.getAttribute('name') ||
        ''

      const ratio = outlineColor && backgroundColor ? contrastRatio(outlineColor, backgroundColor) : 0

      return {
        id: activeElement.id || null,
        label: String(label).replace(/\s+/g, ' ').trim().slice(0, 80),
        tagName: activeElement.tagName.toLowerCase(),
        outlineStyle: style.outlineStyle,
        outlineWidth,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
        contrastRatio: ratio,
        passed: style.outlineStyle !== 'none' && outlineWidth >= 2 && ratio >= 3,
        reason:
          style.outlineStyle === 'none'
            ? 'outline-style is none'
            : outlineWidth < 2
              ? `outline-width is ${outlineWidth}`
              : ratio < 3
                ? `contrast ratio ${ratio.toFixed(2)} is below 3`
                : '',
      }
    })

    expect(
      focusState.passed,
      `Tab step ${step} failed for ${focusState.tagName || 'unknown'} ${focusState.label || ''}: ${focusState.reason}`
    ).toBe(true)
  }
})
