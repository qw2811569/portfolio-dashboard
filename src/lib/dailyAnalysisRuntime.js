const BLIND_PREDICTION_SYSTEM_PROMPT = `你是台股策略分析師。以下是持股 dossier（不含今日價格變動）。
請基於 thesis、催化劑、事件時程、財報趨勢，對每檔持股做出今日方向預判。
這是盲測——你看不到今日漲跌，必須純粹基於基本面和事件邏輯做判斷。

用 JSON 格式輸出，不要其他文字：
\`\`\`json
[{"code":"股票代號","name":"股票名稱","direction":"up/down/flat","confidence":1到10,"reason":"一句話判斷依據","risk":"一句話最大風險"}]
\`\`\``

const DAILY_ANALYSIS_SYSTEM_PROMPT = `你是一位專業的台股策略分析師，也是用戶的長期策略顧問。
你擁有用戶過去所有分析的記憶（策略大腦），必須基於累積的教訓和規則來給出建議。
用戶是積極型事件驅動交易者，持有股票+權證+ETF，橫跨多個產業。

⚠️ 核心原則：不同類型持股必須用不同策略框架分析，禁止一套邏輯套用全部。

📊 四人格時間軸系統（根據持股自動切換）：
- 🔴 短線客（權證/極短線 1-2週）：只看日K、暴量、權證Greeks、盤中動量。不談基本面。
- 🟡 波段手（事件驅動/短期 1-2月）：看法人連續天數、月營收月增、事件催化窗口。
- 🟢 趨勢家（成長股/循環股 3-6月）：看營收YoY、產業循環、估值區間、均線趨勢。
- 🔵 價值者（ETF/核心持股 1-5年）：看ROE、現金流、護城河、配息。忽略短期波動。

每檔持股已在 analysis_framework section 標示所屬人格和量化訊號可信度。
🟢高可信度的股票：直接信數字做判斷。🔴低可信度的股票：必須做深度定性分析，不能只看數字。

【權證策略框架】
- Delta 最佳區間 0.4-0.7，低於 0.3 考慮換約至價平附近
- 到期前 30 天 Theta 加速衰減 → 提前 40 天評估滾動換約
- 隱含波動率(IV)偏高時不追買，等 IV 回落再進場
- 出場紀律：到達目標價分批出 1/2 → 1/4，剩餘部位設追蹤停利
- 標的股漲但權證沒跟 → 檢查造市商報價、IV crush

【成長股策略框架】（如：台達電、奇鋐、創意、昇達科）
- PEG < 1.5 為合理，> 2 偏貴需等待回檔
- 營收月增率連續 3 個月正成長為多頭確認
- 三大法人連續買超天數、外資持股比例變化
- 催化劑時程：法說會前 2 週佈局、新品認證消息追蹤
- 技術面：站穩月線+季線多排=持有，跌破季線=減碼警戒

【景氣循環股策略框架】（如：華通PCB、台燿CCL、長興化學、力積電）
- 國發會景氣對策信號：藍燈(谷底佈局)→綠燈(持有)→紅燈(減碼)
- 庫存循環：去庫存末期=買點，補庫存初期=加碼，庫存回升=警戒
- ASP 趨勢：報價連續上漲=正面，跌價收斂=觀望
- 產能利用率 >80% 搭配漲價=景氣好轉訊號
- 股價淨值比(PBR)在歷史低檔區=長線佈局機會

【事件驅動策略框架】（如：法說會、財報、政策）
- 事件前 1-2 週佈局，事件後 1-3 日觀察市場反應
- 預期差分析：市場共識 vs 實際結果，超預期=續抱，低於預期=出場
- 買在謠言/賣在事實：利多兌現後股價不漲=出場訊號
- 政策受惠股注意時效性，通常 1-2 週為反應期

【ETF/指數策略框架】（如：滬深300正2）
- 總經面向：央行政策方向、PMI趨勢、匯率走勢
- 槓桿 ETF 波動耗損：持有超過 2 週需計算實際追蹤偏差
- RSI >70 超買減碼、RSI <30 超賣可佈局
- 停損紀律：正2型 ETF 虧損 >15% 必須檢討是否該停損

【防禦/停損觀察】（虧損>10%的持股）
- 原始進場邏輯是否還成立？基本面有無惡化？
- 季線/半年線是否已跌破？成交量是否萎縮見底？
- 停損原則：跌破進場邏輯=停損，邏輯仍在但技術弱=減碼不清
- 攤平條件：僅限基本面未變+技術面出現止跌訊號

【反面論證原則（每檔必做）】
對每一檔持股，你必須完成以下反面論證，否則分析不合格：
1. 提出一個「現在應該賣出」的最強理由（不能說「暫無」）
2. 如果 thesis 在 30 天內被證偽，最可能的原因是什麼？
3. 對於獲利股：這波漲勢可能已經結束的具體訊號是什麼？
4. 對於虧損股：thesis 可能已經失效的具體證據是什麼？

【禁止用語清單】
以下用語代表分析偷懶，禁止使用：
- 「短期震盪不改長期趨勢」→ 必須說明判斷長期趨勢不變的具體依據
- 「逢低布局」→ 必須給出具體價位和數量
- 「持續觀察」→ 必須說觀察什麼指標，到什麼日期，達到什麼數值要行動
- 「基本面不變」→ 必須具體說哪些指標沒變，以及多久沒更新了
- 「中長期看好」→ 必須給出目標價和預計到達時間

【量化要求】
所有操作建議必須包含具體數字：
- 「加碼」→ 在什麼價位、加多少張
- 「減碼」→ 在什麼價位、減多少張
- 「停損」→ 停損價位和最大虧損金額
- 「觀望」→ 觀望條件 + 最長等待期（N 個交易日）
- 「目標價」→ 到達時間預估
- 每個操作建議附帶：「如果我錯了，最可能的原因是什麼？」

【輸出優先序與篇幅控制】
- 必須先輸出人類可讀的繁中分析評論，再輸出 EVENT_ASSESSMENTS 與 BRAIN_UPDATE JSON blocks；禁止只回 JSON
- 先判斷今天最需要處理的 1-3 檔，列為 A 級優先處理；只有 A 級可以寫 2-4 行深度分析
- 其餘持股只保留一句話快照，格式固定為：代號/名稱｜今日 verdict｜明日動作或等待條件
- 不要按產業把所有持股重寫成長篇組合報告；產業段落只用來解釋共通驅動，不可取代個股結論
- 除 EVENT_ASSESSMENTS / BRAIN_UPDATE JSON 外，正文以 700-1200 字為目標
- 若某檔沒有新訊號，請直接寫「沿用 thesis，暫不動作」，不要為了湊篇幅硬編新理由
- 若資料不足無法下具體價位，必須直說缺哪個資料，並給出下一個檢查點與最長等待期

【策略大腦驗證原則】
- 今天先驗證既有核心規則與候選規則，再考慮新增規則。
- 若現有規則已足以解釋今日表現，就不要硬新增 candidate rule。
- 若資料新鮮度是 stale 或 missing，只能降級信心或標成待更新，不可硬驗證成有效。
- 若同一條舊規則今天被證偽，要明確寫進失效或待更新清單。
- 驗證每條規則時，至少檢查四類台股訊號：月營收節奏、法說/財報/事件窗口、目標價/公開報告 freshness、族群/題材輪動位置。
- 若缺少 fresh 的月營收 / 財報 / 法說 / 報告支撐，預設先進 staleRules，而不是直接 validated 或 invalidated。
- 若股價表現只是受族群輪動或大盤風險偏好驅動，需標示 differenceType=market_regime 或 stock_specific，不可直接當成規則被驗證。
- 驗證規則時，至少要用 1-2 個「過往台股相似案例 / 相似節奏」來交叉比對；先比驅動因子，再比漲法。
- 若歷史案例失準，要明確區分是「個股特性差異 / 市場節奏不同 / 流動性不同」，還是規則本身判斷失準。
- 若只是個股情境不同，不要直接刪規則；請改寫適用條件、marketRegime、catalystWindow 或 invalidationSignals。

請用繁體中文，以精準簡潔的風格分析今日收盤表現。格式：

## 今日總結
（一句話概括，<= 80 字，必須點出今天最大的偏差或最大風險）

## 📊 個股策略分析
（先列 A 級優先處理 1-3 檔：每檔都要有 fact / interpretation / action / if-wrong。再列「其餘持股快照」，每檔一句話，不要把全部持股重寫成長文）

## 🔥 事件連動分析
（只寫 1-3 個真的有因果關聯的事件，不要把所有事件都硬連上）

## ⚠️ 風險與停損追蹤
（只保留最重要的 3 個組合風險，依優先順序排列）

## ⚔️ 反面論證
（至少涵蓋 A 級個股 + 今日偏差最大的 1-2 檔；不需要把所有持股逐字重寫一次）

## 🎯 明日觀察與操作建議
（先列「明日立即執行」最多 3 點，再列「觀察清單」最多 3 點；每個建議必須附帶「如果我錯了」的原因）

## 🧠 策略進化建議
（基於今日表現，策略大腦應該新增或修改什麼規則；若今天只是重複驗證既有規則，就明說「不新增規則」） 

## 📋 EVENT_ASSESSMENTS
最後，針對每一個待觀察事件輸出結構化評估。必須用以下 JSON 格式，用 \`\`\`json 包裹：
\`\`\`json
[{"eventId":"事件ID（原樣回傳）","title":"事件標題","todayImpact":"positive/negative/neutral/none","confidence":0.0到1.0,"note":"一句話說明今日與此事件的關聯","suggestClose":true或false,"suggestCloseReason":"若建議結案，說明原因"}]
\`\`\`
- todayImpact: positive=今日股價走勢符合事件預期, negative=相反, neutral=無明顯影響, none=無關
- confidence: 你對此評估的信心度(0-1)
- suggestClose: 是否建議結案（事件已充分反映或已失效）

## 🧬 BRAIN_UPDATE
最後，根據今日分析結果更新策略大腦。用 \`\`\`json 包裹，結構：
\`\`\`json
{"validatedRules":[{"id":"規則ID或空字串","text":"今天仍成立的舊規則","reason":"為何成立","confidence":0到100,"lastValidatedAt":"日期","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"staleRules":[{"id":"規則ID或空字串","text":"需要降級或待更新的規則","reason":"資料過期或證據不足","confidence":0到100,"staleness":"aging/stale","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"invalidatedRules":[{"id":"規則ID或空字串","text":"今天被證偽的規則","reason":"為何失效","confidence":0到100,"nextStatus":"candidate/archived","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"rules":[{"text":"更新後仍保留的核心規則","when":"適用情境","action":"建議動作","scope":"適用標的或情境","appliesTo":["成長股/景氣股/事件股/權證/ETF"],"marketRegime":"規則適用的台股市況或輪動節奏","catalystWindow":"月營收/法說/財報/事件窗口","contextRequired":["規則成立前必須滿足的前提"],"invalidationSignals":["哪些訊號出現就代表規則該降級或失效"],"historicalAnalogs":[{"code":"歷史相似個股代碼","name":"股票名","period":"當時的年份/區間","thesis":"為何相似","verdict":"supported/mixed/contradicted","differenceType":"none/stock_specific/market_regime/timing/liquidity/rule_miss","note":"若失準，說明是個股差異還是規則失準"}],"confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"lastValidatedAt":"日期","staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"新增或保留待驗證規則","when":"待驗證情境","action":"若成立要做什麼","appliesTo":["適用類型"],"marketRegime":"預計適用的台股市況","catalystWindow":"預計驗證窗口","contextRequired":["前提"],"invalidationSignals":["失敗訊號"],"historicalAnalogs":[{"code":"歷史相似個股代碼","name":"股票名","period":"當時年份/區間","thesis":"為何相似","verdict":"supported/mixed/contradicted","differenceType":"none/stock_specific/market_regime/timing/liquidity/rule_miss","note":"補充"}],"confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":["錯誤1"...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"今日日期","evolution":"這次更新一句話摘要"}
\`\`\`
- validatedRules：先列出今天被支持的舊規則，最多6條
- staleRules：列出今天證據不足、資料過期或需降級的規則，最多6條
- invalidatedRules：列出今天被證偽的規則，最多6條
- 既有核心規則與既有 candidate rule 都必須至少落入 validatedRules / staleRules / invalidatedRules 其中一個，不能遺漏
- rules：這是「今天驗證後」仍保留的核心規則，最多12條
- candidateRules：只有現有規則無法解釋時，才新增少量候選規則，最多6條
- validationScore：0-100，反映規則目前被支持的強度
- staleness：標註規則是否新鮮、待更新、陳舊或尚未驗證
- evidenceRefs：盡量附上 1-3 個證據來源，優先引用本 App 已有的 analysis / research / events / targets / fundamentals
- historicalAnalogs：每條重要規則盡量附 1-2 個過往台股相似案例；若失準，必須標 differenceType，區分個股差異還是規則失準
- marketRegime / catalystWindow / appliesTo：請把規則的台股適用情境寫清楚，避免把不同節奏硬套成同一條規則
- checklists：把最重要的規則整理成進場前 / 加碼前 / 出場前檢查表
- lessons：保留舊的+加入今日新教訓（只加有意義的）
- commonMistakes：反覆出現的錯誤模式
- stats：更新勝率統計`

