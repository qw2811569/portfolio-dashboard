# Phase B: Workflow Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade thesis tracking from flat list to scorecard with pillars/risks/conviction, and add catalyst type classification to events — both with full backward compatibility.

**Architecture:** Two independent upgrades sharing the same normalize-on-read pattern. Thesis Scorecard adds `pillars`, `risks`, `conviction`, `updateLog` fields with a `normalizeThesis()` function that migrates old format on read. Catalyst Calendar adds `catalystType`, `impact`, `relatedThesisIds` fields to events with `inferCatalystType()` auto-classification. Dossier context is extended to include thesis scorecard summary.

**Tech Stack:** React hooks, Vitest, localStorage persistence, existing constants/seedData patterns

**Spec reference:** `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md` Section 4 (Track B)

---

## File Structure

| Action | File                                       | Responsibility                                                                                                                                 |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `src/constants.js`                         | Add `DEFAULT_THESIS_PILLAR`, `DEFAULT_THESIS_RISK`, `CATALYST_TYPES`, `IMPACT_LEVELS` constants                                                |
| Modify | `src/hooks/useThesisTracking.js`           | Add `normalizeThesis()`, upgrade `addThesis`/`updateThesis`, add `addPillar`/`updatePillar`/`addRisk`/`toggleRisk`/`addUpdateLogEntry` methods |
| Modify | `src/lib/eventUtils.js`                    | Add `inferCatalystType()`, `inferImpact()`, integrate into `normalizeEventRecord()`                                                            |
| Modify | `src/lib/dossierUtils.js`                  | Add `buildThesisScorecardContext()`, integrate into daily dossier                                                                              |
| Create | `tests/hooks/useThesisTracking.test.jsx`   | Tests for normalize + scorecard methods                                                                                                        |
| Create | `tests/lib/catalystType.test.js`           | Tests for `inferCatalystType()` and event normalization                                                                                        |
| Create | `tests/lib/dossierThesisScorecard.test.js` | Tests for thesis scorecard in dossier context                                                                                                  |

---

### Task 1: Thesis Scorecard Constants

**Files:**

- Modify: `src/constants.js:110-121`

- [ ] **Step 1: Add thesis scorecard constants**

Add the following after the existing `DEFAULT_THESIS` block (line 121) in `src/constants.js`:

```javascript
export const DEFAULT_THESIS_PILLAR = {
  id: null,
  text: '',
  status: 'on_track', // on_track / watch / behind / broken
  trend: 'stable', // up / stable / down
  lastChecked: null,
}

export const DEFAULT_THESIS_RISK = {
  id: null,
  text: '',
  triggered: false,
}

export const PILLAR_STATUSES = ['on_track', 'watch', 'behind', 'broken']
export const PILLAR_TRENDS = ['up', 'stable', 'down']
export const CONVICTION_LEVELS = ['high', 'medium', 'low']
export const UPDATE_LOG_IMPACTS = ['strengthen', 'weaken', 'neutral']
export const UPDATE_LOG_ACTIONS = ['hold', 'add', 'trim', 'exit']
```

- [ ] **Step 2: Add catalyst type constants**

Add the following after the thesis constants:

```javascript
export const CATALYST_TYPES = ['earnings', 'corporate', 'industry', 'macro', 'technical']
export const IMPACT_LEVELS = ['high', 'medium', 'low']
```

- [ ] **Step 3: Commit**

```bash
git add src/constants.js
git commit -m "feat: add thesis scorecard and catalyst type constants"
```

---

### Task 2: Thesis Normalize Function + Tests

**Files:**

- Modify: `src/hooks/useThesisTracking.js:1-18`
- Create: `tests/hooks/useThesisTracking.test.jsx`

- [ ] **Step 1: Write failing tests for normalizeThesis**

Create `tests/hooks/useThesisTracking.test.jsx`:

