# 持倉看板 QA Checklist · 最終整合版（白話）

**日期**：2026-04-26
**整合自**：Claude 95 條 + Codex 109 條 → 雙邊對照後 final list
**用法**：你打開 http://104.199.144.170/ 一頁一頁勾，發現任何沒勾掉的回報

---

## 看板（Dashboard）

### Desktop（電腦版）

- ☐ 第一螢幕只看到 hero 主數字 + 持倉組別 + 今日焦點黑 panel 3 區塊（5 焦慮卡 / Quote / Morning Note 都應在 fold 2 之後）
- ☐ Hero 大數字（總資產 + 損益 + 持股檔數）粗 sans 字體，不是 serif 軟字
- ☐ Hero headline 是「把市場的雜訊 · 壓回能判斷的節奏」punchy 句，**不是**「資料有點久了」軟敘事
- ☐ 「今日焦點」黑色 panel 在右側（深近黑底色），白字，撐住版面重量
- ☐ 持倉組別 4-5 條策略 bar，最大那條橘色，其餘灰色（**只 1 條橘**）
- ☐ Portfolio chip「小奎主要投資」是中性灰底，前面 1 個橘色小圓點作 active 標（**不是淡橘 wash 整片**）
- ☐ 5 焦慮指標 X1-X5 都看得到，未上線/載入中的 collapse 成 1 行不展開大卡
- ☐ Morning Note 上的 catalyst 點下去能跳到對應 tab + 帶股票 context（不只「待補」放著）
- ☐ 數字顏色：上漲 / 獲利暖紅橘，下跌 / 虧損冷靜 charcoal（**不用綠色當正向**）
- ☐ Voice：顧問口氣，不是 AI 範本

### Mobile（手機版 390px）

- ☐ Header 高度 ≤ 64px（不雙層 nav 占螢幕 25%）
- ☐ Mobile fold 1 看到 hero 主數字 + 持倉組別 + 今日焦點黑 panel
- ☐ Bottom 是 sticky tab bar 5 primary（看板/持倉/事件/收盤/深度）+ 「更多 5」收 News/Trade/Log（**不用 hamburger**）

### 看板頁整頁不要做（4 條）

- ☐ 沒看到漸層底色 / 任何 card 背景單色
- ☐ 沒看到模糊 / 玻璃浮層效果
- ☐ 沒看到紫 / 藍 / 螢光綠 / amber 雜色搭配（除「漲跌」warm 紅 + 主橘 cta 兩用色）
- ☐ 所有 chip / button 方角不 pill（除 progress bar 兩端 + circular avatar）

---

## 持倉（Holdings）

### Desktop

- ☐ Tab nav 是 underline 不是 pill（Active 下方 2px 橘色 underline + filled icon）
- ☐ 可切換不同投資組合（小奎主要投資 / 全組合 / 金聯成 等）
- ☐ 可篩選：類型 / 產業 / 持倉狀態 / thesis pillar 狀態 / 文字搜尋
- ☐ 左主表格列出所有持股（股號/名/數量/成本/現價/P&L/action）
- ☐ 右側固定 4 卡：心法卡 / 今天先做 / 今天不做 / 風險提醒（4 卡邊框各色，**只 1 卡是橘**）
- ☐ Detail pane 點 row 後 right pane 載入單檔完整 dossier，內容對齊 Daily / Research / Weekly PDF
- ☐ Hover 表格 row **不抬升**（用背景或 left accent，不像可愛卡片浮起）
- ☐ Voice：系統中性

### Mobile

- ☐ 表格改 grouped list + drawer 風
- ☐ 點 row → 全螢幕 drawer 不半屏

### 持倉頁整頁不要做（4 條）

- 同看板頁

---

## 事件追蹤（Events）

### Desktop

- ☐ 左欄 timeline 有「今天」垂直橘色 marker
- ☐ Timeline 上下 row 標籤 **不重疊**（同 x 位置多 events 自動 aggregate「3 events · 04/25」）
- ☐ 預測 vs 實際命中率 chart 在右
- ☐ 事件 status chip：pending / closed / completed 不同顏色清楚
- ☐ Voice：專業記錄官，**不出現**「預測看漲 / 停損 / 出場」之類操作暗示
- ☐ Insider mode 自家股事件去掉 buy/sell 暗示