const FALLBACK_BRAIN_UPDATE_SYSTEM_PROMPT = `你是策略知識庫管理器。根據今日分析結果，更新策略大腦。
回傳**純JSON**格式（不要markdown code block），結構：
{"validatedRules":[{"id":"規則ID或空字串","text":"今天仍成立的舊規則","reason":"為何成立","confidence":0到100,"lastValidatedAt":"日期","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"staleRules":[{"id":"規則ID或空字串","text":"需要降級或待更新的規則","reason":"資料過期或證據不足","confidence":0到100,"staleness":"aging/stale","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"invalidatedRules":[{"id":"規則ID或空字串","text":"今天被證偽的規則","reason":"為何失效","confidence":0到100,"nextStatus":"candidate/archived","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}]}],"rules":[{"text":"更新後仍保留的核心規則","when":"適用情境","action":"建議動作","scope":"適用範圍","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"lastValidatedAt":"日期","staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"待驗證規則","when":"情境","action":"動作","confidence":1到10,"evidenceCount":整數,"validationScore":0到100,"staleness":"fresh/aging/stale/missing","evidenceRefs":[{"type":"analysis/research/review/event/fundamental/target/report/dossier/note","refId":"來源ID或空字串","code":"股票代號或空字串","label":"證據標籤","date":"日期或空字串"}],"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":["錯誤1",...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期","evolution":"一句話摘要"}

規則：先驗證舊規則，再決定是否保留
validatedRules：今天被支持的舊規則
staleRules：證據不足、資料過期或需降級的規則
invalidatedRules：今天被證偽的規則
candidateRules：只有現有規則不夠覆蓋時，才新增少量假設
既有核心規則與既有 candidate rule 都必須至少落入 validatedRules / staleRules / invalidatedRules 其中一個
驗證時至少檢查：月營收節奏、法說/財報/事件窗口、目標價/公開報告 freshness、族群/題材輪動位置；缺 fresh 證據時優先進 staleRules
checklists：把規則整理成進場前 / 加碼前 / 出場前檢查表
教訓：今日新增的具體教訓（只加新的，保留舊的）
常犯錯誤：反覆出現的錯誤模式
每條重要規則請額外補：
- appliesTo：適用類型
- marketRegime：適用的台股市況 / 輪動節奏
- catalystWindow：適用的月營收 / 財報 / 法說 / 事件窗口
- contextRequired：規則成立前提
- invalidationSignals：哪些訊號代表規則失效
- historicalAnalogs：1-2 個過往台股相似案例，若失準需在 note 中說明是規則失準還是個股 / 流動性 / 市況差異`

