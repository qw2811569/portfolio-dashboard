# News / Events UI 完全分離

**日期**：2026-04-15
**任務 id**：feat-02
**實作者**：Codex
**QA**：Qwen（code-level pass）

## 決議

UI 層面 news vs events 完全分離：

- `/events` (催化驗證 tab) 只顯示 event 卡（impact 色條、預測 badge、復盤）
- `/news` (情報脈絡 tab) 只顯示純 RSS 新聞卡（極簡：title + source + pubDate）

## Discriminator：`recordType`，不是 `type`

**Codex 抓到我的 brief 有 bug**：`event.type` 已被事件分類（法說/財報/營收）佔用。用 `type: 'news' | 'event'` 會直接撞壞 filter + 顏色映射。

正確做法用 **`recordType: 'news' | 'event'`**：

- `eventUtils.js:371-393` 正規化 `recordType`
- `EventsPanel.jsx:716` 過濾 `recordType !== 'news'`
- `NewsPanel.jsx:152` 標記 `recordType: 'news'`

## LogPanel

不搬家 — `src/components/news/NewsPanel.jsx` 裡的 LogPanel 是**重複副本**，正式版本早就在 `src/components/log/LogPanel.jsx`。直接刪副本即可。

## 測試狀態

- 708 tests passed
- Code-level lint clean
- 用戶瀏覽器測試未跑（視覺層面用戶驗收）
