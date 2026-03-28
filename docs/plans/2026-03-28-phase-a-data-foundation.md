# Phase A：資料基礎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 從 My-TW-Coverage 引入供應鏈/主題/公司摘要靜態資料，建立資料適配層，並擴充 STOCK_META 的主題標籤。

**Architecture:** 新增 `src/data/` 放靜態 JSON 參考資料，新增 `src/lib/dataAdapters/` 做資料來源抽象層。用 Python 腳本從 My-TW-Coverage repo 解析 markdown 產出 JSON。所有業務邏輯只透過 adapter 的統一格式讀取資料，不直接碰外部格式。

**Tech Stack:** Python 3（腳本）、Vitest（測試）、ES Modules（`"type": "module"`）、JSON import

**Spec:** `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md` Section 3 + 5

---

## File Map

| Action | File                                      | Responsibility                              |
| ------ | ----------------------------------------- | ------------------------------------------- |
| Create | `scripts/sync-coverage-data.py`           | 從 My-TW-Coverage markdown 解析產出 JSON    |
| Create | `src/data/supplyChain.json`               | 供應鏈關係（上下游、客戶、供應商）          |
| Create | `src/data/themes.json`                    | 21 個主題篩選（AI伺服器、CoWoS...）         |
| Create | `src/data/companyProfiles.json`           | 輕量公司摘要（名稱、產業、描述、wikilinks） |
| Create | `src/lib/dataAdapters/types.js`           | 統一內部資料格式定義                        |
| Create | `src/lib/dataAdapters/coverageAdapter.js` | 從靜態 JSON 讀取公司/供應鏈/主題資料        |
| Create | `src/lib/dataAdapters/index.js`           | 匯出組合 adapter（多來源 merge）            |
| Create | `tests/lib/dataAdapters.test.js`          | adapter 單元測試                            |
| Modify | `src/seedData.js`                         | STOCK_META 加 `themes` 欄位                 |
| Modify | `src/lib/dossierUtils.js`                 | buildHoldingDossiers 帶入供應鏈 context     |
| Create | `tests/lib/dossierSupplyChain.test.js`    | dossier 供應鏈整合測試                      |

---

## Task 1: 建立靜態資料 JSON — 供應鏈

**Files:**

- Create: `src/data/supplyChain.json`

先手動建立持倉涵蓋公司的供應鏈 JSON。之後 Task 6 的 Python 腳本可自動擴充。

- [ ] **Step 1: 建立 src/data/ 目錄並寫入 supplyChain.json**

```json
{
  "2308": {
    "name": "台達電",
    "upstream": [
      { "name": "被動元件供應商", "code": null, "product": "電子零組件", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "資料中心客戶", "code": null, "product": "電源/散熱方案", "revenueShare": null }
    ],
    "customers": ["Microsoft", "Google", "Amazon"],
    "suppliers": []
  },
  "2317": {
    "name": "鴻海",
    "upstream": [
      { "name": "半導體供應商", "code": null, "product": "電子零組件", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "Apple", "code": null, "product": "iPhone組裝", "revenueShare": "~30%" },
      { "name": "NVIDIA", "code": null, "product": "AI伺服器組裝", "revenueShare": "~10%" }
    ],
    "customers": ["Apple", "NVIDIA", "Amazon", "Google"],
    "suppliers": []
  },
  "3017": {
    "name": "奇鋐",
    "upstream": [
      { "name": "銅/鋁材料商", "code": null, "product": "散熱材料", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "AI伺服器廠", "code": null, "product": "散熱模組", "revenueShare": null }
    ],
    "customers": ["NVIDIA", "廣達", "緯創"],
    "suppliers": []
  },
  "3231": {
    "name": "緯創",
    "upstream": [
      { "name": "零組件供應商", "code": null, "product": "電子零件", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "NVIDIA", "code": null, "product": "AI伺服器代工", "revenueShare": "~15%" }
    ],
    "customers": ["NVIDIA", "Meta", "Google"],
    "suppliers": []
  },
  "3443": {
    "name": "創意",
    "upstream": [{ "name": "台積電", "code": "2330", "product": "晶圓代工", "dependency": "high" }],
    "downstream": [
      { "name": "客製化ASIC客戶", "code": null, "product": "ASIC設計服務", "revenueShare": null }
    ],
    "customers": ["Alchip客戶群", "HPC客戶"],
    "suppliers": ["台積電"]
  },
  "3491": {
    "name": "昇達科",
    "upstream": [
      { "name": "光通訊零件商", "code": null, "product": "光學元件", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "資料中心", "code": null, "product": "光收發模組/天線", "revenueShare": null }
    ],
    "customers": ["電信商", "資料中心運營商"],
    "suppliers": []
  },
  "1503": {
    "name": "士電",
    "upstream": [
      { "name": "矽鋼片/銅材供應商", "code": null, "product": "重電材料", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "台電", "code": null, "product": "變壓器/配電設備", "revenueShare": ">50%" }
    ],
    "customers": ["台電", "公共工程"],
    "suppliers": []
  },
  "1717": {
    "name": "長興",
    "upstream": [
      { "name": "化學原料供應商", "code": null, "product": "樹脂原料", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "PCB廠", "code": null, "product": "電子級樹脂", "revenueShare": null }
    ],
    "customers": ["PCB製造商", "半導體封裝廠"],
    "suppliers": []
  },
  "6862": {
    "name": "三集瑞-KY",
    "upstream": [
      { "name": "金屬材料商", "code": null, "product": "連接器材料", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "AI伺服器廠", "code": null, "product": "高速連接器", "revenueShare": null }
    ],
    "customers": ["伺服器組裝廠"],
    "suppliers": []
  }
}
```