```javascript
import { describe, it, expect } from 'vitest'
import { normalizeThesis } from '../../src/hooks/useThesisTracking.js'

describe('normalizeThesis', () => {
  it('passes through a fully upgraded thesis unchanged', () => {
    const full = {
      id: 'thesis-001',
      stockId: '2330',
      status: 'active',
      createdAt: '2026/01/01',
      updatedAt: '2026/03/28',
      direction: 'long',
      statement: 'AI demand drives CoWoS',
      reason: '',
      expectation: 'Q1 EPS +20%',
      invalidation: '',
      pillars: [
        {
          id: 'p1',
          text: 'Revenue growth',
          status: 'on_track',
          trend: 'up',
          lastChecked: '2026/03/28',
        },
      ],
      risks: [{ id: 'r1', text: 'NVIDIA轉單', triggered: false }],
      conviction: 'high',
      targetPrice: 2200,
      stopLoss: 1650,
      stopLossPercent: 10,
      updateLog: [],
      reviewHistory: [],
    }
    const result = normalizeThesis(full)
    expect(result.statement).toBe('AI demand drives CoWoS')
    expect(result.direction).toBe('long')
    expect(result.pillars).toHaveLength(1)
    expect(result.risks).toHaveLength(1)
    expect(result.conviction).toBe('high')
  })

  it('migrates old format: reason → statement fallback', () => {
    const old = {
      id: 'thesis-old',
      stockId: '3017',
      status: 'active',
      reason: 'AI server demand strong',
      expectation: 'Q1 EPS growth',
      invalidation: '月營收轉負',
      targetPrice: 600,
      stopLossPercent: 10,
    }
    const result = normalizeThesis(old)
    expect(result.statement).toBe('AI server demand strong')
    expect(result.direction).toBe('long')
    expect(result.pillars).toEqual([])
    expect(result.risks).toEqual([{ id: 'r-migrated-0', text: '月營收轉負', triggered: false }])
    expect(result.conviction).toBe('medium')
    expect(result.updateLog).toEqual([])
    expect(result.stopLoss).toBeNull()
  })

  it('does not overwrite statement with reason if statement exists', () => {
    const mixed = {
      id: 'thesis-mix',
      stockId: '2308',
      statement: 'Real statement',
      reason: 'Old reason',
      invalidation: '',
    }
    const result = normalizeThesis(mixed)
    expect(result.statement).toBe('Real statement')
  })

  it('returns null for invalid input', () => {
    expect(normalizeThesis(null)).toBeNull()
    expect(normalizeThesis(undefined)).toBeNull()
    expect(normalizeThesis('string')).toBeNull()
  })

  it('normalizes invalid conviction to medium', () => {
    const thesis = { id: 't1', stockId: '2330', conviction: 'extreme' }
    expect(normalizeThesis(thesis).conviction).toBe('medium')
  })

  it('normalizes pillar with invalid status to on_track', () => {
    const thesis = {
      id: 't1',
      stockId: '2330',
      pillars: [{ id: 'p1', text: 'test', status: 'invalid', trend: 'up' }],
    }
    const result = normalizeThesis(thesis)
    expect(result.pillars[0].status).toBe('on_track')
    expect(result.pillars[0].trend).toBe('up')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/hooks/useThesisTracking.test.jsx`
Expected: FAIL — `normalizeThesis` is not exported

- [ ] **Step 3: Implement normalizeThesis**

Add the following to `src/hooks/useThesisTracking.js`, after the existing imports (line 2), before `readThesisFromStorage`:

```javascript
import {
  DEFAULT_THESIS_PILLAR,
  DEFAULT_THESIS_RISK,
  PILLAR_STATUSES,
  PILLAR_TRENDS,
  CONVICTION_LEVELS,
} from '../constants.js'
```

Add the `normalizeThesis` function before `readThesisFromStorage`:

