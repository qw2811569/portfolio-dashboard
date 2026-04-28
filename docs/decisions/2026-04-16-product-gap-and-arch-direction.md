# 產品化 Gap + 架構方向（長期錨點）

> ⚰️ **架構章節 SUPERSEDED 2026-04-28** — 「Vercel = 純 web server / VM = 純 backend」雙雲分工已 SUPERSEDED 為 single-cloud sovereignty：兩台 GCP VM（bigstock `35.236.155.62` + jcv-dev `104.199.144.170`）對稱 dev 環境 · 各跑全套 stack（持倉看板 + Agent Bridge + cron + GCS）· Vercel 2026-04-28 disconnect 為 cold backup。產品化 Gap 章節仍適用。詳 [`2026-04-25-vercel-full-decoupling.md`](./2026-04-25-vercel-full-decoupling.md)

**日期**：2026-04-16
**決議人**：用戶（2026-04-16 口頭確認）
**狀態**：長期 roadmap 錨點

## 一、用戶認可的產品化 Gap

當前位置 = prototype → internal beta（非商業階段）。

| 類別           | 現況                                   | 產品化需要                  |
| -------------- | -------------------------------------- | --------------------------- |
| 核心功能       | 能跑，但目標價 4/11 覆蓋、edge case 多 | 8/11 以上、0 重大 bug       |
| 視覺           | Phase 2 ship（Hero + 圓環）            | Phase 3-5 + 響應式 + 空狀態 |
| 穩定性         | 手動測                                 | 連續 4 週無事故             |
| 多用戶         | 只 1 人用                              | Auth + portfolio 隔離       |
| 收費           | 0                                      | Stripe / 綠界整合           |
| onboarding     | 0                                      | 引導、教學、錯誤救援        |
| 法律           | 0                                      | 服務條款、隱私、免責        |
| brand / domain | 暫掛 sslip.io + vercel.app             | `.com` + logo + 品牌故事    |
| support        | 0                                      | 客服 / feedback channel     |

**距離**：2-4 個月全速推（不含法律、品牌）。

## 二、長期架構方向（穩了才會搬）

**終極形態**：

```
Vercel   = 純 web server（前端 CDN、靜態 build、SSL、全球邊緣）
VM       = 純 backend / API server（所有 /api/* + cron + 長任務 + AI）
```

**現況 = 過渡態**：Vercel 暫留「讀 Blob 的輕 API」做遷移節奏 + CDN 邊緣速度。

**何時完全純化**（三條都達才執行）：

1. VM 連續穩定運行 3 個月以上
2. 至少 1 次 zone-level 事件處理過（或手動模擬演練過）
3. 有付費用戶（Stripe 接了）→ backend 明確化有商業動機

**純化後 Vercel 只做**：

- React build 靜態發佈
- 全球 CDN 邊緣快取（持倉看板 HTML / CSS / JS）
- DNS + SSL 代管
- Preview deploy（PR / 分支測試）

**純化後 VM 做**：

- 所有 /api/\*（瀏覽器 → VM，不再繞 Vercel serverless）
- 所有 cron、長任務、WebSocket、佇列
- 完整 Postgres / Redis / SQLite 存儲
- AI orchestration / LLM CLI

## 三、目前資料源處理狀態（2026-04-16 Codex 3 深度研究結論）

- **TWSE OpenAPI 只覆蓋上市**（1081 rows 實測），上櫃股（6470 等）拿不到 → **不接**為 analyst target-price 來源
- **cnyes** 上市 40 檔抽 21 有 target data、上櫃 40 檔抽 13 有 → **接為 aggregate fallback**（非 per-firm），工時 4-6 小時
- **Fugle / TEJ** 不解 target-price，屬未來 market-data/fundamentals lane → **暫不接**
- **現況**：目標價 4/11 覆蓋（FinMind + CMoney notes tag=78570）
- **接 cnyes 後估算**：4/11 → ~7/11（64%）

詳見 `docs/research/taiwan-stock-data-sources-v3-deep.md`。

## 四、這段時間的優先級

1. **UX / 呈現層 > infra / 資料源**（3 家 LLM 共識）
2. **VM / Vercel 都用，不動成本**（直到穩定）
3. **暫不做**：Stripe、auth、multi-tenant、成本優化
4. **Vercel 部署紀律**（CLAUDE.md rule #4 已更新）：
   - 預設本地 dev，不 push
   - 例外才 push（備份 / VM 依賴驗證）
   - 每次 push 前跟用戶確認理由

## 五、何時重開這份 decision

- 5 人內測連續跑 4 週無事故
- 用戶給核心功能具體滿意度
- 用戶主動問「我想付費」or「可以分享朋友用嗎」

其中任一達成 → 啟動商業化討論（定價 / auth / 收款）+ 考慮架構純化。
