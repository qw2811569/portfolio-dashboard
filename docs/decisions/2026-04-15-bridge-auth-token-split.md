# VM Bridge Auth Token 拆 prod / preview

**日期**：2026-04-15
**觸發**：Vercel preview 分支若拿到 prod token 可打 prod VM mutating route

## 決議

VM Agent Bridge 接受兩個 token：

- `BRIDGE_AUTH_TOKEN` (prod)
- `BRIDGE_AUTH_TOKEN_PREVIEW` (preview)

Vercel env 兩邊都叫 `BRIDGE_AUTH_TOKEN`，但各自綁不同值（prod 值 vs preview 值）。

## 實作

- `agent-bridge-standalone/server.mjs` 同時驗兩個 token，log 區分（`Auth accepted (http:prod)` / `(preview)`），不 log 值
- VM pm2 env 加 `BRIDGE_AUTH_TOKEN_PREVIEW`
- `.env.example` 加欄位註解

## 風險 / 未來升級

- 目前 prod/preview 權限仍同級（token 分開但能打同 routes）
- 未來若 preview token 只能寫 preview 隔離資源，需做 route ACL
