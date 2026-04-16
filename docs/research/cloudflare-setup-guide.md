# Cloudflare Setup Guide

目的：在不切 production DNS 到 VM 的前提下，先把 `jiucaivoice.com` 納入 Cloudflare free tier，準備 DDoS 防護、CDN、WAF 能力。

## 10 步驟

1. 登入 Cloudflare，點 `Add a domain`，輸入 `jiucaivoice.com`。
2. 選 `Free` 方案，確認功能會包含 CDN、Auto Minify、基礎 WAF、DDoS 保護。
3. 匯入現有 DNS records，逐筆比對 `A`、`CNAME`、`TXT`、`MX`，先不要刪原本 provider 上的紀錄。
4. 保留目前正式站的 DNS 指向不變。
   原因：本輪不做 production DNS switch，只先完成 Cloudflare 設定與驗證。
5. 到 Cloudflare `DNS` 頁，把未來要走 Cloudflare 代理的 Web 記錄雲朵切成 `Proxied`；mail 相關 `MX` / mail host 一律維持 `DNS only`。
6. 到 `SSL/TLS` 設為 `Full (strict)`。
   前提：VM 上 Nginx 憑證已有效，否則 strict 會失敗。
7. 到 `Security` 啟用 `WAF` 與 `DDoS protection` 預設規則；free tier 先用 Managed Rules 預設值，不要自訂過多例外。
8. 到 `Speed` 或 `Caching` 啟用 `Auto Minify`、`Brotli`、`Always Online`；對 `/api/*` 不做 cache rule，避免快取動態資料。
9. 建一條 Cache Rule：`Hostname equals jiucaivoice.com` 且 `Path does not start with /api/` 時允許 cache；`/api/*`、`/github/webhook` 一律 `Bypass cache`。
10. 用 Cloudflare 提供的 nameserver 先在 registrar 端完成替換，但先只驗證 DNS propagated 與憑證狀態，不把使用者流量切到新的 VM origin；等 Phase 2 再正式切換 A record / origin 策略。

## 驗收

- `dig NS jiucaivoice.com` 應看到 Cloudflare nameservers。
- `curl -I https://jiucaivoice.com` 應出現 `server: cloudflare` 與 `cf-ray`。
- `curl -I https://jiucaivoice.com/api/health` 不應看到 cache hit 標頭。

## 注意

- free tier 沒有進階 WAF 自訂與完整 rate limiting；API 限流仍以 VM Nginx 為主。
- 若正式站暫時仍走 Vercel，Cloudflare 只是在前面代理，不等於已切到 VM。
- `sslip.io` 測試域名不建議接 Cloudflare；Cloudflare 設定以正式網域 `jiucaivoice.com` 為主。