- [ ] **Step 2: 驗證 JSON 格式正確**

Run: `node -e "import('./src/data/supplyChain.json', { assert: { type: 'json' } }).then(m => console.log(Object.keys(m.default).length + ' companies loaded')).catch(e => console.error(e))"`

Expected: `9 companies loaded`

- [ ] **Step 3: Commit**

```bash
git add src/data/supplyChain.json
git commit -m "feat: add supply chain static data for core holdings"
```

---

## Task 2: 建立靜態資料 JSON — 主題篩選 + 公司摘要

**Files:**

- Create: `src/data/themes.json`
- Create: `src/data/companyProfiles.json`

- [ ] **Step 1: 寫入 themes.json**

從 My-TW-Coverage 的 `themes/` 目錄結構轉換。先放與持倉最相關的主題：

```json
{
  "AI伺服器": {
    "description": "AI 訓練與推論伺服器完整供應鏈，從晶片到系統到散熱",
    "count": 148,
    "relatedThemes": ["CoWoS", "HBM", "NVIDIA", "CPO", "資料中心"],
    "stocks": {
      "upstream": ["2382", "2324", "3231", "2356"],
      "midstream": ["2308", "2317", "3044", "3011"],
      "downstream": ["3017", "3037", "2327", "2383"]
    }
  },
  "CoWoS": {
    "description": "台積電先進封裝技術 Chip-on-Wafer-on-Substrate 供應鏈",
    "count": 39,
    "relatedThemes": ["AI伺服器", "HBM", "NVIDIA"],
    "stocks": {
      "upstream": [],
      "midstream": ["2330"],
      "downstream": ["3037", "8046", "2344"]
    }
  },
  "NVIDIA": {
    "description": "NVIDIA AI 晶片與 GPU 供應鏈",
    "count": 104,
    "relatedThemes": ["AI伺服器", "CoWoS", "HBM", "資料中心"],
    "stocks": {
      "upstream": ["2330", "3443"],
      "midstream": ["2317", "2382", "3231"],
      "downstream": ["3017", "6862"]
    }
  },
  "HBM": {
    "description": "高頻寬記憶體 High Bandwidth Memory 供應鏈",
    "count": 16,
    "relatedThemes": ["AI伺服器", "CoWoS", "NVIDIA"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": ["3037", "2330"]
    }
  },
  "CPO": {
    "description": "共封裝光學 Co-Packaged Optics 供應鏈",
    "count": 13,
    "relatedThemes": ["AI伺服器", "資料中心", "矽光子"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": ["3491", "4960"]
    }
  },
  "資料中心": {
    "description": "資料中心基礎設施完整供應鏈",
    "count": 77,
    "relatedThemes": ["AI伺服器", "CPO", "NVIDIA"],
    "stocks": {
      "upstream": ["2308", "2317"],
      "midstream": ["3017", "3231", "2382"],
      "downstream": ["3491"]
    }
  },
  "5G": {
    "description": "5G 通訊設備與基地台供應鏈",
    "count": 62,
    "relatedThemes": ["低軌衛星"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": []
    }
  },
  "電動車": {
    "description": "電動車與自駕供應鏈",
    "count": 45,
    "relatedThemes": ["碳化矽"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": []
    }
  },
  "低軌衛星": {
    "description": "低軌道衛星通訊供應鏈",
    "count": 20,
    "relatedThemes": ["5G"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": ["3491"]
    }
  },
  "矽光子": {
    "description": "矽光子 Silicon Photonics 技術供應鏈",
    "count": 12,
    "relatedThemes": ["CPO", "資料中心"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": []
    }
  },
  "碳化矽": {
    "description": "碳化矽 SiC 功率半導體供應鏈",
    "count": 15,
    "relatedThemes": ["電動車"],
    "stocks": {
      "upstream": [],
      "midstream": [],
      "downstream": []
    }
  },
  "ABF載板": {
    "description": "ABF 載板 Ajinomoto Build-up Film 供應鏈",
    "count": 10,
    "relatedThemes": ["AI伺服器", "CoWoS"],
    "stocks": {
      "upstream": [],
      "midstream": ["3037", "8046"],
      "downstream": []
    }
  }
}
```

- [ ] **Step 2: 寫入 companyProfiles.json**

