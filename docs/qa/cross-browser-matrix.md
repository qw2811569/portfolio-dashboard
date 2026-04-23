# Cross-Browser Matrix

> 日期：2026-04-24  
> 對應：`docs/portfolio-spec-report/todo.md:332` `Q06`「Cross-browser matrix with real iOS Safari priority」；`docs/portfolio-spec-report/todo.md:472` 要求 matrix 檔存在、iOS Safari first-class、且 3 條 critical route 有 pass/fail evidence slot。  
> 主要依據：SA §3.3、§4.2、§5；`playwright.config.mjs`；`tests/e2e/goldenPath.spec.mjs`；`tests/e2e/uxSimulation.spec.mjs`；`scripts/full-smoke.mjs`；`tests/e2e/snapshots/*`；`docs/release/internal-beta-signoff.md`；`docs/release/internal-beta-checklist.md`

## 1. Browser 矩陣

SA §2.3 已把「Web，優先考慮 iOS Safari」寫成產品定位；SA §3.3 要求兩位 persona 都能信任數字與來源、且「不被嚇到」；SA §4.2 又要求 `7865` insider 情境必須 per-portfolio 處理。這代表 cross-browser 不能只做 desktop happy path，也不能只驗單一 persona。

`playwright.config.mjs` 目前只定義三個 project：`chromium` = `Desktop Chrome`、`webkit` = `Desktop Safari`、`ios-safari` = `iPhone 14`。本機實際 Playwright 版本為 `1.59.1`；實際 browser version 由本機 Playwright binary 啟動後取得：Chromium `147.0.7727.15`、WebKit `26.4`。

| Browser             | Version                                                                   | Engine | 覆蓋範圍                                                                                             | 狀態                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Chromium（desktop） | `147.0.7727.15` · `Desktop Chrome` · viewport `1280x720`                  | Blink  | SA §5.3-§5.10 八頁 `goldenPath` smoke；目前 Playwright suite discovery 的 8 個 spec 都掛在此 project | ✅                                                                                                                       |
| iOS Safari          | `26.4` · `iPhone 14` preset · viewport `390x664` · UA 含 `iPhone OS 16_0` | WebKit | `goldenPath` 8-route smoke + Q06 priority lane（Dashboard / Holdings / Daily）                       | 🟡 `UX-22a` 前破；`scripts/full-smoke.mjs:221` 仍明寫「Playwright webkit + iOS viewport cover 90% · 剩實機 10% pending」 |
| WebKit（desktop）   | `26.4` · `Desktop Safari` · viewport `1280x720`                           | WebKit | SA §5.3-§5.10 八頁 `goldenPath` smoke；目前 Playwright suite discovery 的 8 個 spec 都掛在此 project | ✅                                                                                                                       |

補充：

- `ios-safari` 是 Playwright WebKit + `devices['iPhone 14']`，不是 owner 真機 Safari；真機觸控、dynamic toolbar、safe-area 仍要靠 M-U3 補。
- `tests/e2e/uxSimulation.spec.mjs` 另有 `UX21_VIEWPORTS` 測量 lane：`ios-safari` 會跑 `iPhone SE (375x667)`、`iPhone 14 (390x844)`；`chromium` 會跑 `Desktop Chrome (1280x900)`。這些是補強 viewport evidence，不是八頁 direct baseline lane。

## 2. Page × Viewport 覆蓋

本節的 direct baseline 只認 `tests/e2e/snapshots/{chromium,ios-safari,webkit}/` 與 `tests/e2e/goldenPath.spec.mjs`，因為 `Q06` 需要的是 route/page matrix，不是單一元件量測圖。`goldenPath.spec.mjs` 的預設 persona 是 `7865`：

- `const TARGET_PORTFOLIO_ID = ... || '7865'`
- `const TARGET_PORTFOLIO_SCENARIO = ... || 'golden-path-7865'`

因此，這三個 snapshot dir 目前可直接回指的 direct page baseline 幾乎全是 `7865` lane；`me` / `overview` 在這一條 baseline lane 目前沒有 direct page screenshot。

狀態規則：

- `✅`：baseline 存在，且在本輪 2026-04-24 page-baseline 視窗內刷新。
- `🟡`：baseline 存在，但最後 direct page baseline 刷新仍是 2026-04-19 wave。
- `❌`：無 direct page baseline 檔。

目前 direct page baseline 沒有任何格子到 `✅`。2026-04-24 的新證據主要在 `tests/e2e/snapshots/ux-21-verify/`，但那是 Dashboard/header-only 量測圖，不納入八頁 direct baseline 計數。

### Persona `7865`（default `golden-path-7865`）

