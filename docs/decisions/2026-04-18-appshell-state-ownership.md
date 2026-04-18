# AppShell State Ownership ADR

**日期**：2026-04-18  
**決議人**：Codex（依 R121 L0/T53 runbook）  
**狀態**：✅ 決議，作為 `T54/T55/T21` 的 owner map

## 背景

目前 runtime 真相分成兩套：

- canonical AppShell：`src/App.jsx` → `src/hooks/useAppRuntime.js` → `AppShellFrame.jsx`
- route-shell：`src/pages/PortfolioLayout.jsx` → `useRoutePortfolioRuntime.js`

route-shell 已明講是 migration-only，但它仍持有一部分 route-local persistence 與 setter。這讓 `OperatingContext`、portfolio snapshot、trade write exception、以及後續 `T54/T55` 的切邊界工作都缺乏單一 owner map。

本 ADR 的目標不是立刻重構，而是把「誰擁有哪一段 state」先寫死，讓後續拆 hook / cut mutation 時不再靠口頭共識。

## 歷史基礎承接（R135 merge）

這份 owner map 直接承接舊版 `Holding Dossier` 架構設計裡仍然成立的三條底線，避免 state ownership ADR 和資料層設計互相打架：

- `HoldingDossier` 仍是 detail pane / daily / research 共用的 canonical object，不回到各頁各自拼 context。
- stale-while-revalidate、partial success、timeout 仍是資料刷新規則；owner 變更不代表可以重新引入「等全部資料回來才分析」。
- 收盤價同步仍維持「收盤後每日一次、全域快取」的上游紀律；route-shell 不應因局部 view state 重新發明抓價節奏。

換句話說：舊設計裡的 **data shape / freshness discipline / workflow intent** 保留，這份 ADR 只正式推翻其中「owner boundary 還模糊」的部分。

## Owner Map

| State bucket                                                                                                | Current owner                                                     | Target owner                                                   | Rule                                                               |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| portfolio registry / active portfolio / view mode                                                           | `useAppRuntimeState` + refs；route-shell 另有一份 local copy      | canonical AppShell only                                        | route-shell 只讀，不再自管 source-of-truth                         |
| holdings / tradeLog / targets / fundamentals / newsEvents / analysisHistory / researchHistory / dailyReport | canonical AppShell + route-shell persistence 雙存                 | canonical AppShell only                                        | 所有 domain write 由 AppShell runtime 發出                         |
| `HoldingDossier` derived cache                                                                              | canonical AppShell rebuild + localStorage；route-shell 也能讀舊值 | canonical AppShell rebuild only                                | detail / daily / research 共用同一份 dossier                       |
| `OperatingContext` / next-action narrative                                                                  | panel context composer                                            | panel context composer                                         | 6 頁都讀同一個 object，不得 route-shell 自算                       |
| transient UI state (`tab`, filters, dialogs, relay/review/search selection)                                 | AppShell UI hooks；route pages 各自保留 view-state                | split owner                                                    | AppShell 管跨頁 transient；route-shell 只保留 URL/view-local state |
| cloud sync / bootstrap refs / save timers                                                                   | canonical AppShell refs                                           | canonical AppShell refs                                        | route-shell 不得接手同步責任                                       |
| `/trade` mutation exception                                                                                 | route-shell 目前仍有真寫入路徑                                    | canonical AppShell workflow；route-shell 只 preview / delegate | exception 必須顯式收斂，不可再是暗規則                             |

## Current State Machine

目前的 **state machine** 有兩條會互相踩到的線：

1. `boot`：AppShell 啟動、hydrate localStorage / cloud / market cache。
2. `route-hydrate`：route-shell 以自己的 `readPortfolioRuntimeSnapshot(...)` 讀一份近似資料。
3. `dual-live`：兩邊都能 render，且 route-shell 仍保留部分 setter / persistence。
4. `drift-risk`：當 write path 走 route-shell 或 legacy import path，canonical AppShell 可能晚一步才看到變更。

簡化表示：

```text
boot -> route-hydrate -> dual-live -> drift-risk
```

這條 current **state machine** 的核心問題不是讀不到資料，而是 owner 邊界不清：render surface 已在分層，mutation 還沒。

## Target State Machine

目標 **state machine** 只保留一套 domain owner：

1. `booting`：canonical AppShell 載入 registry / snapshot / refs。
2. `hydrated`：canonical AppShell 產出 live portfolio snapshot、holding dossiers、operating context。
3. `live`：所有 page surface 只讀 canonical runtime；route-shell 只做 URL / layout / view-state。
4. `degraded`：若某資料 lane 缺失，UI 顯示 degraded truth，但 owner 仍不改變。

簡化表示：

```text
booting -> hydrated -> live -> degraded/recovered
```

target **state machine** 的關鍵原則：

- domain state 只有 canonical AppShell 能 mutate
- route-shell 可以承載 navigation / route params / view-local filters
- `OperatingContext`、`HoldingDossier`、trade apply side effects 都從 canonical runtime 下發

## Migration State Machine

實際落地採三段式 **state machine**，避免一次切爆 localStorage 舊資料：

1. `observe`
   - 保留現況雙讀
   - 在 route-shell 舊 write path 補 deprecated warning / telemetry
2. `delegate`
   - route-shell mutation 改成 delegate 給 canonical AppShell
   - 保留 legacy read fallback，但新寫入不再走 route-local key
3. `cutover`
   - 刪除 route-local persistence setter
   - route-shell 只剩 read/view-state
4. `prune`
   - 移除 fallback 與 dead state
   - 測試只驗 canonical owner

簡化表示：

```text
observe -> delegate -> cutover -> prune
```

## Current / Target Matrix

| Concern                        | Current                                                 | Target                                                | Migration note                                         |
| ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| route page render data         | route runtime 直接讀 localStorage snapshot              | route page 讀 canonical context / loader-fed snapshot | 先 dual-read，再收斂到 canonical feed                  |
| holdings / log / targets write | AppShell 與 route runtime 都可能寫                      | 只 AppShell workflow 可寫                             | `/trade` exception 先顯式 delegate，再拔除 route write |
| backup import                  | route-shell 仍有 legacy localStorage import path        | canonical import boundary + schema gate               | Phase A warning，Phase B migrate                       |
| `OperatingContext`             | Holdings / Events / Daily / Research 已較接近 canonical | Trade / Log 也讀同一 object                           | `T21` 直接吃這份 owner map                             |
| dossier rebuild                | build on demand + persisted cache                       | canonical rebuild once, downstream consume only       | `T54` 用這格拆 composer / state slices                 |

## Cutover Trigger

只有同時滿足以下條件，才允許進 `cutover`：

1. `OperatingContext` 已覆蓋 Trade / Log，不再是 shell-only decoration。
2. `/trade` route 的真寫入已搬回 canonical AppShell runtime。
3. `useRoutePortfolioRuntime.js` 的 route-local persistence setter 已只剩 read fallback 或完全移除。
4. `useAppRuntime` / `useAppRuntimeComposer` 拆分後，domain slice owner 可被測試直接驗證。
5. `route-shell` prod guard、multi-portfolio fast-switch、portfolio persistence 測試全綠。

## 後續任務對位

- `T21`：讓 Trade / Log 真正消費 canonical `OperatingContext`
- `T54`：把 AppShell state 按 owner map 切成 bounded slices
- `T55`：把 route-shell containment 從口頭規矩變成硬邊界

這份 ADR 先定 owner，不先定實作細節。之後若要推翻，必須用新的 state-ownership ADR 明示變更理由。
