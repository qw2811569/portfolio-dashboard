# 2026-04-26 · 雙 Persona Walkthrough Hostile Test

**Live**：`http://104.199.144.170/`
**Capture**：`tests/e2e/personaWalkthrough.spec.mjs`
**Evidence**：`.tmp/r156-full-execute/round11/walkthrough/`
**完整清單**：

- `.tmp/r156-full-execute/round11/persona-A-retail-issues.md`（35 條）
- `.tmp/r156-full-execute/round11/persona-B-designer-issues.md`（41 條）

## 最優先

### HIGH · Mobile 首頁還不是「今天先做什麼」

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-a-mobile/01-overview-initial.png`

第一眼看到提醒 16、總資產、今日損益空白、持倉 20 檔；真正像「今天先做」的內容在黑卡裡，又被底部導覽擋住。散戶盤前打開會先忙著理解畫面，而不是知道下一步。

建議：手機第一屏固定一張「今天先做 1 件事」，只放一個主按鈕；缺資料與提醒放第二層。

### HIGH · 多頁仍有使用者看不懂的英文/工程詞

截圖：`01-overview-initial.png`、`13-events-initial.png`、`40-log-initial.png`

外露詞包含 `daily principle`、`Restore Snapshot`、`last success`、`EARNINGS`、`EX-DIVIDEND`、`SHAREHOLDING-MEETING`、`memo`、`trade audit`、`fallback`、`thesis`。這些字會讓一般散戶覺得像後台或測試版。

建議：做一輪介面文字清理；投資理由、備份復原、檢查紀錄、財報、除息、股東會都用中文。

### HIGH · 研究頁先看到登入/補資料，不是「投資理由還在不在」

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-a-mobile/34-research-initial.png`

使用者想查研究，第一屏卻是「需要重新登入」「這輪卡在台達電」「先備資料」與一長串資料未取得。它沒有先回答這頁最重要的問題。

建議：最上方先放「目前投資理由狀態」摘要；登入與補資料放成次要提醒。

### HIGH · 收盤分析的狀態互相打架

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-a-mobile/19-daily-initial.png`

頁面上方說「等明早」，下方又出現每檔「減碼分批 / 續抱」與「仍要重新分析」。散戶會不知道這是今天可用建議，還是舊資料。

建議：資料沒齊時，動作卡全部標成「上一版暫存」或先隱藏；主按鈕只留「先補復盤」。

### HIGH · 持倉頁找賺最多/賠最多太慢

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-a-mobile/07-holdings-initial.png`

手機要滑過資料源、持倉結構、搜尋、篩選、投組健檢，才看到持倉卡。散戶想快速知道最大贏家/最大輸家時太慢。

建議：持倉頁第一屏放「賺最多 / 賠最多」兩張摘要，點了直接跳到排序結果。

### HIGH · Mobile 底部導覽遮內容，也遮交易提醒

截圖：`25-watchlist-initial.png`、`31-trade-initial.png`

觀察股卡片的數字被底部導覽壓住；交易提醒彈窗開啟時，底部導覽和搜尋浮鈕還壓在彈窗上。這會讓使用者不確定能不能按，也讓畫面顯得不精緻。

建議：所有手機頁面加底部安全距離；彈窗開啟時隱藏底部導覽與浮動搜尋。

### HIGH · 桌機版太多相似盒子，主次不清楚

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-b-desktop/19-daily-initial.png`

Daily 幾乎每段都是白底大圓角框，從今日摘要、基本面、每檔該做、資料確認到週報都同一層。設計師視角看不到主角。

建議：只讓主摘要和真正重點用大框；輔助狀態改成細列或收合。

### HIGH · 事件頁顏色與標籤太吵

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-b-desktop/13-events-initial.png`

藍、綠、黃、紅、灰事件類別同時出現，卡片內又有多層灰框與橘色「需要重看 thesis」。整頁看起來像資料表貼滿標籤。

建議：事件類型用中文小標籤；待辦狀態只放右上角；卡片內少包灰底盒。

### HIGH · 桌機 filter 區比持倉內容還重

截圖：`.tmp/r156-full-execute/round11/walkthrough/persona-b-desktop/07-holdings-initial.png`

持倉桌機版上半屏大多被篩選器佔據，真正的持倉表要往下才看到。設計師會覺得工具搶走內容主角。

建議：桌機篩選器預設收成一行摘要，表格提前露出。

## 兩種 Persona 的衝突

1. 散戶需要更快、更少字：例如首頁、持倉、收盤分析都應先給「今天先做什麼」。設計師也同意要減少盒子，但會更在意視覺層級與對齊。
2. 散戶覺得合規提醒讓人不敢按；設計師看到的是彈窗層級錯誤與底部導覽壓住彈窗。兩邊都指向同一修法：交易頁提醒要更短、更單一、更像一個完整流程。
3. 散戶可以接受資訊多，但不能有看不懂的英文；設計師則覺得中英混排和 emoji 讓產品不成熟。兩邊都要求把核心介面改成乾淨中文。
4. 散戶想在觀察股看到「哪檔接近目標價」；設計師覺得進度線像裝飾。修法一致：顯示「還差多少」而不是只畫淡橘線。
5. 散戶看到缺資料會焦慮；設計師看到缺資料長列表會疲勞。修法一致：缺資料用一張摘要收合，只展開會影響今天判斷的部分。

## 建議 R12 順序

1. 先修手機首頁「今天先做 1 件事」與底部導覽遮擋。
2. 清掉 user-facing 英文/工程詞，尤其首頁、事件、研究、交易日誌。
3. 修 Daily 資料未齊時仍顯示行動建議的矛盾。
4. 修 Research 第一屏，先回答投資理由狀態。
5. 修 Holdings mobile 的賺最多/賠最多入口。
6. 桌機視覺再做一輪：少盒子、少灰底、少彩色標籤、filter 收合。

## 不列入本輪新 issue 的邊界

- R8/R9/R10 已確認修好的 header 高度、bottom tab 基本存在、焦慮卡 collapse、台股紅漲語義等，沒有重複列為已修問題。
- `docs/audits/2026-04-26-qa-checklist-VERIFIED.md` 已標註的「程式碼/資料檔內禁用詞是否要全改」不當成本輪主要問題；本輪只列使用者畫面上實際看到的文字。
