> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔審查的是「全棧搬 VM」前提；該前提已被 staged migration 決議取代。
>
> 最新請見 `docs/decisions/2026-04-16-vm-maximization-roadmap.md`、`docs/decisions/2026-04-16-product-gap-and-arch-direction.md`、`docs/decisions/2026-04-16-vm-migration-url-plan.md`。

# Gemini 盲點審查 — VM 全遷移決策

**派給**：Gemini
**角色**：外部視角反駁者

**讀這兩份**：

- `docs/research/vm-full-migration-brief.md`（Claude 寫的遷移計畫）
- `docs/research/infra-03-vm-orchestrator-brief.md`

## 問題

用戶決定從 Vercel + VM 混合架構 → 全搬 VM。Claude/Codex 都支持。**你找 3 個他們沒看到的洞**。

可能方向（不限）：

- 全搬 VM 真的便宜嗎？隱藏成本（DNS / SSL / DDoS 防護 / monitoring / backup）
- VM 單點故障 — 4-5 付費用戶時若 VM 掛 2 小時能接受嗎？
- Vercel 的 preview env 失去後，驗證新功能怎麼做
- Vite 環境變數 / build-time config 在 VM 上的差異
- 全球用戶（若未來擴）CDN latency
- 開發體驗倒退（失去 Vercel PR preview）
- 潛在資料 migration 問題（Blob、cache）

## 回報格式

```markdown
## 3 個盲點

1. ...
2. ...
3. ...

## 整體判斷

- [ ] 同意遷移
- [ ] 改 X 再遷
- [ ] 不要遷

## strongest_objection
```

300 字以內。不客套。
