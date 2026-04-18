# VM 利用 Round 1 — Codex（技術可行性 + 整合成本）

**讀必備**：`docs/research/vm-utilization/claude-baseline.md`（Claude 的 6 場景 + 3 優先級）

## 你的角色

Technical architect。看 Claude 的建議**哪些技術上卡、哪些看似簡單其實陷阱多、哪些被低估**。

## 必答 5 題（短、準）

### Q1. P0「target-price pipeline 搬 VM」真的能解 Vercel timeout 嗎？

- 具體 architecture：VM cron 跑誰、Vercel 讀誰？
- 需要改哪些檔？`api/cron/collect-target-prices.js` 變什麼角色？
- VM ↔ Vercel ↔ Blob 資料流會不會變 race condition？

### Q2. P0「infra-03 CLI on VM」隱藏坑

- Codex/Qwen/Gemini 的 OAuth / API key 怎麼放在 VM 安全？
- 跑 AI 結果寫哪？VM local 還是 Vercel Blob？
- 使用者 Mac 端 dispatch vs VM 端 dispatch 的結果要不要同步？

### Q3. P1「FinMind 本地 SQLite cache」真的值嗎？

- FinMind 1600 req/hr 額度，我們**實際用量**多少？（grep code 看）
- 快取命中率估計？
- 每日 cron full sync 要下載多少筆？

### Q4. 「深度研究 job 搬 VM」會不會破壞前端 UX？

- Vercel serverless 呼叫 VM API 的 latency？
- 如果 VM down，前端怎麼 degrade？
- 使用者等待體驗跟現狀比如何？

### Q5. Claude 漏的場景

Claude 列 6 個。你覺得還漏了什麼？或哪個其實是過度 engineering？

## 回報格式

```markdown
## Q1 target-price 搬 VM 的 architecture

## Q2 CLI on VM 安全與同步

## Q3 FinMind cache ROI 真數字

## Q4 深度研究搬 VM 的 UX

## Q5 Claude 漏掉 / 過度的場景

## 我推薦的 top 3 優先級

## 我反駁 Claude 的地方（至少 2 點）
```

上限 900 字。
