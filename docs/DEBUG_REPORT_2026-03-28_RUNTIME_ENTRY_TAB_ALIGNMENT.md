# Runtime Entry And Tab Alignment Report

日期：2026-03-28  
狀態：完成

## 背景

使用者提出的優化方向本身是合理的，但 repo 當下處於「route shell 已寫、runtime 尚未真正搬完」的中間態。

實際檢查後發現：

- `src/main.jsx` 已被改成 render `src/App.routes.jsx`
- `src/App.routes.jsx` / `src/pages/*` 仍大量依賴 TODO、placeholder state、假 handler
- `src/App.jsx` 仍是唯一具備完整 runtime orchestration 的穩定入口
- `src/components/Header.jsx` 依賴 `TABS` prop，但 `src/App.jsx` 路徑當時未傳入，風險被 route shell 暫時遮住

## 這輪修補

### 1. 收回穩定 runtime 入口

- `src/main.jsx` 改回直接 render `src/App.jsx`
- 移除目前不該在主入口啟用的 `BrowserRouter`

### 2. 收斂 tabs 設定

- 新增 `src/lib/navigationTabs.js`
- 將持倉工作台 tabs 的 label 組裝統一為 `buildPortfolioTabs({ urgentCount, analyzing, researching })`
- `src/App.jsx` 改為使用共享 builder，避免 tab 定義散落
- `src/pages/PortfolioLayout.jsx` 也改用同一套 builder，讓 route scaffold 至少共用同一份 UI vocabulary

### 3. 降低 Header 接線脆弱度

- `src/components/Header.jsx` 現在對遺漏的 `TABS` 有安全 fallback，不再因單一路徑漏傳 props 直接炸掉
- `src/pages/PortfolioLayout.jsx` 移除對 `A` / `alpha` 的冗餘 props 傳遞；這兩者已由 `Header.jsx` 自行自 `theme.js` 匯入

## 結論

這輪沒有直接把 app 全量切到 route shell，原因不是抗拒重構，而是目前 `App.routes.jsx` 還不是 production-ready runtime。

目前正確共識是：

1. `src/main.jsx -> src/App.jsx` 仍是主入口
2. `src/App.routes.jsx` / `src/pages/*` 是後續遷移 scaffold，不是現在的 source of truth
3. 若要再往 route shell 推進，下一步應先把真實 state、derived data、handler 與 panel content 逐段搬進 layout / pages，而不是只切入口

## 驗證

本輪至少應驗證：

- `npm run lint`
- `npm run typecheck`
- `npm run check:fast-refresh`
- `npm run build`
