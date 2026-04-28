# Audits 索引

**用途**：所有「審視 / 評估 / 找問題」類型的報告統一放這 · 不再散落 `.tmp/`。
PM、UX、Designer、QA、Perf、Security 等任何視角的 audit 都進 `docs/audits/`。

**最後更新**：2026-04-28

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

| Audit                                                                        | 日期       | Lens                                       | 狀態                                                                                                             | 摘要                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-04-28-r29-r30-bug-consensus.md](./2026-04-28-r29-r30-bug-consensus.md) | 2026-04-28 | QA + Security + Perf + a11y + State + Arch | 🟢 R31 closed (9 round mutual QA · 19/19 HIGH · 三維度 9.97 · LCP 30.6→3.31s · perf 0.55→0.86 · 1349/1349 tests) | Claude+Codex R29 5 輪 + R30 6-lens hostile QA · 90+ finding · **19 HIGH dogfood blocker**（含 USER PRIO 0 收盤分析卡住根因）· 49 MEDIUM · 22 LOW · R31 sprint trail in `.tmp/r31-fix/r31-shared.md` |
| [2026-04-26-qa-checklist.md](./2026-04-26-qa-checklist.md)                   | 2026-04-26 | QA 用戶肉眼勾                              | 🟢 R1-R7 完工                                                                                                    | 8 頁 × Desktop+Mobile + 4 不要做 + Header + Insider + Motion + Phase 1 Must · 共 ~120 條白話清單                                                                                                    |
| [2026-04-26-pm-ux-audit.md](./2026-04-26-pm-ux-audit.md)                     | 2026-04-26 | PM + UX + Designer                         | 🟢 R1-R7 完工                                                                                                    | Claude + Codex 各 5 輪 PM + 5 輪 Designer · 60+ 痛點 · 11 批次工 ~91h · R7 後視覺已對齊 mockup-01                                                                                                   |
| [2026-04-25-r147-multi-llm-qa.md](./2026-04-25-r147-multi-llm-qa.md)         | 2026-04-25 | QA × 12                                    | ✅ 12/13 修完                                                                                                    | R147 12 輪多 LLM QA · #8 deferred                                                                                                                                                                   |

## 跟 decisions / specs 的差別

- **Audit**：「找問題」報告 · 多人多 lens · 列發現 · 不一定有 action
- **Decision**：「拍板了」紀錄 · 用戶確認的方向 · audit 後若要動 · 寫進 decision
- **Spec**：「要做什麼 · 怎麼做」· implement 前的 contract
- **Status**：「現在到哪」· 階段性 handoff / 工作交接
