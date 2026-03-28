# 文檔清理建議報告

最後更新：2026-03-28
狀態：文檔審計與清理建議

---

## 文檔總覽

### 目前文檔數量統計

| 目錄                       | 檔案數 | 說明           |
| -------------------------- | ------ | -------------- |
| `/docs`                    | 26 檔  | 根目錄文檔     |
| `/docs/superpowers/specs`  | 11 檔  | 規格文件       |
| `/docs/superpowers/plans`  | 2 檔   | 計畫文件       |
| `/docs/superpowers/status` | 2 檔   | 狀態文件       |
| `/docs/evals`              | 1 檔   | 評估框架       |
| `/docs/refactoring`        | 0 檔   | 重構記錄（空） |
| `/docs/testing`            | 0 檔   | 測試記錄（空） |

**總計：約 42 檔**

---

## 文檔分類與保留建議

### ✅ 核心文檔（必須保留）

這些是系統的 canonical source of truth，所有 AI 和人類開發者必讀。

| 檔案                                             | 用途         | 最後更新   | 保留 |
| ------------------------------------------------ | ------------ | ---------- | ---- |
| `AI_COLLABORATION_GUIDE.md`                      | AI 協作規則  | 2026-03-28 | ✅   |
| `PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`   | 系統架構     | 2026-03-28 | ✅   |
| `superpowers/status/current-work.md`             | 當前工作狀態 | 2026-03-28 | ✅   |
| `superpowers/status/ai-collaboration-channel.md` | AI 角色定義  | 持續更新   | ✅   |
| `USER_GUIDE_COMPLETE.md`                         | 使用者說明書 | 2026-03-27 | ✅   |

**小計：5 檔**

---

### ⚠️ 策略與分析文檔（選擇性保留）

這些是策略討論和分析報告，有歷史價值但可能過時。

| 檔案                                 | 用途                     | 最後更新   | 建議    |
| ------------------------------------ | ------------------------ | ---------- | ------- |
| `THREE_KEY_POINTS_DISCUSSION.md`     | 付費/停損加倉/籌碼面討論 | 2026-03-27 | ⚠️ 保留 |
| `MY_TW_COVERAGE_ANALYSIS.md`         | 競品分析報告             | 2026-03-27 | ⚠️ 保留 |
| `stock-selection-engine-design.md`   | 選股引擎設計             | 2026-03-27 | ⚠️ 保留 |
| `stock-selection-deep-reflection.md` | 選股策略反思             | 2026-03-27 | ⚠️ 保留 |
| `phase0-data-collection-strategy.md` | 資料收集策略             | 2026-03-27 | ⚠️ 保留 |
| `phase4-research-system-analysis.md` | 研究系統問題分析         | 2026-03-27 | ⚠️ 保留 |
| `phase0-4-implementation-summary.md` | Phase 0-4 實作總結       | 2026-03-27 | ⚠️ 保留 |

**建議：** 這些文檔代表策略思考歷程，建議保留但移至 `/docs/archive/strategy/`

**小計：7 檔**

---

### 🔄 重複/重疊文檔（建議合併或刪除）

#### 重複 1：選股策略相關

| 檔案                                 | 內容             | 重複點                                             | 建議                                    |
| ------------------------------------ | ---------------- | -------------------------------------------------- | --------------------------------------- |
| `stock-selection-engine-design.md`   | 選股引擎設計規格 | 與 `stock-selection-deep-reflection.md` 重疊約 40% | 🔀 合併                                 |
| `stock-selection-deep-reflection.md` | 選股策略深度反思 | 同上                                               | 🔀 合併為 `stock-selection-strategy.md` |

**合併建議：**

```
stock-selection-engine-design.md (保留設計規格部分)
+ stock-selection-deep-reflection.md (保留問題分析部分)
→ stock-selection-strategy.md (合併後)
```

#### 重複 2：Phase 0-4 相關

| 檔案                                 | 內容                 | 重複點                                             | 建議                                 |
| ------------------------------------ | -------------------- | -------------------------------------------------- | ------------------------------------ |
| `phase0-data-collection-strategy.md` | Phase 0 資料收集策略 | 與 `phase0-4-implementation-summary.md` 重疊約 60% | 🔀 合併                              |
| `phase0-4-implementation-summary.md` | Phase 0-4 實作總結   | 同上                                               | 🔀 合併為 `phase0-implementation.md` |
| `phase4-research-system-analysis.md` | Phase 4 研究系統分析 | 可獨立，但部分內容已在 implementation-summary      | ⚠️ 精簡                              |

