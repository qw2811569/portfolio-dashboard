# 持倉到深度分析架構共識報告

最後更新：2026-03-28  
狀態：目前執行中版本的共識文件  
適用對象：人類開發者、Codex、Claude、Qwen、Gemini 與其他接手 AI

---

## 1. 這個程式在幹嘛

這不是單純的「看盤頁」或「記帳工具」，而是一個以台股投資決策為核心的工作台。

它把以下事情接成一條連續工作流：

1. 管理持倉與多組合
2. 追蹤觀察股與催化事件
3. 解析交易截圖並回寫部位
4. 在收盤後做結構化分析
5. 把分析結果沉澱成策略大腦
6. 對單一標的做深度研究
7. 讓後續每一次決策都能回頭引用前面的脈絡

一句話總結：

> 這是一個把「部位、事件、研究、復盤、策略記憶」串成閉環的台股投資作業系統。

---

## 2. 目前真正的執行入口

這一點很重要，因為現有文件裡有歷史版本殘影。

目前 runtime source of truth 是：

- `src/main.jsx`
- `src/App.jsx`

目前實際上是：

- `src/main.jsx` 載入 `src/App.jsx`
- `src/main.jsx` 現在只做 theme / runtime diagnostics boot，畫面級錯誤邊界不再包整個 App
- `src/App.jsx` 仍是主 orchestrator，但現在更接近 runtime shell，負責狀態接線、使用者流程、AI 任務與頁面切換
- `src/hooks/usePortfolioManagement.js` 管 portfolio switching / overview mode / registry 操作
- `src/hooks/usePortfolioDerivedData.js` 管 holdings / watchlist / overview / refresh candidate 的衍生資料
- `src/hooks/usePortfolioBootstrap.js` 管 app boot、active portfolio hydrate、owner portfolio 雲端冷啟同步
- `src/hooks/usePortfolioPersistence.js` 管 localStorage persistence、雲端 debounce save、analysis/research 雲端回補
- `src/hooks/usePortfolioDossierActions.js` 管 target / fundamentals / alert 的 canonical state mutation
- `src/hooks/useReportRefreshWorkflow.js` 管 analyst report refresh、structured research extract 回寫與相關 UI status
- `src/hooks/useLocalBackupWorkflow.js` 管本機備份匯出 / 匯入
- `src/hooks/useEventLifecycleSync.js` 管事件在 `pending / tracking / closed` 間的自動流轉與價格歷史追蹤
- `src/hooks/useAppConfirmationDialog.js` 管 app-level confirm dialog state 與 promise-style resolve flow
- `src/hooks/useWeeklyReportClipboard.js` 管週報素材組裝與剪貼簿 / textarea fallback copy
- `src/hooks/useWatchlistActions.js` 管 watchlist upsert / delete 的 canonical normalize 邊界
- `src/hooks/useTransientUiActions.js` 管 review cancel 與 reversal update 這類薄 UI actions
- `src/hooks/useSavedToast.js` 管 app-level saved toast、timer cleanup 與 shared `flashSaved()` 邊界
- `src/hooks/useAppShellUiState.js` 管 `tab / scan / relay / review / research selection` 這批純 UI transient state
- `src/hooks/useCanonicalLocalhostRedirect.js` 管 `localhost -> 127.0.0.1` canonical redirect，讓主 runtime 不再自己養 redirect effect
- `src/components/AppPanels.jsx` 管 tab panel registry 與 panel-scoped `ErrorBoundary` render，讓 `App.jsx` 不再自己展開每一段 panel skeleton
- `src/lib/appShellRuntime.js` 管 app-shell 級的 live snapshot 組裝、runtime events fallback 與 event filter helper
- `src/hooks/useDailyAnalysisWorkflow.js` 管收盤分析的 async orchestration，讓 `App.jsx` 不再直接承擔整段 `runDailyAnalysis()`
- `src/lib/brainRuntime.js` 管 strategy brain rule lifecycle、validation、audit normalization
- `src/lib/dailyAnalysisRuntime.js` 管收盤分析 snapshot、事件關聯、盲測評分、prompt payload builder 與 report shaping
- `src/lib/eventUtils.js` 管 event normalize、review helper、event date parsing、stock outcome builder
- `src/lib/datetime.js` 管 storage date、flexible date parsing、Taipei market clock 與共用日期格式化
- `src/lib/market.js` 管 market cache normalize、post-close sync gate、persisted quotes 與 TWSE price extraction helper
- `src/lib/portfolioUtils.js` 管 portfolio registry、backup import-export、localStorage key / fallback / migration helper
- `src/lib/reportUtils.js` 管 daily report / analysis history / analyst report normalize 與 merge
- `src/lib/reportRefreshRuntime.js` 管 analyst report batch merge、report refresh meta merge 與 structured extract plan shaping
- `src/lib/dossierUtils.js` 管 holding dossier 組裝、台股 hard gate 與 daily/research prompt context builder
- `src/lib/routeRuntime.js` 管 route shell 讀取 localStorage snapshot、overview summary 與 page-level runtime bridge
- `src/hooks/useRoute*Page.js` 現在承接 route page 的 action assembly、navigation 與 page-local workflow state，讓 `src/pages/*` 盡量退回薄畫面容器
- `src/App.jsx` 內部目前以 panel-scoped `ErrorBoundary` 包住 Header 與主要 tab panel，避免單一區塊錯誤直接吞掉整個工作台
- `src/App.jsx` 目前已降到約 `1111` 行，主要保留狀態接線、hook 組裝與少量入口組裝
- `src/App.jsx` 與 route shell 的 `watchlist / reversal` action 現在已共用相同 hook，避免兩條入口寫出不同 shape 或遺漏 `updatedAt`
- `src/App.jsx`、`usePortfolioManagement.js`、`usePortfolioPersistence.js` 與 `useRoutePortfolioRuntime.js` 的 saved toast 現在已共用 `notifySaved / flashSaved` 邊界，不再各自手刻 timer
- `flushCurrentPortfolio()` 與 local backup export 現在已共用同一份 live snapshot builder，新增 persisted field 時不再需要同步維護兩份欄位清單
- `src/App.routes.jsx` 存在，但不是目前瀏覽器載入的主入口
- `src/App.routes.jsx` 已補上 route-local `QueryClientProvider`，讓 `Daily / Research` 這類 route hooks 可以在不依賴 `src/App.jsx` 的前提下運作
- `src/pages/usePortfolioRouteContext.js` 已作為 route pages 的第一批真實資料入口，但不代表主入口已切換
- route watchlist 已經切掉舊的 `prompt()` 增改路徑，改走 `WatchlistPanel` 內建 editor modal；這是 route shell 與主 runtime 邊界收斂的一部分
- route portfolio create / rename / delete 已切掉 `prompt()` / `confirm()`，改由 `Header` 的 shared dialogs 配合 `useRoutePortfolioRuntime` 管理
- 穩定主 runtime 的 `usePortfolioManagement.js` 也已接上同一組 Header dialogs，因此 portfolio manager 互動已不再是 route shell 與 main runtime 之間的分岔點
- 目前 runtime 內其餘 legacy browser dialogs 也已完成收斂：
  - `TradePanel` 的欄位修正走 shared text-field dialog
  - `WatchlistPanel` 的刪除走 shared confirm dialog
  - `App.jsx` 的備份匯入與收盤價強制刷新確認走 app-level confirm dialog
  - runtime source tree 不再依賴原生 `prompt / confirm / alert`