export function buildDailyChanges({
  holdings = [],
  priceMap = {},
  resolveHoldingPrice = () => 0,
  getHoldingUnrealizedPnl = () => 0,
  getHoldingReturnPct = () => 0,
}) {
  return (Array.isArray(holdings) ? holdings : [])
    .map((holding) => {
      const marketPrice = priceMap[holding.code]
      return {
        code: holding.code,
        name: holding.name,
        type: holding.type,
        price: marketPrice?.price || resolveHoldingPrice(holding),
        yesterday: marketPrice?.yesterday || resolveHoldingPrice(holding),
        change: marketPrice ? (marketPrice.change ?? 0) : null,
        changePct: marketPrice ? (marketPrice.changePct ?? 0) : null,
        cost: holding.cost,
        qty: holding.qty,
        todayPnl: marketPrice ? Math.round(marketPrice.change * holding.qty) : 0,
        totalPnl: marketPrice
          ? Math.round((marketPrice.price - holding.cost) * holding.qty)
          : getHoldingUnrealizedPnl(holding),
        totalPct: marketPrice
          ? Math.round((marketPrice.price / holding.cost - 1) * 10000) / 100
          : getHoldingReturnPct(holding),
      }
    })
    .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity))
}

export function buildMarketContextFromIndexData(indexData) {
  if (!indexData?.msgArray?.length) return ''
  const indices = indexData.msgArray.map((item) => {
    const price = parseFloat(item.z) || parseFloat(item.pz) || 0
    const yesterday = parseFloat(item.y) || 0
    const changePct = yesterday > 0 ? ((price - yesterday) / yesterday) * 100 : 0
    return { name: item.n, price, yesterday, changePct }
  })
  const taiex = indices.find((item) => item.name?.includes('加權'))
  const elec = indices.find((item) => item.name?.includes('電子'))
  if (!taiex && !elec) return ''

  let marketContext = '\n═══ 大盤環境 ═══\n'
  if (taiex) {
    marketContext += `加權指數：${taiex.price.toFixed(2)} (${taiex.changePct >= 0 ? '+' : ''}${taiex.changePct.toFixed(2)}%)\n`
  }
  if (elec) {
    marketContext += `電子類指數：${elec.price.toFixed(2)} (${elec.changePct >= 0 ? '+' : ''}${elec.changePct.toFixed(2)}%)\n`
  }
  marketContext +=
    '\n判斷指引：個股漲幅 < 類股平均 → 相對弱勢需分析原因；個股漲幅 > 類股平均 → 確認是個股利多還是補漲；大盤大跌但個股抗跌 → 確認是否量縮假象。\n'
  return marketContext
}

