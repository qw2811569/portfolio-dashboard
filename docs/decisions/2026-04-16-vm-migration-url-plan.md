# VM 遷移 URL 規劃：穩了再買 domain

**日期**：2026-04-16
**用戶拍板**：「好穩了再買」

## 時間線

| 階段              | URL                                                                          | 狀態                |
| ----------------- | ---------------------------------------------------------------------------- | ------------------- |
| **現況**          | `jiucaivoice-dashboard.vercel.app`（Vercel）+ `35.236.155.62.sslip.io`（VM） | 🟢 兩邊活           |
| **遷移期**        | 兩邊都活（DNS 還沒切）                                                       | ⏳                  |
| **Phase 2 切 VM** | 主站用 `35.236.155.62.sslip.io`                                              | sslip.io 免費 HTTPS |
| **觀察 1-2 週**   | 無事故 → 買 domain                                                           | 等穩定              |
| **正式 domain**   | `jiucaivoice.com` 或別名（用戶挑）                                           | 待買                |

## 為什麼先不買 domain

1. **遷移期 sslip.io 夠用**（HTTPS 已設、免費、Let's Encrypt 可續）
2. 4-5 internal beta 用戶看醜 URL 可接受
3. 買 domain 前 DNS / Cloudflare 設定可能 debug 1-2 天 — 先別跟 VM 遷移疊在一起
4. 穩了之後 domain 挑更從容（名字、.com/.tw/.app 對比）

## 穩了的標準（用戶認可才買）

- VM Phase 1 ship 完無回退 7 天
- 至少 2 次 atomic deploy 成功（證明 rollback 機制 work）
- VM uptime ≥ 99%（手動檢查）
- 無重大 bug / 資料遺失

## 買 domain 時會做的事

1. 挑名字（sageholdings / calmportfolio / jiucaivoice 等）
2. 買 `.com` 或 `.app`（~NT$400-600/year）
3. DNS 放 Cloudflare（免費 CDN + DDoS）
4. Cloudflare Tunnel 連 VM（不暴露 IP）
5. Let's Encrypt cert 切新 domain
6. 舊 sslip.io 301 redirect 新 domain

## 短期 FAQ

Q: Vercel URL `jiucaivoice-dashboard.vercel.app` 會消失嗎？
A: **會，但不是馬上**。DNS 切 VM 後 Vercel 仍可跑，只是沒人打。觀察 2 週後關 Vercel Pro 才失效。

Q: 別人看到 sslip.io 會不會不信任？
A: 會。但 internal beta 階段用戶是你找的人，預期這段不專業。正式邀請用戶前必買 domain。