所以所有 AI 都應該先假設：

- 真正正在跑的是 `src/main.jsx -> src/App.jsx` 這條 runtime
- `App.jsx` 仍然偏大，但已不是單一大檔包全部生命週期
- 新功能優先落在 `lib/*`、`hooks/*`、`components/*`
- dossier 與 report 相關純邏輯，現在優先落在 `src/lib/dossierUtils.js`、`src/lib/reportUtils.js`
- event / review 與 portfolio storage 純邏輯，現在優先落在 `src/lib/eventUtils.js`、`src/lib/portfolioUtils.js`
- date / market cache 純邏輯，現在優先落在 `src/lib/datetime.js`、`src/lib/market.js`
- 只有跨 tab orchestration、使用者流程、最終接線才優先進 `src/App.jsx`

---

## 3. 產品的核心對象與價值

### 對使用者本身

- 把零散的交易、想法、事件、研究變成同一套決策系統
- 讓每次買賣不再是一次性動作，而是可追蹤、可復盤、可累積
- 降低「看對故事卻做錯節奏」的機率
- 避免因為換裝置、換網址、換 AI 而丟失上下文

### 對客戶 / 委託人

- 能看到不只是結果，還能看到決策脈絡
- 能知道每一檔持股為什麼買、現在怎麼看、接下來看什麼
- 能把事件驅動投資從主觀經驗，變成可交付的工作流程
- 能從研究結論、催化事件、風險提醒、歷史復盤中得到比較穩定的一致口徑

