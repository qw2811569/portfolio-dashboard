# AI Collaboration Channel

最後更新：2026-03-25

## 目的

這份文件是本 repo 的固定多 AI 協作通道。

用途：

- 統一各 AI 的角色邊界
- 讓 Codex 能快速判斷該把什麼工作分給誰
- 在階段性回報前做 checkpoint meeting
- 讓所有 AI 回報：
  - 能做什麼
  - 不能做什麼
  - 遇到什麼困難
  - 最適合怎麼被協作

## 通道結構

固定使用兩份文件：

- live 狀態板：[current-work.md](/Users/chenkuichen/APP/test/docs/superpowers/status/current-work.md)
- 協作角色與回報協議：[ai-collaboration-channel.md](/Users/chenkuichen/APP/test/docs/superpowers/status/ai-collaboration-channel.md)

規則：

- `current-work.md`：記錄當前任務、時間線、checkpoint 結論、stop-in-5-min 收尾點
- `ai-collaboration-channel.md`：記錄每個 AI 的長期角色、能力、限制、困難、最佳協作方式

## 成員清單

### Codex

- 擅長：
  - 主架構與最後裁決
  - 高風險邏輯
  - 策略大腦、validation、truth-layer
  - 整體整合與交付前 QA
- 不適合：
  - 長時間低風險重複改碼
  - 充當唯一的即時外部資料來源
- 常見困難：
  - 資料層與 prompt 層不同步時，模型輸出可讀但不可安全回寫
  - 使用者期待高於目前資料品質時，容易被誤解成 prompt 問題
- 最佳角色：
  - 技術主導
  - 最終 reviewer
  - 多模型協作的裁決者

### Gemini

- 擅長：
  - 公開資料蒐集
  - citation / freshness / unresolved questions
  - 新聞、法說、公告、公開目標價報導索引
- 不適合：
  - 最終數字真值
  - 直接回寫 fundamentals / targets / strategyBrain
  - 最終買賣判斷
- 常見困難：
  - 容易把搜尋整合結果當成最終事實
  - 某些高階模型會先碰到每日 quota，不適合當唯一高頻主力
- 最佳角色：
  - 外部 research scout
  - public-source fact pack builder
  - 先交 facts / citations / freshness，再由 Codex 判定是否採納
- 目前穩定用法：
  - general 預設：`gemini-2.5-flash`
  - scout 預設：`gemini-3.1-flash-lite-preview`
  - `gemini-3-flash-preview` 若當日 free-tier 額度耗盡，改走上述兩個模型
  - 先跑 `scripts/gemini-healthcheck.sh`，確認 Node / auth / last error 狀態
  - 若 `validate-local-llm-stack.sh` 顯示 `429 RESOURCE_EXHAUSTED`，代表當日 research lane 額度不足，不應再把它當高頻主力

### Qwen Code

- 擅長：
  - 低風險實作
  - 機械式重構
  - 測試與小型 UI 清理
  - 第一輪 code review
- 不適合：
  - 策略大腦核心邏輯
  - 高風險同步/資料模型調整
  - 客戶版正確性最後裁決
- 常見困難：
  - 如果任務邊界不清楚，容易碰到高風險區
- 最佳角色：
  - implementation worker
  - low-risk patch owner
  - bounded coding helper
- 目前穩定用法：
  - 透過 [launch-qwen.sh](/Users/chenkuichen/APP/test/scripts/launch-qwen.sh) 啟動
  - 目前為 plain Qwen CLI，不再依賴 Ollama
  - 現階段更適合低頻、明確、bounded 任務，不應阻塞主線

### AnythingLLM

- 擅長：
  - PDF / 文件知識庫
  - 客戶報告 / spec / 研究文件查詢
  - RAG 與 workspace 知識整理
- 不適合：
  - 直接改 code
  - 直接做最終策略判斷
- 常見困難：
  - 文件知識豐富，但不是結構化真值來源
- 最佳角色：
  - knowledge base
  - document context provider

## 固定回報格式

所有 AI 在回報時，盡量用同一個結構：

- `done`
- `unknowns`
- `risks`
- `needs_external_ref`
- `next_best_step`

如果是做研究類任務，再額外補：

- `citations`
- `freshness`
- `unresolved_questions`

## 任務分配原則

### 類型 1：高風險核心邏輯

例：

- 策略大腦
- validation lifecycle
- truth-layer
- cloud sync
- 損益正確性

分工：

- Codex 主導
- Qwen 不直接改主邏輯
- Gemini 只補外部資料，不做最後裁決

### 類型 2：外部資料蒐集

例：

- 法說 / 公告 / 新聞
- 公開目標價報導
- 公開 research 索引

分工：

- Gemini 主導
- AnythingLLM 做文件檢索補充
- Codex 最後決定是否採用

### 類型 3：低風險實作

例：

- UI 小改
- helper 重構
- 測試
- 機械式整理

分工：

- Qwen 主導
- Codex review

### 類型 4：文件與知識整理

例：

- spec 摘要
- 客戶報告素材整理
- PDF / 會議 memo

分工：

- AnythingLLM / Gemini 做整理
- Codex 審核可否進主流程

## Checkpoint Meeting 規則

每次準備對使用者做階段性回報前，先做一次 checkpoint meeting。

至少檢查：

1. 哪些部分還不穩
2. 哪些資料來源仍不足
3. 哪些工作應該換 AI 接手
4. 是否需要新增 skill / 工具
5. 是否需要外部資料驗證

結論要寫回 [current-work.md](/Users/chenkuichen/APP/test/docs/superpowers/status/current-work.md)

## Stop-in-5-Min 規則

如果使用者說「中斷」：

- 所有 AI 先在 5 分鐘內完成目前小段落
- 不再開新 scope
- 回寫：
  - 完成了什麼
  - 卡在哪裡
  - 下一步最小切點

## 目前的最佳協作策略

- Codex：高風險邏輯、最終裁決
- Gemini：公開資料 scout
- Qwen：低風險 patch / test / UI
- AnythingLLM：文件知識庫

## 目前已知不足

- Gemini headless CLI 還不夠穩，還不能完全當成可靠的自動審核主力
- 本地多模型仍缺少統一的 machine-readable status channel
- Qwen 的低成本執行路徑仍需要更清楚的自動切換條件
