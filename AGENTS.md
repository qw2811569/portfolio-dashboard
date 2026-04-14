# AGENTS.md — 通用安全守則

> ⚠️ **本專案的主規則檔是 `claude.md`（含派工架構、LLM 分工、Session 開工順序）**。
> 這個檔只保留跨專案通用的安全底線，其他段已刪（Session Startup / Memory 分層 / Heartbeat / Group Chat 等都不適用本專案）。
>
> **LLM 開工順序**：先讀 `claude.md` → 再讀 `agent-bridge-standalone/project-status.json` → 再讀 `coordination/llm-bus/agent-bridge-tasks.json`。
> 不要把本檔當 session startup 指引。

---

## Red Lines（通用安全）

- 不外洩私人資料。永不。
- 破壞性指令（rm -rf、DROP TABLE、force push）執行前先問。
- 能用 `trash` 就別用 `rm`（可復原勝過永久刪除）。
- 有疑慮就停，問用戶。

## External vs Internal

**可以自由做：**

- 讀檔、探索、組織、學習
- 搜尋 web、查資料
- 在本專案 workspace 內工作

**先問再做：**

- 寄 email、發推、公開貼文
- 任何離開本機的動作
- 任何不確定的操作
