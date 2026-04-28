# R139-R141 Pending Items

更新基準：`509c3df`（`origin/main..HEAD = 56 commits`）  
深讀來源：R139 Round 1-8、R140 brief/follow-up、R141 brief、Gemini R8 audit、Hostile QA、M-U3、UX-21 edge cases、R6.10 archive、`CLAUDE.md` R7.5 warning、`docs/archive/2026-Q2/status-history/r139-r141-rollup.md`

## Legend

- `✅` 已有 commit 落地
- `🟡` 已提過，但仍未收斂、仍需決策，或文件仍落後
- `❌` 明確還沒做
- `⚠️` 技術上已做，但權威文件仍寫舊狀態

## R139 Round 2 · 8 題 Codex verdict map

| Q   | 題目                                       | Codex 當時 verdict                                            | 現況                                                                                                 |
| --- | ------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Q1  | Mockup pixel-diff 當 P0 ship gate          | 不該當 ship gate；應改 live baseline 或 docs-mockup refresh   | `✅/🟡` docs-mockup refresh 已做（`ffb3ace`）；真正 screenshot-diff gate 仍未做                      |
| Q2  | M-U3 iPhone smoke scope                    | 收窄成 3 critical route + interaction，不是重跑 9 頁 snapshot | `🟡` Playwright real-user sim 已做（`2876751`），但 `Q06` 是否仍要求 owner 真機證據未收斂            |
| Q3  | NewsPanel sticky 只是 1 行 bug？           | 不是；需拆成 `UX-22a` mobile collapse + `UX-22b` polish       | `✅` `a71a60d` + `d50803a`                                                                           |
| Q4  | B lane 優先度                              | `B2 > B1 > B7 > B3 > B4 > B5+B6`，且 `B5+B6` 可合併           | `✅` B1/B2/B3/B4/B5+B6/B7 全有 commit（`c3acf72` `4bcede3` `0296622` `66c00d4` `2335182` `3f255d5`） |
| Q5  | Facade alias 何時砍                        | 拆 `C1a freeze` / `C1b UI migration` / `C1c enum+seed`        | `✅` `475999c` `15be792` `e94324d` `4cc70df` `67fa53c` `69a3b70`                                     |
| Q6  | `sync-to-vm-root --mirror-vercel` 是否先做 | 當時判定可押後，等第二次 hash 漂移再開 spec                   | `✅/⚠️` 後來已做 emergency fallback（`124bfe3`）；屬決策演進，不再是 pending                         |
| Q7  | R121 recurring ops                         | VM cron + Blob snapshot；monthly restore rehearsal 人工跑     | `🟡` stage 1-3 已做（`8be7067` `a08bb23` `ebfad63`），但「月度實跑證據」仍是 follow-up               |
| Q8  | Ship Gate 還差什麼                         | UX 以外還有 L8 docs/contract/signoff blocker                  | `🟡` L8 文件都建了，但 signoff/manual/legal/invite 仍未收口，且多份文件已過時                        |

## Gemini Round 5 / Round 6 / Round 7 / Round 9 verdict map

| 來源  | Gemini / Claude 收斂                                                                             | 現況                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| R5 Q1 | Dashboard 不應硬改 default；後來收斂為「保留 dashboard default + 再補 localStorage persistence」 | `✅` default 保留 `9cddeed`；persistence 已做 `2019a47`                                    |
| R5 Q2 | M-VIEW 不該降權，跨組合比較是剛需                                                                | `✅` `e535803` 已落地 compare strip + 3 個 P0 bug                                          |
| R5 Q3 | L8 現況是假綠燈，docs-only validation 不夠                                                       | `🟡` UX-25 Playwright real-user sim 已做，但 `Q06` manual gate vs Playwright policy 仍衝突 |
| R5 Q4 | Split Brain IA 是真風險，不是單一 bug                                                            | `🟡` 嚴格紅燈已由 UX-23 收斂；但 UX-26 follow-up 三項仍未做                                |
| R5 Q5 | VM Claude wrapper 用途成立，但主要是 Ops Audit                                                   | `🟡` wrapper 已做 `3d52e65`；VM Claude auth 401 仍 known broken                            |
| R5 Q6 | 「不吃狗糧」需要更強的 snapshot / pixel-diff / auto alarm                                        | `❌` branch 內仍沒有真正 screenshot-diff CI gate；目前仍是 artifact capture + 人工比對     |
| R5 Q7 | FinMind stale / degraded UX、台股特殊 events 要補                                                | `✅` `a06e809` + `3cbaad8`                                                                 |
| R7    | Gemini blindspot rerun quota exhausted                                                           | `🟡` 仍未補跑；可用 Gemini 2.5 flash 另開一輪                                              |
| R9    | `UX-29` X1-X5 焦慮指標應做成 cohesive surface，不要只是零散 metric                               | `❌` 目前沒有已 commit 的 unified panel                                                    |

