# Runtime Status File Policy · 2026-04-24

**日期**：2026-04-24
**狀態**：✅ 決議
**來源**：R138/R139 C4 runtime status file cleanup

## 背景

這個 repo 有幾類檔案會被本地 CLI、cron、或 VM runtime 持續改寫：

- `docs/status/ai-activity.json`
- `docs/status/ai-activity-log.json`
- `docs/status/data-coverage-YYYY-MM-DD.md`
- `agent-bridge-standalone/data/tasks.json`

它們對 live dashboard、同日 debug、與本地審計有用，但進 git 後幾乎只留下時間戳、當前任務、`updatedAt`、append-only feed 之類的低訊號變動，反覆污染工作樹與 commit history。

## 決策

| 檔案                                      | 類型                                  | 處置            | 理由                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/status/ai-activity.json`            | AI live runtime state                 | `A · gitignore` | 給 docs-site / AI 協作腳本讀即時狀態即可；git history 不需要記錄每次 CLI 啟動與 `lastUpdated` 漂移。                                                          |
| `docs/status/ai-activity-log.json`        | append-only live activity feed        | `A · gitignore` | 最近 activity feed 對當下 debug 有用，但每次 append 都進 repo 只會造成巨大噪音；長期 checkpoint 應看 `docs/status/current-work.md`。                          |
| `docs/status/data-coverage-YYYY-MM-DD.md` | 每日 audit report artifact            | `A · gitignore` | `verify:local` 與 cron 每天都會產生；保留本地報表即可。若未來真的需要趨勢史，另做 curated monthly digest，不直接 commit 每日 verify 產物。                    |
| `agent-bridge-standalone/data/tasks.json` | Agent Bridge persisted runtime mirror | `A · gitignore` | 這是 seed task + runtime evidence/session assignment 的混合持久層；repo 真相應維持在 `coordination/llm-bus/agent-bridge-tasks.json`，不是 `data/tasks.json`。 |

## 不選 B / C 的原因

### 不選 `B · periodic snapshot commit`

這四類檔案都不是適合直接 batch commit 的 repo source-of-truth：

- `ai-activity*` 與 `tasks.json` 的值高度依賴當下 session / host / dispatch 狀態，批次提交也沒有穩定審閱價值。
- `data-coverage-YYYY-MM-DD.md` 雖然有 audit 價值，但 daily verify artifact 太細碎；若要看月趨勢，應從更高層摘要輸出，不該把每次 verify 的 markdown 直接當歷史系統。

### 不選 `C · delete`

這些檔案仍有 live debug / audit 用途：

- `ai-activity*` 仍是 docs-site 與協作腳本的 runtime 狀態來源。
- `data-coverage-*.md` 仍是同日 coverage gate 的可讀報表。
- `agent-bridge-standalone/data/tasks.json` 仍是 bridge server 的本地持久層。

所以正確做法是「保留本地用途，但退出 repo history」。

## Repo 規則

- `docs/status/current-work.md` 仍是**需追蹤**的 canonical checkpoint 真相。
- `coordination/llm-bus/agent-bridge-tasks.json` 仍是**需追蹤**的 seed / planning 真相。
- `docs/status/ai-activity.json`、`docs/status/ai-activity-log.json`、`docs/status/data-coverage-YYYY-MM-DD.md`、`agent-bridge-standalone/data/tasks.json` 一律視為 runtime/generated artifact，不納入 feature commits。
- 若這些檔案不存在，應由既有腳本或 runtime 自動重建；不要為了讓 repo 乾淨而手動造假內容。

## 後續指引

- 若未來需要 data coverage 的長期歷史，新增獨立的人類可審閱摘要，例如 `docs/status/data-coverage/2026-05.md` 或 `docs/metrics/` 下的 curated digest。
- 不要重用 `verify:local` 每日自動生成的 `data-coverage-YYYY-MM-DD.md` 當長期版本庫。
