# 策略大腦 V2 多模型分工與優化計畫

最後更新：2026-03-25

## 目標

把目前的策略大腦從「會記錄心得」升級成「能更精準判斷台股持倉、知道自己根據什麼做判斷、也知道哪些結論還不夠新鮮」的決策系統。

這一輪的核心不是把模型再換大，而是讓：

- 持倉 dossier
- 財報 / 月營收 / 目標價 / 公開報告
- 事件追蹤
- 收盤分析
- 復盤
- 策略大腦規則

真正串成同一條資料鏈。

### 台股分析底線

台股分析不能只看持倉本身，至少要同時理解：

- 市場結構：漲跌停、量價結構、融資融券、權證時間價值、ETF / 槓桿產品特性
- 時間節奏：月營收、財報、法說、除權息、政策題材、事件窗口
- 資金行為：外資 / 投信 / 自營商、主流族群輪動、題材資金擁擠度
- 產業與供應鏈：龍頭 / 二線、上游下游、報價循環、景氣位置
- 資料新鮮度：過期財報、舊目標價、舊事件不可以當成當下結論

也就是說，策略大腦的任務不是「替持倉寫心得」，而是把台股市場運作方式一起納入判斷。

## 成功標準

做到以下 6 件事，才算策略大腦優化有效：

1. 每檔持股的建議都能對應到明確依據，不再像跟持倉資料割裂。
2. 規則能分出核心規則、候選規則、待淘汰規則，不再只是一堆文字。
3. AI 會標出資料是否過期，避免拿舊財報硬做強結論。
4. 同一條規則能被驗證、升級、降級、淘汰，而不是只會累積。
5. 台股特有節奏會被納入判斷，例如月營收、法說、法人報告、事件窗口。
6. 介面上能看出「為什麼現在叫你觀察 / 加碼 / 減碼 / 出場」。
7. 重要規則會拿去對照過往台股相似個股 / 相似節奏，並區分失準是規則本身有問題，還是個股情境差異。

## 五個 LLM / 工具怎麼分工

### 1. AnythingLLM

定位：知識整理與文件檢索層

適合交給它：

- 吃 PDF、研究報告、客戶健檢文件
- 查過去 spec / playbook / 報告草稿
- 整理同一檔股票不同來源文件的差異
- 先把分散的研究資料彙整成摘要包

不要交給它：

- 直接改程式
- 決定最後資料 schema
- 決定策略大腦的最終規則

### 2. Gemini CLI

定位：公開資料蒐集與即時研究層

適合交給它：

- 查最近的公開新聞、公告、法說、公司 IR
- 整理公開可見的目標價報導與來源
- 蒐集 citations / freshness / unresolved questions
- 幫 dossier 準備外部事實包

不要交給它：

- 最終 fundamentals 真值
- 最終 target 價格定稿
- 直接回寫 `strategyBrain`
- 最終買賣判斷

### 3. Claude Code over Ollama

定位：低成本的策略草稿與規則整理助手

適合交給它：

- 把研究筆記整理成候選規則
- 幫每檔持股先做第一輪規則配對
- 草擬 prompt 文案
- 草擬 checklist
- 做低風險的規則摘要、分類、歸納

不要交給它：

- 最終決定策略邏輯
- 大型多檔案重構
- 關鍵數字正確性背書

### 4. Qwen Code

定位：便宜的工程實作打手

適合交給它：

- 小範圍 UI 調整
- 低風險資料欄位接線
- 抽 helper
- 寫測試
- 寫單一檔案或局部 patch

不要交給它：

- 策略大腦資料模型定稿
- AI prompt 契約大改
- cloud sync / migration 這種高風險變更

### 5. Codex

定位：高風險決策、整體設計與最後驗收

優先由 Codex 負責：

- 策略大腦資料結構與演算法
- 台股判斷邏輯主幹
- dossier 與 brain 的接合方式
- 規則驗證 / 淘汰機制
- 客戶與投資工作流品質把關

## 實際派工流程

### 流程 A：文件先消化，再改程式

1. 先把研究 PDF、財報摘要、客戶筆記丟進 AnythingLLM。
2. 讓 AnythingLLM 產出「內部研究摘要」。
3. 再讓 Gemini CLI 補近期公開事實、來源與 freshness。
4. 再讓 Claude Code over Ollama 把摘要整理成候選規則、檢查表、需要驗證的假設。
5. 由 Codex 決定哪些要進策略大腦資料模型。
6. 由 Qwen Code 做低風險實作。
7. 最後回到 Codex 做驗收與修正。

### 流程 B：收盤分析品質優化

1. AnythingLLM 整理近期文件與研究材料。
2. Gemini CLI 補近期外部事件、法說 / 新聞 / 公告來源。
3. Claude Code over Ollama 先草擬：
   - 今日異常點
   - 需要驗證的規則
   - 可能的 checklist 更新
4. Codex 根據 dossier + brain + 事件資料決定真正要改的 prompt 與規則更新流程。
5. Qwen Code 負責把 UI / helper / 低風險串接補上。
6. Codex 做最後檢查，確保不會再次出現「持倉很完整，但分析像割裂」。

### 流程 C：單一股票深度研究

1. AnythingLLM 先做文件檢索與比較。
2. Gemini CLI 先補公開來源、近期法說 / 新聞 / 報導。
3. Claude Code over Ollama 先整理：
   - 多頭邏輯
   - 風險
   - 事件窗口
   - 需更新到 brain 的候選規則
4. Codex 審核是否足夠回寫到：
   - `fundamentals`
   - `targets`
   - `analystReports`
   - `strategyBrain`
5. Qwen Code 再做必要的 UI / 資料接線。

## 策略大腦 V2 這輪要做的 5 個模組

### Phase 1：規則物件化再升級

