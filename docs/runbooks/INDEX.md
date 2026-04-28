# Runbooks 索引

**用途**：long-lived 操作 SOP（不是一次性 sprint trail）。每份 runbook 應該支援「半年後新人照著跑」。
**Updated**：2026-04-28

## 命名規則

```
docs/runbooks/<topic>.md
```

不用日期前綴（per `docs/audits/INDEX.md` 整體 doc 規則表）。runbook 跟 sprint / decision / status 不同，是「持續可用的操作」。

## 現有 runbooks

| Runbook                                                      | 狀態      | 摘要                                                                                                   |
| ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------ |
| [restore-drill.md](./restore-drill.md)                       | 🟢 active | T64 restore drill / rollback test / MDD recovery + O03 monthly rehearsal · 含逐步 SOP + decision tree  |
| [restore-drill-log.md](./restore-drill-log.md)               | 🟢 active | 每次 restore drill 完跑 append 一段 evidence row（template 在檔內）· 配合 `restore-drill.md` 使用      |
| [rbac-manual-verification.md](./rbac-manual-verification.md) | 🟢 active | Verify `admin` / `user` claim resolution + cross-portfolio 403 leak check · 手動 RBAC verification SOP |

## Archived

歷史 runbook 已歸檔到 [`docs/archive/2026-Q2/runbooks-history/`](../archive/2026-Q2/runbooks-history/)：

- `vm-https-setup.md` — 一次性 jcv-dev VM HTTPS 啟用 SOP（已 done · 不需重跑）

## 開新 Runbook 前必做

1. 先 grep 這份 INDEX · 看同 topic 有沒有現存
2. 若是一次性操作 / sprint trail → 應該寫到 `docs/status/` 或 `docs/decisions/`，不是 runbooks
3. 若會 recurring（每月 / 每季 / 每次 release）→ runbook · 必含 evidence template

## 跟其他類別的差別

- **Runbook**：long-lived 操作 SOP · 半年後仍可用
- **Decision**：拍板紀錄 · 為何做 X 不做 Y
- **Spec**：要做什麼 / 怎麼做 · implement contract
- **Audit**：找問題報告 · 多 lens 列發現
- **Status**：階段性 handoff / 工作交接（短命）
