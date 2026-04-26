# 持倉看板 QA Checklist · 雙重確認版（白話）

**日期**：2026-04-26
**驗證**：Claude（106 ☑ / 14 ☐）+ Codex（133 ☑ / 12 ☐）→ 雙邊比對
**規則**：☑ = 雙邊都確認過 · ☐ = 至少一邊找到問題或無法 confirm
**Live**：http://104.199.144.170/

---

## 看板（Dashboard）

### Desktop

- ☑ 第一螢幕只看到 hero 主數字 + 持倉組別 + 今日焦點黑 panel 3 區塊
- ☑ Hero 大數字粗 sans
- ☑ Hero headline「把市場的雜訊...」punchy 句
- ☑ 「今日焦點」黑色 panel 在右側
- ☑ 持倉組別 4-5 條 bar 只 1 條橘
- ☑ Portfolio chip 中性 + 1 cta dot
- ☑ 5 焦慮 collapse 1 行
- ☑ Morning Note handoff 跨頁
- ☑ 數字顏色台股紅漲 / 不用綠色當正向
- ☑ Voice 顧問口氣

### Mobile

- ☐ **Header 高度 ≤ 64px** · Codex catch: mobile screenshot 02 看 Header 高度超過 64px 且多列
- ☑ Mobile fold 1 看到 hero + 持倉 + 黑 panel
- ☐ **Bottom sticky tab bar 5 primary + 5 overflow** · Codex catch: mobile screenshot tab bar 在頂部，無底部 sticky tab，違 SD §3.10.2

### 看板頁不要做 4 條

- ☑ 沒漸層 / 沒玻璃 / 沒紫藍綠 / 全方角 · per grep 0

---

## 持倉（Holdings）

### Desktop

- ☑ Tab nav underline 不 pill
- ☑ Multi-portfolio switcher
- ☑ Multi-filter（類型/產業/狀態/thesis/搜尋）
- ☑ 表格列出股號/名/qty/cost/price/PnL/action
- ☑ 右側 4 卡心法/今天先做/今天不做/風險
- ☑ Detail pane single dossier
- ☑ Hover row 不抬升
- ☑ Voice 系統中性

### Mobile

- ☑ Grouped list + drawer
- ☑ 點 row → 全螢幕 drawer

### 持倉頁不要做 4 條

- ☑ 全 4 條

---

## 事件追蹤（Events）

### Desktop

- ☑ Timeline「今天」橘 marker
- ☑ Labels 不重疊 aggregate
- ☑ 預測命中率 chart
- ☑ Status chip 顏色
- ☐ **Voice 專業記錄官 不出現「預測看漲 / 停損 / 出場」** · Codex catch: `EventsPanel.jsx:82` 「預測看漲」仍在
- ☐ **Insider mode 自家股事件去 buy/sell 暗示** · 同上 line 82 沒 insider filter

### Mobile

- ☑ Timeline 單欄垂直
- ☑ Status / dot 清楚

### 事件頁不要做 4 條

- ☑ 全 4 條

---

## 情報脈絡（News）

### Desktop

- ☑ 列表 source/time/持股關聯
- ☑ 篩選持股/來源/影響方向
- ☑ Insider 自家股隱 AI impact
- ☑ Voice 編輯轉述
- ☑ 主橘只用「判讀影響」

### Mobile

- ☑ 主卡 + 摺疊 filter

### 新聞頁不要做 4 條

- ☑ 全 4 條

---

## 收盤分析（Daily）

### Desktop

- ☑ 今日盤後 hero + 複製按鈕
- ☑ 3 pillar row
- ☑ 每檔今日該做 list
- ☑ 動作 chip 中性 + 紅停損出場
- ☑ 7 天 archive timeline + 日曆
- ☑ 30 天命中率 chart
- ☑ Insider mode 不顯示 per-holding actions
- ☑ Accuracy Gate 6 entry
- ☑ Voice 顧問 + 結構化
- ☐ **Streaming 文字 live generation 時逐字** · Codex catch: AnimatedNumber 只 metric settle，未實作真 streaming text reveal

### Mobile

- ☑ 垂直堆疊

### Daily 頁不要做 4 條

- ☑ 全 4 條

---

## 全組合研究（Research）

### Desktop

- ☐ **Streaming AI 結果區（live 逐字）** · Codex catch: 找不到 typewriter / line-reveal 實作
- ☑ 每份研究含目標持股 / 信心 / 來源 / 新鮮度 badges
- ☑ 風險揭示 / 資料待補 list
- ☑ Weekly PDF 入口 + Insider compliance section
- ☑ Voice 策略分析

### Mobile

- ☑ 主分析中欄 + status 垂直

### Research 頁不要做 4 條

- ☑ 全 4 條

---

## 上傳成交（Trade）

### Desktop

- ☑ Compliance disclaimer modal
- ☑ STEP 1-4 progress bar
- ☑ Step 1 三入口
- ☑ Step 2 警告 + 「下一步」disabled
- ☑ Step 3 confirm disabled
- ☑ Step 4 「✅ 已寫入 N 筆」
- ☑ Apply 同步 Holdings + Log
- ☑ Voice 嚴肅合規 + 同事

### Mobile

- ☑ 4 step 一頁一個
- ☑ Compliance modal 全屏

### Trade 頁不要做 4 條