**合併建議：**

```
phase0-data-collection-strategy.md
+ phase0-4-implementation-summary.md
→ phase0-implementation.md (合併後)

phase4-research-system-analysis.md
→ 精簡為 phase4-research-notes.md (只保留問題分析)
```

---

### 🗑️ 臨時/過時文檔（建議刪除或歸檔）

#### Debug 報告（已解決的問題）

| 檔案                                                           | 用途              | 最後更新   | 建議    |
| -------------------------------------------------------------- | ----------------- | ---------- | ------- |
| `DEBUG_REPORT_2026-03-27_FAST_REFRESH_FIX.md`                  | Fast Refresh 修復 | 2026-03-27 | 🗑️ 歸檔 |
| `DEBUG_REPORT_2026-03-27_FULL_SWEEP.md`                        | 全面 debug        | 2026-03-27 | 🗑️ 歸檔 |
| `DEBUG_REPORT_2026-03-27_LAYER2_HOOKS.md`                      | Hook 層 debug     | 2026-03-27 | 🗑️ 歸檔 |
| `DEBUG_REPORT_2026-03-27_LAYER3_EDGE_CASES.md`                 | 邊界情況 debug    | 2026-03-27 | 🗑️ 歸檔 |
| `DEBUG_REPORT_2026-03-28_DOSSIER_REPORT_UTILS_EXTRACTION.md`   | 工具函式提取      | 2026-03-28 | 🗑️ 歸檔 |
| `DEBUG_REPORT_2026-03-28_FAST_REFRESH_BOUNDARY_CONVERGENCE.md` | Fast Refresh 收斂 | 2026-03-28 | 🗑️ 歸檔 |

**建議：** 這些是已解決問題的記錄，對未來參考價值低。

- 若有重要教訓，提取到 `docs/lessons-learned.md`
- 其餘移至 `/docs/archive/debug-logs/` 或直接刪除

**小計：6 檔 → 建議刪除或歸檔**

#### Optimization 報告（已完成的優化）

| 檔案                                                                     | 用途               | 最後更新   | 建議    |
| ------------------------------------------------------------------------ | ------------------ | ---------- | ------- |
| `OPTIMIZATION_REPORT_2026-03-27_FAST_REFRESH_HEALTHCHECK_DIAGNOSTICS.md` | Healthcheck 優化   | 2026-03-27 | 🗑️ 歸檔 |
| `OPTIMIZATION_REPORT_2026-03-27_TESTS_TS_HEALTHCHECK.md`                 | TypeScript 測試    | 2026-03-27 | 🗑️ 歸檔 |
| `OPTIMIZATION_REPORT_2026-03-27_WEB_VITALS_RUNTIME_ADAPTER.md`           | Web Vitals         | 2026-03-27 | 🗑️ 歸檔 |
| `OPTIMIZATION_REPORT_2026-03-28_REMOTE_DIAGNOSTICS_ADAPTERS.md`          | Remote Diagnostics | 2026-03-28 | 🗑️ 歸檔 |
| `PERFORMANCE_REPORT_2026-03-28_MEMORY_PRESSURE_REDUCTION.md`             | 記憶體優化         | 2026-03-28 | 🗑️ 歸檔 |

**建議：** 這些是已完成的優化記錄。

- 若有永久性的配置變更，確保已寫入相關配置文件
- 移至 `/docs/archive/optimization-logs/` 或直接刪除

**小計：5 檔 → 建議歸檔**

#### 臨時配置文檔

| 檔案                          | 用途             | 最後更新 | 建議        |
| ----------------------------- | ---------------- | -------- | ----------- |
| `LOCAL_DEV_CONFIG_UPDATE.md`  | 本地開發配置更新 | 未知     | 🗑️ 檢查     |
| `LOCAL_DEV_SETUP_COMPLETE.md` | 本地開發設置完成 | 未知     | 🗑️ 檢查     |
| `SAFARI_CONNECTION_FIX.md`    | Safari 連接修復  | 未知     | 🗑️ 檢查     |
| `SERVER_ACCESS_GUIDE.md`      | 伺服器訪問指南   | 未知     | ⚠️ 可能有用 |

