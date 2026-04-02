# Session 交接 V2 — 2026-04-02 晚

前一版：`session-handoff-2026-04-02.md`

---

## 用戶反饋的核心問題（不是個別 bug，是架構斷裂）

### 1. 全組合研究只分析一檔

**根因：** Codex 在 FIX-2 把本地 research 改成 `local-fast` 1 輪模式。但全組合研究（evolve mode）需要 4 輪迭代（Round 1 個股快掃全部持股 → Round 2 組合建議 → Round 3 系統診斷 → Round 4 提案）。1 輪只做完第一檔個股就結束了。

**修法：** `api/research.js` 的 `local-fast` 模式應該是「每輪只呼叫一次 AI（不迭代改善）」，而不是「只做 Round 1」。4 個 Round 都要跑，但每個 Round 只呼叫一次。

### 2. 頁面各自為政，沒有串成閉環

**設計目標（from 架構文件）：**

```
持倉管理 → 催化事件追蹤 → 收盤分析 → 深度研究 → 復盤 → 策略記憶沉澱
```

**現實：** 每個頁面獨立運作，數據沒有流通：

- 行事曆的事件沒有被注入收盤分析（✅ 已修 — eventSummary 有傳入）
- 收盤分析的 BRAIN_UPDATE 沒有更新策略大腦（⚠️ parse 不穩定）
- 深度研究的結果沒有回寫到持倉 dossier（⚠️ enrichResearchToDossier 有但可能沒觸發）
- FinMind 數據沒有出現在分析 prompt 中（⚠️ Codex FIX-4 剛修但需驗證）

### 3. 分析顯示「資料來源不足」

**根因：** `buildDailyHoldingDossierContext()` 組裝 dossier 時，FinMind 數據（三大法人、財報、外資持股）可能是空的。原因：

- `usePortfolioDerivedData.js` 的 async enrichment 可能在分析開始前還沒完成
- FinMind 快取第一次載入時沒有數據（需要第一次 API 呼叫才有）
- `dossierByCode` Map 可能是空的因為 enrichment 失敗

### 4. OpenClaw 的正確用法

用戶希望透過 Telegram 遙控 Mac mini 上的開發流程。OpenClaw 的角色是**跑指令的遠端手**。

已完成：

- ✅ Telegram bot token 更新
- ✅ Telegram health OK
- ✅ 專案 symlink 到 OpenClaw workspace

用法：在 Telegram 跟 bot 說 shell 指令，例如：

```
在 /Users/chenkuichen/app/test 執行 git log --oneline -5
```

---

## 下一輪任務（第七輪）

### Codex — 修全組合研究 + 數據流通

1. **FIX-5 全組合研究修復** — `api/research.js` 的 `local-fast` 模式應該跑完 4 個 Round（個股快掃、組合建議、系統診斷、提案），但每個 Round 只做 1 次 AI call。不是只做 Round 1。
2. **FIX-6 FinMind 數據確認進入 prompt** — 在 `buildCompactFinMindSummary()` 加 console.log 驗證 7 個 dataset 是否有值。如果沒有，追蹤 `fetchStockDossierData()` 是否被正確呼叫。
3. **FIX-7 策略大腦更新** — 確認收盤分析的 `extractDailyBrainUpdate()` 能正確解析 BRAIN_UPDATE 後更新 `strategyBrain`。

### Qwen — 閉環 UI 串接

1. **事件→分析串接可視化** — 收盤分析結果中顯示「本次分析引用了 X 個事件、Y 條知識庫規則、Z 筆 FinMind 數據」
2. **研究→持倉回寫確認** — 深度研究完成後，確認目標價、基本面有回寫到持倉頁
3. **FinMind 數據面板** — 在持倉詳情展開區顯示 FinMind 三大法人/PER/融資融券的最新數據

### Gemini — 產業新聞 + 競爭態勢

1. **產業新聞** — `news-2026-04-02.json`
2. **FinMind 數據品質** — 抽查驗證

### 成本守則

- 不要頻繁 push
- 本地測試用 `vercel dev`
- FINMIND_TOKEN 在 `.env`（不是 `.env.local`）
- 改完一次 push，不要手動 Redeploy
