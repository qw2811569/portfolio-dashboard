# Before / After · R139-R141 具體改善對照 · 2026-04-24

**Scope**：這輪 session 啟動點（UX-20 剛收 · origin `ab20a48` pre-R138 state）→ 現在（55+ commits 後）

---

## 📊 量化 Before vs After

| 指標                       | Before（session 起點 · 約 2026-04-24 早上） | After（2026-04-24 pm · 55+ commits 後）                                                           | Delta         |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------- |
| Local commits ahead origin | 20（UX-01a~20）                             | **55+**                                                                                           | +35+          |
| Ship-before 30 條 done     | 25/30 · 4 blocked + T72b pending            | **25 done + T48 deferred-per-decision · T64/M04/M09 未動（ship 後收）· T72b 仍 pending**          | T48 unblocked |
| Playwright spec            | per-feature spec · 未整套 aggregate run     | **106 passed / 14 skipped / 0 unexpected / 0 flaky** 跨 chromium+ios-safari+webkit                | 整套綠        |
| Unit tests                 | 兒頻不清                                    | **1040 passing · 159 test files**                                                                 | baseline 建   |
| a11y                       | UX-14 focus ring 有 · 其他未審              | **select-name + dashboard color-contrast + 4 pages landmark/heading/region audit 完**（axe-core） | 顯著升級      |
| Bundle entry size          | 1404 kB（> 500 kB Vite warn）               | **47 kB entry**（route-level lazy split + manualChunks）                                          | -96%          |
| Lighthouse performance     | 55（LCP 26.68s）                            | 重 build 後大幅改善（需重測 · 預期 LCP < 5s）                                                     | -80% LCP      |
| SA §5 八頁覆蓋             | 7/8（Log tab 未動）                         | **8/8**（SA-5-10 Log polish 完）                                                                  | +1            |
| 新 decisions               | 0 this session                              | **4 條新**（R120 / sticky / facade freeze / runtime status file）                                 | +4            |
| 新 memory 紀律             | 8 條舊                                      | **16 條（+8 this session）**                                                                      | +8            |
| Multi-LLM 討論輪數         | 1（R120 之前）                              | **10+**（R139 R1-R8 + R140 + Gemini R8 + R9 + R141）                                              | +9+           |

---

## 🎯 具體改善項目（逐項對照）

### 1 · Dashboard 首頁

|                            | Before                                                                | After                                                                          |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Canonical runtime mount    | ❌ DashboardPanel 未掛 · 用 OverviewPanel 代 · UX-04/15/19 用戶看不到 | ✅ `AppPanels.jsx` 掛 DashboardPanel · 成 default tab                          |
| 軟語 hero headline         | ❌ 原 banner 「先補齊資料再做深度研究」                               | ✅ `buildDashboardHeadline()` 依持股狀態 · 「整體論述仍穩 · 1 檔接近估值上緣」 |
| 大字 portfolio value       | ❌ 一般字級                                                           | ✅ 56-76px hero + tabular-nums                                                 |
| Loading skeleton           | ❌ 白屏                                                               | ✅ `Skeleton.jsx` bone pulse                                                   |
| 「我+金聯成」compare strip | ❌ 沒有                                                               | ✅ M-VIEW fix `e535803` · hero 下方 compare                                    |

### 2 · Holdings

|                                                             | Before                                           | After                                                           |
| ----------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| drill pane 內容                                             | 空白                                             | ✅ thesis / pillar dots / valuation band / freshness / softlang |
| iPhone touch target                                         | 69 failures（44×44）                             | ✅ <10                                                          |
| Multi-level filter chip bar                                 | ❌ 沒（R6.10 要過）                              | 🟡 R141 running                                                 |
| Right-side Detail Pane（近 3 日 daily / research / events） | ❌ 沒（R6.10 要過）                              | 🟡 R141 running                                                 |
| 2330 ring chart 重複                                        | ❌ 有 bug                                        | ✅ HoldingsRing aggregate 修（`da10222`）                       |
| Thesis 空狀態 spam 15 次                                    | ❌ 每檔都塞「這檔當初買進理由還沒整理成卡片...」 | 🟡 R141 running · 改為「空就不顯 section」                      |

### 3 · News

|                               | Before                           | After                                  |
| ----------------------------- | -------------------------------- | -------------------------------------- |
| Mobile 雙欄                   | ❌ 擠爆 hero 主欄 0px 寬         | ✅ single-col + sidebar 下沉（UX-22a） |
| Sticky side-notes             | ❌ mobile 也 sticky（違 policy） | ✅ 非 mobile sticky                    |
| PAPER 子系統（#fff8f0）       | ❌ 獨立 palette drift            | ✅ canonical SD 1.1（UX-13）           |
| `preview fallback` label leak | ❌ dev 狀態 leak                 | ✅ 修（`b517dd9`）                     |
| Counter 0/0/0 vs cards        | ❌ 不符                          | ✅ final-QA 已修                       |