| Page（SA §5） | Chromium（desktop）                                                    | iOS Safari                                                               | WebKit（desktop）                                                    | 備註                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard     | 🟡 `tests/e2e/snapshots/chromium/01-home.png` · `2026-04-19`           | 🟡 `tests/e2e/snapshots/ios-safari/01-home.png` · `2026-04-19`           | 🟡 `tests/e2e/snapshots/webkit/01-home.png` · `2026-04-19`           | 對應 SA §5.3                                                                                                                                                      |
| Holdings      | 🟡 `tests/e2e/snapshots/chromium/02-owner-holdings.png` · `2026-04-19` | 🟡 `tests/e2e/snapshots/ios-safari/02-owner-holdings.png` · `2026-04-19` | 🟡 `tests/e2e/snapshots/webkit/02-owner-holdings.png` · `2026-04-19` | 對應 SA §5.4                                                                                                                                                      |
| Events        | 🟡 `tests/e2e/snapshots/chromium/04-events.png` · `2026-04-19`         | 🟡 `tests/e2e/snapshots/ios-safari/04-events.png` · `2026-04-19`         | 🟡 `tests/e2e/snapshots/webkit/04-events.png` · `2026-04-19`         | 對應 SA §5.5                                                                                                                                                      |
| News          | 🟡 `tests/e2e/snapshots/chromium/05-news.png` · `2026-04-19`           | 🟡 `tests/e2e/snapshots/ios-safari/05-news.png` · `2026-04-19`           | 🟡 `tests/e2e/snapshots/webkit/05-news.png` · `2026-04-19`           | iOS Safari baseline 仍是 `UX-22a` 修前圖                                                                                                                          |
| Daily         | 🟡 `tests/e2e/snapshots/chromium/06-daily.png` · `2026-04-19`          | 🟡 `tests/e2e/snapshots/ios-safari/06-daily.png` · `2026-04-19`          | 🟡 `tests/e2e/snapshots/webkit/06-daily.png` · `2026-04-19`          | 對應 SA §5.7                                                                                                                                                      |
| Research      | 🟡 `tests/e2e/snapshots/chromium/03-research.png` · `2026-04-19`       | 🟡 `tests/e2e/snapshots/ios-safari/03-research.png` · `2026-04-19`       | 🟡 `tests/e2e/snapshots/webkit/03-research.png` · `2026-04-19`       | 對應 SA §5.8                                                                                                                                                      |
| Trade         | ❌                                                                     | ❌                                                                       | ❌                                                                   | `goldenPath` step 8 會驗 `trade-panel` / upload / parse / write-back，但沒有在 Trade route 留 direct page screenshot；存下來的是回到 Log 後的 `08-upload-log.png` |
| Log           | 🟡 `tests/e2e/snapshots/chromium/07-trade-log.png` · `2026-04-19`      | 🟡 `tests/e2e/snapshots/ios-safari/07-trade-log.png` · `2026-04-19`      | 🟡 `tests/e2e/snapshots/webkit/07-trade-log.png` · `2026-04-19`      | 三 project 另各自還有 `08-upload-log.png` 作為寫入後 evidence                                                                                                     |

### Persona `me`

| Page（SA §5） | Chromium（desktop） | iOS Safari | WebKit（desktop） | 備註                                                   |
| ------------- | ------------------- | ---------- | ----------------- | ------------------------------------------------------ |
| Dashboard     | ❌                  | ❌         | ❌                | `goldenPath` snapshot dir 無 `me` direct page baseline |
| Holdings      | ❌                  | ❌         | ❌                | 同上                                                   |
| Events        | ❌                  | ❌         | ❌                | 同上                                                   |
| News          | ❌                  | ❌         | ❌                | 同上                                                   |
| Daily         | ❌                  | ❌         | ❌                | 同上                                                   |
| Research      | ❌                  | ❌         | ❌                | 同上                                                   |
| Trade         | ❌                  | ❌         | ❌                | 同上                                                   |
| Log           | ❌                  | ❌         | ❌                | 同上                                                   |

### Persona `overview`

| Page（SA §5） | Chromium（desktop） | iOS Safari | WebKit（desktop） | 備註                                                                           |
| ------------- | ------------------- | ---------- | ----------------- | ------------------------------------------------------------------------------ |
| Dashboard     | ❌                  | ❌         | ❌                | `overview` 目前只有 `ux-21-verify` header measurement，無 direct page baseline |
| Holdings      | ❌                  | ❌         | ❌                | 同上                                                                           |
| Events        | ❌                  | ❌         | ❌                | 同上                                                                           |
| News          | ❌                  | ❌         | ❌                | 同上                                                                           |
| Daily         | ❌                  | ❌         | ❌                | 同上                                                                           |
| Research      | ❌                  | ❌         | ❌                | 同上                                                                           |
| Trade         | ❌                  | ❌         | ❌                | 同上                                                                           |
| Log           | ❌                  | ❌         | ❌                | 同上                                                                           |