### 對 AI 協作

- 不同 AI 不用各自發明一套理解
- 所有 AI 都知道這個程式不是「聊天工具」，而是「投資決策工作台」
- 所有 AI 都知道哪些資料是核心、哪些只是呈現

---

## 4. 核心資料域

這個系統主要圍繞以下資料域運作：

### 4.1 Portfolio

每個 portfolio 是一個獨立決策空間。

包含：

- 持倉
- 觀察股
- 事件
- 分析歷史
- 研究歷史
- portfolio notes
- 局部策略脈絡

系統支援：

- 多組合
- owner portfolio
- overview 唯讀總覽

### 4.2 Holdings

持倉是整個系統的事實基底。

它決定：

- 今日持有什麼
- 成本、股數、市值、損益
- 哪些標的應該進入收盤分析
- 哪些標的需要事件追蹤或深度研究

### 4.3 Watchlist

觀察股不是持倉的附屬資料，而是前置決策池。

它承接：

- 還沒買但有興趣的標的
- 目標價、催化劑、狀態、備註
- 與事件、研究的弱連動

### 4.4 Events

事件是系統的節奏引擎。

狀態流轉：

- `pending`
- `tracking`
- `closed`

事件資料不只記標題，還記：

- `eventDate`
- `trackingStart`
- `exitDate`
- `priceAtEvent`
- `priceAtExit`
- `priceHistory`
- `actual`
- `lessons`

所以事件不是貼標籤，而是可以被追蹤與復盤的催化單位。

### 4.5 Strategy Brain

策略大腦是這套系統的記憶層。

它包含：

- rules
- candidateRules
- checklists
- lessons
- commonMistakes
- coachLessons
- 驗證與審核脈絡

目的不是生成漂亮文字，而是讓未來分析不從零開始。

### 4.6 Research History

研究歷史是長週期認知層。

它關注的是：

- 標的是什麼
- thesis 是否還成立
- 財報與營收是否支持
- 公開報告怎麼看
- 哪些資料新鮮，哪些已過期

### 4.7 Holding Dossier

holding dossier 是把單一標的需要的資訊打包成分析上下文。

它整合：

- position
- meta
- thesis
- targets
- fundamentals
- analyst reports
- events
- research
- brainContext
- freshness

它是「收盤分析」與「深度研究」之間的關鍵橋樑。

---

## 5. 從持倉到深度分析的連動邏輯

下面這段是整個產品最重要的工作流。

### Phase 0：啟動、hydrate、持久化

入口：

- `src/main.jsx -> src/App.jsx`
- `usePortfolioBootstrap`
- `usePortfolioPersistence`

主要動作：

- 啟動時先從 localStorage 讀 portfolio registry 與 active snapshot
- owner portfolio 才啟用 cloud sync，且先遵守 TTL，再做雲端補缺
- boot 階段雲端資料採「本地優先、雲端補缺」策略
- 平時 state 變動先寫回 localStorage，owner portfolio 再 debounce 回寫雲端
- analysis / research 只在需要的 tab 與 TTL 過期時才回補

結果：

- 系統先保證「本機可用」，再追求「雲端一致」
- 使用者換裝置或重啟後，不會因 cloud failure 直接失去工作台能力
- 持倉、事件、brain、研究歷史能維持同一套資料節奏