- ☑ 全 4 條

---

## 觀察股（Watchlist）

### Desktop

- ☑ Search bar + sort
- ☑ 每股 row 標準
- ☐ **編輯/刪除 button 方角不 pill** · Codex catch: `WatchlistPanel.jsx:345, 364` borderRadius 12 + 4px padding 高度 → 視覺偏 pill

### Mobile

- ☑ 每股 row vertical card
- ☑ 35+ 檔 actions 收斂

### 觀察股頁不要做 4 條

- ☑ 全 4 條

---

## 交易日誌（Log）

### Desktop

- ☑ 60+ 筆 search + filter
- ☑ 紀錄 4 元素
- ☑ 月回顧 / 反思卡（部分 — file:line evidence 但無「月回顧」字樣）
- ☑ Voice 回顧內省

### Mobile

- ☑ Timeline 間距加大

### Log 頁不要做 4 條

- ☑ 全 4 條

---

## 跨頁全局（Header）

- ☐ **純文字下載按鈕無 emoji** · Codex catch: Header `⟳ 收盤價` 圖形符號還在 + cloudIndicator「雲端」字樣（週報 buttons 已純文字 OK）
- ☑ 沒 .html 下載
- ☑ 沒單獨 `?` button（已 rename「重看導覽」）
- ☑ Insider 7865 切換 Header 出現 `👑 公司代表` badge
- ☑ Tab nav active 2px tangerine underline
- ☑ Tab inactive iron 灰文字

### Cross-page workflow

- ☑ Morning Note → tab + context
- ☑ Trade apply → Holdings + Log 同步
- ☑ Events 驗證 → thesis pillar 變化

### 全站禁用詞 0 出現

- ☐ **禁用詞** · Codex catch: src/ 多處命中 `內部人` (chip-analysis.json 內) / `canonical` (PortfolioLayout.jsx) / `SSE` (useResearchWorkflow.js) / `tracking` (WatchlistPanel.jsx)。**user-facing 0**（component 文字面），但 source code identifier 還有 — 嚴格判斷視為違規

---

## Insider 模式（金聯成 / 7865）

- ☑ Header `👑 公司代表` badge
- ☑ Daily / Holdings / Trade / Log / News compliance copy
- ☑ News 自家股隱 AI impact
- ☑ Weekly PDF insider section
- ☐ **Events 自家股不出現預測看漲** · 同 Events 段問題 EventsPanel.jsx:82
- ☑ Trade / Log insider 文案邊界
- ☑ Persona 視覺氣氛

---

## 視覺 Motion

- ☐ **Hero 數字 prev → next 過渡** · Codex catch: `AnimatedNumber.jsx:1-21` 只直接 render value + metric-settle，沒 prev value state，無 prev → next 證據
- ☑ Strategy bar grow-in 300ms
- ☑ Tab / panel mount fade
- ☑ Card hover lift Watchlist + KPI
- ☑ Drawer slide 240ms
- ☑ Holdings price-deviation pulse 保留
- ☑ Low-confidence dot pop
- ☑ prefers-reduced-motion guard

---

## Phase 1 Must（10 條）

- ☑ Dashboard 雙模式
- ☑ Morning Note handoff
- ☑ Holdings switcher
- ☑ Holdings multi-filter
- ☑ Detail pane single dossier
- ☑ 5 焦慮 X1-X5
- ☑ Accuracy Gate 6 entry
- ☑ Trade → Holdings + Log
- ☐ **Insider UX 跨 tab 一致** · Codex catch: Header / News / Daily 都套，但 Events line 82 沒套，跨 tab 不一致
- ☑ Empty / Skeleton / Error / 互動 / 完成 五狀態

---

## 統計

|     | Claude | Codex |   雙邊整合 |
| --- | -----: | ----: | ---------: |
| ☑   |    106 |   133 | **約 110** |
| ☐   |     14 |    12 |  **約 11** |

雙邊都 ☑ 才打勾，任一邊 ☐ 就保 ☐。

---

## R8 必修清單（11 條 ☐）

1. **EventsPanel.jsx:82 「預測看漲」改 voice**（spec drift · 嚴重，影響 Insider 跨 tab 一致性 + Events Voice 兩條）
2. **Header.jsx `⟳ 收盤價` 改純文字 / line icon**
3. **Header.jsx `cloudIndicator` 「雲端」改純文字 status text**（已是純文字，但要看視覺）
4. **AnimatedNumber.jsx 真做 prev → next 過渡**（R6 spec drift）
5. **WatchlistPanel.jsx:345, 364 編輯/刪除 button radius 12 → 8**
6. **Mobile Header 高度 > 64px** · 收成單列 sticky（per SD §3.10.2 + audit §D-3）
7. **Mobile bottom sticky tab bar** · 加底部 5 primary + 3 overflow（per SD §3.10.2）
8. **Daily streaming live 逐字 / line-reveal 實作**（per Codex discussion 1.1 共識）
9. **Research streaming live 逐字 / line-reveal 實作**（同上）
10. **全站禁用詞 src/ identifier 殘留**：`canonical / SSE / tracking / 主腦` 在 hook / lib name 內 — refactor 改名（不易，可能要新 decision 是否例外允許 internal identifier）
11. **Insider Events handoff missing**（同 #1）

幾條合併修：#1 + #11 同時做。