**建議：** 檢查這些文檔的內容：

- 若配置已寫入 `.env.example` 或 `README.md`，可刪除
- 若仍有參考價值，移至 `/docs/guides/`

**小計：4 檔 → 需檢查內容後決定**

---

### 📚 歷史/參考文檔（保留但歸檔）

| 檔案                        | 用途                | 建議                                           |
| --------------------------- | ------------------- | ---------------------------------------------- |
| `HANDBOOK_FOR_AI_AGENTS.md` | AI 代理手冊（舊版） | 📚 歸檔，已被 `AI_COLLABORATION_GUIDE.md` 取代 |
| `QUICK_START.md`            | 快速開始指南        | 📚 保留或合併到 `USER_GUIDE_COMPLETE.md`       |

**小計：2 檔**

---

## 清理後文檔結構建議

### 新結構

```
docs/
├── README.md                    ← 新增：文檔索引
├── AI_COLLABORATION_GUIDE.md   ← 核心：AI 協作規則
├── PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md  ← 核心：架構
├── USER_GUIDE_COMPLETE.md      ← 核心：使用者指南
├── THREE_KEY_POINTS_DISCUSSION.md  ← 策略：付費/停損/籌碼
├── MY_TW_COVERAGE_ANALYSIS.md  ← 策略：競品分析
├── stock-selection-strategy.md ← 策略：選股（合併後）
│
├── guides/                      ← 新增：使用指南
│   ├── server-access.md        ← 從 SERVER_ACCESS_GUIDE.md 移來
│   └── quick-start.md          ← 從 QUICK_START.md 移來
│
├── specs/                       ← 規格文件（從 superpowers/specs 移來）
│   ├── phase0-implementation.md       ← 合併後
│   └── phase4-research-notes.md       ← 精簡後
│
├── status/                      ← 狀態文件
│   ├── current-work.md         ← 當前工作
│   └── ai-collaboration-channel.md
│
├── lessons-learned.md          ← 新增：重要教訓總結
│
└── archive/                     ← 歸檔區
    ├── strategy/               ← 策略討論歷史
    ├── debug-logs/             ← Debug 報告
    ├── optimization-logs/      ← 優化報告
    └── historical/             ← 歷史文檔
```

---

## 清理行動清單

### 第一階段：合併重複文檔（優先）

- [ ] **合併選股策略文檔**
  - 讀取 `stock-selection-engine-design.md` 和 `stock-selection-deep-reflection.md`
  - 提取設計規格到 `stock-selection-strategy.md`
  - 提取問題分析到同一檔案的不同章節
  - 刪除原始兩檔

- [ ] **合併 Phase 0-4 文檔**
  - 讀取 `phase0-data-collection-strategy.md` 和 `phase0-4-implementation-summary.md`
  - 合併為 `phase0-implementation.md`
  - 精簡 `phase4-research-system-analysis.md` 為 `phase4-research-notes.md`
  - 刪除原始檔案

**預計減少：** 4 檔 → 2 檔（減少 2 檔）

---

### 第二階段：歸檔臨時文檔

- [ ] **歸檔 Debug 報告**
  - 建立 `/docs/archive/debug-logs/`
  - 移動 6 個 DEBUG_REPORT 檔案
  - 或直接刪除（已解決的問題）

- [ ] **歸檔 Optimization 報告**
  - 建立 `/docs/archive/optimization-logs/`
  - 移動 5 個 OPTIMIZATION 檔案
  - 或直接刪除（已完成的優化）

**預計減少：** 11 檔 → 0 檔（減少 11 檔，移至 archive）

---

### 第三階段：檢查並決定

- [ ] **檢查臨時配置文檔**
  - 讀取 `LOCAL_DEV_CONFIG_UPDATE.md`
  - 讀取 `LOCAL_DEV_SETUP_COMPLETE.md`
  - 讀取 `SAFARI_CONNECTION_FIX.md`
  - 讀取 `SERVER_ACCESS_GUIDE.md`
  - 決定保留或刪除

**預計減少：** 4 檔 → 1-2 檔（減少 2-3 檔）

---