## 已提過但未落地 / 未收斂

### Product / IA / route contract

| 來源             | 項目                                                                          | 現況 | 為何還在                                                                                                          | 建議                                                                            |
| ---------------- | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| UX-26 audit      | Holdings wrapper dedupe                                                       | `❌` | canonical 用 `HoldingsPanelChunk`，route 端直接 inline；不是紅燈，但仍有 wrapper duplication                      | 等 R141 #3 定案後一起收；避免邊做 detail pane 邊改 surface 名稱                 |
| UX-26 audit      | Route-state parity audit                                                      | `❌` | canonical 用 `usePortfolioPanelsContextComposer`；route shell 另有 `useRoute*Page` state owner                    | 做 domain-by-domain parity 表，先釐清哪些 write 是故意 blocked、哪些其實仍 live |
| UX-26 audit      | Route error-boundary parity audit                                             | `❌` | canonical `AppPanels.jsx` 全包 `ErrorBoundary`；route pages 沒有                                                  | 小修可做，但先決定 route shell 是否還是長期 surface                             |
| UX-26 + 現況測試 | Route-shell「migration-only / limited」與 trade route 仍可寫入 canonical data | `🟡` | 文件寫 route-shell limited；但 `tests/routes/routePages.actions.test.jsx` 仍 assert trade route 寫回 holdings/log | 要嘛明寫「route shell 仍有 trade write 例外」，要嘛真的把 route write 封死      |
| Round 9          | Dashboard ↔ Holdings 關聯性 / 焦慮指標 X1-X5 unified panel                    | `❌` | 現有 metric 分散，沒有單一「情緒安全感」面板                                                                      | 若要把 R9 當 ship blocker，需先明確定義 Phase 1 最小切片                        |

### R141 / archive carry-over

| 來源                    | 項目                                                                            | 現況 | 為何還在                                                                        | 建議                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R141 #3 + R6.10 archive | Holdings multi-level filter chip bar                                            | `❌` | R6.10 已提；M-U3 findings 仍明確說 canonical holdings 沒有多層 filter surface   | 切成 `R141b` 單獨做，不要和 detail pane 綁死同 commit                    |
| R141 #3 + R6.10 archive | Holdings detail pane / drawer                                                   | `❌` | current holdings 只有 inline drill；沒有 right pane / mobile drawer / deep link | 切成 `R141c`，含 focus trap、outside click、`?stock=`                    |
| R141 #3 + archive 細項  | 近 3 日 daily cross-reference、最近一次研究 mention、相關事件 / 股東會 / 除權息 | `❌` | detail pane 的內容 contract 還沒落地                                            | 先決定哪些是 Phase 1 必帶，哪些可延後成 pane 二期                        |
| `CLAUDE.md` R7.5        | 第三次漏提 pattern 的唯一未收尾項                                               | `🟡` | 多組合與第二 persona 已收；但「多層篩選 + detail pane」仍是同一個漏提點         | 在後續 brief 裡明寫「這不是 nice-to-have，是已被抓過 3 次的 scope debt」 |

### Release / signoff / docs truth

