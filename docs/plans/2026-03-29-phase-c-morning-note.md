# Phase C: Morning Note + 收尾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MOPS announcements API, build a morning note assembler from existing data, and add catalyst type filter tabs to EventsPanel.

**Architecture:** Three independent pieces: (1) `api/mops-announcements.js` — Vercel serverless function fetching 公開資訊觀測站 RSS with cache, (2) `src/lib/morningNoteBuilder.js` — pure function assembling holdings/events/thesis/institutional data into a structured morning note, (3) EventsPanel UI — add catalyst type filter tabs alongside existing type filter.

**Tech Stack:** Vercel serverless (Node), React (createElement), Vitest, existing cache lib

**Spec reference:** `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md` Section 4.3, 4.4

---

## File Structure

| Action | File                                    | Responsibility                                                  |
| ------ | --------------------------------------- | --------------------------------------------------------------- |
| Create | `api/mops-announcements.js`             | Vercel serverless: fetch 公開資訊觀測站 重大訊息, cache 30 min  |
| Create | `src/lib/morningNoteBuilder.js`         | Pure function: assemble morning note from existing data sources |
| Modify | `src/components/events/EventsPanel.jsx` | Add catalyst type filter tabs (全部/財報/公司/產業/總經/技術)   |
| Create | `tests/lib/morningNoteBuilder.test.js`  | Tests for morning note builder                                  |
| Modify | `src/lib/index.js`                      | Export morningNoteBuilder                                       |

---

### Task 1: MOPS Announcements API

**Files:**

- Create: `api/mops-announcements.js`

- [ ] **Step 1: Create the API endpoint**

Create `api/mops-announcements.js`:

