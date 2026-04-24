# R139–R141 Consolidated Rollup · 2026-04-24

**用途**：R139 / R140 / R141 共 5 輪 LLM 討論 + 53+ commits · 分散在 briefs / decisions / memory / logs · 這份統一 rollup · 方便你一眼看全貌。

---

## 1 · 決議（新增 4 條 · 全在 `docs/decisions/`）

| Decision                                                                                       | 狀態 | 摘要                                                                                                  |
| ---------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| [2026-04-24-r120-scope-batch](../decisions/2026-04-24-r120-scope-batch.md)                     | ✅   | 15 題 contract/scope/infra 一次拍板（Q-D/Q-P/Q-I）· Q-I1 維持不 rotate override default               |
| [2026-04-24-mobile-sticky-policy](../decisions/2026-04-24-mobile-sticky-policy.md)             | ✅   | Mobile ≤ 768px 只允許 `app-shell` title + tabs sticky · 其他 panel 預設隨滾動                         |
| [2026-04-24-facade-alias-freeze](../decisions/2026-04-24-facade-alias-freeze.md)               | ✅   | `theme.js` facade alias 凍結新 consumer · pre-commit gate 擋 `C.blue/olive/teal/cyan/fillPrimary/*Bg` |
| [2026-04-24-runtime-status-file-policy](../decisions/2026-04-24-runtime-status-file-policy.md) | ✅   | Runtime status file（ai-activity.json / tasks.json 類）gitignore · 不 commit · 不 mirror              |

---

## 2 · Memory 新紀律（8 條 · 全在 `memory/`）

| 紀律                                                                                     | 摘要                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Qwen 會燒錢](~/.claude/.../memory/feedback_qwen_costs_money.md)                         | CLI 安裝類改派 Codex · Qwen 只在真需廣度並行研究時才派                                      |
| [VM URL dogfood surface](~/.claude/.../memory/feedback_vm_url_is_dogfood_surface.md)     | 用戶日常看 `35.236.155.62.sslip.io` · Vercel 一天一 build                                   |
| [Auto mirror VM 每 commit](~/.claude/.../memory/feedback_auto_mirror_vm_after_commit.md) | Claude 可直接跑 `sync-to-vm-root.mjs` · UI 改動 commit 立即 mirror                          |
| [不要每輪丟 A/B/C](~/.claude/.../memory/feedback_stop_asking_abc.md)                     | SA/SD/arch/mockup 是 ground truth · 用戶已授權就派 · 不問                                   |
| [不吃狗糧 · 產品被做壞](~/.claude/.../memory/feedback_not_dogfooding_products.md)        | Claude 只看 spec/decision/commit/snapshot · 不親自點 · 產品退化                             |
| [Playwright 模擬真人](~/.claude/.../memory/feedback_playwright_simulates_real_user.md)   | 不派用戶驗 · Playwright 可點/滑/下載/讀檔 assert                                            |
| [QA 必須主動找 bug](~/.claude/.../memory/feedback_qa_must_hunt_bugs.md)                  | 不驗 happy path · 用 Playwright/Gemini multimodal/a11y/persona 主動 hostile test            |
| [AI markdown leak QA gap](~/.claude/.../memory/feedback_markdown_leak_qa_gap.md)         | AI 輸出 markdown · 無 renderer · 3 LLM 全沒抓 · 未來 AI 生成 card 必查 prompt/renderer 對齊 |

---

## 3 · 已實作（53+ commits）

### UX layer（R139）

**P0 · Ship-before 11 項**：UX-01a~20（tokens / palette / spacing / typography / AA contrast / drill pane / viewMode / raw id hide / touch target 44 / error UI / compliance banner / skeleton / empty state / focus ring / persona fixture / diff toggle / tab rename / hero polish / secondary scale）+ UX-21 mobile sticky shrink + UX-21b landscape + UX-22a NewsPanel collapse + UX-22b polish + UX-23 dashboard canonical tab + UX-24 VM Claude CLI wrapper + UX-25 Playwright real-user sim + UX-26 Split Brain audit + UX-27 default-tab persistence + UX-28 FinMind degraded UX

**P1 · Beta+1 7 項**：B1 Morning Note 08:30 cron + B2 Trade memo + disclaimer modal + B3 weekly export md/html + B4 Today in Markets v1 + B5+B6 Daily Principle + Freshness badge + B7 Accuracy Gate hard-block UX

**P2 · Backlog 9 項**：M-EVENT-TW（除權息/股東會/紀念品）+ C1a/b/c（facade freeze + UI migration + tone enum）+ C3 `--mirror-vercel` flag + C4 runtime status file cleanup + docs mockup refresh SD 1.6

**M-U3 iPhone smoke + M-VIEW fix（OverviewPanel 3 P0 bug + dashboard compare strip + mobile metrics）+ L8 reconciliation 8 條** + SA §5.10 Log tab polish（整合 trade-audit JSONL）

### QA aggregation（R140）

- Playwright cross-browser full run · **106 passed / 14 skipped / 0 unexpected / 0 flaky**
- Hostile QA 找 14 個 bug · 當場修 7 個 critical+high
- Bundle entry 1.4MB → 47 KB（route-level lazy split）
- a11y `select-name` + dashboard color-contrast 修
- 4 lint warnings 收