### Mobile

- ☐ Timeline 單欄垂直
- ☐ 事件 status / dot 清楚

### 事件頁整頁不要做（4 條）

- 同看板頁

---

## 情報脈絡（News）

### Desktop

- ☐ 列表每則新聞含 source / time / 持股關聯
- ☐ 篩選可依持股 / 來源 / 影響方向
- ☐ Insider 自家股 news **隱掉** 「判讀影響 / 利多 / 利空」AI 判斷
- ☐ Voice：編輯轉述，**不**直接給 buy/sell 建議
- ☐ 主橘只用於「判讀影響」這類主動作

### Mobile

- ☐ 主卡 + 摺疊 filter

### 新聞頁整頁不要做（4 條）

- 同看板頁

---

## 收盤分析（Daily）

### Desktop

- ☐ 頂部今日盤後 hero card + streaming 摘要 + 「複製今日摘要」按鈕
- ☐ 3 pillar row：基本面 / 事件 / 風險（左中右等寬）
- ☐ 「每檔今日該做」list（每檔：股號 / 動作 / 理由短句）
- ☐ 動作 chip：加碼 / 續抱 / 觀察 / 減碼 / 減碼分批 都中性灰，**只**「減碼或停損 / 出場」紅
- ☐ 7 天 archive timeline + 日曆 input
- ☐ 30 天命中率 chart 底部
- ☐ Insider mode 不顯示 per-holding actions
- ☐ Accuracy Gate：來源 / 數字 / 低信心 / Insider / self-check 都看得到提示
- ☐ Voice：顧問 + 結構化

### Mobile

- ☐ 各區塊垂直堆疊
- ☐ Streaming 文字 live generation 時逐字出（已生成的 snapshot 是 bullet line-reveal，不全量逐字）

### Daily 頁整頁不要做（4 條）

- 同看板頁

---

## 全組合研究（Research）

### Desktop

- ☐ Streaming AI 結果區（live 時逐字）
- ☐ 每份研究含目標持股 / 信心 / 來源 / 新鮮度 badges
- ☐ 風險揭示 / 資料待補 list 在右
- ☐ Weekly PDF 下載入口 + Insider portfolio 含獨立 compliance section
- ☐ Voice：策略分析，誠實顯示「資料缺、不結論」

### Mobile

- ☐ 主分析中欄，旁欄 status 收進垂直堆疊

### Research 頁整頁不要做（4 條）

- 同看板頁

---

## 上傳成交（Trade）

### Desktop

- ☐ 進頁先見合規 disclaimer modal「我已了解，進入 Trade 頁」
- ☐ STEP 1-2-3-4 progress bar 在頂（上傳 / 解析 / 預覽 / 套用）
- ☐ Step 1 三入口：textarea 貼成交 / 截圖上傳 / 手動填單
- ☐ Step 2 parse 結果，未指定動作（買/賣）的 trade 旁邊顯示警告 + 「下一步」disabled
- ☐ Step 3 preview 顯示 before/after holdings + 「確認套用」disabled when 仍有未確認動作
- ☐ Step 4 顯示「✅ 已寫入 N 筆成交」
- ☐ Apply 完 Holdings + Log **同步**更新（不能只 Trade 頁說成功）
- ☐ Voice：嚴肅合規 + 同事

### Mobile

- ☐ 4 step 一頁一個（不同屏塞）
- ☐ Compliance modal 全屏

### Trade 頁整頁不要做（4 條）

- 同看板頁

---

## 觀察股（Watchlist）

### Desktop

- ☐ Search bar + sort（距目標價 / 加入時間 / 催化劑）
- ☐ 每股 row：股號 / 股名 / 現價 / 目標價 / 距 % / 編輯 / 刪除
- ☐ 編輯 / 刪除 button 方角（不 pill）

### Mobile

- ☐ 每股 row 改 vertical card
- ☐ 35+ 檔不再 35 個 button 排下去

### 觀察股頁整頁不要做（4 條）

- 同看板頁

---

## 交易日誌（Log）

### Desktop

