# PROJECT_ENTRY.md — 專案唯一入口

最後更新：2026-04-03
狀態：**所有 LLM / 人類接手時的第一份文件**

## 這份文件是幹嘛的

這不是取代所有文件。

它的用途是：

- 在 LLM 換電腦、換 session、上下文消失時，**最快重新理解專案**
- 告訴接手者：**現在主線是什麼、做到哪、還差什麼、下一步誰做什麼**
- 提供延伸文件入口，避免每次重新翻整個 repo

---

## 先講結論：現在真正的主線目標

**把專案核心主流程做成可交付狀態：架構落地、前後閉環、流程順、明顯 bug 收斂。**

不是再零碎修一堆小點，而是先確認這條線真的通：

**持倉 / 事件 / FinMind 資料 → 收盤分析 / 深度研究 → 策略更新 → 前台看得到完整結果**

---

## 現在的真相版本

### 已經明確的事

- 唯一入口改為 `docs/status/PROJECT_ENTRY.md`
- canonical 細節狀態仍以 `docs/status/current-work.md` 為主
- 專案主入口仍是穩定 runtime，不是未來藍圖那條 route migration
- Gemini 暫時**不列入主線**，等使用者回到電腦後再決定是否啟用
- 決策與整體複查由 **小奎 + Claude** 主導，再分工給 Codex / Qwen

### 目前已做到的重點

- **Codex（本地已完成）**
  - 全組合研究不再只跑一段，已補成 4 輪流程
  - FinMind 資料有補進分析 / 研究前的主流程
  - 收盤分析產生的策略更新，已補強成不只看單一欄位
- **Qwen（已有前台進展）**
  - 等待提示已補
  - Holdings 的部分視覺化已接上
  - 前台已有事件 / 規則 / FinMind 使用量顯示

### 還沒完全收斂的地方

- 本地 vercel dev 的 API 路由不正確（回傳原始碼而非 JSON），功能測試需打 production
- Vercel production 額度可能受限，需確認 serverless function 是否正常
- 自動閉環 (auto-loop) 已能跑 CI + production API 測試，但尚未做過完整的使用者端到端操作驗收

---

## 目前最重要的風險

1. **狀態分散**
   - 做了很多，但 checkpoint、handoff、角色卡、新舊任務混在一起
2. **本地完成 ≠ 已可交付**
   - 核心流程雖有修補，但還需要正式 smoke / 驗收
3. **上下文容易斷**
   - 換電腦、換 session、LLM 歷史消失時，容易重新判斷一次

---

## 現在的分工原則

### 小奎 + Claude（架構師 + 品質總監）

- 主導決策與整體邏輯複查
- 審查其他 AI 的產出品質
- 透過 OpenClaw ACP 調度所有 AI

### Codex（工程師）

- 修 bug、寫邏輯、改 API
- 負責所有程式碼修改
- 不做測試驗證（那是 Qwen 的事）

### Qwen（QA 測試員）

- 跑 build/lint/test 驗證
- Production API 功能測試
- 發現問題寫回報，不自己修
- 詳細 QA 流程見 `QWEN.md`

### Gemini

- 暫不納入主線（API 限流）
- 可用時負責公開資料蒐集

### OpenClaw（純調度員 — 不做推理）

只負責：

- 接 Telegram webhook/polling，轉傳訊息給 AI
- 維持 gateway 背景執行
- 管理 token、session、排程、錯誤重試
- ACP 調度 Claude/Codex/Qwen 的 session 生命週期

不負責：

- 模型推理（那是 Claude/Codex/Qwen 的事）
- 工具標準定義
- 策略判斷或程式碼修改

---

## 接手者最短閱讀路徑

### 第一步：先看這份

- `docs/status/PROJECT_ENTRY.md`

### 第二步：看 canonical 狀態板

- `docs/status/current-work.md`

### 第三步：看架構共識

- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
- `/Users/chenkuichen/.openclaw/workspace/OPENAI_OPENCLAW_GUARDRAILS.md`

### 第四步：若要追細節，再看交接

- `docs/status/session-handoff-2026-04-02-v2.md`

### 角色補充文件

- `CLAUDE.md`
- `CODEX.md`
- `QWEN.md`
- `GEMINI.md`

---

## 接手時先回答這 4 件事

1. **現在主線目標是什麼？**
   - 架構落地、流程閉環、明顯 bug 收斂
2. **目前做到哪？**
   - Codex 已補核心主流程（parser/research/brain update/FinMind hydration）
   - 前台已有事件/知識庫/FinMind 顯示
   - OpenClaw ACP 多代理調度已就緒
   - 自動閉環 (auto-loop) 可從 Telegram 一鍵啟動
3. **還差什麼才算可交付？**
   - 使用者端到端操作驗收（打開頁面 → 收盤分析 → 看到結果）
   - 確認 Vercel production API 額度與可用性
4. **下一步誰做哪一件事？**
   - 小奎：手動走一遍主流程，找出卡住的地方
   - Claude：根據小奎的回報判斷修復優先順序
   - Codex：修小奎和 Qwen 找到的問題
   - Qwen：跑 QA 驗證修復結果

---

## 更新規則（很重要）

這份文件要跟著進度更新，但**不要把所有細節直接塞在這裡**。

更新原則：

- 這份只保留：主線、狀態、風險、下一步、文件入口
- 細節驗證、完整變更檔案、測試清單，仍寫在 `current-work.md`
- 每次重要 checkpoint 更新時，**同步更新這份文件的「現在做到哪 / 還差什麼 / 下一步」**
- 舊 handoff 文件只保留歷史角色，不再承擔主線說明

建議更新時機：

- Codex 完成一輪正式驗收後
- Qwen 完成前台最後閉環後
- 主線目標改變時
- 任何會影響接手理解的決策變更時

---

## 給未來接手的 LLM 一句話

**先別急著修 bug。先確認現在主線、目前真相、可交付程度，再決定你要做哪一件事。**