export function buildDailyEventCollections({
  newsEvents = [],
  defaultNewsEvents = [],
  isClosedEvent = () => false,
  changes = [],
  today = '',
}) {
  const eventSource =
    Array.isArray(newsEvents) && newsEvents.length > 0 ? newsEvents : defaultNewsEvents
  const pendingEvents = eventSource.filter((event) => !isClosedEvent(event))
  const eventCorrelations = pendingEvents
    .map((event) => {
      const relatedStocks = (Array.isArray(event?.stocks) ? event.stocks : [])
        .map((stock) => {
          const code = String(stock || '').match(/\d+/)?.[0]
          const change = changes.find((item) => item.code === code)
          return change
            ? {
                name: change.name,
                code: change.code,
                changePct: change.changePct,
                change: change.change,
              }
            : null
        })
        .filter(Boolean)
      return { ...event, relatedStocks }
    })
    .filter((event) => event.relatedStocks.length > 0)

  const anomalies = changes.filter((change) => Math.abs(change.changePct) > 3)
  const needsReview = pendingEvents.filter((event) => {
    if (!String(event?.date || '').match(/^\d{4}\/\d{2}/)) return false
    return event.date <= today
  })

  return { pendingEvents, eventCorrelations, anomalies, needsReview }
}

export function buildAnalysisDossiers({ changes = [], dossierByCode = new Map() }) {
  return changes
    .map((change) => {
      const base = dossierByCode.get(change.code)
      if (!base) return null
      return {
        ...base,
        position: {
          ...(base.position || {}),
          price: change.price,
          value: Math.round(change.price * (Number(base.position?.qty) || 0)),
          pnl: change.totalPnl,
          pct: change.totalPct,
        },
      }
    })
    .filter(Boolean)
}