```json
{
  "2308": {
    "name": "台達電",
    "sector": "Electronic Components",
    "industry": "電源/散熱",
    "description": "全球電源管理與散熱解決方案龍頭，AI伺服器電源供應器市佔率領先，近年積極佈局資料中心與電動車充電。",
    "wikilinks": ["AI", "資料中心", "電動車"]
  },
  "2317": {
    "name": "鴻海",
    "sector": "Electronic Components",
    "industry": "EMS/代工",
    "description": "全球最大電子代工廠，主要客戶 Apple、NVIDIA。近年積極佈局 AI 伺服器組裝與電動車。",
    "wikilinks": ["AI", "NVIDIA", "Apple", "電動車"]
  },
  "3017": {
    "name": "奇鋐",
    "sector": "Electronic Components",
    "industry": "散熱",
    "description": "AI伺服器散熱模組龍頭，受惠 NVIDIA GPU 散熱需求，液冷散熱技術領先。",
    "wikilinks": ["AI", "NVIDIA", "資料中心"]
  },
  "3231": {
    "name": "緯創",
    "sector": "Computer Hardware",
    "industry": "伺服器代工",
    "description": "AI伺服器代工大廠，NVIDIA GB200/GB300 伺服器代工夥伴，營收中 AI 伺服器佔比快速拉升。",
    "wikilinks": ["AI", "NVIDIA"]
  },
  "3443": {
    "name": "創意",
    "sector": "Semiconductors",
    "industry": "ASIC設計服務",
    "description": "台積電轉投資，客製化 ASIC 設計服務龍頭，受惠客製化 AI 晶片需求。",
    "wikilinks": ["AI", "CoWoS", "ASIC"]
  },
  "3491": {
    "name": "昇達科",
    "sector": "Communication Equipment",
    "industry": "光通訊/天線",
    "description": "光通訊元件與天線廠，受惠 5G、低軌衛星與資料中心光互連需求。",
    "wikilinks": ["5G", "CPO", "低軌衛星"]
  },
  "1503": {
    "name": "士電",
    "sector": "Electrical Equipment",
    "industry": "重電",
    "description": "重電設備廠，主要生產變壓器、配電設備，受惠台電強韌電網計畫。",
    "wikilinks": ["重電"]
  },
  "1717": {
    "name": "長興",
    "sector": "Specialty Chemicals",
    "industry": "特用化學/樹脂",
    "description": "電子級樹脂龍頭，產品應用於 PCB、半導體封裝，受惠 ABF 載板與先進封裝需求。",
    "wikilinks": ["PCB", "ABF載板"]
  },
  "6862": {
    "name": "三集瑞-KY",
    "sector": "Electronic Components",
    "industry": "連接器",
    "description": "高速連接器廠，產品應用於 AI 伺服器、資料中心，受惠高速傳輸規格升級。",
    "wikilinks": ["AI", "資料中心"]
  },
  "3013": {
    "name": "晟銘電",
    "sector": "Computer Hardware",
    "industry": "伺服器機殼",
    "description": "伺服器機殼/機箱製造廠，受惠 AI 伺服器出貨量成長。",
    "wikilinks": ["AI"]
  },
  "6274": {
    "name": "台燿",
    "sector": "Electronic Components",
    "industry": "CCL/銅箔基板",
    "description": "CCL 銅箔基板廠，產品應用於高階 PCB，受惠 AI 伺服器高層數 PCB 需求。",
    "wikilinks": ["PCB", "AI"]
  },
  "8227": {
    "name": "巨有科技",
    "sector": "Communication Equipment",
    "industry": "光通訊",
    "description": "光通訊主動元件廠，生產光收發模組，受惠資料中心 400G/800G 升級。",
    "wikilinks": ["CPO", "資料中心"]
  }
}
```

- [ ] **Step 3: 驗證兩個 JSON 格式正確**

Run: `node -e "Promise.all([import('./src/data/themes.json',{assert:{type:'json'}}), import('./src/data/companyProfiles.json',{assert:{type:'json'}})]).then(([t,c]) => console.log(Object.keys(t.default).length+' themes, '+Object.keys(c.default).length+' profiles')).catch(e=>console.error(e))"`

Expected: `12 themes, 12 profiles`

- [ ] **Step 4: Commit**

```bash
git add src/data/themes.json src/data/companyProfiles.json
git commit -m "feat: add theme screens and company profiles static data"
```

---

## Task 3: 資料適配層 — types.js

**Files:**

- Create: `src/lib/dataAdapters/types.js`

- [ ] **Step 1: 寫 adapter 的統一格式定義**

```javascript
/**
 * 統一的公司資料格式
 * 所有 adapter 都輸出這個格式，業務邏輯只認這個格式
 */

/** @returns {CompanyData} */
export function createEmptyCompanyData(code = '') {
  return {
    code,
    name: '',
    sector: '',
    industry: '',

    // 估值指標（即時資料源提供，靜態資料源為 null）
    pe: null,
    forwardPe: null,
    pb: null,
    ps: null,
    evEbitda: null,

    // 成長指標
    revenueYoy: null,
    epsGrowth: null,
    grossMargin: null,
    operatingMargin: null,

    // 元資料
    source: '',
    freshness: 'missing',
    fetchedAt: null,
  }
}

/**
 * 供應鏈資料格式
 */
export function createEmptySupplyChain(code = '') {
  return {
    code,
    name: '',
    upstream: [],
    downstream: [],
    customers: [],
    suppliers: [],
    source: '',
  }
}

/**
 * 主題資料格式
 */
export function createEmptyTheme(name = '') {
  return {
    name,
    description: '',
    count: 0,
    relatedThemes: [],
    stocks: { upstream: [], midstream: [], downstream: [] },
    source: '',
  }
}

/**
 * 合併多個 CompanyData，非 null 欄位以前面的為主
 */
export function mergeCompanyData(...sources) {
  const result = createEmptyCompanyData()
  for (const src of sources) {
    if (!src) continue
    for (const key of Object.keys(result)) {
      if (result[key] === null || result[key] === '' || result[key] === 'missing') {
        if (
          src[key] !== null &&
          src[key] !== undefined &&
          src[key] !== '' &&
          src[key] !== 'missing'
        ) {
          result[key] = src[key]
        }
      }
    }
  }
  return result
}
```

