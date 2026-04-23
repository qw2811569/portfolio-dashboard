# Mobile Sticky Policy · 2026-04-24

**日期**：2026-04-24
**狀態**：✅ 決議
**來源**：R139 Round 2 Codex 建議 + Round 3 Claude 接受 + 用戶拍板
**相關 commit**：`b8eb2ec fix(UX-21): mobile sticky header shrink`

## 背景

2026-04-24 用戶在實機 iPhone 回報「凍結頂部影響閱讀性」。Root cause：`src/components/Header.jsx` 966 行 monolith 整塊 `position: sticky` · 無 mobile breakpoint · 在 iPhone 375px 下 sticky 區實測 339-349 px（iPhone SE 螢幕的 40-50%）。

UX-21 修好 Header 後 · Codex 在 R139 Round 2 進一步發現 `src/components/news/NewsPanel.jsx:707` 也有同樣的 sticky + 無 mobile breakpoint 問題 · 即將觸發 UX-22a。

為防未來新 component 重犯同錯 · 立此 policy 做 repo-level 紀律。

## 規則

### ✅ 允許的 mobile sticky

**只有一處**：主 layout 頂部 · `app-shell` 內的 **title row + tabs row**（合計 ≤ 100px）。

實作落點：`src/components/Header.jsx` · 透過 `src/hooks/useIsMobile.js` 判斷 ≤ 768px 時分離 sticky-zone / scroll-zone。

### ❌ 禁止的 mobile sticky

**任何其他 panel / card / sidebar / rail / section** 在 mobile（≤ 768px）**預設都不得 sticky**。

包括但不限於：

- Panel 內的 side rail（NewsPanel right rail 類）
- Dashboard hero 內的 meta bar
- Table / List 的 header row
- Drawer / Modal 的 footer action bar
- Filter / Chip 列

### 例外條款

若某 component 有**強 UX 證據**需要 mobile sticky · 必須同時滿足：

1. **有實機截圖**證明非 sticky 會造成 UX 退化
2. **PR / brief 明文引用**此 policy 並說明為何例外
3. **工時 ≥ 1 hr 實測**（Playwright iOS Safari）· 確認 sticky 區 ≤ 60px 且不與其他 sticky 區重疊
4. Claude 或用戶拍板允准

## Desktop 不受此 policy 約束

桌面（≥ 769px）sticky 如何用是設計選擇 · 本 policy 不管。

## 驗證建議

- New component PR 若含 `position: 'sticky'` / `position: 'fixed'` · grep reviewer 必須確認是否踩此 policy
- 未來可加 lint rule 或 pre-commit grep gate · 自動偵測 `src/components/**/*.jsx` 新增 sticky / fixed 是否有 mobile breakpoint 守護

## 追溯與豁免

- UX-21 / Header.jsx：✅ 符合
- UX-22a / NewsPanel.jsx：🔴 不符合 · 即將修（2026-04-24 ongoing）
- 其他 component（WatchlistPanel / Toast / CmdKPalette / Dialogs）：Codex R139 Round 2 已 grep · Toast / Dialogs / CmdKPalette 是 overlay fixed（非 sticky · 不受此 policy 影響）· WatchlistPanel 無 sticky · 無需動

## 與既有決議的關係

- 延續 `2026-04-16-product-stage-stability-first.md`（UX / 呈現層優先於 infra）
- 與 R120 Q-D / Q-P scope 無衝突
- 無 supersede 其他 decision