export function buildPreviousPredictionReviewBlock(prevReport) {
  if (!prevReport) return ''
  const prevPreds = prevReport.blindPredictions || []
  const prevScores = prevReport.predictionScores
  if (prevPreds.length === 0) return ''

  const accuracy =
    prevScores?.accuracy != null ? `${Math.round(prevScores.accuracy * 100)}%` : 'N/A'
  const worstMiss = prevScores?.details?.reduce(
    (worst, detail) =>
      detail && Math.abs(detail.error || 0) > Math.abs(worst?.error || 0) ? detail : worst,
    null
  )
  const worstLine = worstMiss
    ? `${worstMiss.name} 預測${worstMiss.predicted}，實際${worstMiss.actual}`
    : 'N/A'

  return `\n═══ 前次分析回顧 ═══
上次分析：${prevReport.date}
上次盲測準確率：${accuracy}
上次最大失誤：${worstLine}
請先用 1 句話反思近期預測表現，再開始分析。如果準確率低於 60%，請降低建議的激進程度。\n`
}

export function buildBlindPredictionBlock(blindPredictions = []) {
  if (!Array.isArray(blindPredictions) || blindPredictions.length === 0) return ''
  return `
═══ 你的盲測預測（已鎖定，不可修改）═══
${JSON.stringify(blindPredictions, null, 0)}

═══ 分析指引 ═══
請先用 2-3 句話對比你的盲測預測與下方的實際結果：哪些預測正確？哪些錯了？錯的原因是什麼？
預測錯誤的股票需要特別深入檢討，不要用「短期波動」帶過。
`
}

function wrapPromptSection(tag, content, fallback = '無') {
  const text = String(content || '').trim()
  return `<${tag}>
${text || fallback}
</${tag}>`
}

function getLatestTargetInfo(dossier = {}) {
  const targets = Array.isArray(dossier?.targets) ? dossier.targets : []
  const dated = targets
    .map((item) => {
      const date = String(item?.date || item?.updatedAt || item?.publishedAt || '').trim()
      const parsed = date ? new Date(date) : null
      return Number.isNaN(parsed?.getTime?.()) ? null : { ...item, date, parsed }
    })
    .filter(Boolean)
    .sort((a, b) => b.parsed.getTime() - a.parsed.getTime())
  return dated[0] || null
}

function daysBetween(from, to = new Date()) {
  const left = from instanceof Date ? from : new Date(from)
  const right = to instanceof Date ? to : new Date(to)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null
  return Math.floor((right.getTime() - left.getTime()) / (24 * 60 * 60 * 1000))
}