- [ ] **Step 2: 驗證 import 正常**

Run: `node -e "import('./src/lib/dataAdapters/types.js').then(m => { const d = m.createEmptyCompanyData('2330'); console.log(d.code, d.freshness); }).catch(e => console.error(e))"`

Expected: `2330 missing`

- [ ] **Step 3: Commit**

```bash
git add src/lib/dataAdapters/types.js
git commit -m "feat: add data adapter types with unified CompanyData format"
```

---

## Task 4: 資料適配層 — coverageAdapter + index

**Files:**

- Create: `src/lib/dataAdapters/coverageAdapter.js`
- Create: `src/lib/dataAdapters/index.js`
- Create: `tests/lib/dataAdapters.test.js`

- [ ] **Step 1: 寫測試**

```javascript
import { describe, it, expect } from 'vitest'
import {
  getCompanyData,
  getSupplyChain,
  getThemes,
  getThemesForStock,
  getStocksInTheme,
} from '../../src/lib/dataAdapters/index.js'

describe('dataAdapters', () => {
  describe('getCompanyData', () => {
    it('returns merged data for known stock', () => {
      const data = getCompanyData('3017')
      expect(data.code).toBe('3017')
      expect(data.name).toBe('奇鋐')
      expect(data.source).toBe('coverage-static')
      expect(data.freshness).toBe('aging')
    })

    it('returns empty data for unknown stock', () => {
      const data = getCompanyData('9999')
      expect(data).toBeNull()
    })
  })

  describe('getSupplyChain', () => {
    it('returns supply chain for known stock', () => {
      const chain = getSupplyChain('3443')
      expect(chain.name).toBe('創意')
      expect(chain.upstream.length).toBeGreaterThan(0)
      expect(chain.upstream[0].name).toBe('台積電')
      expect(chain.customers.length).toBeGreaterThan(0)
    })

    it('returns null for unknown stock', () => {
      expect(getSupplyChain('9999')).toBeNull()
    })
  })

  describe('getThemes', () => {
    it('returns all themes', () => {
      const themes = getThemes()
      expect(Object.keys(themes).length).toBeGreaterThanOrEqual(10)
      expect(themes['AI伺服器']).toBeDefined()
      expect(themes['AI伺服器'].count).toBe(148)
    })
  })

  describe('getThemesForStock', () => {
    it('finds themes containing a stock code', () => {
      const themes = getThemesForStock('3017')
      const names = themes.map((t) => t.name)
      expect(names).toContain('AI伺服器')
    })

    it('returns empty array for stock in no theme', () => {
      const themes = getThemesForStock('9999')
      expect(themes).toEqual([])
    })
  })

  describe('getStocksInTheme', () => {
    it('returns all stocks in a theme', () => {
      const stocks = getStocksInTheme('AI伺服器')
      expect(stocks.length).toBeGreaterThan(0)
      expect(stocks).toContain('2308')
    })

    it('returns empty array for unknown theme', () => {
      expect(getStocksInTheme('不存在')).toEqual([])
    })
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/lib/dataAdapters.test.js`

Expected: FAIL — module not found

- [ ] **Step 3: 寫 coverageAdapter.js**

```javascript
import supplyChainData from '../../data/supplyChain.json' with { type: 'json' }
import themesData from '../../data/themes.json' with { type: 'json' }
import companyProfiles from '../../data/companyProfiles.json' with { type: 'json' }
import { createEmptyCompanyData, createEmptySupplyChain } from './types.js'

/**
 * 從 My-TW-Coverage 靜態 JSON 取得公司資料
 */
export function getCompanyData(code) {
  const profile = companyProfiles[code]
  if (!profile) return null

  const data = createEmptyCompanyData(code)
  data.name = profile.name
  data.sector = profile.sector
  data.industry = profile.industry
  data.source = 'coverage-static'
  data.freshness = 'aging'
  return data
}

/**
 * 取得供應鏈資料
 */
export function getSupplyChain(code) {
  const chain = supplyChainData[code]
  if (!chain) return null

  return {
    code,
    name: chain.name,
    upstream: chain.upstream || [],
    downstream: chain.downstream || [],
    customers: chain.customers || [],
    suppliers: chain.suppliers || [],
    source: 'coverage-static',
  }
}

/**
 * 取得所有主題
 */
export function getThemes() {
  return themesData
}

/**
 * 取得特定股票所屬的主題列表
 */
export function getThemesForStock(code) {
  const result = []
  for (const [name, theme] of Object.entries(themesData)) {
    const allStocks = [
      ...(theme.stocks?.upstream || []),
      ...(theme.stocks?.midstream || []),
      ...(theme.stocks?.downstream || []),
    ]
    if (allStocks.includes(code)) {
      result.push({ name, ...theme })
    }
  }
  return result
}

/**
 * 取得主題內所有股票代碼（去重）
 */
export function getStocksInTheme(themeName) {
  const theme = themesData[themeName]
  if (!theme) return []

  const stocks = new Set([
    ...(theme.stocks?.upstream || []),
    ...(theme.stocks?.midstream || []),
    ...(theme.stocks?.downstream || []),
  ])
  return [...stocks]
}

/**
 * 取得公司描述（for AI prompt context）
 */
export function getCompanyDescription(code) {
  return companyProfiles[code]?.description || null
}

/**
 * 取得公司 wikilinks
 */
export function getCompanyWikilinks(code) {
  return companyProfiles[code]?.wikilinks || []
}
```