### Bug fix（R140 follow-up + Gemini R8 + R141）

- HoldingsRing 2330 聚合（`da10222`）
- NewsPanel preview fallback render tree（`b517dd9`）
- Portfolio switch queue（`7d5c33c`）
- Modal escape focus trap（`7912f6f`）
- Bundle manualChunks + route split（`319005c`）
- **Blob race 抓 + 修**（Gemini R8 發現 · `4d0879b`）
- 7865 t0/t1 fixture（`f94e77d`）
- 操作 context 「需注意」→「需留意 X 檔持股」（`da10222`）
- R141 **進行中** · markdown leak + thesis empty + Notion 多層次

---

## 4 · 多 LLM 討論輪數

| Round            | 誰                                                                 | 產出 |
| ---------------- | ------------------------------------------------------------------ | ---- |
| R139 R1 Claude   | 初 task queue（P0/P1/P2 + R121 §11）· 8 Q 反駁題                   |
| R139 R2 Codex    | 每題 verdict · Top-3 斷腕 · 新 task 建議 · L8 dirty 8 條           |
| R139 R3 Claude   | 收斂 · 12 條 P0 task 定案 · 3 拍板題問用戶                         |
| R139 R4 用戶補充 | 管理者視圖 polish + VM Claude CLI wrapper                          |
| R139 R5 Gemini   | 3 critical 盲點（Split Brain / Docs-only / M-VIEW 降權）+ 新 UX-25 |
| R139 R6 Claude   | 接受 Gemini · 收斂 Final Task Queue · UX-23 裁決                   |
| R139 R7 Gemini   | Final blindspot · quota exhausted mid-run                          |
| R140             | 12 items · Claude R1 + Codex R2 verdict · 5 commits                |
| Gemini R8        | 3 concerns · 1 真 blob race 抓到 + 修                              |
| R141             | 3 critical（markdown leak / thesis spam / Notion 多層次）· 進行中  |

**Top-3 高價值洞察（不是 Claude / Codex 自己想的）**：

1. **Gemini R5 Split Brain IA** → UX-23 Dashboard swap
2. **Gemini R5 M-VIEW 降權錯誤** → compare strip 上 Dashboard 首屏
3. **Gemini R8 Blob race** → `tracked-stocks` ETag guard

---

## 5 · 延後（明文 · 非 R141 處理）

### 依 R120 decision

- Secret rotation（Q-I1）· 正式產品上線前不啟動
- Weekly export email channel（Q-P2）
- Today in Markets v2 美股/匯率/commodity（Q-P3）
- Daily Principle share image（Q-P4）
- Persona 完整 reasoning trace（Q-D5）

### 依 R139/R140 decision

- `sync-to-vm-root --mirror-vercel` flag（C3 · 已實作 · 但僅 emergency）
- Recurring Ops monthly restore rehearsal 人工跑（R120 Q-I3）
- `daily-events/latest.json` dual-writer race theoretical（Gemini R8 · 非 real · 未來 1 owner）
- `tw-events-worker` failure-marker signature（Gemini R8 · observability 不 crash）

### 觀察期

- 2026-05-01 後刪 `backup/pre-r138-*` remote 分支

---

## 6 · R141 剩 · 正在派 Codex（進行中）

| #   | Task                                                          | 狀態                        |
| --- | ------------------------------------------------------------- | --------------------------- |
| 1   | Markdown leak fix（`react-markdown` + `MorningNoteCard` etc） | 🟡 R141 running             |
| 2   | Thesis empty state hide（空就不顯 section）                   | 🟡 R141 running             |
| 3   | Notion 多層次 = R6.10 漏提 · chip filter + right Detail Pane  | 🟡 R141 running · 2-2.5 day |

---

## 7 · Ship 前剩 · 用戶手動

1. `docs/release/invite-feedback-flow.md` Google Doc / Form 連結（L8-h）
2. `docs/release/internal-beta-signoff.md` signoff block 簽 + legal 四欄勾
3. Vercel push 授權時機（53+ commit · 一天一 build quota）

---

## 8 · QA failures 複盤（自省）

**3 LLM（Claude / Codex / Gemini）集體盲點**：

1. **UX-04/15/19 投在 DashboardPanel · canonical runtime 掛 OverviewPanel = 幽靈實作**（Gemini R5 抓到）· **53 commit 中 UX-23 前所有 dashboard 相關 UX 投資用戶看不到**
2. **Markdown leak**（用戶自己抓到）· 沒人問「AI 生成 markdown · UI 有 renderer 嗎？」
3. **Thesis empty state spam**（用戶抓到）· 15 檔每檔都塞 nag · 設計沒想用戶視角
4. **Notion 多層次 = R6.10 漏提**（用戶抓到）· 2026-04-17 已要 · 2026-04-24 還沒做

**紀律**：寫進 `memory/feedback_markdown_leak_qa_gap.md` · 未來 AI render card 必查 prompt/renderer 對齊。

---

## 9 · 這份 rollup 存 git

提醒 Claude / Codex / Gemini：下次 session 啟動 · 讀 `docs/status/r139-r141-rollup.md` 當 context 起點 · 避免重開已決 · 避免漏已做。

**最後更新**：2026-04-24（R141 進行中）· R141 收完會追加 Round 10 update。