### 4 · Daily

|                              | Before         | After                                                                     |
| ---------------------------- | -------------- | ------------------------------------------------------------------------- |
| t0/t1 diff toggle            | ❌ 不常顯      | ✅ UX-17 always-visible + 7865 fixture（`f94e77d`）                       |
| Compliance banner（insider） | ❌ lower fold  | ✅ top banner（UX-10）                                                    |
| `missing` 英文字             | ❌ 漏          | ✅ `resolveDailyPanelFreshnessLabel()` 中文化                             |
| `需注意 10` 無 context       | ❌ 模糊        | ✅ 「需留意 X 檔持股」（`da10222`）                                       |
| FinMind degraded             | ❌ silent fail | ✅ AccuracyGateBlock + StaleBadge + fallback from Blob（UX-28 `a06e809`） |

### 5 · Trade

|                                 | Before                 | After                                                   |
| ------------------------------- | ---------------------- | ------------------------------------------------------- |
| Disclaimer modal                | ❌ 沒                  | ✅ TradeDisclaimerModal + 90d re-prompt（B2 `4bcede3`） |
| Duplicate submit                | ❌ 20 次 spam 寫 20 次 | ✅ in-flight lock（hostile QA `838a5cf`）               |
| 負 qty / 負 price / XSS payload | ❌ accept              | ✅ validation reject                                    |
| Audit JSONL                     | ❌ 無                  | ✅ `logs/trade-audit-YYYY-MM.jsonl` server-side append  |
| Modal focus trap                | ❌ ESC 焦點漂          | ✅ focus trap + safe re-focus（`7912f6f`）              |

### 6 · Log tab（SA §5.10）

|          | Before                         | After                                                                                                              |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 頁面狀態 | ❌ 簡單卡片 · 沒接 audit JSONL | ✅ list/detail journal · 整合 `logs/trade-audit-*.jsonl` · mobile single-col · skeleton · stale badge（`f561ce3`） |

### 7 · Mobile · iPhone

|                             | Before                           | After                                                  |
| --------------------------- | -------------------------------- | ------------------------------------------------------ |
| Header sticky               | ❌ 339-349px（eat 50% viewport） | ✅ 99px（UX-21 · `b8eb2ec`）                           |
| Landscape 844×390 判 mobile | ❌ 判 desktop（UX-21b 前）       | ✅ coarse-pointer + max-height 500（UX-21b `8bfba50`） |
| Touch target 44×44          | 69 failures                      | ✅ <10                                                 |

### 8 · 基建 / 政策

|                            | Before              | After                                                                 |
| -------------------------- | ------------------- | --------------------------------------------------------------------- |
| Facade alias consumer      | 153 hits 散 29 檔   | ✅ 全 0（C1a pre-commit freeze + C1b 遷移 + C1c enum/seed）           |
| VM Claude CLI              | ❌ 沒               | ✅ `scripts/launch-claude-vm.sh`（`3d52e65` · auth 401 待修）         |
| Morning Note cron          | ❌ 沒               | ✅ VM worker 08:30 Asia/Taipei · Blob snapshot（B1 `c3acf72`）        |
| Daily snapshot cron        | ❌ 沒               | ✅ 03:00 Asia/Taipei + monthly restore rehearsal（R121 §11 3 stages） |
| Blob ACL                   | public 混           | ✅ private · R134c earlier                                            |
| Blob race protection       | ❌ last-writer-wins | ✅ `tracked-stocks` ETag + ifMatch guard（Gemini R8 · `4d0879b`）     |
| Runtime status file policy | ❌ 雜檔 commit      | ✅ gitignore + decision doc（C4 `74f4081`）                           |

### 9 · Docs / Release