補充但不列入 direct baseline 計數：

- `tests/e2e/snapshots/ux-21-verify/` 已有 2026-04-24 的 Dashboard/header-only 量測圖：
  - `ios-safari`：`iphone-se` + `iphone-14`，且 `me` / `7865` / `overview` 三 persona 都有 after-shot。
  - `chromium`：`desktop-1280`，且 `me` / `7865` / `overview` 三 persona 都有 after-shot。
  - `webkit`：沒有對應 `ux-21-verify` row。
- 這些檔證明 viewport/persona smoke 在跑，但不等於 SA §5 八頁都有 direct baseline。

## 3. 回歸測試契約

`scripts/full-smoke.mjs:248-257` 目前直接跑：

```bash
npx playwright test tests/e2e --reporter=html,json
```

也就是把 `playwright.config.mjs` 的三個 project 全部吃進去：`chromium`、`webkit`、`ios-safari`。`scripts/full-smoke.mjs:259-270` 另外把 `test-results/results.json` 視為 hard requirement；沒有 JSON report 就直接 fail。`scripts/full-smoke.mjs:221` 同時明寫：Playwright 只覆蓋 `Q06` 的 90%，剩餘 10% 由真機 iOS Safari 補。

### 3.1 Spec × Project × Assertion

| Spec                          | Project                                                                                  | Screenshot lane                                                                                                     | Data contract                                                              | Interaction                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `agentBridge.spec.mjs`        | `chromium` / `webkit` / `ios-safari`                                                     | ✅ `agent-01-hero.png` / `agent-02-focus.png` / `agent-03-week.png`；artifact capture，非 `toHaveScreenshot()` diff | —                                                                          | ✅ login + scroll capture                                                             |
| `goldenPath.spec.mjs`         | `chromium` / `webkit` / `ios-safari`                                                     | ✅ `01-home` 到 `09-logout`；artifact capture，非 `toHaveScreenshot()` diff                                         | △ route shell / selected option / panel visibility 層級                    | ✅ portfolio switch、tab flow、upload、log write-back、logout                         |
| `dataErrorStates.spec.mjs`    | `chromium` / `webkit` / `ios-safari`                                                     | —                                                                                                                   | ✅ mock `401/404` 後 error UI copy / state visible                         | ✅ tab 切換與寫入流程觸發                                                             |
| `loadingEmptyStates.spec.mjs` | `chromium` / `webkit` / `ios-safari`                                                     | —                                                                                                                   | ✅ skeleton / empty-state render contract                                  | △ cold-start / seeded localStorage                                                    |
| `personaCanonical.spec.mjs`   | `chromium` / `webkit` / `ios-safari`                                                     | —                                                                                                                   | ✅ `me` / `7865` rendered holding codes 必須等於 canonical fixture         | ✅ select persona + open holdings                                                     |
| `keyboardNav.spec.mjs`        | discovery 在 3 project；runtime 會 skip `ios-safari`                                     | ✅ `keyboard-tab-01..05`；artifact capture，非 diff assert                                                          | ✅ focus ring 可見、outline width、contrast ratio                          | ✅ desktop `Tab` traversal                                                            |
| `trackedStocksSync.spec.mjs`  | discovery 在 3 project；runtime 只在 `chromium + localhost + BLOB_READ_WRITE_TOKEN` 有效 | —                                                                                                                   | ✅ `/api/tracked-stocks` `POST 200`、localStorage、Blob record、sync badge | ✅ upload + manual trade + sync                                                       |
| `uxSimulation.spec.mjs`       | `chromium` / `webkit` / `ios-safari`                                                     | ✅ `ux-round2-*` / `ux-21-verify/*`；artifact capture，非 diff assert                                               | ✅ persona holdings alignment + error capture evidence                     | ✅ live audit flow across dashboard / holdings / events / news / daily / agent bridge |

補充：

- `pendingDecisions.spec.mjs` 不在 `npx playwright test tests/e2e --list` 的 discovery 內，故不算 `full-smoke` CI gate 的 Playwright project matrix。
- 目前 repo 內沒有任何 e2e spec 使用 `expect(page).toHaveScreenshot()`；視覺 lane 仍是「artifact baseline + 人工比對」，這也符合 `Q04` 仍在 beta+1、尚未升 ship-before 的現況。

### 3.2 CI Gate 的最小覆蓋