```javascript
/**
 * Normalize a thesis record — migrates old format on read
 */
export function normalizeThesis(thesis) {
  if (!thesis || typeof thesis !== 'object') return null

  const statement = thesis.statement || thesis.reason || ''
  const direction = thesis.direction === 'short' ? 'short' : 'long'
  const conviction = CONVICTION_LEVELS.includes(thesis.conviction) ? thesis.conviction : 'medium'

  const pillars = Array.isArray(thesis.pillars)
    ? thesis.pillars.map((p) => ({
        ...DEFAULT_THESIS_PILLAR,
        ...p,
        status: PILLAR_STATUSES.includes(p?.status) ? p.status : 'on_track',
        trend: PILLAR_TRENDS.includes(p?.trend) ? p.trend : 'stable',
      }))
    : []

  // Migrate old invalidation string → single risk item
  let risks = []
  if (Array.isArray(thesis.risks)) {
    risks = thesis.risks.map((r) => ({ ...DEFAULT_THESIS_RISK, ...r }))
  } else if (typeof thesis.invalidation === 'string' && thesis.invalidation.trim()) {
    risks = [{ id: 'r-migrated-0', text: thesis.invalidation.trim(), triggered: false }]
  }

  return {
    id: thesis.id || null,
    stockId: thesis.stockId || null,
    status: thesis.status || 'active',
    createdAt: thesis.createdAt || null,
    updatedAt: thesis.updatedAt || null,
    direction,
    statement,
    reason: thesis.reason || '',
    expectation: thesis.expectation || '',
    invalidation: thesis.invalidation || '',
    pillars,
    risks,
    conviction,
    targetPrice: thesis.targetPrice ?? null,
    stopLoss: thesis.stopLoss ?? null,
    stopLossPercent: thesis.stopLossPercent ?? null,
    updateLog: Array.isArray(thesis.updateLog) ? thesis.updateLog : [],
    reviewHistory: Array.isArray(thesis.reviewHistory) ? thesis.reviewHistory : [],
  }
}
```

- [ ] **Step 4: Update readThesisFromStorage to normalize**

Replace the existing `readThesisFromStorage` function:

```javascript
function readThesisFromStorage(portfolioId = OWNER_PORTFOLIO_ID) {
  try {
    const key = `${STORAGE_KEYS.THESIS}-${portfolioId}`
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(normalizeThesis).filter(Boolean) : []
  } catch {
    return []
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/hooks/useThesisTracking.test.jsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useThesisTracking.js src/constants.js tests/hooks/useThesisTracking.test.jsx
git commit -m "feat: add normalizeThesis with backward-compatible migration"
```

---

### Task 3: Thesis Scorecard Methods

**Files:**

- Modify: `src/hooks/useThesisTracking.js:40-222` (the hook function)
- Modify: `tests/hooks/useThesisTracking.test.jsx`

- [ ] **Step 1: Write failing tests for scorecard methods**

Append to `tests/hooks/useThesisTracking.test.jsx`:

