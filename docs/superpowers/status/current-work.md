# Current Work

Last updated: 2026-03-25 15:42

## Objective

Task A 已完成第一段。Task B 進行中：把收盤分析改成先驗證舊規則，再新增候選規則，並正式納入「過往台股相似案例驗證」。本輪另外加入 `Gemini CLI` 作為公開資料 research scout。

## Active slices

- `Codex`：最終策略邏輯、schema、rule lifecycle、prompt 契約、驗收
- `Gemini CLI`：公開資料、新聞 / 法說 / 公告 / 目標價報導的 citations 與 freshness 蒐集
- `Claude Code over Ollama`：candidate rules / checklist / 台股 prompt guardrails 草稿
- `Qwen Code`：低風險 UI / helper / parsing / test patch
- `AnythingLLM`：PDF / 研究文件 / 歷史材料整理與對照

固定角色與能力邊界見：

- [ai-collaboration-channel.md](/Users/chenkuichen/APP/test/docs/superpowers/status/ai-collaboration-channel.md)

## Files in play

- `src/App.jsx`
- `api/research.js`
- `docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md`
- `docs/superpowers/status/current-work.md`
- `GEMINI.md`
- `scripts/launch-gemini.sh`
- `scripts/launch-gemini-research-scout.sh`
- `CLAUDE.md`
- `QWEN.md`

## Latest checkpoint

- `16:20` Codex：已建立固定多 AI 協作通道 [ai-collaboration-channel.md](/Users/chenkuichen/APP/test/docs/superpowers/status/ai-collaboration-channel.md)
- `16:21` James：回報其最適合擔任高風險 state/storage/sync/migration review 與最終技術裁決輔助
- `16:22` Curie：回報其最適合擔任 truth-layer / validation / freshness / Taiwan-market guardrails 的 final reviewer

- `16:02` Codex：完成 `validationScore / staleness / evidenceRefs` 的 rule normalization 與 fallback 推導
- `16:04` Codex：策略大腦 UI 改為顯示驗證分、狀態與證據來源
- `16:06` Codex：收盤分析 / 復盤 / cleanup / research 的 brain JSON 契約已同步
- `16:08` Codex：`npm run build` 通過；`api/research.js` import 檢查通過
- `16:15` Claude helper：確認可可靠承接 Task B 的 prompt-spec 草稿、JSON contract 草稿、台股 guardrails 草稿，但不應負責最終 rule lifecycle 與 schema
- `16:16` Coordination helper：確認便宜模型適合摘要 / 抽取 / 分群 / 草稿；Codex 保留 truth、persistence、final judgment、client-facing correctness
- `16:25` Idle optimization sweep：共識排序為
  1. 先做「舊規則驗證優先」的收盤分析流程
  2. 再補「證據鏈 + 新鮮度」
  3. 最後強化「台股節奏判斷層」
- `16:27` Idle optimization sweep：便宜模型在空檔時應只交
  - findings
  - refresh queues
  - candidate checklists
  - prompt / wording 草稿
  最終是否採納仍由 Codex 決定