現況已有：

- `rules`
- `candidateRules`
- `checklists`

下一步要補：

- `validationScore`
- `confidenceTrend`
- `lastInvalidatedAt`
- `staleness`
- `evidenceRefs`
- `appliesTo`
- `marketRegime`
- `catalystWindow`
- `contextRequired`
- `invalidationSignals`
- `historicalAnalogs`

目的：

- 讓每條規則不只是一句話，而是知道何時有效、最近是否被驗證、是否已經落後。
- 讓規則不只對今天有效，還能知道在過往台股相似案例裡是被支持、部分支持、還是被證偽。

### Phase 2：證據鏈

每條規則都要能回連到證據，不然只是有條理的幻覺。

證據來源固定為：

- `analysisHistory`
- `researchHistory`
- `review history`
- `events`
- `fundamentals`
- `targets`
- `analystReports`
- `holdingDossiers`

目的：

- 讓 UI 能顯示「這條規則最近是被哪幾次分析支持」
- 也讓淘汰規則時有客觀依據

### Phase 3：台股節奏模組

策略大腦要特別認得台股常見節奏：

- 月營收公告節奏
- 財報 / 法說前後窗口
- 法人目標價更新
- 題材股事件催化
- 量價異常但基本面未跟上的情況

目的：

- 避免模型只給泛用型美股式結論
- 讓判斷更貼近台股實際節奏

### Phase 3.5：歷史相似案例驗證

每條重要規則都要盡量回答：

- 過往台股有哪些相似個股或相似節奏？
- 當時這條規則是成立、部分成立，還是失準？
- 若失準，是因為：
  - 規則本身判斷錯
  - 個股特性不同
  - 流動性不同
  - 市場 regime / 題材輪動不同
  - 事件時間窗口不同

目的：

- 避免只用「今天看起來像對」就升級規則
- 讓規則變成可回頭驗證、可區分邊界條件的台股規則

### Phase 4：規則驗證 / 升降級 / 淘汰

要有明確規則：

- 候選規則連續被支持 2-3 次可升級
- 核心規則連續失準可降級
- 長期未再被支持的規則標成 stale
- 相互衝突的規則要能被標示

目的：

- 讓策略大腦真的會進化，而不是越來越胖

### Phase 5：決策面板

介面要看得出：

- 這檔持股目前被哪幾條規則影響
- 規則是核心還是候選
- 資料是否新鮮
- 建議是因為事件、財報、目標價，還是技術面

目的：

- 使用者能理解建議，不是只能接受一段文字判斷

## 目前最值得先做的具體任務

### Task A：補規則證據欄位

由 Codex 設計，Qwen Code 實作輔助

輸出：

- `strategyBrain` schema 增補
- normalize / merge helper 升級
- 舊資料 migration 相容

### Task B：收盤分析改成先驗證規則，再新增規則

由 Codex 主導

輸出：

- `runDailyAnalysis` prompt 改寫
- `BRAIN_UPDATE` 結構改成：
  - 驗證哪些舊規則
  - 失效哪些規則
  - 哪些新規則只是 candidate
  - 重要規則附 1-2 個 `historicalAnalogs`
  - 若失準，標出 `differenceType`

### Task C：單股 dossier 顯示 brain 命中理由

由 Qwen Code 可先做第一版，Codex 驗收

輸出：

- 持股卡能顯示 `matchedRules`
- 顯示資料新鮮度
- 顯示建議背後依據

### Task D：台股節奏詞彙表與 prompt guardrail

由 Claude Code over Ollama 草擬，Codex 定稿

輸出：

- 台股常用事件 / 節奏 /風險詞彙表
- 收盤分析與研究 prompt guardrails

### Task E：歷史驗證 casebook

由 Codex 設計資料結構，Qwen Code 協助低風險接線

輸出：

- 新增獨立 `brain-validation-v1`
- `strategyBrain` 主體只保留驗證摘要，不塞完整歷史案例
- 相似案例比對結果可回寫 rule summary 與 UI

### Task F：AnythingLLM 工作區整理

由使用者日常維護，AnythingLLM 提供檢索

最少保留這三個 workspace：

- `Product Specs`
- `Strategy Brain`
- `Client Reports`

## 本週推薦執行順序

1. `Task A`：補規則證據欄位
2. `Task B`：改收盤分析的規則驗證流程
3. `Task C`：把 brain 命中理由顯示到持股 dossier / UI
4. `Task D`：台股節奏詞彙表與 prompt guardrail
5. `Task E`：歷史驗證 casebook

這樣做的好處是：

- 先把大腦變得可驗證
- 再把它跟分析流程接上
- 最後才去擴充台股特化語境

## 日常派工簡表

### 可以先丟給 Claude Code over Ollama 的

- 「把這份研究摘要整理成 5 條 candidate rules」
- 「把這 3 次復盤整理成 preExit checklist 草稿」
- 「幫我找出這份收盤分析裡哪幾句沒有直接證據支撐」

### 可以先丟給 Qwen Code 的

- 「把 brain evidenceRefs 顯示在持股展開卡」
- 「幫我補 normalize helper 與 UI badge」
- 「幫我寫這段規則升降級的單元測試」

### 應直接交給 Codex 的

- 「重設 strategyBrain schema」
- 「重寫收盤分析與 brain update prompt 契約」
- 「設計規則驗證 / 淘汰機制」
- 「處理 migration、cloud sync、localStorage 相容」

## 底線

無論用哪個模型，以下 4 件事不能放掉：

1. 關鍵數字以持倉 / dossier / 結構化資料為準，不可用模型自由生成。
2. 沒資料就明講缺資料，不可硬補。
3. 候選規則不等於核心規則。
4. 客戶與交易決策最終版，必須由 Codex 做最後驗收。