```javascript
import { renderHook, act } from '@testing-library/react'
import { useThesisTracking } from '../../src/hooks/useThesisTracking.js'

describe('useThesisTracking scorecard methods', () => {
  beforeEach(() => {
    localStorage.getItem.mockReturnValue(null)
    localStorage.setItem.mockClear()
  })

  it('addPillar adds a pillar to a thesis', async () => {
    const { result } = renderHook(() => useThesisTracking())

    // Add a thesis first
    await act(async () => {
      await result.current.addThesis({ stockId: '2330', reason: 'test' })
    })

    const thesisId = result.current.theses[0].id

    await act(async () => {
      await result.current.addPillar(thesisId, { text: '月營收成長 >20%' })
    })

    const thesis = result.current.theses.find((t) => t.id === thesisId)
    expect(thesis.pillars).toHaveLength(1)
    expect(thesis.pillars[0].text).toBe('月營收成長 >20%')
    expect(thesis.pillars[0].status).toBe('on_track')
    expect(thesis.pillars[0].id).toBeTruthy()
  })

  it('updatePillar updates status and trend', async () => {
    const { result } = renderHook(() => useThesisTracking())

    await act(async () => {
      await result.current.addThesis({
        stockId: '2330',
        reason: 'test',
        pillars: [
          {
            id: 'p1',
            text: 'Revenue growth',
            status: 'on_track',
            trend: 'stable',
            lastChecked: null,
          },
        ],
      })
    })

    const thesisId = result.current.theses[0].id

    await act(async () => {
      await result.current.updatePillar(thesisId, 'p1', { status: 'watch', trend: 'down' })
    })

    const pillar = result.current.theses[0].pillars[0]
    expect(pillar.status).toBe('watch')
    expect(pillar.trend).toBe('down')
    expect(pillar.lastChecked).toBeTruthy()
  })

  it('addRisk adds a risk to a thesis', async () => {
    const { result } = renderHook(() => useThesisTracking())

    await act(async () => {
      await result.current.addThesis({ stockId: '2330', reason: 'test' })
    })

    const thesisId = result.current.theses[0].id

    await act(async () => {
      await result.current.addRisk(thesisId, { text: 'NVIDIA轉單三星' })
    })

    const thesis = result.current.theses.find((t) => t.id === thesisId)
    expect(thesis.risks).toHaveLength(1)
    expect(thesis.risks[0].text).toBe('NVIDIA轉單三星')
    expect(thesis.risks[0].triggered).toBe(false)
  })

  it('toggleRisk flips triggered state', async () => {
    const { result } = renderHook(() => useThesisTracking())

    await act(async () => {
      await result.current.addThesis({
        stockId: '2330',
        reason: 'test',
        risks: [{ id: 'r1', text: 'Risk one', triggered: false }],
      })
    })

    const thesisId = result.current.theses[0].id

    await act(async () => {
      await result.current.toggleRisk(thesisId, 'r1')
    })

    expect(result.current.theses[0].risks[0].triggered).toBe(true)

    await act(async () => {
      await result.current.toggleRisk(thesisId, 'r1')
    })

    expect(result.current.theses[0].risks[0].triggered).toBe(false)
  })

  it('addUpdateLogEntry appends to updateLog', async () => {
    const { result } = renderHook(() => useThesisTracking())

    await act(async () => {
      await result.current.addThesis({ stockId: '2330', reason: 'test' })
    })

    const thesisId = result.current.theses[0].id

    await act(async () => {
      await result.current.addUpdateLogEntry(thesisId, {
        event: 'Q4法說會展望正面',
        impact: 'strengthen',
        pillarId: null,
        action: 'hold',
        note: 'N5/N3 產能利用率維持高檔',
      })
    })

    const thesis = result.current.theses.find((t) => t.id === thesisId)
    expect(thesis.updateLog).toHaveLength(1)
    expect(thesis.updateLog[0].event).toBe('Q4法說會展望正面')
    expect(thesis.updateLog[0].impact).toBe('strengthen')
    expect(thesis.updateLog[0].date).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/hooks/useThesisTracking.test.jsx`
Expected: FAIL — `addPillar`, `updatePillar`, `addRisk`, `toggleRisk`, `addUpdateLogEntry` not defined

- [ ] **Step 3: Implement scorecard methods in useThesisTracking**

Add the following methods inside the `useThesisTracking` hook, after the existing `addReview` callback (line 134):