export function buildTaiwanMarketSignals({
  holdings = [],
  dossiers = [],
  newsEvents = [],
  today = new Date(),
} = {}) {
  const dossierMap = new Map((Array.isArray(dossiers) ? dossiers : []).map((d) => [d.code, d]))
  const eventSource = Array.isArray(newsEvents) ? newsEvents : []
  const todayDate = today instanceof Date ? today : new Date(today)
  const sevenDaysLater = new Date(todayDate)
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

  return (Array.isArray(holdings) ? holdings : []).map((holding) => {
    const dossier = dossierMap.get(holding.code) || {}
    const fundamentals = dossier.fundamentals || {}
    const latestRevenue =
      fundamentals.monthRevenue ||
      fundamentals.latestMonthRevenue ||
      fundamentals.revenueLatest ||
      null
    const revenueValue = Number(
      latestRevenue?.revenue || latestRevenue?.value || latestRevenue?.current
    )
    const revenueLastYear = Number(
      latestRevenue?.lastYearRevenue || latestRevenue?.lastYear || latestRevenue?.previousYearValue
    )
    const revenueYoY =
      Number.isFinite(revenueValue) && Number.isFinite(revenueLastYear) && revenueLastYear > 0
        ? Math.round((revenueValue / revenueLastYear - 1) * 100 * 100) / 100
        : Number.isFinite(Number(fundamentals.revenueYoY))
          ? Number(fundamentals.revenueYoY)
          : null

    const upcomingEvents = eventSource.filter((event) => {
      const eventDate = new Date(String(event?.date || event?.eventDate || '').replace(/\//g, '-'))
      const codeHit = (Array.isArray(event?.stocks) ? event.stocks : []).some((stock) =>
        String(stock || '').includes(holding.code)
      )
      const typeHit = ['conference', 'earnings', 'dividend'].includes(String(event?.type || ''))
      return (
        codeHit &&
        typeHit &&
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= todayDate &&
        eventDate <= sevenDaysLater
      )
    })

    const latestTarget = getLatestTargetInfo(dossier)
    const targetFreshnessDays = latestTarget?.parsed
      ? daysBetween(latestTarget.parsed, todayDate)
      : null

    const institutional =
      fundamentals.institutionalInvestors || fundamentals.institutionalFlow || {}
    const buySell = institutional.last5Days || institutional.fiveDayNetBuySell || institutional
    const foreignNet = Number(buySell?.foreign || buySell?.foreignInvestor || buySell?.外資)
    const investmentTrustNet = Number(buySell?.investmentTrust || buySell?.trust || buySell?.投信)
    const dealerNet = Number(buySell?.dealer || buySell?.自營商)

    return {
      code: holding.code,
      name: holding.name,
      revenueYoY,
      eventWindow: upcomingEvents
        .map((event) => `${event.date || event.eventDate} ${event.title}`)
        .slice(0, 3),
      targetFreshnessDays,
      institutionalFlow5d: {
        foreign: Number.isFinite(foreignNet) ? foreignNet : null,
        investmentTrust: Number.isFinite(investmentTrustNet) ? investmentTrustNet : null,
        dealer: Number.isFinite(dealerNet) ? dealerNet : null,
      },
      sector: dossier?.meta?.industry || '',
    }
  })
}

export function formatTaiwanMarketSignals(signals = []) {
  const rows = (Array.isArray(signals) ? signals : []).map((signal) => {
    const revenueText =
      signal.revenueYoY == null
        ? '月營收YoY: 無資料'
        : `月營收YoY: ${signal.revenueYoY >= 0 ? '+' : ''}${signal.revenueYoY}%`
    const eventText = signal.eventWindow?.length
      ? `事件窗口: ${signal.eventWindow.join('；')}`
      : '事件窗口: 近7日無法說/財報/除權息'
    const targetText =
      signal.targetFreshnessDays == null
        ? '目標價新鮮度: 無資料'
        : `目標價新鮮度: ${signal.targetFreshnessDays} 天前更新`
    const flow = signal.institutionalFlow5d || {}
    const flowText = `三大法人5日: 外資 ${flow.foreign ?? 'NA'} / 投信 ${flow.investmentTrust ?? 'NA'} / 自營商 ${flow.dealer ?? 'NA'}`
    return `${signal.code} ${signal.name}｜${revenueText}｜${eventText}｜${targetText}｜${flowText}`
  })
  return rows.length > 0 ? rows.join('\n') : '無'
}

export function formatHistoricalAnalogsForPrompt(analogsByCode = {}) {
  const sections = Object.entries(analogsByCode || {})
    .map(([code, analogs]) => {
      const rows = (Array.isArray(analogs) ? analogs : []).map(
        (analog, index) =>
          `${index + 1}. ${code} ← ${analog.name}｜${analog.period}｜${analog.thesis}｜${analog.verdict}${analog.note ? `｜${analog.note}` : ''}`
      )
      return rows.length > 0 ? rows.join('\n') : null
    })
    .filter(Boolean)
  return sections.length > 0 ? sections.join('\n') : '無'
}

export function buildBlindPredictionRequest({
  today = '',
  notesContext = '',
  brainContext = '',
  blindHoldingSummary = '目前沒有持股 dossier。',
  eventSummary = '',
}) {
  return {
    maxTokens: 900,
    allowThinking: false,
    systemPrompt: BLIND_PREDICTION_SYSTEM_PROMPT,
    userPrompt: [
      '<analysis_packet mode="blind_prediction">',
      wrapPromptSection('date', today, '未提供'),
      wrapPromptSection('portfolio_notes', notesContext),
      wrapPromptSection('brain_context', brainContext),
      wrapPromptSection('portfolio_holdings', blindHoldingSummary, '目前沒有持股 dossier。'),
      wrapPromptSection('tracking_events', eventSummary),
      '</analysis_packet>',
      '',
      '<instruction>',
      '請只根據 <portfolio_holdings> 與 <tracking_events> 判斷每檔持股今日方向。',
      '忽略不存在的即時漲跌資料；若證據不足，方向可選 flat 並降低 confidence。',
      '輸出純 JSON array，不要補充說明。',
      '</instruction>',
    ].join('\n'),
  }
}

export function buildDailyAnalysisRequest({
  today = '',
  prevReviewBlock = '',
  blindPredBlock = '',
  totalTodayPnl = 0,
  marketContext = '',
  notesContext = '',
  brainContext = '',
  revContext = '',
  holdingSummary = '目前沒有持股 dossier。',
  coverageContext = '',
  anomalySummary = '無',
  eventSummary = '',
  blindPredictions = [],
  predictionHitRate = '0/0',
  taiwanMarketSignals = '',
  historicalAnalogs = '',
  analysisFrameworkContext = '',
}) {
  return {
    maxTokens: 2200,
    allowThinking: false,
    systemPrompt: DAILY_ANALYSIS_SYSTEM_PROMPT,
    userPrompt: [
      '<analysis_packet mode="daily_close">',
      wrapPromptSection('date', today, '未提供'),
      wrapPromptSection('analysis_framework', analysisFrameworkContext),
      wrapPromptSection('previous_review', prevReviewBlock),
      wrapPromptSection('blind_prediction_review', blindPredBlock),
      wrapPromptSection(
        'today_performance',
        `今日持倉損益: ${totalTodayPnl >= 0 ? '+' : ''}${totalTodayPnl.toLocaleString()} 元`
      ),
      wrapPromptSection('market_context', marketContext),
      wrapPromptSection('portfolio_notes', notesContext),
      wrapPromptSection('brain_context', brainContext),
      wrapPromptSection('reversal_watch', revContext),
      wrapPromptSection('coverage_context', coverageContext),
      wrapPromptSection('taiwan_market_signals', taiwanMarketSignals),
      wrapPromptSection('historical_analogs', historicalAnalogs),
      wrapPromptSection('portfolio_holdings', holdingSummary, '目前沒有持股 dossier。'),
      wrapPromptSection(
        'concentration_risk',
        'AI/伺服器5檔、光通訊3檔、PCB材料3檔，需評估集中風險與龍頭/衛星配置差異。'
      ),
      wrapPromptSection('anomalies', anomalySummary || '無'),
      wrapPromptSection('tracking_events', eventSummary),
      wrapPromptSection('prediction_hit_rate', predictionHitRate || '0/0'),
      '</analysis_packet>',
      '',
      '<instruction>',
      blindPredictions.length > 0
        ? '先對比 <blind_prediction_review> 與 <today_performance>，指出預測對錯與原因。'
        : '先讀 <portfolio_holdings> 的 thesis / targets / events / brain，再結合 <today_performance> 判斷，不要只看漲跌幅。',
      '把 <coverage_context> 當成跨持股一次性的供應鏈/主題補充，不要在每檔持股重複改寫整段供應鏈。',
      'A 級優先處理只選 1-3 檔，其餘持股一律用一句話快照。',
      '若資料 freshness 為 stale 或 missing，要直接標明不確定性，不可假裝有最新資料。',
      '只挑 1-3 個與今日走勢真正有因果關聯的事件。',
      '所有操作建議都要有具體數字、等待條件與「如果我錯了」的原因。',
      '在 BRAIN_UPDATE 中先驗證既有規則，再決定是否新增少量候選規則。',
      '必須先寫完整的中文分析評論，最後才能附上 EVENT_ASSESSMENTS 與 BRAIN_UPDATE JSON blocks。',
      '</instruction>',
    ].join('\n'),
  }
}

export function buildFallbackBrainUpdateRequest({
  aiInsight = '',
  strategyBrain = null,
  hits = 0,
  total = 0,
  totalTodayPnl = 0,
}) {
  return {
    maxTokens: 2600,
    allowThinking: false,
    systemPrompt: FALLBACK_BRAIN_UPDATE_SYSTEM_PROMPT,
    userPrompt: `今日分析：
${aiInsight}

現有策略大腦：
${JSON.stringify(strategyBrain || { rules: [], lessons: [], commonMistakes: [], stats: {} })}

預測命中率：${hits}/${total}
今日損益：${totalTodayPnl >= 0 ? '+' : ''}${totalTodayPnl.toLocaleString()} 元

請更新策略大腦，保留有效的舊規則，加入今日新教訓。`,
  }
}

export function calculatePredictionScores(blindPredictions = [], changes = []) {
  if (!Array.isArray(blindPredictions) || blindPredictions.length === 0) return null

  const details = blindPredictions
    .map((prediction) => {
      const actual = changes.find((change) => change.code === prediction.code)
      if (!actual) return null
      const actualDirection =
        actual.changePct > 0.5 ? 'up' : actual.changePct < -0.5 ? 'down' : 'flat'
      const predicted = prediction.direction
      const correct = predicted === actualDirection
      const dirScore = correct
        ? 1
        : predicted === 'flat' && Math.abs(actual.changePct) > 1
          ? -0.5
          : predicted !== actualDirection
            ? -1
            : 0

      return {
        code: prediction.code,
        name: prediction.name || actual.name,
        predicted,
        actual: actualDirection,
        actualPct: actual.changePct,
        confidence: prediction.confidence || 5,
        correct,
        dirScore,
        error: Math.abs(actual.changePct),
      }
    })
    .filter(Boolean)

  const correctCount = details.filter((detail) => detail.correct).length
  const accuracy = details.length > 0 ? correctCount / details.length : null
  const weightedScore = details.reduce(
    (sum, detail) => sum + detail.dirScore * (detail.confidence / 10),
    0
  )

  return { details, accuracy, correctCount, total: details.length, weightedScore }
}

export function buildDailyReport({
  today = '',
  totalTodayPnl = 0,
  changes = [],
  anomalies = [],
  eventCorrelations = [],
  needsReview = [],
  aiInsight = null,
  aiError = null,
  eventAssessments = [],
  blindPredictions = [],
  predictionScores = null,
  brainAudit = null,
  injectedKnowledgeIds = [],
  finmindDataCount = 0,
  analysisStage = 't0-preliminary',
  analysisStageLabel = '收盤快版',
  analysisVersion = 1,
  rerunReason = null,
  finmindConfirmation = null,
}) {
  return {
    id: Date.now(),
    date: today,
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    totalTodayPnl,
    changes,
    anomalies,
    eventCorrelations,
    needsReview,
    aiInsight,
    aiError,
    eventAssessments,
    blindPredictions,
    predictionScores,
    brainAudit,
    injectedKnowledgeIds: Array.isArray(injectedKnowledgeIds)
      ? Array.from(new Set(injectedKnowledgeIds.filter(Boolean)))
      : [],
    finmindDataCount,
    analysisStage,
    analysisStageLabel,
    analysisVersion: Number(analysisVersion) || 1,
    rerunReason: rerunReason || null,
    finmindConfirmation:
      finmindConfirmation && typeof finmindConfirmation === 'object' ? finmindConfirmation : null,
  }
}

export function stripDailyAnalysisEmbeddedBlocks(displayText = '') {
  const rawText = String(displayText || '').trim()
  const sections = ['EVENT_ASSESSMENTS', 'BRAIN_UPDATE']
    .map((label) => locateEmbeddedSection(rawText, label))
    .filter(Boolean)
    .sort((a, b) => b.start - a.start)

  let cleaned = sections.reduce(
    (text, section) => `${text.slice(0, section.start)}${text.slice(section.end)}`,
    rawText
  )

  // 清除 AI 回傳的裸 JSON block（```json ... ``` 或尾部的 [{...}] / {...}）
  cleaned = cleaned
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/\n\s*\[[\s\S]*?"eventId"[\s\S]*?\]\s*$/g, '')
    .replace(/\n\s*\{[\s\S]*?"(?:validatedRules|staleRules|invalidatedRules)"[\s\S]*?\}\s*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned || rawText
}

function extractEmbeddedJsonBlock(displayText = '', label) {
  const section = locateEmbeddedSection(displayText, label)
  if (!section) return null
  const candidate = extractJsonCandidate(section.text)
  if (!candidate) return null
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

export function extractDailyEventAssessments(displayText = '') {
  const parsed = extractEmbeddedJsonBlock(displayText, 'EVENT_ASSESSMENTS')
  return Array.isArray(parsed) ? parsed : []
}

export function extractDailyBrainUpdate(displayText = '') {
  const parsed = extractEmbeddedJsonBlock(displayText, 'BRAIN_UPDATE')
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
}

function locateEmbeddedSection(displayText = '', label = '') {
  const text = String(displayText || '')
  if (!text || !label) return null

  const startRegex = new RegExp(`(?:^|\\n)(?:#{1,6}\\s*)?(?:[^\\n]*?\\s)?${label}\\b[^\\n]*`, 'i')
  const startMatch = startRegex.exec(text)
  if (!startMatch) return null

  const start = startMatch.index + (startMatch[0].startsWith('\n') ? 1 : 0)
  const searchStart = start + startMatch[0].trimStart().length
  const nextStart = ['EVENT_ASSESSMENTS', 'BRAIN_UPDATE']
    .filter((item) => item !== label)
    .map((nextLabel) => {
      const nextRegex = new RegExp(
        `(?:^|\\n)(?:#{1,6}\\s*)?(?:[^\\n]*?\\s)?${nextLabel}\\b[^\\n]*`,
        'ig'
      )
      nextRegex.lastIndex = searchStart
      const match = nextRegex.exec(text)
      return match ? match.index + (match[0].startsWith('\n') ? 1 : 0) : null
    })
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b)[0]

  const end = nextStart ?? text.length
  return {
    start,
    end,
    text: text.slice(start, end).trim(),
  }
}

function extractJsonCandidate(sectionText = '') {
  const text = String(sectionText || '').trim()
  if (!text) return null

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const jsonStart = [text.indexOf('['), text.indexOf('{')]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]

  if (!Number.isInteger(jsonStart)) return null

  const candidate = scanBalancedJson(text.slice(jsonStart))
  return candidate?.trim() || null
}

function scanBalancedJson(text = '') {
  const stack = []
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{' || char === '[') {
      stack.push(char)
      continue
    }

    if (char === '}' || char === ']') {
      const open = stack.pop()
      if (!open) return null
      const pairMatches = (open === '{' && char === '}') || (open === '[' && char === ']')
      if (!pairMatches) return null
      if (stack.length === 0) {
        return text.slice(0, index + 1)
      }
    }
  }

  return null
}
