> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔為歷史參考 · 最新狀態請見 `docs/decisions/2026-04-15-gemini-role-blind-spot-only.md`
>
> 保留理由：被 `docs/product/portfolio-dashboard-spec.md` / 其他 spec 引用為歷史證據，刪除會斷脈絡。

---

# Gemini 不做資料蒐集

**日期**：2026-04-15
**觸發**：Gemini 在 multi-LLM round 跑偏去做 Google Code Assist research，違反當前 pipeline

## 決議

Gemini 角色重定義為：

- ✅ 用戶盲點審查員
- ✅ multi-LLM consensus 反駁者
- ❌ **不做資料蒐集**（新聞、目標價、公開資訊、CLI 研究）

## 理由

- 外部資料統一走 FinMind API（付費，1600 req/hr）或既有 RSS pipeline
- Gemini 每次派工自發去做 research = 浪費資源 + 資料不權威
- Multi-LLM round 需要有一個「外部視角」打破 Claude/Codex/Qwen 同訓練集的 echo chamber

## 實作

- 改寫 Gemini role brief（457 行 → 90 行）slim 為反駁角色
- 明確禁止：`google_web_search`、寫 `docs/gemini-research/*.json`、研究產品比較
- 更新 `project-status.json` `Gemini.focus`

## 舊 workflow（已廢除）

- v1「公開資料蒐集員 / research scout」
- v1「工作流程 1：法說會行事曆蒐集」→ 改走 FinMind
- v1「工作流程 2：新聞蒐集」→ 改走 Google News RSS + FinMind
- v1「工作流程 3：產品/工具研究」→ 直接拒絕
