# Gemini Research 輸出目錄

這個目錄存放 Gemini（研究蒐集員）的結構化輸出。

## 檔案命名規則

- `event-calendar-YYYY-MM-DD.json` — 法說會 / 事件日期
- `target-price-YYYY-MM-DD.json` — 目標價更新
- `news-YYYY-MM-DD.json` — 產業新聞

## 消費者

- **Qwen** 定期讀取此目錄，把資料匯入應用（事件系統、seedData）
- **人類** 審查後決定是否採用

## 注意

- Gemini 只寫入此目錄，不直接改應用代碼
- 每個檔案必須包含 `citations` 和 `freshness` 欄位
- 資料衝突時用 `unresolved_questions` 標記，不要靜默選邊