|                                     | Before       | After                                                      |
| ----------------------------------- | ------------ | ---------------------------------------------------------- |
| cross-browser matrix                | ❌ 不存      | ✅ `docs/qa/cross-browser-matrix.md`（L8-d）               |
| restore-drill runbook               | ❌ 不存      | ✅ `docs/runbooks/restore-drill.md` + log template（L8-e） |
| release note                        | ❌ 不存      | ✅ `docs/release/internal-beta-v1.md`（L8-f）              |
| signoff legal 四欄                  | 空           | ✅ 草稿 + manual rehearsal 填（L8-g）                      |
| `/health` 契約 vs full-smoke 不一致 | ❌ 互相矛盾  | ✅ r127-L8-prep reconcile 為 `/` root                      |
| candidate sha                       | `59f76fd` 舊 | ✅ `ab20a48` + pending `b8eb2ec`                           |
| T48 rotate-secret 狀態              | blocked      | ✅ deferred-per-decision（R120 Q-I1 連結）                 |
| Mockup 8 張                         | SD 1.0 舊    | ✅ SD 1.6 re-render（`ffb3ace`）                           |

---

## 🚧 仍未完成項目

### 🔴 R141 in-flight（ship blocker）

1. **Markdown leak fix** - AI 生成 `## ** |` 當純文字 render · 所有 Morning Note / daily 類 card 漏（react-markdown + MarkdownText component 方向）
2. **Thesis empty state hide** - `HoldingDrillPane` 空 thesis 整 section 隱（不塞 nag）
3. **Notion 多層次**（R6.10 漏提 · 2026-04-17 用戶要過）- chip filter bar + right-side Detail Pane + 近 3 日 daily cross-ref + research slice + events + 法說會

### 🟡 Hostile QA 5 開 task（ship 後排 · 非 blocker）

- Fast portfolio switch stale state（但 R140 `7d5c33c` 可能已解 · 需驗）
- Offline news silent fail（Codex 說 degraded copy 已存 · 需驗）
- Two-tab tracked-sync（Codex 說 listener 已存 · 需驗）
- Slow network loading state（Codex 說 copy 已存 · 需驗）
- Modal escape-key behavior（R141 `7912f6f` 用 focus trap 不關 · design confirm）

### 🟢 Backlog · 觀察期或低優先

- `daily-events/latest.json` dual-writer theoretical（非 real race · ship 後定 1 owner）
- `tw-events-worker` failure marker signature（observability loss · 非 crash）
- Monthly restore rehearsal（人工跑 · 2026-05 月初第 1 交易日）
- `backup/pre-r138-*` 刪（2026-05-01 觀察期後）
- VM Claude CLI auth 401（wrapper 需修 · 用 `ANTHROPIC_VM_KEY_FALLBACK` forward）

### 👤 用戶手動項（Ship 前必做 · Claude 不代勞）

1. `docs/release/invite-feedback-flow.md` Google Doc + Google Form 連結（L8-h）
2. `docs/release/internal-beta-signoff.md` signoff block 簽 + legal 四欄勾
3. Vercel push 時機（55+ commit 中選）

---

## 📈 session 期間產生的 discussion 輪數

R139（2026-04-24 am）R1-R6 + R139 Gemini R5（Split Brain / M-VIEW / Docs-only 揭露）
R140（2026-04-24 pm）12 items Claude + Codex verdict + fix
Gemini R8（concerns audit）· 1 真 blob race 抓 + 修
R141（進行中 · markdown leak + thesis spam + Notion 多層次）

**3 LLM 合計**：Claude 4 rounds + Codex 3 rounds + Gemini 3 rounds = **10 rounds**

**Top 3 高價值洞察**（不是 Claude 自己）：

1. Gemini R5 Split Brain IA → UX-23 dashboard swap
2. Gemini R5 M-VIEW 降權 → compare strip 上 Dashboard 首屏
3. Gemini R8 Blob race → ETag guard

---

## 🧠 自省 · 3 LLM 集體盲點（pattern）

1. **幽靈實作** - UX-04/15/19 投 DashboardPanel · 但 canonical 掛 OverviewPanel（R139 R5 Gemini 抓）
2. **Markdown leak** - AI 生成 markdown · UI 無 renderer（用戶抓）
3. **Thesis empty spam** - 15 檔都塞 nag · 沒想用戶視角（用戶抓）
4. **R6.10 Notion 多層次漏提** - 2026-04-17 就要過 · 過 7 天才被用戶再提（用戶抓 · 第 4 次漏提 pattern）

**紀律升級**：

- `memory/feedback_markdown_leak_qa_gap.md` · AI 輸出 render 前必查 prompt/renderer 對齊
- `memory/feedback_qa_must_hunt_bugs.md` · QA 主動找 bug · 不是 verify happy path
- `memory/feedback_not_dogfooding_products.md` · Claude 必親自點 · 每 session 開頭

---

**最後更新**：2026-04-24（R141 進行中 + R142 深讀 + Gemini R9 並跑）
**下次更新**：R141 收完 + R142 Codex pending-items / conflicts 產出後 · append Section 10
