# 產品階段：先穩定再談錢

**日期**：2026-04-16
**決議人**：用戶
**優先級**：高

## 決議

當前產品階段 = **prototype → internal beta**，不是商業階段。

- **VM 繼續用**（已付，榨到滿，不用考慮單位經濟）
- **Vercel 繼續用**（但限制是真的，重活該搬 VM）
- **4-5 付費用戶**是**未來測試**用途，不是今天的 revenue pressure
- **定價討論** = 產品穩定後才開
- **cost optimization** / multi-tenant auth / Stripe = **延後**

## 這意味著

✅ **現在該做**

- UX 打磨（PM plan v2 持倉篩選 + 行動提示 + MOPS 重訊整合）
- 技術基礎建設（VM Top 2、長任務 job queue、analyst-reports 搬 VM）
- 視覺 polish（VM dashboard Swiss × warm neutral ship）
- 資料源接更多（Codex 提 Top 5：MOPS + MoneyDJ + cnyes + 央行 + 股狗 / CMoney）

❌ **不該做（延後）**

- Stripe / 綠界 / ecpay 收款整合
- Multi-tenant 資料隔離 / per-user auth
- Rate-limit quota per user
- 用戶數 / 每月 MRR dashboard
- Switch to Fly.io / Railway / Cloudflare（成本討論）
- 產品定價 brainstorm

## 何時 reopen 這個決議

1. 5 人內測**連續跑 4 週穩定**，無重大 bug
2. 用戶對核心功能（持股分析、事件驗證、深度研究）給出具體滿意度
3. 用戶主動問「我想付費繼續用」or「可以分享給朋友用嗎」

達到以上 3 條之一 → 啟動「商業化討論」（定價 / auth / 收款）。

## 支撐這個方向的三家 LLM 共識（2026-04-16）

- **Gemini**（VM blind-spot round）：用戶真痛點可能是 UX 不清，不是 VM 技術
- **Codex**（finance data round）：缺的不全是資料源，也缺呈現層
- **Qwen**（free reports round）：≥3 家投顧明細是 over-spec，dashboard 該顯示「有 N 家」而非硬湊

**3 家獨立得出同方向**：**UX / 呈現層 > infra / 資料源**。
