# Release 索引

**用途**：internal beta release 相關的 5 份文件 · 各有獨立 scope（per Codex R32 R2 critique 不可合併）。
**Updated**：2026-04-28

## 命名規則

```
docs/release/<topic>.md
```

不加日期前綴（runbook 風格）· release docs 是「持續支援多次 release 的工具集」。

## 五份文件 · 不同 scope（Codex 已驗）

| File                                                       | Scope                               | 何時讀                                                          |
| ---------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| [internal-beta-checklist.md](./internal-beta-checklist.md) | **Gate template** · 30 條 checklist | ship 前每輪 walk through · 不修改（template）                   |
| [internal-beta-signoff.md](./internal-beta-signoff.md)     | **Evidence + owner signature**      | 每次 release · 填證據 + 簽名（current candidate sha `9edf0dc`） |
| [internal-beta-v1.md](./internal-beta-v1.md)               | **Release note**                    | 對外傳達「這版修了什麼」（R31 closure 後 refresh）              |
| [demo-path.md](./demo-path.md)                             | **Demo flow 操作 SOP**              | 帶 owner / beta 用戶走完一輪 · 列 URL / 帳號 / 期望路徑         |
| [invite-feedback-flow.md](./invite-feedback-flow.md)       | **Invite + Feedback collection**    | ship 前最後一哩 · Google Doc/Form link 由 owner 手填            |

## 順序（一輪 release 怎麼走）

1. `internal-beta-checklist.md` — 跑 30 條 ship gate
2. `internal-beta-signoff.md` — 收 evidence + owner 簽名
3. `internal-beta-v1.md` — 發 release note（外部 / 內部）
4. `demo-path.md` — 帶人走 demo
5. `invite-feedback-flow.md` — 收 feedback + iterate

## 跟其他類別的差別

- **Release**: 多次重用的 ship 工具（5 種文件互補）
- **Decision**: 為何 ship 這版（pre-release 拍板）
- **Audit**: ship 前找問題（pre-ship hostile QA）
- **Status**: 當下進度（短命 sprint trail）

## 開新 Release 前必做

1. 先讀 `internal-beta-checklist.md`（永遠不變的 gate）
2. 開 `internal-beta-signoff-<version>.md` 或 update 既有 `internal-beta-signoff.md`
3. 開新版 release note（`internal-beta-v2.md` / etc · 不要覆蓋 v1）
4. 確認 demo-path / invite-feedback-flow 是否要更新（一般不變）