```javascript
/**
 * Add a pillar to a thesis
 */
const addPillar = useCallback(
  async (thesisId, pillar) => {
    const newPillar = {
      ...DEFAULT_THESIS_PILLAR,
      id: `p-${Date.now()}`,
      lastChecked: new Date().toISOString().slice(0, 10),
      ...pillar,
    }
    const updated = theses.map((t) => {
      if (t.id === thesisId) {
        return {
          ...t,
          pillars: [...(t.pillars || []), newPillar],
          updatedAt: new Date().toISOString(),
        }
      }
      return t
    })
    setTheses(updated)
    saveThesisToStorage(updated, portfolioId)
    return { success: true, pillar: newPillar }
  },
  [theses, portfolioId]
)

/**
 * Update a pillar's status/trend
 */
const updatePillar = useCallback(
  async (thesisId, pillarId, updates) => {
    const updated = theses.map((t) => {
      if (t.id === thesisId) {
        return {
          ...t,
          updatedAt: new Date().toISOString(),
          pillars: (t.pillars || []).map((p) =>
            p.id === pillarId
              ? { ...p, ...updates, lastChecked: new Date().toISOString().slice(0, 10) }
              : p
          ),
        }
      }
      return t
    })
    setTheses(updated)
    saveThesisToStorage(updated, portfolioId)
    return { success: true }
  },
  [theses, portfolioId]
)

/**
 * Add a risk to a thesis
 */
const addRisk = useCallback(
  async (thesisId, risk) => {
    const newRisk = {
      ...DEFAULT_THESIS_RISK,
      id: `r-${Date.now()}`,
      ...risk,
    }
    const updated = theses.map((t) => {
      if (t.id === thesisId) {
        return { ...t, risks: [...(t.risks || []), newRisk], updatedAt: new Date().toISOString() }
      }
      return t
    })
    setTheses(updated)
    saveThesisToStorage(updated, portfolioId)
    return { success: true, risk: newRisk }
  },
  [theses, portfolioId]
)

/**
 * Toggle a risk's triggered state
 */
const toggleRisk = useCallback(
  async (thesisId, riskId) => {
    const updated = theses.map((t) => {
      if (t.id === thesisId) {
        return {
          ...t,
          updatedAt: new Date().toISOString(),
          risks: (t.risks || []).map((r) =>
            r.id === riskId ? { ...r, triggered: !r.triggered } : r
          ),
        }
      }
      return t
    })
    setTheses(updated)
    saveThesisToStorage(updated, portfolioId)
    return { success: true }
  },
  [theses, portfolioId]
)

/**
 * Add an update log entry to a thesis
 */
const addUpdateLogEntry = useCallback(
  async (thesisId, entry) => {
    const logEntry = {
      date: new Date().toISOString().slice(0, 10),
      event: '',
      impact: 'neutral',
      pillarId: null,
      action: 'hold',
      note: '',
      ...entry,
    }
    const updated = theses.map((t) => {
      if (t.id === thesisId) {
        return {
          ...t,
          updatedAt: new Date().toISOString(),
          updateLog: [...(t.updateLog || []), logEntry],
        }
      }
      return t
    })
    setTheses(updated)
    saveThesisToStorage(updated, portfolioId)
    return { success: true }
  },
  [theses, portfolioId]
)
```

- [ ] **Step 4: Update the return object**

Update the return statement of `useThesisTracking` to include the new methods:

```javascript
return {
  // State
  theses,
  loading,
  activeTheses,

  // Methods
  addThesis,
  updateThesis,
  removeThesis,
  addReview,
  getThesisByStock,
  getThesesNeedingReview,
  checkInvalidationSignals,

  // Scorecard methods
  addPillar,
  updatePillar,
  addRisk,
  toggleRisk,
  addUpdateLogEntry,
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/hooks/useThesisTracking.test.jsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useThesisTracking.js tests/hooks/useThesisTracking.test.jsx
git commit -m "feat: add thesis scorecard methods (pillar, risk, updateLog)"
```

---

### Task 4: Catalyst Type Inference + Tests

**Files:**

