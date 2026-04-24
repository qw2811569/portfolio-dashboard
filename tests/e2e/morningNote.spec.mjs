import { expect, test } from '@playwright/test'
import { maybeAcceptTradeDisclaimer } from './support/tradeHelpers.mjs'

const BASE_URL = String(process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3002/').trim()

function buildNoteResponse(note) {
  return {
    ok: true,
    marketDate: '2026-04-24',
    portfolioId: note.portfolioId || 'me',
    snapshotStatus: note.staleStatus || 'fresh',
    note,
  }
}

async function installDashboardBackgroundRoutes(page) {
  await page.route('**/api/event-calendar**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [] }),
    })
  })

  await page.route('**/api/twse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ msgArray: [] }),
    })
  })
}

async function expectMorningNoteVisible(page) {
  await expect(page.getByText('Morning Note')).toBeVisible({ timeout: 15000 })
}

async function selectPortfolioByLabel(page, labelPattern) {
  const select = page.getByTestId('portfolio-select').or(page.locator('select')).first()
  await expect(select).toBeVisible()

  const matchedValue = await select.evaluate((element, pattern) => {
    const matcher = new RegExp(pattern, 'i')
    const matched = Array.from(element.options).find((option) =>
      matcher.test(String(option.textContent || '').trim())
    )
    return matched?.value || ''
  }, String(labelPattern))

  expect(matchedValue).toBeTruthy()
  await select.selectOption(matchedValue)
}

test('dashboard shows pre-open morning note content and insider copy stays compliance-safe', async ({
  page,
}) => {
  await installDashboardBackgroundRoutes(page)
  await page.route('**/api/morning-note?**', async (route) => {
    const url = new URL(route.request().url())
    const portfolioId = String(url.searchParams.get('portfolioId') || 'me').trim()
    const portfolioName = String(url.searchParams.get('portfolioName') || '').trim()
    const viewMode = String(url.searchParams.get('viewMode') || '').trim()

    if (
      /^(7865|jinliancheng)$/i.test(portfolioId) ||
      /金聯成/i.test(portfolioName) ||
      /insider-compressed/i.test(viewMode)
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildNoteResponse({
            portfolioId: '7865',
            date: '2026/04/24',
            headline: '先看公開資訊節奏',
            summary: '今天先把公開資訊和風險節奏排好。',
            lead: '這份版本只保留公開資訊與待驗證事項，不做買賣語氣。',
            focusPoints: [
              {
                id: 'focus-1',
                tone: 'watch',
                title: '先看公司公告與法人公開資訊',
                body: '今天的節奏先以公開資訊面確認，不急著下結論。',
              },
            ],
            sections: {
              todayEvents: [],
              holdingStatus: [],
              watchlistAlerts: [],
              announcements: [],
            },
          })
        ),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildNoteResponse({
          portfolioId: 'me',
          date: '2026/04/24',
          headline: '今天先把節奏排好',
          summary: '08:30 後先看法說，再看主部位。',
          lead: '盤前先把最容易影響情緒的兩三件事放在前面。',
          focusPoints: [
            {
              id: 'focus-1',
              tone: 'watch',
              title: '台積電法說先放第一排',
              body: '今天的盤前節奏先被這件事定義。',
            },
          ],
          sections: {
            todayEvents: [
              {
                title: '台積電法說',
                date: '2026-04-24',
                impactLabel: 'HIGH',
              },
            ],
            holdingStatus: [],
            watchlistAlerts: [],
            announcements: [],
          },
        })
      ),
    })
  })

  await page.goto(BASE_URL)
  await maybeAcceptTradeDisclaimer(page)

  await expectMorningNoteVisible(page)
  await expect(page.getByTestId('morning-note-headline')).toContainText('今天先把節奏排好')
  await expect(page.getByTestId('morning-note-lead')).toContainText('08:30 後先看法說')

  await selectPortfolioByLabel(page, '7865|金聯成')

  await expect(page.getByTestId('morning-note-headline')).toContainText('先看公開資訊節奏')
  await expect(page.getByTestId('morning-note-lead')).not.toContainText(
    /買進|賣出|加碼|減碼|停損|出場/
  )
})

test('dashboard shows fallback copy instead of blank when today has no pre-open snapshot', async ({
  page,
}) => {
  await installDashboardBackgroundRoutes(page)
  await page.route('**/api/morning-note?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        marketDate: '2026-04-26',
        portfolioId: 'me',
        snapshotStatus: 'missing',
        note: {
          portfolioId: 'me',
          date: '2026/04/26',
          staleStatus: 'missing',
          fallbackMessage: '今日無 pre-open 更新 · 請等開盤 T1',
          sections: {
            todayEvents: [],
            holdingStatus: [],
            watchlistAlerts: [],
            announcements: [],
          },
        },
      }),
    })
  })

  await page.goto(BASE_URL)
  await maybeAcceptTradeDisclaimer(page)

  await expectMorningNoteVisible(page)
  await expect(page.getByTestId('morning-note-fallback')).toContainText(
    '今日無 pre-open 更新 · 請等開盤 T1'
  )
  await expect(page.getByTitle('morning note freshness')).toContainText('missing')
})

test('dashboard renders markdown morning note fields as real structure without raw tokens', async ({
  page,
}) => {
  await installDashboardBackgroundRoutes(page)
  await page.route('**/api/morning-note?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildNoteResponse({
          portfolioId: 'me',
          date: '2026/04/24',
          headline: '今天先把節奏排好',
          summary: '## 近期預測反思\n**本次建議** 先看法說。',
          lead: '| 代號 | 重點 |\n| --- | --- |\n| 2330 | 法說 |',
          focusPoints: [],
          sections: {
            todayEvents: [],
            holdingStatus: [],
            watchlistAlerts: [],
            announcements: [],
          },
        })
      ),
    })
  })

  await page.goto(BASE_URL)
  await maybeAcceptTradeDisclaimer(page)
  await expectMorningNoteVisible(page)

  const lead = page.getByTestId('morning-note-lead')

  await expect(lead.locator('h2')).toHaveText('近期預測反思')
  await expect(lead.locator('strong')).toHaveText('本次建議')
  await expect(lead.locator('table')).toBeVisible()
  await expect(lead).not.toContainText('## 近期預測反思')
  await expect(lead).not.toContainText('**本次建議**')
})
