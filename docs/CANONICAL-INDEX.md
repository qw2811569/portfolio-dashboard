# CANONICAL-INDEX · 2026-04-19

使用規則：

1. 任何產品 / 技術 / 流程問題，先 grep 這份 index。
2. 找不到，再翻 `docs/research/`、`coordination/llm-bus/`、`.tmp/portfolio-r8-loop/`。
3. `docs/archive/2026-Q2/` 是歷史考古區，不是 current truth。

## 入口 / Runtime / 協作

- `docs/NOW.md` · current truth / handoff 首讀
- `docs/README.md` · docs 目錄索引
- `docs/AI_COLLABORATION_GUIDE.md` · AI / 人類協作規則與 runtime 真相
- `docs/QUICK_START.md` · 1 分鐘接手版
- `docs/SERVER_ACCESS_GUIDE.md` · 本地 / 遠端 canonical origin
- `docs/status/current-work.md` · live execution state
- `coordination/llm-bus/runtime-execution-plan.md` · runtime lane live ledger
- `coordination/llm-bus/runtime-stabilization-brief.md` · runtime 共識濃縮

## 產品 Spec

- `docs/specs/2026-04-18-portfolio-dashboard-sa.md` · 持倉看板 SA
- `docs/specs/2026-04-18-portfolio-dashboard-sd.md` · 持倉看板 SD
- `docs/portfolio-spec-report/architecture.md` · deployment / data flow / runtime 視圖
- `docs/portfolio-spec-report/todo.md` · execution ledger
- `docs/product/agent-bridge-spec.md` · Agent Bridge SA / SD

## 技術決策

- `docs/decisions/index.md` · 決策索引
- `docs/decisions/2026-03-25-targets-freshness.md`
- `docs/decisions/2026-04-11-staged-daily-analysis.md`
- `docs/decisions/2026-04-15-bridge-auth-token-split.md`
- `docs/decisions/2026-04-15-gemini-role-blind-spot-only.md`
- `docs/decisions/2026-04-15-knowledge-api-blob-not-vm.md`
- `docs/decisions/2026-04-15-news-vs-events-separation.md`
- `docs/decisions/2026-04-16-cmoney-notes-as-phase3.md`
- `docs/decisions/2026-04-16-naming-portfolio-vs-agent-bridge.md`
- `docs/decisions/2026-04-16-product-gap-and-arch-direction.md`
- `docs/decisions/2026-04-16-product-stage-stability-first.md`
- `docs/decisions/2026-04-16-target-price-scraping-source.md`
- `docs/decisions/2026-04-16-vercel-ops-belong-to-codex.md`
- `docs/decisions/2026-04-16-vm-maximization-roadmap.md`
- `docs/decisions/2026-04-16-vm-migration-url-plan.md`
- `docs/decisions/2026-04-18-appshell-state-ownership.md`

## 資料 / API / 品質真相

- `docs/finmind-api-reference.md` · FinMind repo-side truth
- `docs/research/taiwan-stock-data-sources-v3-deep.md` · 台股資料源 canonical research
- `docs/research/vercel-cost-investigation.md` · Vercel cost root cause
- `docs/research/dashboard-redesign/INDEX.md` · 持倉看板互動介面重設計（focus / 視覺層次 · 2026-04-27 開案 · **Round 1-20 完成** · 25 份 ref · 29 個 pattern）
  - 子檔：`MISSION.md`（5 條 design principle）· `SOURCES.md`（22 站清單）· `refs/README.md`（ref 索引）· `TOOLS.md`（抓取工具）· `rounds/discussion.md`（multi-LLM round notes 1-20）· `pattern-matrix-v1.md`
  - 結論 spec：`docs/specs/2026-04-28-dashboard-redesign-spec.md`
  - 拍板 decision（草案）：`docs/decisions/2026-04-28-dashboard-redesign.md`
- `docs/status/kb-availability-2026-04-18.md` · FinMind availability audit
- `docs/known-bugs.md` · 已知資料 / 數字坑
- `docs/audits/INDEX.md` · audit 索引；歷史 stale audit 已歸檔到 `docs/archive/2026-Q2/audits-history/`

## 子目錄 INDEX（R32 起 · 每個子 dir 有自己的 INDEX）

- [`docs/audits/INDEX.md`](audits/INDEX.md) · 4 個 audit 報告
- [`docs/decisions/index.md`](decisions/index.md) · 23 個拍板決議
- [`docs/specs/INDEX.md`](specs/INDEX.md) · 3 個 implementation contract
- [`docs/runbooks/INDEX.md`](runbooks/INDEX.md) · 3 個 long-lived 操作 SOP
- [`docs/release/INDEX.md`](release/INDEX.md) · 5 份 release 工具文件
- [`docs/research/dashboard-redesign/INDEX.md`](research/dashboard-redesign/INDEX.md) · 25 ref + Round 1-20 研究

## Release / QA / 驗證（細項）

- `docs/qa/accessibility-checklist.md`
- `docs/qa/insider-enforcement-evidence.md`
- `docs/qa/cross-browser-matrix.md`
- `docs/runbooks/rbac-manual-verification.md`
- `docs/release/demo-path.md`
- `docs/release/internal-beta-checklist.md`
- `docs/release/internal-beta-signoff.md`
- `docs/release/internal-beta-v1.md`
- `docs/release/invite-feedback-flow.md`

## 操作

- `docs/status/agent-bridge-mobile-guide.md` · iPhone / Agent Bridge 操作

## 歷史檔查找規則

- 只有當這份 index 找不到主題，才回頭查 `docs/archive/2026-Q2/`。
- 需要舊 spec / 舊 session / 舊研究時，直接進 `docs/archive/2026-Q2/` 對應子目錄。
- 不再把 archive 檔當成 canonical brief 來源。

## Coordination / Memory

- `coordination/llm-bus/board.md` · 只作協作看板；若內容和 decisions 衝突，以 decisions 為準。
- `memory/MEMORY.md` 若不存在，表示 memory index 尚未補齊；此時以 `memory/*.md` 的實際最新檔案為準。
