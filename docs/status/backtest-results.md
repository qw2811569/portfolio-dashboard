> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔為歷史參考 · 最新狀態請見 `src/lib/backtestRuntime.js` 已實作
>
> 保留理由：被 `docs/product/portfolio-dashboard-spec.md` / 其他 spec 引用為歷史證據，刪除會斷脈絡。

---

# Backtest Results — 2026-04-03

## 方法

用 strategy-cases.json 的 120 個歷史策略案例做回測。每個案例有明確的 outcome（success/failure），用來驗證知識庫規則和分析框架的有效性。

## 結果

### 整體

- 成功案例：71/120 (59%)
- 失敗案例：49/120 (41%)

### 按分析框架

| 框架       | 成功 | 總計 | 成功率 |
| ---------- | ---- | ---- | ------ |
| balanced   | 64   | 112  | 57%    |
| income     | 3    | 4    | 75%    |
| compounder | 4    | 4    | 100%   |

### 按 confidence

- 高 confidence (>0.75) 案例命中率：41/41 (100%)
- 中低 confidence 案例：79 個未納入統計

## 發現

1. **112/120 案例走 balanced 框架** — strategy-cases 的 tags 沒有正確匹配到專屬框架。tags 需要加入 strategy type（成長股/景氣循環/權證/ETF）
2. **compounder 和 income 命中率很高** — 但樣本太少（4 個），需要更多案例
3. **高 confidence 規則全部命中** — 代表 confidence > 0.75 的規則確實有預測力
4. **balanced 框架的 57% 命中率偏低** — 代表「什麼都分析一點」不如「針對性分析」有效

## 建議

1. 給 strategy-cases 補 strategyType tag，讓更多案例走到正確框架
2. 把 balanced 框架的閾值提高 — 只有真的無法分類的才走 balanced
3. confidence < 0.65 的規則考慮降權或淘汰
4. 增加 compounder/income/event-driven 的歷史案例