```javascript
// Vercel Serverless Function — 公開資訊觀測站 重大訊息 API
// 來源：https://mops.twse.com.tw/
// 快取：30 分鐘

import { getCachedResponse, setCachedResponse } from './_lib/cache.js'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]

const ANNOUNCEMENT_TYPES = {
  營收: 'revenue',
  股利: 'dividend',
  配息: 'dividend',
  除權: 'dividend',
  除息: 'dividend',
  董事: 'corporate',
  股東: 'corporate',
  增資: 'corporate',
  併購: 'corporate',
  法說: 'conference',
  重訊: 'material',
}

function inferAnnouncementType(title) {
  for (const [keyword, type] of Object.entries(ANNOUNCEMENT_TYPES)) {
    if (title.includes(keyword)) return type
  }
  return 'other'
}

function parseAnnouncementRow(row) {
  // MOPS 重大訊息格式：公司代碼、公司名稱、時間、主旨
  const code = (row.code || '').trim()
  const name = (row.name || '').trim()
  const title = (row.title || '').trim()
  const time = (row.time || '').trim()
  if (!code || !title) return null
  return {
    code,
    name,
    type: inferAnnouncementType(title),
    title,
    time,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { date } = req.query

  if (!date || !/^\d{8}$/.test(date)) {
    return res.status(400).json({ error: '請提供日期參數，格式 YYYYMMDD' })
  }

  try {
    // 檢查快取（30 分鐘）
    const cacheKey = `mops-announcements-${date}`
    const cached = getCachedResponse(cacheKey)
    if (cached) {
      return res.status(200).json(cached)
    }

    // 隨機延遲（1-2秒，反爬蟲）
    const delay = 1000 + Math.floor(Math.random() * 1000)
    await new Promise((resolve) => setTimeout(resolve, delay))

    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

    // 公開資訊觀測站 重大訊息查詢
    const year = parseInt(date.slice(0, 4)) - 1911 // 民國年
    const month = date.slice(4, 6)
    const day = date.slice(6, 8)

    const url = `https://mops.twse.com.tw/mops/web/ajax_t05st01`
    const body = new URLSearchParams({
      encodeURIComponent: 1,
      step: 1,
      firstin: 1,
      off: 1,
      keyword4: '',
      code1: '',
      TYPEK2: '',
      checkbtn: '',
      queryName: 'co_id',
      inpuType: 'co_id',
      TYPEK: 'all',
      isnew: 'true',
      co_id: '',
      date1: `${year}/${month}/${day}`,
      date2: `${year}/${month}/${day}`,
      keyword3: '',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://mops.twse.com.tw/mops/web/t05st01',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return res.status(502).json({ error: `MOPS responded with ${response.status}` })
    }

    const html = await response.text()

    // 簡易 HTML 解析（找 <td> 中的文字）
    const announcements = []
    const rowRegex =
      /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi
    let match
    while ((match = rowRegex.exec(html)) !== null) {
      const raw = {
        code: match[1].replace(/<[^>]*>/g, '').trim(),
        name: match[2].replace(/<[^>]*>/g, '').trim(),
        time: match[3].replace(/<[^>]*>/g, '').trim(),
        title: match[4].replace(/<[^>]*>/g, '').trim(),
      }
      const parsed = parseAnnouncementRow(raw)
      if (parsed && /^\d{4,6}$/.test(parsed.code)) {
        announcements.push(parsed)
      }
    }

    const result = {
      date,
      announcements,
      fetchedAt: new Date().toISOString(),
    }

    // 快取 30 分鐘
    setCachedResponse(cacheKey, result, 30 * 60)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({
      error: '取得公開資訊觀測站資料失敗',
      message: err.message,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/mops-announcements.js
git commit -m "feat: add MOPS announcements API for 公開資訊觀測站 重大訊息"
```

---

### Task 2: Morning Note Builder + Tests

**Files:**

- Create: `src/lib/morningNoteBuilder.js`
- Create: `tests/lib/morningNoteBuilder.test.js`
- Modify: `src/lib/index.js`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/morningNoteBuilder.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import {
  buildTodayEvents,
  buildHoldingStatus,
  buildInstitutionalSummary,
  buildWatchlistAlerts,
  buildMorningNote,
  renderMorningNotePlainText,
} from '../../src/lib/morningNoteBuilder.js'

describe('buildTodayEvents', () => {
  it('filters events for today and formats with impact', () => {
    const events = [
      {
        title: '台積電3月營收公布',
        date: '2026/03/29',
        catalystType: 'earnings',
        impact: 'high',
        stocks: ['台積電 2330'],
      },
      {
        title: '昨天的事件',
        date: '2026/03/28',
        catalystType: 'corporate',
        impact: 'medium',
        stocks: ['台達電 2308'],
      },
      {
        title: '奇鋐法說會',
        date: '2026/03/29',
        catalystType: 'earnings',
        impact: 'medium',
        stocks: ['奇鋐 3017'],
      },
    ]
    const theses = [{ stockId: '2330', pillars: [{ id: 'p1', text: '月營收成長' }] }]
    const result = buildTodayEvents(events, theses, '2026/03/29')
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('台積電3月營收公布')
    expect(result[0].impactLabel).toBe('HIGH')
    expect(result[0].relatedPillars).toHaveLength(1)
  })

  it('returns empty array when no events for today', () => {
    const result = buildTodayEvents([], [], '2026/03/29')
    expect(result).toEqual([])
  })
})

describe('buildHoldingStatus', () => {
  it('formats holding with thesis scorecard summary', () => {
    const holdings = [{ code: '2330', name: '台積電', price: 1845, cost: 1700, qty: 1000 }]
    const theses = [
      {
        stockId: '2330',
        conviction: 'high',
        stopLoss: 1650,
        pillars: [{ status: 'on_track' }, { status: 'on_track' }, { status: 'watch' }],
      },
    ]
    const result = buildHoldingStatus(holdings, theses)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('2330')
    expect(result[0].conviction).toBe('high')
    expect(result[0].pillarSummary).toBe('2/3 on_track, 1 watch')
    expect(result[0].stopLossDistance).toBeCloseTo(10.57, 1)
  })

  it('handles holding without thesis', () => {
    const holdings = [{ code: '3017', name: '奇鋐', price: 498, cost: 450, qty: 500 }]
    const result = buildHoldingStatus(holdings, [])
    expect(result[0].conviction).toBeNull()
    expect(result[0].pillarSummary).toBe('')
  })
})

describe('buildInstitutionalSummary', () => {
  it('formats institutional flow data', () => {
    const institutional = {
      foreign: { buy: 1000000, sell: 800000, net: 200000 },
      investment: { buy: 500000, sell: 300000, net: 200000 },
      dealer: { buy: 100000, sell: 150000, net: -50000 },
    }
    const result = buildInstitutionalSummary(institutional)
    expect(result.foreign.net).toBe(200000)
    expect(result.investment.net).toBe(200000)
    expect(result.dealer.net).toBe(-50000)
  })

  it('returns null for missing data', () => {
    expect(buildInstitutionalSummary(null)).toBeNull()
    expect(buildInstitutionalSummary(undefined)).toBeNull()
  })
})

describe('buildWatchlistAlerts', () => {
  it('flags stocks near entry price', () => {
    const watchlist = [{ code: '3037', name: '欣興', entryPrice: 285, currentPrice: 290 }]
    const result = buildWatchlistAlerts(watchlist)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('3037')
    expect(result[0].nearEntry).toBe(true)
  })

  it('does not flag stocks far from entry', () => {
    const watchlist = [{ code: '3037', name: '欣興', entryPrice: 285, currentPrice: 350 }]
    const result = buildWatchlistAlerts(watchlist)
    expect(result).toHaveLength(0)
  })
})

describe('buildMorningNote', () => {
  it('assembles all sections', () => {
    const result = buildMorningNote({
      holdings: [{ code: '2330', name: '台積電', price: 1845, cost: 1700, qty: 1000 }],
      theses: [{ stockId: '2330', conviction: 'high', pillars: [], stopLoss: 1650 }],
      events: [],
      watchlist: [],
      institutional: null,
      announcements: [],
      today: '2026/03/29',
    })
    expect(result.date).toBe('2026/03/29')
    expect(result.sections).toHaveProperty('todayEvents')
    expect(result.sections).toHaveProperty('holdingStatus')
    expect(result.sections).toHaveProperty('institutional')
    expect(result.sections).toHaveProperty('watchlistAlerts')
    expect(result.sections).toHaveProperty('announcements')
  })
})

describe('renderMorningNotePlainText', () => {
  it('renders plain text output', () => {
    const note = {
      date: '2026/03/29',
      sections: {
        todayEvents: [{ title: '台積電3月營收公布', impactLabel: 'HIGH', relatedPillars: [] }],
        holdingStatus: [
          {
            code: '2330',
            name: '台積電',
            conviction: 'high',
            price: 1845,
            stopLossDistance: 10.57,
            pillarSummary: '3/3 on_track',
          },
        ],
        institutional: {
          foreign: { net: 200000 },
          investment: { net: 100000 },
          dealer: { net: -50000 },
        },
        watchlistAlerts: [],
        announcements: [{ code: '2308', name: '台達電', title: '董事會通過配息12元' }],
      },
    }
    const text = renderMorningNotePlainText(note)
    expect(text).toContain('每日交易備忘')
    expect(text).toContain('台積電3月營收公布')
    expect(text).toContain('台積電')
    expect(text).toContain('HIGH')
    expect(text).toContain('台達電')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/morningNoteBuilder.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement morningNoteBuilder.js**

Create `src/lib/morningNoteBuilder.js`:

```javascript
/**
 * Morning Note Builder — 每日交易備忘組裝器
 * 從現有資料源組裝結構化的每日備忘
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function todayFormatted() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const w = WEEKDAYS[d.getDay()]
  return `${y}/${m}/${day}（${w}）`
}

/**
 * Filter and format today's events with thesis pillar links
 */
export function buildTodayEvents(events, theses, today) {
  if (!Array.isArray(events)) return []
  const todayDate = today || new Date().toISOString().slice(0, 10).replace(/-/g, '/')

  return events
    .filter((e) => e.date === todayDate)
    .map((e) => {
      const stockCodes = (e.stocks || [])
        .map((s) => {
          const match = String(s).match(/\d{4,6}/)
          return match ? match[0] : null
        })
        .filter(Boolean)

      const relatedPillars = theses
        .filter((t) => stockCodes.includes(t.stockId))
        .flatMap((t) => (t.pillars || []).map((p) => ({ stockId: t.stockId, pillar: p })))

      const impactLabel = (e.impact || '').toUpperCase() || null

      return {
        title: e.title,
        date: e.date,
        catalystType: e.catalystType || null,
        impactLabel,
        stocks: stockCodes,
        relatedPillars,
      }
    })
}

/**
 * Format holding status with thesis scorecard summary
 */
export function buildHoldingStatus(holdings, theses) {
  if (!Array.isArray(holdings)) return []

  return holdings.map((h) => {
    const thesis = (theses || []).find((t) => t.stockId === h.code)
    const conviction = thesis?.conviction || null
    const stopLoss = thesis?.stopLoss ?? null
    const pillars = thesis?.pillars || []

    // Pillar summary: "2/3 on_track, 1 watch"
    let pillarSummary = ''
    if (pillars.length > 0) {
      const counts = {}
      pillars.forEach((p) => {
        const s = p.status || 'on_track'
        counts[s] = (counts[s] || 0) + 1
      })
      pillarSummary = Object.entries(counts)
        .map(
          ([status, count]) =>
            `${count}${count < pillars.length ? '/' + pillars.length : ''} ${status}`
        )
        .join(', ')
    }

    // Stop loss distance %
    const stopLossDistance = stopLoss && h.price ? ((h.price - stopLoss) / h.price) * 100 : null

    return {
      code: h.code,
      name: h.name,
      price: h.price,
      conviction,
      pillarSummary,
      stopLoss,
      stopLossDistance,
    }
  })
}

/**
 * Format institutional flow data
 */
export function buildInstitutionalSummary(institutional) {
  if (!institutional) return null
  return {
    foreign: institutional.foreign || null,
    investment: institutional.investment || null,
    dealer: institutional.dealer || null,
  }
}

/**
 * Find watchlist stocks near entry price (within 5%)
 */
export function buildWatchlistAlerts(watchlist, threshold = 5) {
  if (!Array.isArray(watchlist)) return []

  return watchlist
    .filter((w) => {
      if (!w.entryPrice || !w.currentPrice) return false
      const distance = ((w.currentPrice - w.entryPrice) / w.entryPrice) * 100
      return distance >= -threshold && distance <= threshold
    })
    .map((w) => ({
      code: w.code,
      name: w.name,
      entryPrice: w.entryPrice,
      currentPrice: w.currentPrice,
      distance: ((w.currentPrice - w.entryPrice) / w.entryPrice) * 100,
      nearEntry: true,
    }))
}

/**
 * Assemble complete morning note from all data sources
 */
export function buildMorningNote({
  holdings = [],
  theses = [],
  events = [],
  watchlist = [],
  institutional = null,
  announcements = [],
  today = null,
}) {
  const dateStr = today || new Date().toISOString().slice(0, 10).replace(/-/g, '/')

  return {
    date: dateStr,
    sections: {
      todayEvents: buildTodayEvents(events, theses, dateStr),
      holdingStatus: buildHoldingStatus(holdings, theses),
      institutional: buildInstitutionalSummary(institutional),
      watchlistAlerts: buildWatchlistAlerts(watchlist),
      announcements: announcements || [],
    },
  }
}

/**
 * Render morning note as plain text (for AI prompt or export)
 */
export function renderMorningNotePlainText(note) {
  if (!note) return ''
  const { date, sections } = note
  const lines = [`每日交易備忘 — ${date}`, '']

  // Today events
  if (sections.todayEvents?.length > 0) {
    lines.push('── 今日事件 ──')
    sections.todayEvents.forEach((e) => {
      const impact = e.impactLabel ? `[${e.impactLabel}]` : ''
      const pillarNote = e.relatedPillars?.length > 0 ? `（thesis pillar 驗證點）` : ''
      lines.push(`${impact} ${e.title}${pillarNote}`)
    })
    lines.push('')
  }

  // Holding status
  if (sections.holdingStatus?.length > 0) {
    lines.push('── 持倉狀態 ──')
    sections.holdingStatus.forEach((h) => {
      const conv = h.conviction ? `conviction:${h.conviction.toUpperCase()}` : ''
      const stop = h.stopLossDistance != null ? `距停損 +${h.stopLossDistance.toFixed(1)}%` : ''
      const pillars = h.pillarSummary || ''
      lines.push(`${h.name}  ${conv}  昨收 ${h.price}  ${stop}  ${pillars}`.trim())
    })
    lines.push('')
  }

  // Institutional
  if (sections.institutional) {
    lines.push('── 法人動態 ──')
    const inst = sections.institutional
    if (inst.foreign) lines.push(`外資 淨買超 ${inst.foreign.net?.toLocaleString() || 0}`)
    if (inst.investment) lines.push(`投信 淨買超 ${inst.investment.net?.toLocaleString() || 0}`)
    if (inst.dealer) lines.push(`自營 淨買超 ${inst.dealer.net?.toLocaleString() || 0}`)
    lines.push('')
  }

  // Watchlist alerts
  if (sections.watchlistAlerts?.length > 0) {
    lines.push('── 觀察股提示 ──')
    sections.watchlistAlerts.forEach((w) => {
      lines.push(`${w.name}(${w.code}) 接近進場價 ${w.entryPrice}（目前 ${w.currentPrice}）`)
    })
    lines.push('')
  }

  // Announcements
  if (sections.announcements?.length > 0) {
    lines.push('── 重大訊息 ──')
    sections.announcements.forEach((a) => {
      lines.push(`${a.code} ${a.name}：${a.title}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Add export to src/lib/index.js**

Add this line to `src/lib/index.js`:

```javascript
export * from './morningNoteBuilder.js'
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/lib/morningNoteBuilder.test.js`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/morningNoteBuilder.js tests/lib/morningNoteBuilder.test.js src/lib/index.js
git commit -m "feat: add morning note builder for daily trading memo assembly"
```

---

### Task 3: EventsPanel Catalyst Type Filter Tabs

**Files:**

- Modify: `src/components/events/EventsPanel.jsx`

- [ ] **Step 1: Add catalyst type filter alongside existing filter**

The EventsPanel currently has a `TYPE_COLOR` map for event types (法說, 財報, 營收, etc.) and an `EventsFilter` component. We need to add a second row of filter buttons for catalyst types.

Add a new constant after the existing `TYPE_COLOR`:

```javascript
const CATALYST_LABELS = {
  earnings: '財報',
  corporate: '公司',
  industry: '產業',
  macro: '總經',
  technical: '技術',
}

const CATALYST_COLOR = {
  earnings: C.up,
  corporate: C.teal,
  industry: C.olive,
  macro: C.lavender,
  technical: C.amber,
}

const IMPACT_COLOR = {
  high: C.up,
  medium: C.amber,
  low: C.textMute,
}
```

- [ ] **Step 2: Add CatalystFilter component**

Add after the existing `EventsFilter` component:

```javascript
/**
 * Catalyst Type Filter Buttons
 */
export function CatalystFilter({ catalystFilter, setCatalystFilter }) {
  return h(
    'div',
    { style: { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 } },
    ['全部', ...Object.keys(CATALYST_LABELS)].map((t) =>
      h(
        Button,
        {
          key: t,
          onClick: () => setCatalystFilter(t),
          style: {
            background: catalystFilter === t ? C.subtleElev : 'transparent',
            color:
              catalystFilter === t
                ? C.text
                : t === '全部'
                  ? C.textMute
                  : CATALYST_COLOR[t] || C.textMute,
            border: `1px solid ${catalystFilter === t ? C.borderStrong : C.border}`,
            borderRadius: 20,
            padding: '3px 11px',
            fontSize: 10,
            fontWeight: 500,
            cursor: 'pointer',
          },
        },
        t === '全部' ? '全部分類' : CATALYST_LABELS[t]
      )
    )
  )
}
```

- [ ] **Step 3: Add impact badge to EventCard**

Modify the `EventCard` component to show an impact badge when the event has `catalystType` or `impact` data. Find the closing of the type badge element and add an impact indicator:

After the existing type badge `h('div', { style: {...} }, event.type)`, add:

```javascript
        event.impact &&
          h(
            'div',
            {
              style: {
                fontSize: 8,
                fontWeight: 600,
                padding: '1px 4px',
                borderRadius: 3,
                background: alpha(IMPACT_COLOR[event.impact] || C.textMute, '15'),
                color: IMPACT_COLOR[event.impact] || C.textMute,
                textAlign: 'center',
              },
            },
            event.impact.toUpperCase()
          ),
```

- [ ] **Step 4: Update EventsPanel to accept catalyst filter props**

Update the `EventsPanel` component signature and add the CatalystFilter:

```javascript
export function EventsPanel({
  showRelayPlan,
  relayPlanExpanded,
  setRelayPlanExpanded,
  filterType,
  setFilterType,
  filteredEvents,
  catalystFilter,
  setCatalystFilter,
}) {
  return h(
    'div',
    null,
    // Relay Plan
    showRelayPlan &&
      h(RelayPlanCard, {
        expanded: relayPlanExpanded,
        onToggle: () => setRelayPlanExpanded((v) => !v),
      }),

    // Type filter buttons
    h(EventsFilter, { filterType, setFilterType }),

    // Catalyst type filter buttons
    setCatalystFilter && h(CatalystFilter, { catalystFilter, setCatalystFilter }),

    // Events list
    filteredEvents.map((e, i) => h(EventCard, { key: i, event: e }))
  )
}
```

Note: `setCatalystFilter` is conditionally rendered — if the parent doesn't pass it, the catalyst filter row is hidden. This makes it backward compatible.

- [ ] **Step 5: Run lint**

Run: `npx eslint src/components/events/EventsPanel.jsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/events/EventsPanel.jsx
git commit -m "feat: add catalyst type filter tabs and impact badges to EventsPanel"
```

---

### Task 4: Full Integration Verification

**Files:**

- No new files — verification only

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS, 0 failures

- [ ] **Step 2: Run lint on all changed files**

Run: `npx eslint src/lib/morningNoteBuilder.js src/components/events/EventsPanel.jsx api/mops-announcements.js src/lib/index.js`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "chore: Phase C integration verification — lint + build clean"
```