### Phase A：交易與部位形成

入口：

- 手動維護持倉
- 上傳成交截圖

主要動作：

- `api/parse.js` 用 AI 解析交易截圖
- `src/hooks/useTradeCaptureRuntime.js` 負責多圖佇列、OCR 修正、補登成交日期與 batch submit orchestration
- `src/lib/tradeParseUtils.js` 先把 OCR payload 正規化，再產出 trade log entry / holdings apply 所需結構
- 回寫 trade log
- 套用到 holdings
- 如有目標價資訊，同步更新 targets

結果：

- 系統知道你現在實際持有什麼
- 這些標的成為後續分析與研究的主體

### Phase B：市場資料與持倉現況同步

入口：

- 收盤價同步
- TWSE quote 查詢

主要動作：

- 同步 post-close prices
- 更新 holdings / watchlist / 事件價格參考
- 記錄 freshness 與同步狀態

結果：

- 部位不是停在成本，而是具備當前市場狀態
- 後續 AI 分析有真實價格基礎

### Phase C：事件驅動追蹤

入口：

- 使用者手動建立事件
- 既有事件依日期與狀態流轉

主要動作：

- `pending -> tracking -> closed`
- 事件綁定股票代碼
- 記錄事件前後價格
- 在 review 時寫入 actual / lessons

結果：

- 系統知道你買這檔不是抽象看好，而是因為特定催化節點
- 事件失敗時可以回收成經驗，而不是只留下情緒

### Phase D：收盤分析

入口：

- 收盤後執行 daily analysis

主要動作：

- 以 holdings 為主體
- 把 holding dossier、事件、notes、strategy brain 一起送進分析 prompt
- 先做 blind prediction
- 再讀入今日實際變化做對照分析
- 產出 daily report / analysis history
- 嘗試回寫策略大腦或驗證規則

結果：

- 分析不是只看今天漲跌，而是和原 thesis、事件節奏、既有規則一起比較
- 每日分析會變成長期記憶，而不是當天看完就消失

### Phase E：事件復盤與教練回寫

入口：

- 對已進入 review 條件的事件做復盤

主要動作：

- 記錄 actual、actualNote、lessons
- 關閉事件
- 對非 owner portfolio 的教訓回寫到 owner brain 的 `coachLessons`

結果：

- 各組合的失誤不會彼此孤立
- 系統會形成跨組合的教練記憶

### Phase F：深度研究

入口：

- 使用者主動研究某檔
- 研究頁根據 dossier / freshness / 公開報告提出優先標的

主要動作：

- `api/research.js` 讀取 holding dossiers、portfolio notes、strategy brain、events、公開報告摘要
- 生成長文研究
- 存入 research history

結果：

- 深度研究不是孤立文章，而是建立在目前部位、既有 thesis、事件節奏、策略規則上
- 研究輸出可反過來幫助下一次 daily analysis

---

## 6. 各頁面的角色分工

### 持倉頁

角色：

- 事實層
- 顯示目前資本配置與損益
- 允許直接更新 target / alert

### 觀察股頁

角色：

- 候選池
- 讓研究與事件追蹤可以在買入前就開始累積

### 事件分析頁

角色：

- 催化層
- 管理所有 pending / tracking / closed event
- 幫投資決策建立明確時間軸

### 收盤分析頁

角色：

- 決策校驗層
- 對照 thesis、規則、事件與當日表現
- 輸出 daily report 與 brain 更新材料

### 深度研究頁

角色：

- 認知深化層
- 用較長週期框架理解個股，而不是只做日內判斷

### 上傳成交頁

角色：

- 摩擦力降低層
- 把真實交易快速寫回系統，避免手動維護成本太高
- 現在支援一次加入多張截圖、逐張補登日期、同批多筆成交一起寫入，不再預設「一張只有一筆、日期一定是今天」

### 交易日誌頁

角色：

- 行為記錄層
- 把買賣理由與後續結果連起來

### 新聞/復盤頁

角色：

- 事件結果層
- 把催化與實際市場反應做事後驗證

---

## 7. API 與後端角色