- ☐ 60+ 筆 trade log 有 search + filter（買/賣 / 月份 / 標的）
- ☐ 每筆紀錄：日期 / 動機 / 預期結果 / 實際結果
- ☐ 月回顧 / 反思卡指出可改進決策習慣
- ☐ Voice：回顧內省 + 同事，**不**用工程稽核口吻

### Mobile

- ☐ Timeline 間距加大（不像 spreadsheet）

### Log 頁整頁不要做（4 條）

- 同看板頁

---

## 跨頁全局（Header / 共用）

### Header

- ☐ 「複製週報 / 下載 .md / 下載 .pdf / 重看導覽」純文字按鈕，**無 emoji 圖案**（無 📥 ☁ ⚡）
- ☐ Header **沒有 `.html` 下載按鈕**（已砍）
- ☐ Header **沒有單獨 `?` 字符按鈕**（已 rename「重看導覽」）
- ☐ Insider portfolio (7865) 切換後 Header 出現 `👑 公司代表` 中灰底 badge（**不是橘**）
- ☐ Tab nav active state：tangerine 2px underline + filled icon（不是 pill 圓背景）
- ☐ Tab inactive：iron 灰文字 + outline icon

### Cross-page workflow

- ☐ Morning Note 點 catalyst → 跳對應 tab + 帶股票 context
- ☐ Trade apply 完 → Holdings 跟 Log 都更新
- ☐ Events 驗證 → Daily / Research / Holdings 看到 thesis pillar 變化

### 全站禁用詞 0 出現

- ☐ 內部人 / 小偷 / beta / canonical / SSE / routing / preview + diff / tracking / accordion / 主腦 / pillar impact

---

## Insider 模式（金聯成 / 7865）

- ☐ 切到 7865 portfolio 後 Header `👑 公司代表` badge 出現
- ☐ Daily / Holdings / Trade / Log / News 都顯示 compliance copy（V-A 或 V-B 或 V-C 任一）
- ☐ News 自家股不出現 AI impact judgment / buy-sell CTA
- ☐ Weekly PDF 下載含 insider 獨立 section
- ☐ Events 自家股不出現「預測看漲 / 停損 / 出場」操作建議
- ☐ Trade / Log 上傳成交 / 日誌都有 insider 文案邊界
- ☐ Persona 不只換內容，要換氣氛（穩重質感、不像 tech feed）

---

## 視覺 Motion（per 2026-04-26 motion-relax 決議）

- ☐ Hero 數字載入時 prev → next 過渡（**不是 0 → 目標**像 slot machine）
- ☐ Strategy bar 進場 grow-in 300ms（scaleX 不改 layout）
- ☐ Tab 切換 / panel mount 200ms fade + 6-8px slide
- ☐ Watchlist / KPI card hover 抬 1px + soft shadow
- ☐ Drawer / detail pane 240ms slide
- ☐ Holdings price-deviation row pulse（保留 — 異動 attention cue）
- ☐ Low-confidence dot 出現 80-120ms scale 微 pop
- ☐ 開啟系統「reduce motion」設定下，所有上述 motion 自動降為 instant

---

## Phase 1 Must（10 條最後總驗）

- ☐ Dashboard 盤前 + 盤後雙模式都成立
- ☐ Morning Note 跨頁 handoff 不孤島
- ☐ Holdings multi-portfolio switcher 切組合不串資料
- ☐ Holdings multi-filter（類型/產業/狀態/thesis/搜尋）都能用
- ☐ Detail pane 單一 dossier 驅動，跨頁同源
- ☐ 5 焦慮指標 UI contract 清楚（每個 X 都有狀態）
- ☐ Accuracy Gate 6 entry 都覆蓋：Dashboard / Daily / Research / Detail pane / Tomorrow actions / Weekly PDF
- ☐ Trade apply → Holdings + Log 同步零落差
- ☐ Insider UX 跨 tab 一致 + Weekly PDF 含 insider section
- ☐ Empty / Skeleton / Error / 互動中 / 完成後 五狀態都有

---

**總條目**：~120 條（按 8 頁 × 各 desktop+mobile+不要做 4 條 + Header 全局 + Insider + Motion + Phase 1 Must）

打勾發現沒過的告訴我（或截圖 + 頁面位置），我跟 Codex 立刻接 R8 / R9 修。
