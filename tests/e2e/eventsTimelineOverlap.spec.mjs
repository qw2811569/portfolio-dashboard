import { expect, test } from '@playwright/test'
import { PORTFOLIO_BASE_URL } from './support/qaHelpers.mjs'

async function settle(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1800)
}

function overlaps(a, b) {
  return !(
    a.right <= b.left ||
    b.right <= a.left ||
    a.bottom <= b.top ||
    b.bottom <= a.top
  )
}

test('events timeline labels do not overlap on desktop', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pf-onboarding-completed-v1', new Date().toISOString())
    window.localStorage.setItem(
      'pf-portfolios-v1',
      JSON.stringify([{ id: 'me', name: '我', isOwner: true, createdAt: '2026-04-01' }])
    )
    window.localStorage.setItem('pf-active-portfolio-v1', JSON.stringify('me'))
    window.localStorage.setItem('pf-view-mode-v1', JSON.stringify('portfolio'))
    window.localStorage.setItem(
      'pf-me-holdings-v2',
      JSON.stringify([{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }])
    )
    window.localStorage.setItem(
      'pf-me-news-events-v1',
      JSON.stringify([
        {
          id: 'evt-1',
          title: '台積電法說會',
          date: '2026-04-25',
          eventDate: '2026-04-25',
          eventType: 'earnings',
          stocks: ['2330 台積電'],
          recordType: 'event',
        },
        {
          id: 'evt-2',
          title: '台積電除息',
          date: '2026-04-25',
          eventDate: '2026-04-25',
          eventType: 'ex-dividend',
          stocks: ['2330 台積電'],
          recordType: 'event',
        },
        {
          id: 'evt-3',
          title: '聯發科法說會',
          date: '2026-04-28',
          eventDate: '2026-04-28',
          eventType: 'earnings',
          stocks: ['2454 聯發科'],
          recordType: 'event',
        },
      ])
    )
  })
  await page.goto(PORTFOLIO_BASE_URL)
  await settle(page)

  const eventsTab = page.getByTestId('tab-events').first()
  await expect(eventsTab).toBeVisible({ timeout: 15000 })
  await eventsTab.click()
  await settle(page)

  const labels = page.locator('.events-timeline__desktop .events-timeline__label')
  await expect(labels.first()).toBeVisible({ timeout: 15000 })

  const boxes = await labels.evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const rect = node.getBoundingClientRect()
        const style = window.getComputedStyle(node)
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none',
        }
      })
      .filter((box) => box.visible)
  )

  expect(boxes.length).toBeGreaterThan(0)

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      expect(overlaps(boxes[i], boxes[j]), `timeline labels ${i} and ${j} overlap`).toBe(false)
    }
  }
})
