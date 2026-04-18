# Vercel 部署策略 + Claude API 使用守則

> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔（2026-04-02）推 Turbo→Standard · 但 2026-04-16 調查發現真根因是 push 頻率  
> 最新：`claude.md` Rule 4「一大輪才 push」+ `docs/research/vercel-cost-investigation.md`  
> 保留作為 pricing reference（Turbo $0.126/min vs Standard $0.014/min 仍事實）· 但 action item 已作廢

最後更新：2026-04-02
作者：Claude（架構師）

---

## 一、你花了多少錢？為什麼？

### 4/1 當天花費：$14.23

| 項目            | 金額   | 原因                                                 |
| --------------- | ------ | ---------------------------------------------------- |
| Build Minutes   | $13.23 | **15 次 push x 每次 ~7 分鐘 x Turbo 機器 $0.126/分** |
| Function Memory | $0.82  | AI API 等待時間的記憶體費用                          |
| Function CPU    | $0.17  | 實際運算                                             |
| 傳輸            | $0.01  | 忽略不計                                             |

### 根因：Turbo Build Machines

2026/2 起 Vercel Pro **預設使用 Turbo 機器**（30 vCPU / 60 GB），費率 **$0.126/分鐘**，是 Standard 的 **9 倍**。你的 Vite build 只要 ~600ms 在本地，根本不需要 Turbo。

| 機器              | 費率       | 15 次 build 成本 |
| ----------------- | ---------- | ---------------- |
| **Turbo（目前）** | $0.126/min | $13.23           |
| Standard          | $0.014/min | **$1.47**        |

---

## 二、Vercel 部署策略

### 立即要做的（省 90% build 費用）

1. **切換 Build Machine 到 Standard**
   - Vercel Dashboard → Project Settings → General → Build & Development Settings
   - Machine Type 選 **Standard**
   - 你的 Vite build 600ms，不需要 Turbo

2. **已設定 Ignored Build Step = `exit 0`** ✅
   - push 不會自動 build
   - 手動部署：Deployments → 最新 → ⋯ → Redeploy

3. **開發用本地 `vercel dev`，不消耗 Vercel 額度**
   - 本地跑的 API 呼叫完全免費（只花 Claude API 的 token 費）
   - 只有確定要上線時才 Redeploy

### 部署節奏建議

| 情境         | 做法                               | 預估成本              |
| ------------ | ---------------------------------- | --------------------- |
| 開發調試     | `vercel dev --listen 0.0.0.0:3002` | $0（免費）            |
| 確認功能正常 | 手動 Redeploy 到 production        | ~$0.10/次（Standard） |
| 日常使用     | 每天最多 1-2 次 deploy             | ~$3/月                |

### 月費預估（優化後）

| 項目                                 | 預估                                 |
| ------------------------------------ | ------------------------------------ |
| Vercel Pro 底價                      | $20（含 $20 credit）                 |
| Build Minutes（Standard，每天 2 次） | ~$4                                  |
| Function 執行                        | ~$5                                  |
| 儲存/頻寬                            | ~$1                                  |
| **總計**                             | **~$30/月**（$20 credit 抵掉大部分） |

### Cache-Control 優化

目前 `vercel.json` 對所有路由設了 `no-cache, no-store`。應該只對 API 這樣做，靜態資源要設長快取：

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store" }]
    }
  ]
}
```

---

## 三、Claude API 使用守則

### 定價（claude-sonnet-4，你目前的 model）

|                  | 每百萬 token        |
| ---------------- | ------------------- |
| Input            | $3                  |
| Output           | $15                 |
| Cache 命中 Input | $0.30（**省 90%**） |

### 每次呼叫成本

| 功能     | Input tokens | Output tokens | 成本       |
| -------- | ------------ | ------------- | ---------- |
| 收盤分析 | ~3,500       | ~2,000        | **~$0.04** |
| 深度研究 | ~6,000       | ~3,500        | **~$0.07** |
| OCR 解析 | ~1,800       | ~400          | **~$0.01** |
| 盲測預測 | ~2,000       | ~500          | **~$0.01** |

### 月費預估（單人）

| 使用模式             | 呼叫/月 | 月費       |
| -------------------- | ------- | ---------- |
| 保守（只做收盤分析） | 22 次   | **~$0.88** |
| 正常（+研究+OCR）    | 50 次   | **~$2**    |
| 重度（頻繁研究）     | 100 次  | **~$5**    |

**Claude API 非常便宜，不是成本瓶頸。**

### 優化守則

1. **OCR 用 Haiku 4.5** — 簡單的截圖文字辨識不需要 Sonnet，改用 Haiku 可省 3 倍

   ```javascript
   // api/parse.js 可以指定較便宜的 model
   const parseModel = 'claude-haiku-4-5-20251001' // $1/$5 per MTok
   ```

2. **啟用 Prompt Caching** — system prompt 每次都一樣，cache 後只花 10% 費用

   ```javascript
   // 在 callAiRaw 中加 cache_control
   system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
   ```

3. **不要開 Extended Thinking** — thinking tokens 算 output（$15/MTok），目前 `allowThinking: false` 是對的，保持不變

4. **maxTokens 設合理值** — 目前設定合理，不需要改

### 絕對不要做的事

- ❌ 不要把 `maxTokens` 設到 8000+（浪費 output tokens）
- ❌ 不要每次 push 都觸發 Vercel build（已修）
- ❌ 不要在前端暴露 `ANTHROPIC_API_KEY`（目前正確放在後端）
- ❌ 不要對每檔持股各呼叫一次 AI（目前正確做法是批量組裝）

---

## 四、本地開發 vs Production 的分工

|          | 本地 `vercel dev`                  | Vercel Production        |
| -------- | ---------------------------------- | ------------------------ |
| 適合     | 開發、調試、日常自用               | 外部用戶訪問、demo       |
| API 功能 | ✅ 完整                            | ✅ 完整                  |
| 費用     | Claude API only（~$0.04/次）       | Claude API + Vercel 費用 |
| 速度     | 取決於網速                         | CDN 加速                 |
| 啟動指令 | `vercel dev --listen 0.0.0.0:3002` | Dashboard → Redeploy     |

**建議：平常用本地 `vercel dev`，只在需要外部訪問或 demo 時才 deploy 到 production。**

---

## 五、LLM 開發流程守則

### Push 與 Deploy 分離

```
開發 → commit → 本地測試 → 確認 OK → push → 不自動 build
                                              ↓
                                        需要上線時才手動 Redeploy
```

### 給其他 AI 的規則

1. **可以自由 commit** — commit 不花錢
2. **push 前要確認** — push 會觸發 build（如果沒設 Ignored Build Step）
3. **不要頻繁觸發 production deploy** — 每天最多 1-2 次
4. **本地測試用 `npm run build && npx vite preview`** — 不花錢
5. **API 測試用 `vercel dev`** — 只花 Claude API token 費