- `16:41` Curie：補齊「台股歷史相似案例驗證」的高信號差異清單，明確區分規則失準 vs 個股 / 流動性 / 市場節奏差異
- `16:49` Codex：策略規則 schema 已擴充 `appliesTo / marketRegime / catalystWindow / contextRequired / invalidationSignals / historicalAnalogs`
- `16:53` Codex：收盤分析與 fallback / review / cleanup prompt 已加入歷史相似案例要求；策略大腦 UI 已能顯示歷史相似案例與失效訊號
- `16:58` James：建議歷史驗證細節不要直接塞進 `strategyBrain` 主體，下一步應新增獨立 `brain-validation-v1` casebook，rule 本體只保留驗證摘要
- `17:02` Codex：已重新驗證 `npm run build` 與 `api/research.js` import，Task B 目前可運行
- `17:14` Codex：新增獨立 `brain-validation-v1` storage / state / autosave，先 local-only 落地
- `17:17` Codex：已接上 rule-based fingerprint / analog scoring / daily analysis 自動累積 casebook
- `17:20` Codex：策略大腦 UI 已能顯示 casebook 歷史驗證摘要；`npm run build`、`api/research.js` import 再次通過
- `17:21` checkpoint meeting：暫不需要新 skill；當前最大缺口改為「事件復盤 / 真實 outcome 回寫 casebook」，以及月營收 / 法說 / 目標價節奏的台股特化補強
- `17:42` Codex：完成 Gemini CLI 官方可行性確認；共識為「只加入公開資料 research scout，不碰最終真值層」
- `17:49` Codex：已安裝 `Gemini CLI 0.35.0`
- `17:57` Codex：新增 repo-local `GEMINI.md` 與兩條啟動腳本，並補進 VSCode tasks
- `18:04` James + Curie：同意 Gemini 最佳位置是外部 research scout；不適合直接定 fundamentals / targets / strategyBrain
- `13:52` Codex：確認 Gemini CLI 已是 `0.35.0`，不是版本太舊；`gemini-3.1-pro` 目前在此 key / 路徑下不可用，`gemini-2.5-pro` free-tier quota 為 0
- `13:54` Codex：實測 `gemini-3-flash-preview` 與 `gemini-3.1-flash-lite-preview` 可用，已將 repo 預設 Gemini 模型切到 `gemini-3-flash-preview`
- `14:01` Codex：Task B 核心安全閥已落地：新增 `brainRuleKey`、`formatBrainRulesForValidationPrompt`、`ensureBrainAuditCoverage`、`mergeBrainWithAuditLifecycle`
- `14:02` Codex：`runDailyAnalysis()` 解析 `BRAIN_UPDATE` 後不再直接覆蓋 brain，改為先補 audit coverage，再做 deterministic rule lifecycle merge
- `14:03` Codex：Task B prompt 已加入 ruleId / 全覆蓋要求，以及台股四類驗證門檻（月營收節奏、法說/財報/事件窗口、目標價/報告 freshness、題材輪動）
- `14:04` Curie：確認最值得硬性要求的台股驗證訊號為月營收 cadence、事件窗口、報告 freshness、族群輪動，不足時應優先進 staleRules
- `14:04` James：提醒 merge 必須避免 partial output 洗掉舊規則，並要求 rule identity、stale vs invalidated、evidenceCount 累積與 checklist drift 一起處理
- `14:05` Codex：`npm run build` 通過；`api/research.js` import 通過
- `14:14` Gemini CLI：已對 submitReview -> brain-validation-v1 提供台股高信號建議，重點包括月營收/法說/財報/目標價 freshness、個股差異 vs 規則失準、以及 time-travel / 重複事件檢查
- `14:18` James：指出 review 路徑若直接套用 daily analysis 的 `ensureBrainAuditCoverage()`，會把不相關規則錯標為 stale；review 只應覆蓋本次事件相關規則
- `14:19` Curie：指出事件復盤不應只看方向對錯，必須把月營收 / 法說 / 財報 / 族群輪動 / 目標價 freshness 一起做 verdict
- `14:23` Codex：`submitReview()` 已改成回傳 review audit buckets，並走 `ensureBrainAuditCoverage(... dossiers)` + `attachEvidenceRefsToBrainAudit()` + `mergeBrainWithAuditLifecycle()`
- `14:24` Codex：`submitReview()` 成功後已正式 append `sourceType: "eventReview"` 到 `brain-validation-v1`，讓真實復盤 outcome 累積進 casebook
- `14:25` Codex：新增 `createFallbackValidationDossier()`、`buildEventReviewDossiers()`、`buildEventReviewEvidenceRefs()`，避免事件股票不在目前持倉時完全失去 validation writeback
- `14:26` Codex：順手修正 holding dossier 仍吃舊 `holding.value/pnl/pct` 的割裂問題，統一改用現算公式
- `14:27` Codex：`npm run build` 再次通過；Claude local / Qwen local 已啟動嘗試 review，但在本機 Ollama 上非互動輸出明顯較慢，暫不作為阻塞主線
- `14:34` 使用者回報：持倉總市值直接變 0；主線切換為高優先 debug
- `14:39` James：指出市值歸零主因是 `price*qty` 現算邏輯缺少 holdings fallback，且 cloud/import/raw holdings 缺少統一 normalizer
- `14:40` Gemini CLI：提醒下一輪系統掃描應補 MOPS / TWSE / 除權息 / 零股 / 交易成本等真值層
- `14:42` Codex：新增 `resolveHoldingPrice()`，缺 `price` 時先回退到 `stored price`，再回推 `value/qty`
- `14:43` Codex：owner 雲端 holdings 補缺改成先 `applyMarketQuotesToHoldings()` 正規化後再進 state / localStorage，避免 raw cloud holdings 直接把總市值打成 0
- `14:45` Codex：`npm run build` 再次通過；下一步改做「全系統 bug / 優化計畫審核」，暫不直接開新大 scope
- `14:49` James：確認 holdings integrity 最小完整方案為 persistence sanitize + import sanitize + repair migration + 所有 setHoldings 出口收斂
- `14:52` Curie：Phase 2/3 最佳順序是先做台股 hard gates，再做 per-stock review outcome，最後才重寫 matched/mismatched dimensions
- `14:55` Gemini CLI：補充真值層優先序應包含 MOPS/TWSE/TPEX、除權息、零股、交易成本與異常值熔斷
- `15:00` Codex：`savePortfolioData()` / `loadPortfolioData()` 已對 `holdings-v2` 強制 sanitize；`importLocalBackup()` 已在寫入前正規化所有 holdings key
- `15:02` Codex：schema 升到 v3，新增 `repairPersistedHoldingsIfNeeded()`，讓舊的 zero-value holdings 在啟動時做一次性修復
- `15:04` Codex：`submitMemo()`、`runDailyAnalysis()`、overview duplicate holdings、投組健檢、Top5、持股卡等聚合 UI 已統一改用同一套 holdings 即時計算
- `15:06` Codex：新增 holdings `integrityIssue` 與頁面提示，若缺可用價格會明講而不是靜默算 0
- `15:08` Codex：Phase 2 第一段已落地，新增 `buildTaiwanValidationSignals()`，dossier / daily analysis / research prompt 已開始帶入月營收、法說、財報、目標價/報告的台股驗證門檻
- `15:18` Codex：已補 canonical local host，之後本地一律以 `http://127.0.0.1:3002` 為準，避免 `localhost` 與 `127.0.0.1` 分裂成不同 localStorage
- `15:21` Codex：header 已顯示收盤價同步狀態與 market date；report refresh 候選排序改成使用即時計算市值，不再吃舊 `holding.value`
- `15:29` Codex：台股 hard gates 已正式接進 daily / review verdict，`validatedRules / invalidatedRules` 若缺 fresh 月營收、法說、財報、目標價/報告支撐，會自動降回 `staleRules`
- `15:31` Codex：多股票事件已新增 `stockOutcomes`，結案復盤後會逐檔記錄方向、漲跌幅、是否支持原 thesis
- `15:34` Codex：`brain-validation-v1` case 已正式回填 `matchedDimensions / mismatchedDimensions`，策略大腦 UI 也開始顯示最近案例的相似 / 差異維度
- `15:37` Codex：已建立 `docs/evals/program.md`、`evals/cases/*`、`scripts/eval_brain.mjs`，開始採用 autoresearch 風格的固定案例回放
- `15:38` Codex：`node scripts/eval_brain.mjs` 初版結果 `3/3 passed · avg 100`
- `15:40` Codex：`npm run build` 通過，最新 bundle `dist/assets/index-CvLP7CgH.js`
- `17:34` Codex：Gemini CLI 不穩的主因已定位為舊 Node (`/usr/local/bin/node v15.7.0`)；wrapper 現已強制切到 `~/.nvm/versions/node/v24.13.1/bin/node`
- `17:36` Codex：Gemini 預設 general model 改為 `gemini-2.5-flash`，scout model 改為 `gemini-3.1-flash-lite-preview`；`gemini-3-flash-preview` 保留為可選但不再作預設
- `17:38` Codex：新增 `scripts/gemini-healthcheck.sh` 與 VSCode 任務 `Gemini CLI: Healthcheck`
- `17:40` Gemini CLI：已用 `gemini-2.5-flash` / `gemini-3.1-flash-lite-preview` 成功回覆 repo 內角色、自身限制與最適合負責的公開資料工作
- `17:47` Codex：已驗證 Qwen CLI `--help` 可正常啟動；Qwen 現況定位為「可用但偏慢的 local low-risk worker」
- `17:49` Codex：已驗證 Claude Local over Ollama 可正常啟動並回報版本；目前定位為「互動式 drafting assistant」，暫不作 headless 主線 worker
- `17:52` Codex：新增外部 LLM 共享交接通道 [coordination/llm-bus/board.md](/Users/chenkuichen/APP/test/coordination/llm-bus/board.md)
- `18:02` 使用者要求把 Qwen 與 Claude local 都升到 `qwen3-coder:30b`；舊 `qwen3:14b` 已移除，正在拉新模型

