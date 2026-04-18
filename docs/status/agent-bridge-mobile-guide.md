# Agent Bridge iPhone 使用

## URL

https://35.236.155.62.sslip.io/agent-bridge/dashboard/

## PIN

你預設的 4 位 PIN（存 iPhone Notes / Bitwarden）

## 步驟

1. Safari 開 URL
2. 輸 PIN → Enter
3. 進入主 dashboard
4. 下方訊息欄輸字 · 送
5. Claude + Codex 收到 · 會回
6. 最近 5 條訊息即時更新

## 登出

localStorage 清掉 · 或等 30 天 token 過期

## Layer 2 · 緊急 VM LLM 喚醒（當 Mac Claude / Codex 卡住）

### 何時用

- Dashboard 看 task status 很久沒更新
- 你送訊息給 Mac 端 agent，長時間沒回
- 出現 Claude quota / session crash / Mac 斷網之類訊號

### 怎麼用

1. Safari 開 dashboard 後，停在 Hero 頁
2. 找到 `Layer 2 Rescue / 緊急喚醒 VM LLM`
3. 兩種方式擇一：
   - 點 `讓 VM LLM 繼續 TODO runbook`
   - 在文字框輸入自訂指令後，點 `送自訂訊息給 VM LLM`
4. 下方 `Layer 2 log` 會每 1.5 秒自動更新

### 建議指令

- `檢查 git status 並回報`
- `跑 npm test 驗證目前是否綠`
- `T46 卡在哪，給我 3 條 debug 線索`

### 不要做

- 不要在 Mac 端 agent 還在寫同一份 state 時，同時叫醒 VM LLM
- 不要把 Layer 2 當成大規模重構工具
- 預設先讓它做診斷、小修、verify、回報；確認安全再決定後續

### 如果 log 顯示 quota exceeded

- 代表 VM 端 provider key 目前額度不夠
- bridge 與 `/wake` 本身已通，但要換成有額度的 provider key 後才適合當長時間救命層
