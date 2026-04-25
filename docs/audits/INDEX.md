# Audits 索引

**用途**：所有「審視 / 評估 / 找問題」類型的報告統一放這 · 不再散落 `.tmp/`。
PM、UX、Designer、QA、Perf、Security 等任何視角的 audit 都進 `docs/audits/`。

**最後更新**：2026-04-26

## 命名規則

```
docs/audits/YYYY-MM-DD-<lens>-audit.md
```

`<lens>` 可選：`pm` `ux` `designer` `qa` `perf` `security` `a11y` `dogfood`。
若同一輪混合多 lens（如 PM + Designer 整合）· 用 `pm-ux-design`（連字）。

## Doc 命名整體規則（也套用其他 docs/）

| 類型             | 路徑              | 命名                         | 範例                                      |
| ---------------- | ----------------- | ---------------------------- | ----------------------------------------- |
| 決議（拍板）     | `docs/decisions/` | `YYYY-MM-DD-<topic>.md`      | `2026-04-25-vercel-full-decoupling.md`    |
| 規格（spec）     | `docs/specs/`     | `YYYY-MM-DD-<topic>.md`      | `2026-04-18-portfolio-dashboard-sa-sd.md` |
| 狀態快照         | `docs/status/`    | `YYYY-MM-DD-<topic>.md`      | `2026-04-24-vm-api-rollout-handoff.md`    |
| **Audit**        | `docs/audits/`    | `YYYY-MM-DD-<lens>-audit.md` | `2026-04-26-pm-ux-audit.md`               |
| Runbook（常駐）  | `docs/runbooks/`  | `<topic>.md`                 | `restore-drill.md`                        |
| Research（探索） | `docs/research/`  | `<topic>.md`                 | `target-price-sources.md`                 |

## 開新 Audit 前必做

1. 先 grep 這份 INDEX · 看同主題有沒有近期 audit
2. 若 30 天內有 → 在原 audit 裡 append 新 round（避免散）
3. 若 30 天以上 → 開新 audit（標明 supersede 哪份）

## 現有 Audits

| Audit                                                                | 日期       | Lens               | 狀態          | 摘要                                                                  |
| -------------------------------------------------------------------- | ---------- | ------------------ | ------------- | --------------------------------------------------------------------- |
| [2026-04-26-pm-ux-audit.md](./2026-04-26-pm-ux-audit.md)             | 2026-04-26 | PM + UX + Designer | 🟡 待動工     | Claude + Codex 各 5 輪 PM + 5 輪 Designer · 60+ 痛點 · 11 批次工 ~91h |
| [2026-04-25-r147-multi-llm-qa.md](./2026-04-25-r147-multi-llm-qa.md) | 2026-04-25 | QA × 12            | ✅ 12/13 修完 | R147 12 輪多 LLM QA · #8 deferred                                     |

## 跟 decisions / specs 的差別

- **Audit**：「找問題」報告 · 多人多 lens · 列發現 · 不一定有 action
- **Decision**：「拍板了」紀錄 · 用戶確認的方向 · audit 後若要動 · 寫進 decision
- **Spec**：「要做什麼 · 怎麼做」· implement 前的 contract
- **Status**：「現在到哪」· 階段性 handoff / 工作交接
