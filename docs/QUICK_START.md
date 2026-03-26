# 快速參考指南

**給接手 AI 的快速上手指南**

---

## 🚀 30 秒上手

```bash
# 1. 安裝依賴
npm install

# 2. 本地開發
npm run dev

# 3. 構建驗證
npm run build  # 必須通過
```

---

## 📁 檔案結構（快速版）

```
src/
├── App.jsx              # 主應用 (6,944 行)
├── hooks/               # 業務邏輯 (7 個 hooks)
├── components/          # UI 元件 (12 個群組)
├── lib/                 # 工具函數 (5 個模組)
└── utils.js             # 向後相容
```

---

## 🔍 快速查找

| 要找什麼 | 去哪裡 |
|----------|--------|
| 持股計算 | `lib/holdings.js` |
| 事件邏輯 | `lib/events.js` + `hooks/useEvents.js` |
| 策略大腦 | `lib/brain.js` + `hooks/useStrategyBrain.js` |
| UI 元件 | `components/{feature}/` |
| 狀態管理 | `hooks/` |
| API 調用 | `api/` |

---

## 📝 修改範例

### 修改持股計算

```javascript
// ❌ 不要直接修改 App.jsx
// ✅ 修改 lib/holdings.js

// lib/holdings.js
export function getHoldingMarketValue(item, overridePrice = null) {
  // 修改這裡
}
```

### 新增功能

```javascript
// 1. 先在 lib/ 添加純函數
// lib/newFeature.js
export function calculateSomething(data) { }

// 2. 在 hooks/ 添加狀態管理
// hooks/useNewFeature.js
export const useNewFeature = () => {
  const [state, setState] = useState();
  // ...
};

// 3. 在 components/ 添加 UI
// components/newFeature/NewFeaturePanel.jsx
export function NewFeaturePanel({ data }) { }

// 4. 在 App.jsx 整合
```

---

## ✅ 驗證清單

修改後必須：
- [ ] `npm run build` 通過
- [ ] 手動測試相關功能
- [ ] 無 console errors

---

## 📚 完整文檔

詳細說明請閱讀：
- `docs/HANDBOOK_FOR_AI_AGENTS.md` - 完整架構文檔
- `CLAUDE.md` - 專案概述

---

**最後更新：** 2026-03-27