### 第四階段：重組結構

- [ ] **建立新目錄結構**
  - 建立 `/docs/guides/`
  - 建立 `/docs/specs/`
  - 建立 `/docs/status/`
  - 建立 `/docs/archive/`

- [ ] **移動文件到新位置**
  - 移動 `superpowers/specs/*.md` 到 `/docs/specs/`
  - 移動 `superpowers/status/*.md` 到 `/docs/status/`
  - 移動 `HANDBOOK_FOR_AI_AGENTS.md` 到 `/docs/archive/historical/`

- [ ] **建立文檔索引**
  - 建立 `docs/README.md`
  - 列出所有核心文檔和用途
  - 提供閱讀順序建議

---

## 清理前後對比

| 項目                  | 清理前 | 清理後       | 減少              |
| --------------------- | ------ | ------------ | ----------------- |
| **核心文檔**          | 5 檔   | 5 檔         | 0                 |
| **策略文檔**          | 7 檔   | 4 檔         | -3                |
| **Debug 報告**        | 6 檔   | 0 檔         | -6                |
| **Optimization 報告** | 5 檔   | 0 檔         | -5                |
| **臨時配置**          | 4 檔   | 1 檔         | -3                |
| **歷史文檔**          | 2 檔   | 2 檔（歸檔） | 0                 |
| **總計**              | ~42 檔 | ~25 檔       | **-17 檔 (-40%)** |

---

## 建議的 docs/README.md

```markdown
# 文檔索引

最後更新：2026-03-28

## 🚀 快速開始

### 新使用者

1. [使用者指南](USER_GUIDE_COMPLETE.md) - 完整功能說明

### 新開發者/AI

1. [AI 協作指南](AI_COLLABORATION_GUIDE.md) - 協作規則
2. [系統架構](PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md) - 技術架構
3. [當前工作](superpowers/status/current-work.md) - 進行中任務

## 📚 核心文檔

| 文檔                                                     | 用途        | 讀者            |
| -------------------------------------------------------- | ----------- | --------------- |
| [AI 協作指南](AI_COLLABORATION_GUIDE.md)                 | AI 協作規則 | 所有 AI、開發者 |
| [系統架構](PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md) | 技術架構    | 開發者、AI      |
| [使用者指南](USER_GUIDE_COMPLETE.md)                     | 功能說明    | 使用者          |
| [當前工作](superpowers/status/current-work.md)           | 進行中任務  | 開發者、AI      |

## 📊 策略文檔

| 文檔                                           | 用途                    |
| ---------------------------------------------- | ----------------------- |
| [選股策略](specs/stock-selection-strategy.md)  | 選股引擎設計與反思      |
| [付費機制討論](THREE_KEY_POINTS_DISCUSSION.md) | 付費、停損/加倉、籌碼面 |
| [競品分析](MY_TW_COVERAGE_ANALYSIS.md)         | My-TW-Coverage 分析     |

## 📁 目錄結構
```

docs/
├── 核心文檔（必讀）
├── guides/ 使用指南
├── specs/ 規格文件
├── status/ 狀態文件
└── archive/ 歸檔區

```

```

---

## 執行建議

### 立即執行（今天）

1. **合併選股策略文檔**（30 分鐘）
2. **合併 Phase 0-4 文檔**（30 分鐘）
3. **建立 archive 目錄**（5 分鐘）
4. **移動 Debug/Optimization 報告**（10 分鐘）

### 本週執行

1. **檢查臨時配置文檔**（15 分鐘）
2. **建立新目錄結構**（15 分鐘）
3. **建立 docs/README.md**（20 分鐘）

### 不需要急著做

- 刪除歸檔文件（可先保留 30 天）
- 重組 `superpowers` 目錄（等當前工作完成）

---

## 結論

**建議清理：**

- **合併：** 4 檔 → 2 檔
- **歸檔：** 11 檔（Debug + Optimization）
- **刪除：** 2-3 檔（臨時配置）
- **總減少：** 約 40% 文檔數量

**保留原則：**

- 核心架構文檔 ✅
- 當前工作狀態 ✅
- 策略討論（有歷史價值）⚠️
- 已解決問題的 debug 報告 🗑️
- 已完成的優化報告 🗑️

**下一步：** 請確認是否執行上述清理建議。
