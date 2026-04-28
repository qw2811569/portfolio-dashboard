# Vercel 操作（含診斷）全部交 Codex，Claude 不碰

> ⚰️ **SUPERSEDED 2026-04-28** — Vercel 已 disconnect（無 active ops）。本紀律對 cold backup 場景仍適用（若日後手動 `vercel deploy` 救火，仍派 Codex 不派 Claude），但實際操作頻率 ≈ 0。詳 [`2026-04-25-vercel-full-decoupling.md`](./2026-04-25-vercel-full-decoupling.md)

**日期**：2026-04-16
**觸發**：Claude 自己跑 `npx vercel ls` + `vercel inspect --logs` 診斷 deploy Error，用戶糾正

## 決議

CLAUDE.md Rule 0 應延伸包含：

- ❌ Claude **不 inspect** Vercel deploy log
- ❌ Claude **不 run vercel CLI**（ls / inspect / deploy / env）
- ❌ Claude **不檢查** deploy status
- ✅ Vercel 相關**連診斷**都派 Codex，他有 MCP 相容 + 熟悉 Vercel 生態

## 原因

1. **角色一致性**：Claude = 架構 + review，動手一次後難劃線
2. **Codex MCP 相容**：他能直接讀 Vercel logs，比 Claude curl 更完整
3. **責任單一**：Deploy issue 屬於 Codex 問題域，所有層面都他處理

## 流程

Vercel 出錯時：

1. Claude 只負責**判斷 user 回報是否真的 Vercel 問題**
2. 寫 brief 給 Codex：「Vercel deploy error，請 inspect + diagnose + fix」
3. Codex 回報根因 + fix
4. Claude review Codex 的 fix
