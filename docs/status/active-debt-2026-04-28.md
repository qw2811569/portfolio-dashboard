# Active Debt · 2026-04-28

**用途**：merged from `conflicts.md` / `next-wave.md` / `pending-items.md` (3 份 R139-R141 sprint trail) — 萃取仍 unresolved 項目，原 3 份已歸檔到 `docs/archive/2026-Q2/status-history/`。

**Updated**：2026-04-28（R32 docs cleanup 收斂）
**基準 commit**：`30b5ae2`（R31 closed + R32 in flight）
**Owners**：每條應該有人；目前多數 unowned

---

## 🔴 Ship blocker（必先決策 / 不能再拖）

| ID                                                       | Item                                                                                                                                      | Why still open                                                                                                                                                                         | 建議                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Q06 / M-U3**                                           | 驗收 oracle：manual iPhone real-device vs Playwright simulation                                                                           | `internal-beta-signoff.md` + `cross-browser-matrix.md` 仍把 manual iPhone gate 列硬欄；memory `feedback_playwright_simulates_real_user.md` 又說 Playwright 模擬真人就算數 — 兩條軌並存 | 開 decision：「manual true-device required」OR 「Playwright + 限定補證」; signoff doc 必對齊 |
| **Route-shell contract**                                 | 文件 says route shell 是 "migration-only / limited" · 但 trade route 仍 live-write `routePages.actions.test.jsx`                          | 二選一：明文承認 trade write 例外；或真把 route write 封死 + 補 ErrorBoundary parity                                                                                                   |                                                                                              |
| **Holdings multi-level filter + detail pane**（R141 #3） | R6.10 archive + SA §5.4 + CLAUDE.md R7.5 連續漏提 4 次                                                                                    | 切成 R141b（filter chip bar）+ R141c（detail pane / drawer / `?stock=`），不要 2.5 day scope 一次爆開                                                                                  |                                                                                              |
| **Release docs SHA refresh**                             | `internal-beta-signoff.md` / `internal-beta-v1.md` / `cross-browser-matrix.md` 仍停在 `ab20a48` / `b8eb2ec`；應在 R31 closure (`30b5ae2`) | docs-only refresh + 對齊 R31 後的 1349/1349 tests + 19/19 HIGH closed                                                                                                                  |                                                                                              |

## 🟡 Follow-up（這輪可做 / <2 hr）

| ID                                             | Item                                                                                           | 現況 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| `tw-events-worker` failure marker call shape   | Gemini R8 audit 留下 isolated backend follow-up · 不碰 UI                                      |
| Hostile QA disposition appendix                | 把 Escape modal / two-tab sync / slow-network 原 open bug 與後續 fixed / no-current-repro 對齊 |
| Daily Principle docs cleanup                   | R120 Q-P4 決議 copy only · 但舊 architecture/todo 還寫 share card                              |
| `invite-feedback-flow.md` Google Doc/Form link | owner 手填外部連結（ship 前最後一哩）                                                          |
| Signoff legal 四欄 + owner signoff block       | 等 candidate SHA + Q06 truth 收斂後填                                                          |

## 🟢 Backlog（記住 · 不在這輪散開）

### UX-26 三件

- **Holdings wrapper dedupe** — canonical `HoldingsPanelChunk` vs route inline；非紅燈 · 等 R141 #3 一起收
- **Route-state parity audit** — domain-by-domain 列哪些 write 故意 blocked / 哪些 live
- **Route error-boundary parity audit** — canonical `AppPanels.jsx` 包 `ErrorBoundary` · route pages 沒包 → 同一 panel 兩 shell 不同 failure semantics

### UX-29 X1-X5 unified anxiety panel

- Round 9 Gemini 提：cohesive surface 而非零散 metric
- 先定義 Phase 1 最小 cohesive slice

### Gemini R8 race conditions（theoretical · backlog）

- `daily-events/latest.json` single-owner / `ifMatch`
- `telemetry-events.json` burst write merge race
- `analysis-history-index.json` / `research-index.json` race
- Monthly NDJSON pseudo-append race

### Infra / observability

- Deploy-time promotion gate（preview 不可寫 prod）
- 真正 screenshot-diff / pixel-alarm CI gate
- R121 monthly restore rehearsal recurring evidence cadence
- VM Claude wrapper auth 401 known broken（wrapper 本體存在 · auth 仍未通）

### Gemini R7 blindspot rerun

- quota 恢復後跑 Gemini 2.5 flash · 補一輪 blindspot review

---

## R31 sprint 已 close（不在 active debt · 留作對照）

R31 R29-R30 hostile QA 19/19 HIGH closed（含 USER PRIO 0 收盤分析卡住根因 + HoldingDetailPane modal `100dvh` + bundle 5.4MB → 0.5MB + LCP 30.6s → 3.31s）— 詳見 `docs/audits/2026-04-28-r29-r30-bug-consensus.md`。

R31 後仍 open：49 MEDIUM + 22 LOW（在 audit doc 內列）— 不在本檔 scope，那邊有完整 file:line 證據，這份是 R139-R141 sprint trail 的不同來源。

---

## 處理建議順序（per next-wave.md "建議執行順序"）

1. 先做 **docs truth cleanup**（最低風險、最高減少誤判）— 內含本輪 R32 docs cleanup
2. 同步拍板 **Q06 + Route-shell contract** — 不先定，每份 signoff/QA 文件會繼續互相打架
3. 再開 **R141 #3** brief（Holdings filter + detail pane）— 明拆 b/c 兩段