| 來源                    | 項目                                                               | 現況 | 為何還在                                                                             | 建議                                                        |
| ----------------------- | ------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| R139 L8-h               | `invite-feedback-flow.md` Google Doc / Form link                   | `🟡` | 仍需 owner 手填外部連結                                                              | 保持 manual；但 `next-wave.md` 應明列它仍是 ship 前最後一哩 |
| R139 L8-g               | Signoff legal 四欄 + owner signoff block                           | `🟡` | 文件架構已有，內容未簽                                                               | 等 candidate SHA 與 Q06 truth 收斂後再填                    |
| R139 L8-c / L8-f / L8-g | Release docs candidate SHA / commit range / blocked issue 文案過時 | `⚠️` | `internal-beta-signoff.md` / `internal-beta-v1.md` 仍停在 `ab20a48` / `b8eb2ec` 時代 | 可先做 docs-only 收口；但若還有大波 code，要在最後再刷一次  |
| R139 L8 / R140 / R141   | `Q06` 到底要求什麼證據                                             | `🟡` | signoff docs保留 manual iPhone gate；memory 又說 Playwright 可模擬真用戶             | 先做明文決策，不要讓 L8 一邊寫 manual、一邊又說別派用戶     |
| R139 L8-e / R121 §11    | Restore drill monthly evidence cadence                             | `🟡` | runbook / script 都有了，但「每月真跑證據」還沒有                                    | 把它當 recurring ops，不要再偽裝成已完成                    |

### Gemini R8 carry-over

| 來源                 | 項目                                                       | 現況 | 為何還在                                                     | 建議                                                  |
| -------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Gemini R8 concern #1 | Deploy-time promotion gate（preview 不可寫 prod）          | `❌` | 本輪 audit 明確跳過 deploy-time；repo 仍沒有 promotion guard | 放到 infra / release gate 專題，不在本輪熱修          |
| Gemini R8 concern #2 | `daily-events/latest.json` dual-writer ownership           | `🟡` | 被判定 theoretical race，不是這輪真 bug                      | 選 1 owner，或補 `ifMatch`；不然永遠是口頭安全        |
| Gemini R8 concern #2 | `telemetry-events.json` burst write merge race             | `🟡` | observability 類，不是 canonical data                        | backlog；若要補，和其他 blob append contract 一起做   |
| Gemini R8 concern #2 | `analysis-history-index.json` / `research-index.json` race | `🟡` | 低頻、低併發，但仍是 index drift 風險                        | backlog；等 research/history 有並行寫需求時一併做 CAS |
| Gemini R8 concern #2 | Monthly NDJSON pseudo-append race                          | `🟡` | 目前依賴 single writer；手動重跑時仍可能重疊                 | 若 recurring ops 要 productize，再一起補              |
| Gemini R8 concern #3 | `tw-events-worker` failure marker call shape               | `🟡` | 非 crash；但 fatal 時會漏 observability marker               | 小修可做，屬 this-wave safe follow-up 候選            |

### QA carry-over / doc drift

| 來源                  | 項目                                                     | 現況 | 為何還在                                                     | 建議                                           |
| --------------------- | -------------------------------------------------------- | ---- | ------------------------------------------------------------ | ---------------------------------------------- |
| Hostile QA            | `Escape` 是否應直接 dismiss disclaimer modal             | `🟡` | 目前已改成 focus trap（`7912f6f`），但 product 行為仍未蓋章  | 在設計決策檔明文化，不要讓 bug doc 永遠掛 open |
| Hostile QA            | Two-tab tracked-sync coherence                           | `🟡` | follow-up 判定 current head 無 repro，但原 bug doc 還寫 open | 文件需加 disposition，否則會被重派             |
| Hostile QA            | Slow-network loading state                               | `🟡` | follow-up 判定 current head 無 repro，但原 bug doc 還寫 open | 文件需加 disposition                           |
| UX-25                 | `UX-25-bug-4` diff toggle live blocker                   | `⚠️` | `f94e77d` 已修，但 release/signoff docs 還寫 blocked         | 應更新 signoff / release note                  |
| Before/After / rollup | R141 #1 markdown leak、#2 thesis hide 仍被寫成 `running` | `⚠️` | 現在已各有 commit `3b2584d` / `509c3df`                      | rollup 下一版要同步，避免後續 brief 以為還沒做 |

