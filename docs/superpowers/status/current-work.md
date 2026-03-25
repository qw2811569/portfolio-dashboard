# Current Work

Last updated: 2026-03-25 18:06

## Objective

Task A 已完成第一段。Task B 進行中：把收盤分析改成先驗證舊規則，再新增候選規則，並正式納入「過往台股相似案例驗證」。本輪另外加入 `Gemini CLI` 作為公開資料 research scout。

## Active slices

- `Codex`：最終策略邏輯、schema、rule lifecycle、prompt 契約、驗收
- `Gemini CLI`：公開資料、新聞 / 法說 / 公告 / 目標價報導的 citations 與 freshness 蒐集
- `Claude Code over Ollama`：candidate rules / checklist / 台股 prompt guardrails 草稿
- `Qwen Code`：低風險 UI / helper / parsing / test patch
- `AnythingLLM`：PDF / 研究文件 / 歷史材料整理與對照

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

## Next actions

- Task B 分工：
  - `Codex`：定義 validated / invalidated / candidate 的最終契約與 merge 規則
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
- 設計 `brain-validation-v1` casebook，避免把大量歷史案例塞爆 `strategyBrain`
- 把 `submitReview()` 的真實結果回寫到 `brain-validation-v1`，讓 verdict 不只靠每日分析
- 補台股事件節奏特化欄位：月營收 / 法說 / 財報 / 目標價更新窗口
- 評估是否為策略大腦補單元測試

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
- `brain-validation-v1` 已落地且可由 daily analysis 自動累積，但目前還缺少 review-driven 的真實 outcome 標記
- 必須維持舊版 localStorage brain 資料相容，不能要求使用者重置資料
- 台股分析屬高難度任務：便宜模型只能做摘要、抽取、分群、草稿；最終判斷與客戶/策略影響仍由 Codex 決定
- 台股分析不可只看持倉欄位，後續 Task B / Task D 必須把市場機制、法人 / 題材 / 月營收 / 法說節奏一起納入
