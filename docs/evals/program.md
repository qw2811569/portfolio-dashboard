# Strategy Brain Eval Program

最後更新：2026-03-25

## 目標

把策略大腦的優化流程收斂成固定回圈，而不是每次靠感覺改 prompt。

這份 `program.md` 借用了 `autoresearch` 的工作方法，但改成適合這個台股 App 的版本：

1. 只改有限範圍的策略邏輯
2. 用固定台股案例集回放
3. 跑 `eval_brain`
4. 看分數與 fail reason
5. 過 gate 才保留，沒過就回滾

## 可修改範圍

每一輪只允許改以下內容：

- `src/App.jsx`
  - 台股 hard-gate verdict 邏輯
  - event review / per-stock outcome
  - brain-validation casebook explainability
- `scripts/eval_brain.mjs`
- `evals/cases/**/*.json`
- `docs/evals/program.md`

不要在同一輪順手大改：

- 整體 UI 版型
- 多組合 schema
- 雲端同步協定
- 無關的 AI provider / LLM 安裝流程

## 每輪標準流程

1. 選 1 個 capability
   - `freshness-gating`
   - `event-review-per-stock`
   - `analog-explainability`
2. 跑：

```bash
node scripts/eval_brain.mjs
```

3. 讀結果
   - 總分
   - 每個 case 的 pass/fail
   - 哪個維度失敗
4. 只修高信號失敗案例
5. 重跑
6. 分數進步才保留；若 critical gate 退步就回滾

## 評分重點

- `gate_correctness`
  - stale / missing 的月營收、法說、財報、目標價/報告，不可被當成 `validated`
- `per_stock_resolution`
  - 多股票事件必須逐檔留下 outcome
- `analog_explainability`
  - casebook 必須能說清楚相似維度與差異維度
- `unsupported_claim_penalty`
  - 沒資料卻硬判 fresh / validated 直接失敗

## 接受門檻

- Critical cases 全過
- 總分 `>= 85`
- 不可出現 unsupported claim
- 已通過 case 不可退步

## 多模型分工

- `Gemini`
  - 外部公開資料 scout
  - 不直接當真值層
- `James`
  - schema / merge / edge-case reviewer
- `Curie`
  - 台股市場結構與 verdict reviewer
- `Qwen`
  - 低風險 patch / test / helper
- `Claude local`
  - prompt 草稿與 checklist 草稿
- `Codex`
  - 最終裁決、修改策略邏輯、驗收分數、決定保留或回滾

## 本輪固定案例集

- `evals/cases/daily-analysis/freshness-gating-001.json`
- `evals/cases/event-review/per-stock-review-001.json`
- `evals/cases/brain-validation/analog-dimensions-001.json`

## 備註

這一版不是模型訓練框架，而是「台股策略邏輯回放評測器」。
先把規則驗證、逐檔 outcome、差異解釋做穩，再往後擴大案例集。
