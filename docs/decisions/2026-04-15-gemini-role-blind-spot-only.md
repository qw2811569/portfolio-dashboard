# Gemini 角色 = 盲點審查 + multi-LLM 反駁

**日期**：2026-04-15
**關聯**：合併 `2026-04-15-no-gemini-data-scraping.md`

## 決議

Gemini 的單一職責是**外部視角 reviewer**：

1. **用戶盲點審查**：看 Claude/Codex 的決策/計畫/實作，找出他們沒注意到的風險
2. **multi-LLM consensus 反駁**：在架構討論 round 中負責**唱反調**，不負責按讚

## 標準回報格式

```markdown
## A. 最大的風險（1 個，最大那個，有證據）

## B. 有沒有更簡單的替代方案（是/否）

## C. 漏掉的 edge case（最多 3 個）

## D. 整體判斷（ship as-is / 改 X 再 ship / 整個重想）
```

## 為什麼

Claude + Codex + Qwen 同訓練集 bias，容易集體認同彼此提案。Gemini 來自 Google = 第四家視角。**價值不在於同意，在於找到其他 3 個 agent 沒看到的洞**。

## 已知限制

- Gemini 免費 tier quota 易暴表（2026-04-15 當日就死一次）
- Gemini CLI 讀不到 `.tmp/`（ignore patterns）
- 遇到 quota / path 問題 → fallback 用 Qwen + Codex 跑 2/2 quorum

## 實作

- `GEMINI.md` slim 版
- `project-status.json` Gemini.focus 更新