- [ ] **Step 4: 寫 index.js**

```javascript
/**
 * Data Adapters — 統一資料存取層
 *
 * 目前只有 coverage（靜態 JSON）adapter。
 * 未來加付費資料源時，只需新增 adapter 檔案並在這裡 merge。
 */
export {
  getCompanyData,
  getSupplyChain,
  getThemes,
  getThemesForStock,
  getStocksInTheme,
  getCompanyDescription,
  getCompanyWikilinks,
} from './coverageAdapter.js'

export {
  createEmptyCompanyData,
  createEmptySupplyChain,
  createEmptyTheme,
  mergeCompanyData,
} from './types.js'
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run tests/lib/dataAdapters.test.js`

Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/dataAdapters/ tests/lib/dataAdapters.test.js
git commit -m "feat: add coverage data adapter with supply chain, themes, profiles"
```

---

## Task 5: STOCK_META 加 themes 欄位

**Files:**

- Modify: `src/seedData.js:31-68`

- [ ] **Step 1: 更新 STOCK_META，每筆加 themes 陣列**

在 `src/seedData.js` 的 STOCK_META 中，為每個 me 組合的持股加上 `themes` 欄位：

```javascript
export const STOCK_META = {
  // ── me 組合 ──
  '00637L': {
    industry: '中國ETF',
    strategy: 'ETF/指數',
    period: '短中',
    position: '戰術',
    leader: 'N/A',
  },
  '039108': {
    industry: '被動元件',
    strategy: '權證',
    period: '短',
    position: '戰術',
    leader: 'N/A',
    underlying: '禾伸堂',
  },
  '053848': {
    industry: '半導體設備',
    strategy: '權證',
    period: '短',
    position: '戰術',
    leader: 'N/A',
    underlying: '亞翔',
  },
  702157: {
    industry: '光通訊',
    strategy: '權證',
    period: '短',
    position: '戰術',
    leader: 'N/A',
    underlying: '華星光',
  },
  1503: { industry: '重電', strategy: '景氣循環', period: '中', position: '衛星', leader: '二線' },
  1717: {
    industry: 'PCB/材料',
    strategy: '景氣循環',
    period: '中',
    position: '衛星',
    leader: '龍頭',
    themes: ['ABF載板'],
  },
  2308: {
    industry: 'AI/伺服器',
    strategy: '成長股',
    period: '中長',
    position: '核心',
    leader: '龍頭',
    themes: ['AI伺服器', '資料中心', '電動車'],
  },
  2313: {
    industry: 'PCB/材料',
    strategy: '景氣循環',
    period: '中',
    position: '衛星',
    leader: '二線',
  },
  2543: { industry: '營建', strategy: '景氣循環', period: '中', position: '戰術', leader: '小型' },
  3006: {
    industry: 'IC/記憶體',
    strategy: '景氣循環',
    period: '短中',
    position: '戰術',
    leader: '小型',
  },
  3013: {
    industry: 'AI/伺服器',
    strategy: '成長股',
    period: '中',
    position: '衛星',
    leader: '小型',
    themes: ['AI伺服器'],
  },
  3017: {
    industry: 'AI/伺服器',
    strategy: '成長股',
    period: '中長',
    position: '核心',
    leader: '龍頭',
    themes: ['AI伺服器', '資料中心'],
  },
  3231: {
    industry: 'AI/伺服器',
    strategy: '成長股',
    period: '中',
    position: '衛星',
    leader: '大型',
    themes: ['AI伺服器', 'NVIDIA'],
  },
  3443: {
    industry: 'AI/伺服器',
    strategy: '成長股',
    period: '中長',
    position: '核心',
    leader: '龍頭',
    themes: ['AI伺服器', 'NVIDIA', 'CoWoS'],
  },
  3491: {
    industry: '光通訊',
    strategy: '成長股',
    period: '中長',
    position: '核心',
    leader: '小龍頭',
    themes: ['CPO', '低軌衛星', '資料中心'],
  },
  4583: {
    industry: '精密機械',
    strategy: '事件驅動',
    period: '中',
    position: '衛星',
    leader: '小型',
  },
  6274: {
    industry: 'PCB/材料',
    strategy: '景氣循環',
    period: '中',
    position: '衛星',
    leader: '二線',
    themes: ['AI伺服器'],
  },
  6770: {
    industry: 'IC/記憶體',
    strategy: '景氣循環',
    period: '中長',
    position: '衛星',
    leader: '二線',
  },
  6862: {
    industry: '連接器',
    strategy: '成長股',
    period: '中',
    position: '衛星',
    leader: '小型',
    themes: ['AI伺服器', 'NVIDIA'],
  },
  8227: {
    industry: '光通訊',
    strategy: '成長股',
    period: '中長',
    position: '衛星',
    leader: '小型',
    themes: ['CPO', '資料中心'],
  },
  // ── 金聯成 組合 ──
  '0050': {
    industry: '台股ETF',
    strategy: 'ETF/指數',
    period: '中長',
    position: '衛星',
    leader: 'N/A',
  },
  '00635U': {
    industry: '商品ETF',
    strategy: 'ETF/指數',
    period: '中',
    position: '戰術',
    leader: 'N/A',
  },
  '00918': {
    industry: '高股息ETF',
    strategy: 'ETF/指數',
    period: '中長',
    position: '衛星',
    leader: 'N/A',
  },
  '00981A': {
    industry: '主動型ETF',
    strategy: 'ETF/指數',
    period: '中長',
    position: '衛星',
    leader: 'N/A',
  },
  1799: {
    industry: '生技醫療',
    strategy: '轉型股',
    period: '中',
    position: '核心',
    leader: '小型',
  },
  1815: {
    industry: 'PCB/材料',
    strategy: '景氣循環',
    period: '中',
    position: '衛星',
    leader: '二線',
  },
  2489: {
    industry: '顯示器/光電',
    strategy: '轉型股',
    period: '中',
    position: '核心',
    leader: '中型',
  },
  3167: {
    industry: '精密機械',
    strategy: '成長股',
    period: '中',
    position: '衛星',
    leader: '小龍頭',
  },
  4562: {
    industry: '精密機械',
    strategy: '景氣循環',
    period: '中',
    position: '衛星',
    leader: '小型',
  },
  6446: {
    industry: '生技醫療',
    strategy: '成長股',
    period: '中長',
    position: '核心',
    leader: '龍頭',
  },
  7799: {
    industry: '生技醫療',
    strategy: '成長股',
    period: '中長',
    position: '核心',
    leader: '小龍頭',
  },
  7865: {
    industry: '環保/循環',
    strategy: '價值股',
    period: '中長',
    position: '核心',
    leader: '小龍頭',
  },
  8074: {
    industry: 'PCB/材料',
    strategy: '景氣循環',
    period: '中',
    position: '衛星',
    leader: '小型',
  },
  8096: {
    industry: '電子通路',
    strategy: '成長股',
    period: '中',
    position: '衛星',
    leader: '中型',
  },
}
```

- [ ] **Step 2: 確認 lint 通過**

Run: `npx eslint src/seedData.js`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/seedData.js
git commit -m "feat: add themes tags to STOCK_META for holdings"
```

