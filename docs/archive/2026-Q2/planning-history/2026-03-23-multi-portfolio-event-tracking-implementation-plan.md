# 多組合管理 + 事件追蹤強化 實作任務清單

> 依據設計文件：`docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md`
> 日期：2026-03-23
> 狀態：程式面完成，待手動 smoke test

## 目標

把多組合管理與事件追蹤強化拆成可逐步落地的實作順序，優先保護資料隔離，避免在「切組合 / 自動儲存 / 雲端同步」半改狀態下寫錯資料。

## 實作同步摘要

- Phase A-E 已完成並同步到程式
- 已完成機器驗證：`npm run build`
- 設計文件已同步：`docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md`
- 尚待手動 smoke：切組合隔離、overview 唯讀、tracking 追蹤、coachLessons 回寫、owner-only cloud gate

## 實作原則

1. 先做資料隔離與 migration，再做 UI
2. 先讓 owner-only local 模式穩定，再碰跨組合經驗回寫
3. 每一階段都要能獨立驗證，不要求一次做完所有功能

---

## Phase A：資料模型與安全隔離（已完成）

### Task A1：加入 portfolio 基本狀態與 key helper（已完成）

- 目標：新增 `portfolios`、`activePortfolioId`、`viewMode`、`portfolioTransition.isHydrating`
- 檔案：
  - `src/App.jsx`
- 要做：
  - 建立 `pfKey(pid, suffix)`、`savePortfolioData(pid, suffix, data)`、`loadPortfolioData(pid, suffix, fallback)`
  - 建立 `getEmptyFallback(suffix)`，補上 `notes`
  - 明確規定 `activePortfolioId` 只存真實 id，overview 用 `viewMode` 表示
- 完成條件：
  - App 還能正常啟動
  - 尚未切組合前，`me` 的資料讀寫行為與現在一致

### Task A2：補上 schema version 與一次性 migration（已完成）

- 目標：舊單組合資料可安全搬到 `pf-me-*`
- 檔案：
  - `src/App.jsx`
- 要做：
  - 新增 `pf-schema-version`
  - 啟動時掃描 legacy keys，而不是只看 `pf-holdings-v2`
  - 建立 `pf-portfolios-v1`、`pf-active-portfolio-v1`、`pf-view-mode-v1`
  - 把舊 key 複製到 `pf-me-*`，成功後才刪舊 key
- 完成條件：
  - 舊資料可搬移一次且可重跑
  - 搬移後 `me` 的既有持倉 / 事件 / 策略大腦仍能正常顯示

### Task A3：讓 backup / import 支援 portfolio-aware key（已完成）

- 目標：本機備份不會只備到舊單組合 key
- 檔案：
  - `src/App.jsx`
- 要做：
  - 更新 `LOCAL_BACKUP_FIELDS`
  - 納入 `pf-portfolios-v1`、`pf-active-portfolio-v1`、`pf-view-mode-v1`
  - 納入 `pf-{pid}-notes-v1`
  - 確認 import 不會覆蓋錯誤的組合 key
- 完成條件：
  - 匯出 JSON 內可看到多組合相關 key
  - 匯入後可以正確還原 active portfolio 與組合資料

---

## Phase B：切組合與總覽模式（已完成）

### Task B1：建立 `loadPortfolio(pid)` / `flushCurrentPortfolio()` / `switchPortfolio(pid)`（已完成）

- 目標：安全切組合，不把 A 的 state 存進 B
- 檔案：
  - `src/App.jsx`
- 要做：
  - 實作 `portfolioTransition.isHydrating`
  - 切換流程依序執行：`flushCurrentPortfolio` → reset transient state → `setViewMode("portfolio")` → `setActivePortfolioId(pid)` → `loadPortfolio(pid)`
  - 將 boot 邏輯拆成可重用的 `loadPortfolio` 流程
- 完成條件：
  - 來回切 `me` / `wang`，資料不互相污染
  - 切換途中沒有短暫顯示錯人的資料

### Task B2：所有 auto-save effect 加上 guard（已完成）

- 目標：hydrate / overview 期間任何 auto-save 都不寫資料
- 檔案：
  - `src/App.jsx`
- 要做：
  - 所有 `useEffect(save...)` 加上：
    - `ready`
    - `viewMode === "portfolio"`
    - `!portfolioTransition.isHydrating`
  - write 時改成 `savePortfolioData(activePortfolioId, suffix, data)`
- 完成條件：
  - 切組合時 localStorage 不會產生錯的 `pf-{pid}-*`
  - overview 模式完全唯讀

### Task B3：加入頂部組合切換器（已完成）

- 目標：可選擇 `me` / 其他組合 / 全部總覽
- 檔案：
  - `src/App.jsx`
- 要做：
  - 新增 dropdown UI
  - 顯示每組合持股數與總報酬率
  - 加入「全部總覽」「新增組合」「管理組合」入口
- 完成條件：
  - 能從 UI 切到不同 portfolio
  - overview 不會改寫任何資料

### Task B4：建立 overview mode 頁面（已完成）

- 目標：彙總所有 portfolio 的 holdings + events
- 檔案：
  - `src/App.jsx`
- 要做：
  - 顯示總市值 / 總損益
  - 顯示各組合摘要
  - 顯示重複持股
  - 顯示待處理事項（pending + tracking）
- 完成條件：
  - overview 只讀
  - 點組合摘要可切回該 portfolio

### Task B5：新增 / 管理組合 UI（已完成）

- 目標：可新增、改名、刪除組合，並編輯 notes
- 檔案：
  - `src/App.jsx`
