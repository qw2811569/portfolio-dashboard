> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔假設「Vercel 只留 DNS、全棧搬 VM」；後續正式決議已改為 staged migration：Vercel 保留前端/CDN，VM 承接重後端與長任務。
>
> 最新請見 `docs/decisions/2026-04-16-vm-maximization-roadmap.md`、`docs/decisions/2026-04-16-product-gap-and-arch-direction.md`、`docs/decisions/2026-04-16-vm-migration-url-plan.md`、`docs/decisions/2026-04-15-knowledge-api-blob-not-vm.md`。

# Full VM 遷移 — Vercel 只留 DNS，全棧搬 VM

**派給**：Codex
**日期**：2026-04-16
**用戶拍板**：搬 VM（放棄 Vercel serverless + CDN，VM 全接）
**前提**：VM 已有 nginx + Let's Encrypt + pm2 + Agent Bridge（port 9527），已 HTTPS

## 目標架構

```
users → HTTPS → nginx (VM)
  ├── /              → static React build (/var/www/app/dist)
  ├── /api/*         → pm2 node (port 3000)
  └── /agent-bridge  → pm2 agent-bridge (port 9527)
```

## 分 2 階段

### Phase 1（今天）：VM 加 static + /api 轉發

1. VM: `pm2 start scripts/vercel-api-server.mjs --name jcv-api`（新寫）
   - 模擬 Vercel serverless，read api/\*.js 並 express mount
2. VM: build step — `npm run build` in VM 產 dist/
3. VM: nginx vhost:
   - `server_name jiucaivoice.com`（DNS 等 Phase 2 才切）
   - `location /` → `root /var/www/app/dist`
   - `location /api/` → `proxy_pass http://127.0.0.1:3000`
4. VM: GitHub webhook endpoint / deploy script
5. 保留 Vercel 當 backup 1 週

### Phase 2（驗證穩 1 週後）

- DNS 切 VM
- 關 Vercel Pro / cron
- 月省 ~$100

## 關鍵檔案新增

- `scripts/vercel-api-server.mjs`（核心：Vercel-compatible express adapter）
- `scripts/vm-deploy-webhook.mjs`（GitHub webhook → pull + build + pm2 reload）
- `deploy/nginx-jcv.conf`（nginx vhost 設定）
- `deploy/pm2-ecosystem.config.cjs`（pm2 app manifest）

## 不做

- ❌ 不動 api/\*.js 業務邏輯（adapter 層吸收差異）
- ❌ 不改 src/\*（前端照舊）
- ❌ 不 deploy Phase 2（本輪只做 Phase 1 + 驗證）

## 驗收 Phase 1

```bash
# 從 Mac 測 VM 直接回 app
curl -sI https://35.236.155.62.sslip.io/  # 應該 200 且 content-type html
curl -s https://35.236.155.62.sslip.io/api/target-prices?code=3491 | jq
```

## Vercel 還留什麼

- Vercel 繼續服務 jiucaivoice-dashboard.vercel.app（backup）
- 停 auto-deploy（手動 trigger 才 build）
- 下週 migrate 完刪

## 回報

```
done:
new files:
vm deploy: ssh / pm2 / nginx / cert
test: curl 結果
我反駁 Claude:
```

## 反駁 Claude

- 如果 express adapter 比我想的複雜（Vercel 有 edge runtime 等特殊），建議先只搬 static + 保留 Vercel /api
- 如果 nginx config 有 gotcha（WebSocket / CORS），flag