---

## Task 6: Dossier 整合供應鏈 context

**Files:**

- Modify: `src/lib/dossierUtils.js`
- Create: `tests/lib/dossierSupplyChain.test.js`

- [ ] **Step 1: 寫測試**

```javascript
import { describe, it, expect } from 'vitest'
import { buildSupplyChainContext, buildThemeContext } from '../../src/lib/dossierUtils.js'

describe('dossier supply chain integration', () => {
  describe('buildSupplyChainContext', () => {
    it('returns supply chain text for known stock', () => {
      const text = buildSupplyChainContext('3443')
      expect(text).toContain('台積電')
      expect(text).toContain('上游')
    })

    it('returns empty string for unknown stock', () => {
      expect(buildSupplyChainContext('9999')).toBe('')
    })
  })

  describe('buildThemeContext', () => {
    it('returns theme text for stock with themes', () => {
      const meta = { themes: ['AI伺服器', 'NVIDIA'] }
      const text = buildThemeContext('3443', meta)
      expect(text).toContain('AI伺服器')
      expect(text).toContain('NVIDIA')
    })

    it('returns empty string for stock without themes', () => {
      expect(buildThemeContext('9999', {})).toBe('')
      expect(buildThemeContext('9999', null)).toBe('')
    })
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/lib/dossierSupplyChain.test.js`

Expected: FAIL — functions not exported

- [ ] **Step 3: 在 dossierUtils.js 底部加入兩個新函數**

在 `src/lib/dossierUtils.js` 的 `formatTaiwanHardGateIssueList` 函數之後加入：

```javascript
import { getSupplyChain, getThemesForStock } from './dataAdapters/index.js'

/**
 * 建立供應鏈 context 文字（for AI prompt）
 */
export function buildSupplyChainContext(code) {
  const chain = getSupplyChain(code)
  if (!chain) return ''

  const parts = []

  if (chain.upstream.length > 0) {
    const upstreamText = chain.upstream
      .map((s) => `${s.name}(${s.product}${s.dependency === 'high' ? ',高度依賴' : ''})`)
      .join(', ')
    parts.push(`上游: ${upstreamText}`)
  }

  if (chain.downstream.length > 0) {
    const downstreamText = chain.downstream
      .map((s) => `${s.name}(${s.product}${s.revenueShare ? ',' + s.revenueShare + '營收' : ''})`)
      .join(', ')
    parts.push(`下游: ${downstreamText}`)
  }

  if (chain.customers.length > 0) {
    parts.push(`主要客戶: ${chain.customers.join(', ')}`)
  }

  if (chain.suppliers.length > 0) {
    parts.push(`主要供應商: ${chain.suppliers.join(', ')}`)
  }

  return parts.join('\n')
}

/**
 * 建立主題 context 文字（for AI prompt）
 */
export function buildThemeContext(code, stockMeta) {
  if (!stockMeta?.themes?.length) return ''

  const themes = stockMeta.themes.map((name) => {
    const found = getThemesForStock(code).find((t) => t.name === name)
    if (found) return `${name}(${found.count}家)`
    return name
  })

  return `相關主題: ${themes.join(', ')}`
}
```