- Modify: `src/lib/eventUtils.js`
- Create: `tests/lib/catalystType.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/catalystType.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { inferCatalystType, inferImpact } from '../../src/lib/eventUtils.js'

describe('inferCatalystType', () => {
  it('detects earnings events', () => {
    expect(inferCatalystType({ title: '台積電3月營收公布' })).toBe('earnings')
    expect(inferCatalystType({ title: 'Q4財報發布' })).toBe('earnings')
    expect(inferCatalystType({ title: '法說會' })).toBe('earnings')
    expect(inferCatalystType({ title: '季報公告' })).toBe('earnings')
    expect(inferCatalystType({ title: 'EPS超預期' })).toBe('earnings')
    expect(inferCatalystType({ title: '年報' })).toBe('earnings')
  })

  it('detects corporate events', () => {
    expect(inferCatalystType({ title: '董事會通過配息' })).toBe('corporate')
    expect(inferCatalystType({ title: '庫藏股買回' })).toBe('corporate')
    expect(inferCatalystType({ title: '除權除息' })).toBe('corporate')
    expect(inferCatalystType({ title: '併購案公告' })).toBe('corporate')
    expect(inferCatalystType({ title: '現金增資' })).toBe('corporate')
  })

  it('detects industry events', () => {
    expect(inferCatalystType({ title: 'CoWoS產能擴張' })).toBe('industry')
    expect(inferCatalystType({ title: 'AI伺服器訂單增加' })).toBe('industry')
    expect(inferCatalystType({ title: '供應鏈調整' })).toBe('industry')
    expect(inferCatalystType({ title: '新製程量產' })).toBe('industry')
  })

  it('detects macro events', () => {
    expect(inferCatalystType({ title: 'Fed升息' })).toBe('macro')
    expect(inferCatalystType({ title: '央行利率決策' })).toBe('macro')
    expect(inferCatalystType({ title: 'CPI數據公布' })).toBe('macro')
    expect(inferCatalystType({ title: '關稅政策變動' })).toBe('macro')
    expect(inferCatalystType({ title: '匯率波動' })).toBe('macro')
    expect(inferCatalystType({ title: 'GDP成長率' })).toBe('macro')
  })

  it('detects technical events', () => {
    expect(inferCatalystType({ title: '外資連續買超' })).toBe('technical')
    expect(inferCatalystType({ title: '融資餘額大增' })).toBe('technical')
    expect(inferCatalystType({ title: '成交量暴增' })).toBe('technical')
    expect(inferCatalystType({ title: '突破前高' })).toBe('technical')
  })

  it('returns null for unclassifiable events', () => {
    expect(inferCatalystType({ title: '今天天氣不錯' })).toBeNull()
    expect(inferCatalystType({ title: '' })).toBeNull()
    expect(inferCatalystType({})).toBeNull()
  })
})

describe('inferImpact', () => {
  it('returns high for earnings type', () => {
    expect(inferImpact({ catalystType: 'earnings' })).toBe('high')
  })

  it('returns medium for corporate type', () => {
    expect(inferImpact({ catalystType: 'corporate' })).toBe('medium')
  })

  it('returns medium for industry type', () => {
    expect(inferImpact({ catalystType: 'industry' })).toBe('medium')
  })

  it('returns medium for macro type', () => {
    expect(inferImpact({ catalystType: 'macro' })).toBe('medium')
  })

  it('returns low for technical type', () => {
    expect(inferImpact({ catalystType: 'technical' })).toBe('low')
  })

  it('returns null for unknown type', () => {
    expect(inferImpact({ catalystType: null })).toBeNull()
    expect(inferImpact({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/catalystType.test.js`
Expected: FAIL — `inferCatalystType` and `inferImpact` not exported

- [ ] **Step 3: Implement inferCatalystType and inferImpact**

Add the following functions to `src/lib/eventUtils.js`, before the `normalizeEventRecord` function:

```javascript
/**
 * Infer catalyst type from event title text
 * @returns {'earnings'|'corporate'|'industry'|'macro'|'technical'|null}
 */
export function inferCatalystType(event) {
  const text = (event?.title || '').toLowerCase()
  if (!text) return null
  if (/營收|財報|eps|法說|季報|年報/.test(text)) return 'earnings'
  if (/併購|增資|庫藏|董事|除權|除息/.test(text)) return 'corporate'
  if (/產能|訂單|供應鏈|技術|製程/.test(text)) return 'industry'
  if (/fed|利率|gdp|cpi|央行|匯率|關稅/.test(text)) return 'macro'
  if (/外資|融資|融券|成交量|突破|跌破/.test(text)) return 'technical'
  return null
}

/**
 * Infer impact level from catalyst type
 * @returns {'high'|'medium'|'low'|null}
 */
export function inferImpact(event) {
  const type = event?.catalystType
  if (!type) return null
  if (type === 'earnings') return 'high'
  if (type === 'technical') return 'low'
  return 'medium'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/catalystType.test.js`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventUtils.js tests/lib/catalystType.test.js
git commit -m "feat: add inferCatalystType and inferImpact for catalyst classification"
```

---

### Task 5: Integrate Catalyst Fields into normalizeEventRecord

**Files:**

- Modify: `src/lib/eventUtils.js` (the `normalizeEventRecord` function)
- Modify: `tests/lib/catalystType.test.js`

- [ ] **Step 1: Write failing tests for catalyst fields in normalizeEventRecord**

Append to `tests/lib/catalystType.test.js`:

```javascript
import { normalizeEventRecord } from '../../src/lib/eventUtils.js'

