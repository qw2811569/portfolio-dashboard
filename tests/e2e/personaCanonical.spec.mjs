import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'
import { diffHoldingCodes, getPersonaFixture, sortHoldingCodes } from './personaFixtures.mjs'

const PERSONAS = [getPersonaFixture('me'), getPersonaFixture('7865')]

async function settle(page, waitMs = 900) {
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

async function isolatePersonaSeedState(page) {
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    const now = String(Date.now())
    window.localStorage.setItem('pf-cloud-sync-at', now)
    window.localStorage.setItem('pf-analysis-cloud-sync-at', now)
    window.localStorage.setItem('pf-research-cloud-sync-at', now)
  })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let payload = {}

    if (url.pathname === '/api/brain') {
      payload = { holdings: [], events: [], history: [], brain: null }
    } else if (url.pathname === '/api/research') {
      payload = { reports: [] }
    } else if (url.pathname === '/api/analyst-reports') {
      payload = { items: [], reports: [] }
    } else if (url.pathname === '/api/tracked-stocks') {
      payload = { trackedStocks: [] }
    } else if (url.pathname === '/api/target-prices') {
      payload = { reports: [], updatedAt: null, isNew: false }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

async function selectPersona(page, persona) {
  const custIdInput = await firstExisting(
    page.getByTestId('cust-id-input'),
    page.getByLabel(/cust[_\s-]?id|客戶編號/i)
  )
  const loginButton = await firstExisting(
    page.getByTestId('login-btn'),
    page.getByRole('button', { name: /登入|login|enter/i })
  )

  if (custIdInput && loginButton && (await custIdInput.isVisible().catch(() => false))) {
    await custIdInput.fill(persona.custId)
    await loginButton.click()
    await settle(page, 2500)
    return
  }

  const select = await requireLocator(
    'missing portfolio select',
    page.getByTestId('portfolio-select'),
    page.locator('select')
  )
  const matchedValue = await select.evaluate(
    (element, target) => {
      const options = Array.from(element.options)
      const byValue = options.find(
        (option) =>
          String(option.value || '').trim() === target.portfolioId ||
          String(option.value || '').trim() === target.custId
      )
      if (byValue) return byValue.value

      const byLabel = options.find((option) =>
        target.portfolioLabels.some((label) =>
          String(option.textContent || '')
            .trim()
            .includes(label)
        )
      )

      return byLabel?.value || ''
    },
    {
      portfolioId: persona.portfolioId,
      custId: persona.custId,
      portfolioLabels: persona.portfolioLabels,
    }
  )

  if (!matchedValue) {
    throw new Error(`missing persona option for ${persona.personaId}`)
  }

  await select.selectOption(matchedValue)
  await settle(page, 2200)
}

async function openHoldings(page, persona) {
  await page.goto(PORTFOLIO_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page, 2600)
  await expect(page).toHaveTitle(/持倉看板|Portfolio/)
  await selectPersona(page, persona)

  const holdingsTab = await firstExisting(
    page.getByTestId('tab-holdings'),
    page.getByRole('button', { name: '持倉', exact: true })
  )
  if (holdingsTab) {
    await holdingsTab.scrollIntoViewIfNeeded()
    await holdingsTab.click()
    await settle(page, 1400)
  }
}

async function getRenderedHoldingCodes(page) {
  const rows = page.locator('[data-holding-code]')
  await expect(rows.first()).toBeVisible({ timeout: 20000 })
  const codes = await rows.evaluateAll((nodes) =>
    Array.from(
      new Set(
        nodes
          .map((node) => String(node.getAttribute('data-holding-code') || '').trim())
          .filter(Boolean)
      )
    )
  )

  return sortHoldingCodes(codes)
}

for (const persona of PERSONAS) {
  test(`persona canonical fixture alignment · ${persona.personaId}`, async ({ page }) => {
    await isolatePersonaSeedState(page)
    await openHoldings(page, persona)

    const actual = await getRenderedHoldingCodes(page)
    const expected = sortHoldingCodes(persona.canonicalHoldings)
    const diff = diffHoldingCodes(actual, expected)

    expect(diff.missing).toEqual([])
    expect(diff.extra).toEqual([])
    expect(actual).toEqual(expected)
  })
}