注意：`import { getSupplyChain, getThemesForStock }` 需要加在檔案頂部的 import 區域。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/lib/dossierSupplyChain.test.js`

Expected: 4 tests PASS

- [ ] **Step 5: 在 buildDailyHoldingDossierContext 中整合供應鏈 context**

在 `buildDailyHoldingDossierContext` 函數的 return 模板中，在 `${brainRuleInfo}` 後面加上：

```javascript
const supplyChainInfo = buildSupplyChainContext(dossier.code)
const themeInfo = dossier.stockMeta ? buildThemeContext(dossier.code, dossier.stockMeta) : ''

return `
股票代碼: ${dossier.code}
股票名稱: ${dossier.name}
持股數量: ${position.qty}
${priceInfo}
成本: ${position.cost}
市值: ${position.value}
未實現損益: ${position.pnl} (${position.pct >= 0 ? '+' : ''}${position.pct.toFixed(2)}%)

投資論文 (Thesis): ${thesis.reason || '無'}
${targetInfo}
${fundamentalInfo}
${eventInfo}
${brainRuleInfo}
${supplyChainInfo ? `\n供應鏈:\n${supplyChainInfo}` : ''}
${themeInfo ? `${themeInfo}` : ''}
`
```

- [ ] **Step 6: 跑全部測試確認沒有 regression**

Run: `npx vitest run`

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/dossierUtils.js tests/lib/dossierSupplyChain.test.js
git commit -m "feat: integrate supply chain and theme context into holding dossier"
```

---

## Task 7: Python 同步腳本

**Files:**

- Create: `scripts/sync-coverage-data.py`

這個腳本用於日後從 My-TW-Coverage repo 自動更新靜態 JSON。目前 JSON 已手動建立，此腳本做為擴充工具。

- [ ] **Step 1: 建立腳本**

