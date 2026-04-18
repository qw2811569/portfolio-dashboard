# docs/ 索引

> 📌 `docs/` 目錄索引。首讀仍是根目錄 `README.md`。

最後更新：2026-04-18

## 先讀順序

1. [`../README.md`](../README.md) — 專案首讀、最短導航
2. [`AI_COLLABORATION_GUIDE.md`](AI_COLLABORATION_GUIDE.md) — AI / 人類協作規則
3. [`specs/2026-04-18-portfolio-dashboard-sa.md`](specs/2026-04-18-portfolio-dashboard-sa.md) — 系統分析（What）
4. [`specs/2026-04-18-portfolio-dashboard-sd.md`](specs/2026-04-18-portfolio-dashboard-sd.md) — 系統設計（How）
5. [`portfolio-spec-report/architecture.md`](portfolio-spec-report/architecture.md) — 架構 blocker / TODO
6. [`decisions/index.md`](decisions/index.md) — 正式決議索引
7. [`status/current-work.md`](status/current-work.md) — 只在接手 live work 時讀

## 文檔群組

- `docs/specs/`：主規格與 SA/SD
- `docs/decisions/`：正式決議（有 override 關係時以這裡為準）
- `docs/status/`：live 狀態與審計報告
- `docs/research/`：研究與 feasibility brief
- `docs/portfolio-spec-report/`：對外閱讀版報告與架構頁
- `docs/testing/`：測試 / 驗證報告

## 次讀文件

- [`QUICK_START.md`](QUICK_START.md) — 1 分鐘接手版
- [`SERVER_ACCESS_GUIDE.md`](SERVER_ACCESS_GUIDE.md) — 本地 / 遠端開發入口
- [`finmind-api-reference.md`](finmind-api-reference.md) — FinMind 資料集與 repo-side caveat
- [`known-bugs.md`](known-bugs.md) — 已知資料/邏輯坑

## 舊檔判讀

- 檔頭有 `SUPERSEDED` 的，只保留歷史脈絡，不作 current action 依據
- append-only round 文件若與 `docs/decisions/*.md` 或較新 round 衝突，以較新者為準
- 若只想知道現在真相，不要從 `docs/status/todo-live.md` 或舊 review snapshot 開始