## Hostile QA 14 bugs · 原 open 項目前處置

| Bug                                    | 原始狀態 | 目前判讀                                       | 建議                                               |
| -------------------------------------- | -------- | ---------------------------------------------- | -------------------------------------------------- |
| Fast portfolio switch stale context    | open     | `✅` 已由 `7d5c33c` + `7bdb021` 收             | 從「open」改成 fixed                               |
| Offline news silent fail               | open     | `✅` `7bdb021` 已補 `DataError` degraded copy  | 從「open」改成 fixed                               |
| Two-tab tracked-sync storage sync      | open     | `🟡` follow-up 說 current head 無 repro        | 標記 monitor / no current repro，不要再寫 open bug |
| Slow-network 4G/3G/2G 無 loading state | open     | `🟡` follow-up 說 current head 無 repro        | 標記 monitor / no current repro                    |
| Disclaimer modal `Escape`              | open     | `🟡` `7912f6f` 已定成 focus trap，不是 dismiss | 需要設計決策，不是再丟回 bug pool                  |

## L8 reconciliation 12 條 · current status

| L8 項      | 內容                                    | 現況                                                            |
| ---------- | --------------------------------------- | --------------------------------------------------------------- |
| L8-a       | `/health` vs `/` contract truth         | `✅` 已由 `r127-L8-prep.md` 收斂                                |
| L8-b       | `T48` secret rotation 文件同步 R120     | `✅` 已改成 deferred-per-decision                               |
| L8-c       | candidate SHA update                    | `⚠️` 做過一次，但現已再次落後                                   |
| L8-d       | `docs/qa/cross-browser-matrix.md`       | `✅/⚠️` 檔案存在，但內容仍有舊 pending row                      |
| L8-e       | `docs/runbooks/restore-drill.md`        | `✅` 檔案存在；實跑 cadence 仍是 recurring ops                  |
| L8-f       | `docs/release/internal-beta-v1.md`      | `✅/⚠️` 檔案存在，但 candidate/ship narrative 過時              |
| L8-g       | `docs/release/internal-beta-signoff.md` | `✅/⚠️` 檔案存在，但 blocked issue / SHA / manual欄位過時或未填 |
| L8-h       | `invite-feedback-flow` resolve links    | `🟡` owner manual pending                                       |
| UX-22a     | News mobile collapse                    | `✅` `a71a60d`                                                  |
| UX-21b     | landscape / coarse-pointer short-height | `✅` `8bfba50`                                                  |
| C1a        | facade alias freeze                     | `✅` `475999c`                                                  |
| M-U3 / Q06 | iOS critical-route evidence             | `🟡` 仍缺「一個明文化的驗收真相」                               |

## 已做但容易被誤判成 pending

| 項目                                            | 狀態                                        |
| ----------------------------------------------- | ------------------------------------------- |
| R141 #1 markdown leak                           | `✅` `3b2584d`                              |
| R141 #2 thesis empty hide + write-reason CTA    | `✅` `509c3df`                              |
| UX-25-bug-4 insider fixture / daily diff toggle | `✅` `f94e77d`                              |
| UX-24 wrapper 本體                              | `✅` `3d52e65`（但 auth 還不是 green）      |
| Blob race 真正紅燈                              | `✅` `4d0879b` 已修 tracked-stocks CAS race |

## R143 follow-up backlog

- VM URL 跨域 auth
  選項：
  a. CORS + Bearer token（SPA 從 VM config localStorage 讀 token）
  b. VM nginx reverse proxy `/api/*` 到 Vercel · 帶 VM 自己的 service token
  c. Domain 統一（VM + Vercel 都 CNAME 到 apex · 共享 cookie domain）
  目前 VM 用戶 = 匿名 → 所有 fail-closed API 被擋。
  短期：登入頁 clearly 說「VM 是 dogfood surface · 需要從 Vercel domain 登一次 · 或輸入 bearer token」。
  長期：選一種方案實作。