```python
#!/usr/bin/env python3
"""
sync-coverage-data.py

從 My-TW-Coverage repo 解析 Pilot_Reports markdown，
產出 src/data/ 下的靜態 JSON 檔案。

使用方式：
  python scripts/sync-coverage-data.py --source /path/to/My-TW-Coverage
  python scripts/sync-coverage-data.py --source /path/to/My-TW-Coverage --tickers 2330,2317,3017
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


def parse_report(filepath):
    """解析單一公司 markdown 報告"""
    text = filepath.read_text(encoding="utf-8")
    result = {}

    # 名稱
    title_match = re.search(r"^# (\d+)\s*-\s*\[\[(.+?)\]\]", text, re.MULTILINE)
    if title_match:
        result["code"] = title_match.group(1)
        result["name"] = title_match.group(2)

    # 板塊 / 產業
    sector_match = re.search(r"\*\*板塊:\*\*\s*(.+)", text)
    industry_match = re.search(r"\*\*產業:\*\*\s*(.+)", text)
    if sector_match:
        result["sector"] = sector_match.group(1).strip()
    if industry_match:
        result["industry"] = industry_match.group(1).strip()

    # 業務簡介（第一段）
    desc_match = re.search(
        r"## 業務簡介\n(?:\*\*.+\n)*\n(.+?)(?=\n##|\Z)", text, re.DOTALL
    )
    if desc_match:
        desc = desc_match.group(1).strip()
        desc = re.sub(r"\[\[(.+?)\]\]", r"\1", desc)  # remove wikilinks
        result["description"] = desc[:300]  # cap at 300 chars

    # wikilinks
    wikilinks = set(re.findall(r"\[\[(.+?)\]\]", text))
    result["wikilinks"] = sorted(wikilinks)

    # 供應鏈
    upstream_match = re.search(r"\*\*上游.*?\*\*\s*[：:]\s*(.+?)(?=\n\*\*|\n##|\Z)", text, re.DOTALL)
    downstream_match = re.search(r"\*\*下游.*?\*\*\s*[：:]\s*(.+?)(?=\n\*\*|\n##|\Z)", text, re.DOTALL)
    customers_match = re.search(r"### 主要客戶\n(.+?)(?=\n###|\n##|\Z)", text, re.DOTALL)
    suppliers_match = re.search(r"### 主要供應商\n(.+?)(?=\n###|\n##|\Z)", text, re.DOTALL)

    def extract_names(text_block):
        if not text_block:
            return []
        names = re.findall(r"\[\[(.+?)\]\]", text_block)
        return names

    result["upstream_names"] = extract_names(upstream_match.group(1) if upstream_match else "")
    result["downstream_names"] = extract_names(downstream_match.group(1) if downstream_match else "")
    result["customer_names"] = extract_names(customers_match.group(1) if customers_match else "")
    result["supplier_names"] = extract_names(suppliers_match.group(1) if suppliers_match else "")

    return result


def parse_theme(filepath):
    """解析主題 markdown"""
    text = filepath.read_text(encoding="utf-8")
    result = {}

    title_match = re.search(r"^# (.+)", text, re.MULTILINE)
    if title_match:
        result["description"] = title_match.group(1).strip()

    count_match = re.search(r"\*\*涵蓋公司數:\*\*\s*(\d+)", text)
    if count_match:
        result["count"] = int(count_match.group(1))

    related_match = re.search(r"\*\*相關主題:\*\*\s*(.+)", text)
    if related_match:
        result["relatedThemes"] = re.findall(r"\[\[(.+?)\]\]", related_match.group(1))

    # 解析上中下游的股票代碼
    stocks = {"upstream": [], "midstream": [], "downstream": []}
    current_section = None
    for line in text.split("\n"):
        if re.match(r"## 上游", line):
            current_section = "upstream"
        elif re.match(r"## 中游", line):
            current_section = "midstream"
        elif re.match(r"## 下游", line):
            current_section = "downstream"
        elif re.match(r"## ", line):
            current_section = None
        elif current_section:
            code_match = re.match(r"- \*\*(\d+)\s+", line)
            if code_match:
                stocks[current_section].append(code_match.group(1))

    result["stocks"] = stocks
    return result


def main():
    parser = argparse.ArgumentParser(description="Sync My-TW-Coverage data to static JSON")
    parser.add_argument("--source", required=True, help="Path to My-TW-Coverage repo root")
    parser.add_argument("--tickers", help="Comma-separated ticker codes to sync (default: all)")
    parser.add_argument("--output", default="src/data", help="Output directory (default: src/data)")
    args = parser.parse_args()

    source = Path(args.source)
    output = Path(args.output)

    if not source.exists():
        print(f"Error: source path {source} does not exist")
        sys.exit(1)

    ticker_filter = set(args.tickers.split(",")) if args.tickers else None

    # Parse reports
    reports_dir = source / "Pilot_Reports"
    profiles = {}
    supply_chains = {}

    if reports_dir.exists():
        for md_file in reports_dir.rglob("*.md"):
            try:
                data = parse_report(md_file)
                code = data.get("code")
                if not code:
                    continue
                if ticker_filter and code not in ticker_filter:
                    continue

                profiles[code] = {
                    "name": data.get("name", ""),
                    "sector": data.get("sector", ""),
                    "industry": data.get("industry", ""),
                    "description": data.get("description", ""),
                    "wikilinks": data.get("wikilinks", []),
                }

                if data.get("upstream_names") or data.get("downstream_names"):
                    supply_chains[code] = {
                        "name": data.get("name", ""),
                        "upstream": [{"name": n, "code": None, "product": "", "dependency": "medium"} for n in data["upstream_names"]],
                        "downstream": [{"name": n, "code": None, "product": "", "revenueShare": None} for n in data["downstream_names"]],
                        "customers": data.get("customer_names", []),
                        "suppliers": data.get("supplier_names", []),
                    }
            except Exception as e:
                print(f"Warning: failed to parse {md_file}: {e}")

    # Parse themes
    themes_dir = source / "themes"
    themes = {}

    if themes_dir.exists():
        for md_file in themes_dir.glob("*.md"):
            if md_file.name == "README.md":
                continue
            try:
                theme_name = md_file.stem.replace("_", "")
                data = parse_theme(md_file)
                themes[theme_name] = {
                    "description": data.get("description", ""),
                    "count": data.get("count", 0),
                    "relatedThemes": data.get("relatedThemes", []),
                    "stocks": data.get("stocks", {"upstream": [], "midstream": [], "downstream": []}),
                }
            except Exception as e:
                print(f"Warning: failed to parse theme {md_file}: {e}")

    # Write output
    output.mkdir(parents=True, exist_ok=True)

    with open(output / "companyProfiles.json", "w", encoding="utf-8") as f:
        json.dump(profiles, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(profiles)} company profiles")

    with open(output / "supplyChain.json", "w", encoding="utf-8") as f:
        json.dump(supply_chains, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(supply_chains)} supply chains")

    with open(output / "themes.json", "w", encoding="utf-8") as f:
        json.dump(themes, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(themes)} themes")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 驗證腳本語法正確**

Run: `python3 -c "import ast; ast.parse(open('scripts/sync-coverage-data.py').read()); print('syntax OK')"`

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-coverage-data.py
git commit -m "feat: add sync-coverage-data.py to import My-TW-Coverage data"
```

---

## Task 8: Lint + Build + 全部測試

**Files:** None (verification only)

- [ ] **Step 1: 跑 lint**

Run: `npx eslint src/seedData.js src/lib/dossierUtils.js src/lib/dataAdapters/`

Expected: 0 errors

- [ ] **Step 2: 跑全部測試**

Run: `npx vitest run`

Expected: All tests PASS

- [ ] **Step 3: 跑 build**

Run: `npm run build`

Expected: Build succeeds

- [ ] **Step 4: 如有問題修復後再 commit**

```bash
git add -A
git commit -m "fix: resolve lint/test/build issues from Phase A"
```

（只在有修復時才執行此 commit）

---

## Summary

| Task | 內容                 | 產出                                                         |
| ---- | -------------------- | ------------------------------------------------------------ |
| 1    | 供應鏈 JSON          | `src/data/supplyChain.json`                                  |
| 2    | 主題 + 公司摘要 JSON | `src/data/themes.json`, `src/data/companyProfiles.json`      |
| 3    | Adapter types        | `src/lib/dataAdapters/types.js`                              |
| 4    | Adapter 實作 + 測試  | `src/lib/dataAdapters/coverageAdapter.js`, `index.js`, tests |
| 5    | STOCK_META themes    | `src/seedData.js` 修改                                       |
| 6    | Dossier 整合 + 測試  | `src/lib/dossierUtils.js` 修改, tests                        |
| 7    | Python 同步腳本      | `scripts/sync-coverage-data.py`                              |
| 8    | 全部驗證             | lint + test + build                                          |
