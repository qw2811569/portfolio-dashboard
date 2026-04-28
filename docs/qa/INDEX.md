# QA 索引

**用途**：long-lived QA / 驗證文件（不是一次性 sprint trail）。每份應該支援多次 release 重複使用。
**Updated**：2026-04-28（R32 R12 補建）

## 命名規則

```
docs/qa/<topic>.md
```

不用日期前綴（per `docs/audits/INDEX.md` 整體 doc 規則表）· QA docs 跟 audit 不同：

- audit = 多 lens 找問題 · 一次性報告
- qa = 跨 release 重用的 checklist / matrix / template

## 現有 QA docs

| File                                                                 | 狀態      | 摘要                                                                         |
| -------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| [accessibility-checklist.md](./accessibility-checklist.md)           | 🟢 active | A11y 手動驗收 checklist · 跨 release 重用                                    |
| [cross-browser-matrix.md](./cross-browser-matrix.md)                 | 🟢 active | 桌機 / mobile × Chrome / Safari / Firefox 跨瀏覽器測試矩陣 · 跨 release 重用 |
| [insider-enforcement-evidence.md](./insider-enforcement-evidence.md) | 🟢 active | Insider mode 規則執行證據（compliance copy / 隱藏邏輯）· release 前 review   |

## Archived

歷史 QA report 在 [`docs/archive/2026-Q2/testing-history/`](../archive/2026-Q2/testing-history/)：

- `2026-04-26-qa-checklist-unverified.md`（被 `2026-04-26-qa-checklist-VERIFIED.md` supersede）
- `2026-04-26-persona-walkthrough.md`（被 R31 R29-R30 hostile QA supersede）
- `playwright-report-2026-04-18/`（一次性 e2e snapshot · 不再 active）

## 跟 audits/ 的差別

- **QA**: 跨 release reusable template / matrix / checklist
- **Audit**: 一次性「找問題」報告 · 多 lens 列發現
- 一輪 audit 跑完 · 找到的 bug 可能升 active-debt · 修法可能寫進 qa checklist 防回歸
