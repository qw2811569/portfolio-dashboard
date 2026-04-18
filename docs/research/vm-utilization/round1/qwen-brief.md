# VM 利用 Round 1 — Qwen（成本 + 驗證 + 運維風險）

**讀必備**：`docs/research/vm-utilization/claude-baseline.md`

## 你的角色

Ops / verification lens。看 Claude 的提案**運維痛不痛、成本真數字、失敗模式**。

## 必答 5 題

### Q1. VM 4 cores 16GB 真的夠嗎？

列估算：

- 跑 target-price job 每檔 CPU/RAM 吃多少？
- 加上 Vector DB（pg-vector or Qdrant）RAM 多少？
- FinMind local SQLite 100GB disk 用幾成？
- 同時跑 Codex / Qwen CLI 會不會 OOM？

### Q2. 每個場景的真實運維風險

對 Claude 6 個場景各給：

- **failure mode** (pm2 restart fail / disk full / cert expire / OOM)
- **monitoring gap**（目前有沒有 alert）
- **recovery time**（掛了多久才能補）

### Q3. Cost deepdive

- 這台 GCP VM **一個月多少錢**？（e2-standard-4 大約 $97）
- 用到 80% 利用率 vs 20%，電費省多少？（VM 月費不變，差別是 throughput）
- 加 Cloudflare / CDN / Alert monitoring 月費？

### Q4. 跟 Vercel 比的 ROI

如果把 VM 的 P0 任務搬 Vercel Pro ($20/月)：

- Vercel Pro 有 900s maxDuration，足以跑 target-price
- Vercel 加 Blob = 很多 VM 功能都能做
- 為什麼不把 VM 全退掉改 Vercel Pro？

### Q5. 你的驗收策略

對每個建議 ship 的場景，**怎麼驗證確實發揮 VM 優勢**？

- Before / after 指標
- 成本 before / after
- 運維成本 before / after

## 回報

```markdown
## Q1 VM 資源 sizing 分析

## Q2 6 場景的運維風險表

## Q3 Cost deepdive ($/月明確)

## Q4 VM vs Vercel Pro 真 ROI

## Q5 驗收策略

## 我反駁 Claude 的地方（至少 2 點）
```

上限 900 字。要數字不要文青。