## Next actions

- Task B 分工：
  - `Codex`：已完成 validated / stale / invalidated / candidate 的 merge 契約與 review-driven validation；下一步補強多股票事件與 casebook 解釋力
  - `Gemini CLI`：補近期公開來源、法說 / 公告 / 目標價報導與 citations
  - `Claude Code over Ollama`：先草擬 `brainContext` / `BRAIN_UPDATE` 新 prompt 文案與台股 guardrails
  - `Qwen Code`：等契約定稿後接 parsing / UI / test 的機械實作
- 新增歷史驗證主線：
  - `AnythingLLM`：整理相似個股案例與文件證據
  - `Claude Code over Ollama`：草擬 analog matching / differenceType 文案與清單
  - `Codex`：定義哪些差異屬於規則失準，哪些只是情境不同
- 若主線暫時卡住或正在等驗證，自動做一次 optimization sweep：
  - 問其他模型哪裡還能優化
  - 只收具體、低噪音、可驗證的建議
  - 由 Codex 決定是否納入下一輪
- 每次準備對用戶做階段性回報前，先做一次 checkpoint meeting：
  - 讓各模型先回報哪裡仍薄弱
  - 檢查是否漏掉台股特有節奏 / 風險
  - 判斷是否需要新 skill / 新工具
  - 判斷是否需要上網補一手策略 / 市場參考
  - 最後只保留「立即採納 / 暫緩 / 拒絕」三類決議