- `full-smoke` 必須在三個 Playwright project 都可啟動，並產出 `test-results/results.json`。
- Playwright exit code 非 `0`，或 JSON report 缺失，視為 `T72b` / `Q06` 未過。
- ship-before 的 cross-browser 最小自動覆蓋，至少包含：
  - `goldenPath.spec.mjs` 三 project 都可跑；
  - `agentBridge.spec.mjs` 三 project 都可跑；
  - 其餘 discovered suite 不得因 project drift 直接 crash；
  - `keyboardNav.spec.mjs` 的 desktop lane 仍可驗；
  - `trackedStocksSync.spec.mjs` 即使因環境條件 skip，也不得移除其 local-only contract。
- 真正 blocking 的 iOS Safari 收口，仍需搭配 owner manual smoke；這一點已被 `docs/release/internal-beta-checklist.md:29` 與 `docs/release/internal-beta-signoff.md:70` 保留成 manual gate。

### 3.3 Three Critical Route Pass/Fail Evidence Slots

`todo.md:472` 明寫 Q06 需要「Three critical routes have explicit pass/fail evidence slots」。本 repo 目前的 manual slot 應如下固定：

| Critical route | SA   | Persona      | Evidence slot                                                                        | 目前狀態     |
| -------------- | ---- | ------------ | ------------------------------------------------------------------------------------ | ------------ |
| Dashboard      | §5.3 | `me`, `7865` | `.tmp/m-u3-iphone-smoke/findings.md` → `## Route 1 · Dashboard` + 同目錄 screenshots | pending M-U3 |
| Holdings       | §5.4 | `me`         | `.tmp/m-u3-iphone-smoke/findings.md` → `## Route 2 · Holdings` + 同目錄 screenshots  | pending M-U3 |
| Daily          | §5.7 | `7865`       | `.tmp/m-u3-iphone-smoke/findings.md` → `## Route 3 · Daily` + 同目錄 screenshots     | pending M-U3 |

## 4. 已知 gap

| Gap                                      | 依據                                                                                                                                                                                        | 狀態                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `UX-22a` NewsPanel mobile collapse       | `docs/decisions/2026-04-24-mobile-sticky-policy.md` 已把 `NewsPanel.jsx:707` 列為違反 mobile sticky policy；現有 `tests/e2e/snapshots/ios-safari/05-news.png` 仍是 2026-04-19 修前 baseline | pending · 本 L8 前修                    |
| `UX-21` iPad `768` / landscape edge case | `docs/portfolio-spec-report/sd.md:666-672` 的 QA gate 明寫要做 `iPad 768 實測`；目前 `ux-21-verify` 只有 `iphone-se`、`iphone-14`、`desktop-1280`，沒有 iPad row                            | pending · audit 中                      |
| 真機觸控 / Safari dynamic toolbar        | Playwright `ios-safari` project 只能覆蓋 WebKit + iPhone 14 preset；`docs/release/internal-beta-checklist.md:29` 與 `docs/release/internal-beta-signoff.md:70` 都明文保留 real-device gate  | M-U3 smoke scope · 非 Playwright 可覆蓋 |

## 5. 維護

以下任一變動，都必須同步更新這份 matrix：

| 觸發條件                                                                     | 這份 matrix 必須改什麼                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 有人改 `playwright.config.mjs`                                               | 更新第 1 節 browser/version/engine/viewport；更新第 2 節 viewport 欄；更新第 3 節 project 契約             |
| 有人新增 Playwright project                                                  | 第 1 節加 browser row；第 2 節加新 viewport 欄；第 3 節補 spec × project mapping                           |
| 有人改 `goldenPath.spec.mjs` 的 default persona、snapshot 名稱或 route steps | 第 2 節 persona/page baseline 路徑要重掃；第 3 節 interaction contract 要同步                              |
| 有人新增或刪除 SA §5 route                                                   | 第 2 節 page row 要同步；若 route 未進 smoke，必須顯式標 `❌` 或補 manual lane                             |
| 有人刷新 baseline 或補 `ux-21-verify` / M-U3 實機證據                        | 更新第 2 節 last-verified 日期；更新第 3.3 節 evidence slot 狀態；若 gap 已收口，更新第 4 節               |
| 有人把 `Q04` 升成真正 screenshot diff gate                                   | 第 3 節要把「artifact capture only」改成真實 diff assertion，並列出哪支 spec / 哪些 project 開始 hard-fail |

最低維護原則：

- 不接受只改 `playwright.config.mjs` 不改 matrix。
- 不接受只加新 page / 新 project 卻不補 baseline 狀態。
- 不接受把 `ios-safari` 當成 `webkit` 的別名；它在 Q06 中是 first-class lane，因為 SA 與 signoff 都把 iOS Safari 放在優先位。