### `api/parse.js`

用途：

- 圖片 → 結構化交易資料

價值：

- 降低輸入門檻
- 讓交易可以即時回到系統

### `api/analyze.js`

用途：

- 收盤分析
- 盲測預測
- brain 驗證與歸納

價值：

- 把 daily review 變成有結構的認知累積

### `api/research.js`

用途：

- 深度研究
- 研究索引讀寫
- 基於 dossier / notes / rules 生成完整研究

價值：

- 讓研究不離開實際持倉上下文

### `api/brain.js`

用途：

- owner-only brain / history / events / holdings cloud sync

價值：

- 讓 owner portfolio 成為全系統記憶主幹

### `api/analyst-reports.js`

用途：

- 拉 Google News RSS
- 用 AI 萃取公開報告重點、目標價、券商、立場

價值：

- 把外部公開訊號變成 dossier 可用的結構化輸入

---

## 8. 儲存策略

### 本機

主儲存是 localStorage。

原則：

- multi-portfolio key 分離
- overview 唯讀
- 切組合前先 flush
- 本機資料是即時操作的主來源

### 雲端

雲端是 owner-only best-effort sync。

原則：

- 只有 owner portfolio 會碰 `/api/brain`、`/api/research`
- 非 owner 不直接污染共享記憶
- 本機優先，雲端補缺

這個設計的好處是：

- 不會因為雲端短暫失敗就中斷工作
- 也不會讓測試組合把正式策略大腦洗亂

---

## 9. 對客戶的可交付價值

### 9.1 從「看法」變成「可追蹤決策」

客戶不只看到一句「看好」，而是能看到：

- 部位
- 催化
- 目標價
- 風險
- 事件時程
- 復盤結果

### 9.2 從「盤後心得」變成「策略資產」

每日分析與事件復盤不是一次性內容，而是進入：

- analysis history
- research history
- strategy brain
- coach lessons

### 9.3 從「單檔研究」變成「組合上下文研究」

研究不是脫離持倉做的，而是會考慮：

- 這檔在組合裡扮演什麼角色
- 是否已有事件在跑
- 目前的 thesis 和 targets 是否新鮮
- 這個標的與過去規則是否相符

### 9.4 從「人治」變成「人 + AI 共用記憶」

不同 AI 不需要重新理解一次你的投資風格。

因為系統裡已經有：

- portfolio notes
- strategy brain
- event history
- research history

---

## 10. AI 與人類的共識準則

### 所有 AI 都要知道的事

1. 這個系統的核心不是頁面，而是資料閉環
2. 持倉、事件、研究、brain 是互相餵資料的
3. 不可以把其中任何一層當成純展示資料
4. 目前 runtime 主入口是 `src/main.jsx -> src/App.jsx`
5. 本地驗證不能只看 200 回應，還要驗 UI smoke

### AI 動手前先看什麼

1. `docs/AI_COLLABORATION_GUIDE.md`
2. 本文件
3. `claude.md`
4. `QWEN.md`

---

## 11. 本地部署與驗證規則

本地成功不等於「port 有起來」。

正確定義是：

1. `vercel dev` 啟動
2. `npm run verify:local` 通過
3. 若有額外高風險改動，再人工檢查對應流程

### 唯一正確的本地入口

```bash
vercel dev
```

### 唯一正確的本地 URL

```bash
http://127.0.0.1:3002
```

### 標準驗收命令

```bash
npm run verify:local
```

### 重要提醒

- `curl 200` 只代表 server 有回應
- 不代表 React runtime 沒白頁
- 白頁與 runtime error 要靠 `npm run smoke:ui` 或直接看瀏覽器 console

---

## 12. 最後的共識

如果只用一句話對外介紹這個系統，建議統一說法：

> 這是一個面向台股主動投資流程的決策工作台，從持倉、事件、交易、收盤分析到深度研究全部連成一個可追蹤、可復盤、可累積的系統。

如果只用一句話對內介紹給 AI，建議統一說法：

> 這個 repo 的主任務不是做頁面，而是維護「持倉 → 事件 → 分析 → research → brain」這條資料閉環的正確性。
