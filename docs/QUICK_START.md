# 快速參考指南

給接手 AI 與開發者的 1 分鐘版本

---

## 30 秒上手

```bash
npm install
vercel dev
npm run verify:local
```

若只是快速重驗前端白頁：

```bash
npm run smoke:ui
```

---

## 檔案結構（快速版）

```
src/
├── App.jsx              # 主 orchestrator (~5,062 行)
├── hooks/               # runtime / state lifecycle
├── components/          # UI 元件 (12 個群組)
├── lib/                 # 純邏輯與 brain runtime
└── utils.js             # 向後相容
```

目前最重要的 runtime hooks：

- `usePortfolioManagement`
- `usePortfolioDerivedData`
- `usePortfolioBootstrap`
- `usePortfolioPersistence`

---

## 快速查找

| 要找什麼                    | 去哪裡                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| 持股計算                    | `lib/holdings.js`                                                     |
| typed holding math baseline | `lib/holdingMath.ts`                                                  |
| 事件邏輯                    | `lib/events.js` + `hooks/useEvents.js`                                |
| 策略大腦                    | `lib/brain.js` + `hooks/useStrategyBrain.js`                          |
| UI 元件                     | `components/{feature}/`                                               |
| 狀態管理                    | `hooks/`                                                              |
| API 調用                    | `api/`                                                                |
| boot / hydrate / cloud sync | `hooks/usePortfolioBootstrap.js` + `hooks/usePortfolioPersistence.js` |

---

## 修改原則

- 優先改 `lib/*`、`hooks/*`、`components/*`
- 只有跨 tab orchestration、使用者流程接線、最終 panel 組裝才優先改 `App.jsx`
- 完整本地模式只認 `vercel dev`

```javascript
// 優先在 lib/hooks 落邏輯

// lib/holdings.js
export function getHoldingMarketValue(item, overridePrice = null) {
  // 修改這裡
}
```

---

## 驗證清單

修改後必須：

- [ ] `npm run verify:local` 通過
- [ ] 若只做小修，至少 `npm run smoke:ui` 通過
- [ ] 若動到 typed module / ts baseline，補看 `npm run typecheck`

---

## 完整文檔

詳細說明請閱讀：

- `docs/AI_COLLABORATION_GUIDE.md` - canonical 協作與驗證規則
- `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md` - 產品與資料流共識

---

最後更新：2026-03-27