describe('normalizeEventRecord catalyst fields', () => {
  const baseEvent = {
    id: 'evt-1',
    title: '台積電3月營收公布',
    date: '2026/03/28',
    stocks: ['台積電 2330'],
    pred: 'up',
    status: 'pending',
  }

  it('auto-infers catalystType from title', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.catalystType).toBe('earnings')
  })

  it('auto-infers impact from catalystType', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.impact).toBe('high')
  })

  it('preserves explicit catalystType over inference', () => {
    const result = normalizeEventRecord({ ...baseEvent, catalystType: 'corporate' })
    expect(result.catalystType).toBe('corporate')
  })

  it('preserves explicit impact over inference', () => {
    const result = normalizeEventRecord({ ...baseEvent, impact: 'low' })
    expect(result.impact).toBe('low')
  })

  it('defaults relatedThesisIds to empty array', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.relatedThesisIds).toEqual([])
  })

  it('preserves provided relatedThesisIds', () => {
    const result = normalizeEventRecord({ ...baseEvent, relatedThesisIds: ['thesis-2330-001'] })
    expect(result.relatedThesisIds).toEqual(['thesis-2330-001'])
  })

  it('defaults pillarImpact to null', () => {
    const result = normalizeEventRecord(baseEvent)
    expect(result.pillarImpact).toBeNull()
  })

  it('sets catalystType to null for unclassifiable events', () => {
    const result = normalizeEventRecord({ ...baseEvent, title: '今天天氣不錯' })
    expect(result.catalystType).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/catalystType.test.js`
Expected: FAIL — `catalystType`, `impact`, `relatedThesisIds`, `pillarImpact` not present in result

- [ ] **Step 3: Modify normalizeEventRecord to include catalyst fields**

In `src/lib/eventUtils.js`, inside the `normalizeEventRecord` function, find the return statement (`return { ...event,`) and add the catalyst fields. The return object should include these new fields:

```javascript
// Add these lines before the final return in normalizeEventRecord
const catalystType = event.catalystType || inferCatalystType(event)
const impact = event.impact || inferImpact({ catalystType })

return {
  ...event,
  status,
  stocks: buildEventStockDescriptors(event).map((item) => `${item.name} ${item.code}`),
  eventDate,
  trackingStart,
  exitDate,
  priceAtEvent,
  priceAtExit,
  priceHistory: normalizePriceHistory(event.priceHistory, event),
  actual: actual || null,
  actualNote: event.actualNote || '',
  stockOutcomes,
  correct: typeof event.correct === 'boolean' ? event.correct : null,
  lessons: event.lessons || '',
  reviewDate,
  // Catalyst fields (backward compatible — old events get null/[])
  catalystType: catalystType || null,
  impact: impact || null,
  relatedThesisIds: Array.isArray(event.relatedThesisIds) ? event.relatedThesisIds : [],
  pillarImpact: event.pillarImpact || null,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/catalystType.test.js`
Expected: ALL PASS

- [ ] **Step 5: Run all existing event tests to check no regression**

Run: `npx vitest run tests/stores/event.test.js tests/lib/eventReviewRuntime.test.js`
Expected: ALL PASS (no regression)

- [ ] **Step 6: Commit**

```bash
git add src/lib/eventUtils.js tests/lib/catalystType.test.js
git commit -m "feat: integrate catalyst type and impact into normalizeEventRecord"
```

---

### Task 6: Thesis Scorecard Context in Dossier

**Files:**

- Modify: `src/lib/dossierUtils.js`
- Create: `tests/lib/dossierThesisScorecard.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/dossierThesisScorecard.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { buildThesisScorecardContext } from '../../src/lib/dossierUtils.js'

describe('buildThesisScorecardContext', () => {
  it('builds scorecard text from a full thesis', () => {
    const thesis = {
      statement: 'AI demand drives CoWoS',
      direction: 'long',
      conviction: 'high',
      pillars: [
        { id: 'p1', text: '月營收成長 >20%', status: 'on_track', trend: 'up' },
        { id: 'p2', text: 'CoWoS產能擴張', status: 'watch', trend: 'stable' },
      ],
      risks: [
        { id: 'r1', text: 'NVIDIA轉單', triggered: false },
        { id: 'r2', text: '月營收轉負', triggered: true },
      ],
      targetPrice: 2200,
      stopLoss: 1650,
    }

    const text = buildThesisScorecardContext(thesis)
    expect(text).toContain('AI demand drives CoWoS')
    expect(text).toContain('high')
    expect(text).toContain('月營收成長 >20%')
    expect(text).toContain('on_track')
    expect(text).toContain('watch')
    expect(text).toContain('NVIDIA轉單')
    expect(text).toContain('月營收轉負')
    expect(text).toContain('TRIGGERED')
    expect(text).toContain('2200')
    expect(text).toContain('1650')
  })

  it('returns empty string for null thesis', () => {
    expect(buildThesisScorecardContext(null)).toBe('')
    expect(buildThesisScorecardContext(undefined)).toBe('')
  })

  it('handles thesis with no pillars or risks', () => {
    const thesis = {
      statement: 'Simple thesis',
      conviction: 'low',
      pillars: [],
      risks: [],
    }
    const text = buildThesisScorecardContext(thesis)
    expect(text).toContain('Simple thesis')
    expect(text).toContain('low')
  })

  it('falls back to reason when statement is empty', () => {
    const thesis = {
      statement: '',
      reason: 'Legacy reason text',
      conviction: 'medium',
      pillars: [],
      risks: [],
    }
    const text = buildThesisScorecardContext(thesis)
    expect(text).toContain('Legacy reason text')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/dossierThesisScorecard.test.js`
Expected: FAIL — `buildThesisScorecardContext` not exported

- [ ] **Step 3: Implement buildThesisScorecardContext**

Add the following function to `src/lib/dossierUtils.js`, after the existing `buildThemeContext` function:

```javascript
/**
 * Build thesis scorecard context for AI prompt
 */
export function buildThesisScorecardContext(thesis) {
  if (!thesis) return ''

  const statement = thesis.statement || thesis.reason || ''
  const direction = thesis.direction || 'long'
  const conviction = thesis.conviction || 'medium'

  const pillarLines = (thesis.pillars || [])
    .map((p) => `  - ${p.text} [${p.status}] trend:${p.trend || 'stable'}`)
    .join('\n')

  const riskLines = (thesis.risks || [])
    .map((r) => `  - ${r.text}${r.triggered ? ' [TRIGGERED]' : ''}`)
    .join('\n')

  const priceInfo = []
  if (thesis.targetPrice) priceInfo.push(`目標價: ${thesis.targetPrice}`)
  if (thesis.stopLoss) priceInfo.push(`停損價: ${thesis.stopLoss}`)

  return `Thesis (${direction}): ${statement}
Conviction: ${conviction}${pillarLines ? `\nPillars:\n${pillarLines}` : ''}${riskLines ? `\nRisks:\n${riskLines}` : ''}${priceInfo.length > 0 ? `\n${priceInfo.join(' / ')}` : ''}`
}
```

- [ ] **Step 4: Integrate into buildDailyHoldingDossierContext**

In `src/lib/dossierUtils.js`, find the `buildDailyHoldingDossierContext` function. Replace the existing thesis line:

```javascript
投資論文 (Thesis): ${thesis.reason || '無'}
```

with:

```javascript
${dossier.thesis ? buildThesisScorecardContext(dossier.thesis) : '投資論文 (Thesis): 無'}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/dossierThesisScorecard.test.js tests/lib/dossierSupplyChain.test.js`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/dossierUtils.js tests/lib/dossierThesisScorecard.test.js
git commit -m "feat: add thesis scorecard context to dossier AI prompts"
```

---

### Task 7: Full Integration Verification

**Files:**

- No new files — verification only

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS, 0 failures

- [ ] **Step 2: Run lint**

Run: `npx eslint src/hooks/useThesisTracking.js src/lib/eventUtils.js src/lib/dossierUtils.js src/constants.js`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "chore: Phase B integration verification — lint + build clean"
```