- 要做：
  - 新增 portfolio 表單
  - 管理 modal / 區塊
  - notes 三欄位：`riskProfile` / `preferences` / `customNotes`
  - 刪除時一併移除該 pid 的所有 localStorage key
- 完成條件：
  - 可新增空白組合
  - 刪除組合不影響其他人資料

---

## Phase C：owner-only cloud gate（已完成）

### Task C1：boot 階段只讓 owner 讀雲端（已完成）

- 目標：非 owner 與 overview 完全不碰 `/api/brain`、`/api/research`
- 檔案：
  - `src/App.jsx`
- 要做：
  - 新增 `canUseCloud`
  - boot 階段只有 `activePortfolioId === "me"` 且 `viewMode === "portfolio"` 時才 fetch cloud
- 完成條件：
  - 切到 `wang` 時不會觸發全域 cloud fetch

### Task C2：auto-save 只讓 owner 寫雲端（已完成）

- 目標：防止非 owner 覆寫現有 Blob singleton
- 檔案：
  - `src/App.jsx`
- 要做：
  - `scheduleCloudSave` 外層加 `canUseCloud`
  - owner-only 更新 sync timestamp
- 完成條件：
  - `wang` / `mei` 的編輯只寫 localStorage，不打 `/api/brain`

---

## Phase D：事件模型升級（已完成）

### Task D1：升級事件 schema 與 status（已完成）

- 目標：`pending / tracking / closed`
- 檔案：
  - `src/App.jsx`
- 要做：
  - 事件結構新增 `eventDate`、`trackingStart`、`exitDate`、`priceAtEvent`、`priceAtExit`、`priceHistory`
  - 舊 `past` UI 與邏輯改為 `closed`
- 完成條件：
  - 舊事件仍可顯示
  - 新事件可用新欄位

### Task D2：實作 `pending -> tracking`（已完成）

- 目標：事件到日後自動開始追蹤
- 檔案：
  - `src/App.jsx`
  - 需要時可複用現有股價抓取 helper
- 要做：
  - 解析 `stocks` 代碼
  - 事件日抓 `priceAtEvent`
  - 成功後寫入 `eventDate`、`trackingStart`、`status = "tracking"`
- 完成條件：
  - 非交易日可延後到下一個有效報價日
  - API 失敗不會壞資料，只是留在 pending

### Task D3：實作 `priceHistory` 更新與 retention（已完成）

- 目標：tracking 事件會累積追蹤價格
- 檔案：
  - `src/App.jsx`
- 要做：
  - 每次開 App / 進入事件 Tab 更新當日價格
  - 同一天只留一筆
  - 單事件最多 90 筆
- 完成條件：
  - tracking 卡片可顯示目前股價 / 追蹤天數

### Task D4：實作 `tracking -> closed`（已完成）

- 目標：結案復盤前自動帶入 exit price 與預填 actual
- 檔案：
  - `src/App.jsx`
- 要做：
  - 點「結案復盤」時抓 `priceAtExit`
  - 自動算出預填 `actual`
  - 更新 status 為 `closed`
- 完成條件：
  - 使用者仍可手動修正 `actual`

---

## Phase E：策略大腦雙寫（已完成）

### Task E1：個人策略大腦維持隔離（已完成）

- 目標：每個 portfolio 的 brain 只反映自己的交易
- 檔案：
  - `src/App.jsx`
- 要做：
  - `submitReview` 與收盤分析都改成 portfolio-aware brain key
  - 非 owner 不影響 owner 的 `rules / stats`
- 完成條件：
  - 切組合後看到的 brain 完全不同

### Task E2：owner 寫入 `coachLessons`（已完成）

- 目標：跨組合經驗只進 owner 的 `coachLessons`
- 檔案：
  - `src/App.jsx`
- 要做：
  - `submitReview` 在非 owner 情境下直接讀寫 `pf-me-brain-v1`
  - append `coachLessons`，帶 `source / sourcePortfolioId / sourceEventId`
- 完成條件：
  - `wang` 的復盤會出現在 `me` 的 coachLessons
  - `me` 的 `rules / hitRate / totalAnalyses` 不被改壞

---

## Phase F：驗證與收尾（進行中）

### Task F1：手動驗證清單

- 已完成：
  - `npm run build`
- 待手動 smoke：
- 驗證 `me` 啟動後資料與現在一致
- 驗證新增 `wang` 後資料預設為空
- 驗證 `me -> wang -> me` 切換不互相污染
- 驗證 overview 唯讀且不寫入任何 key
- 驗證非 owner 不打 cloud API
- 驗證 legacy migration 可跑一次且不丟資料
- 驗證 tracking / closed 流程可正常復盤
- 驗證 owner 的 `coachLessons` 有收到他人經驗

### Task F2：文件同步（已完成）

- 檔案：
  - `docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md`
  - `docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md`

## 收尾狀態

- 程式實作：完成
- 設計文件同步：完成
- 任務清單同步：完成
- 自動化驗證：`npm run build` 已通過
- 人工 smoke test：待執行

---

## 實際完成順序

1. `A1 -> A2 -> A3`
2. `B1 -> B2`
3. `C1 -> C2`
4. `B3 -> B4 -> B5`
5. `D1 -> D2 -> D3 -> D4`
6. `E1 -> E2`
7. `F1 -> F2`

## 里程碑

- 里程碑 1：完成 Phase A + B2  
  資料隔離與 hydrate guard 已落地

- 里程碑 2：完成 Phase C + B4  
  多組合切換、overview 唯讀、owner-only cloud gate 已可用

- 里程碑 3：完成全部  
  multi-portfolio + tracking + coachLessons 已交付，剩人工 smoke