- optimization sweep 優先檢查：
  - strategyBrain 規則是否重複 / 空泛 / 缺少 exit logic
  - holding dossier 哪些欄位 stale / missing
  - 收盤分析是否出現無證據支撐的句子
  - 台股節奏詞彙與 guardrail 是否不足
  - UI 是否隱藏了 matched rules / freshness / evidence
- 補 `evidenceRefs` 的實際產生流程，不只支援 schema
- 補 `historicalAnalogs` 的實際產生流程，不只支援 schema
- 繼續把台股事件節奏特化欄位做實：月營收 / 法說 / 財報 / 目標價更新窗口的 hard gate enforcement
- 評估是否為策略大腦補單元測試
- 下一段優先檢查：
  - 使用者 reload 後確認 0 市值是否已恢復；若仍有問題，優先檢查 unrecoverable `integrityIssue: missing-price` 的個股名單
  - 台股真值層下一步要補 MOPS / TWSE / TPEX / 除權息 / 零股 / 交易成本
  - 把 `eval_brain` 案例擴到真實台股月營收 / 法說 / 題材輪動情境，不只 3 個 smoke cases
  - Qwen / Claude local 若要進穩定協作，需要把非互動本地模型路由再調順

## Stop-in-5-min fallback

- 先完成當前 edit batch，不再開新 scope
- 至少更新一次這份檔案的 `Latest checkpoint`
- 明確寫下：
  - 已完成的檔案
  - 尚未完成的下一個函式 / 區塊
  - 下一步最直接的指令或檔案位置
- 若有 delegated slice，標明：
  - 哪個模型已交稿
  - 哪個模型待 review
  - 哪個 slice 被 Codex 收回

## Blockers / assumptions

- 目前 `validationScore` 與 `staleness` 仍以 fallback 推導為主，真正精準化要靠 Task B 之後的規則驗證流程
- `evidenceRefs` schema 已就位，但實際自動回填來源還要再補
- `historicalAnalogs` schema 已就位，但還沒有正式的相似案例檢索 / 比對器；目前先由 AI 在現有 dossier 與歷史脈絡內產出草稿
- `brain-validation-v1` 現在已支援 review-driven 的真實 outcome 標記，但多股票事件仍是單一 outcome 顆粒度
- 必須維持舊版 localStorage brain 資料相容，不能要求使用者重置資料
- 台股分析屬高難度任務：便宜模型只能做摘要、抽取、分群、草稿；最終判斷與客戶/策略影響仍由 Codex 決定
- 台股分析不可只看持倉欄位，後續 Task B / Task D 必須把市場機制、法人 / 題材 / 月營收 / 法說節奏一起納入
