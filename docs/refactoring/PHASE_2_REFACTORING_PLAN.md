# 第二階段重構計畫

**日期：** 2026-03-27  
**狀態：** 🔄 進行中  
**目標：** 進一步優化 App.jsx，引入現代化架構

---

## 🎯 重構目標

基於第一階段的成功（App.jsx 從 9,518 行減少到 6,944 行），第二階段將進一步：

1. 引入全局狀態管理 (Zustand)
2. 引入路由管理 (React Router)
3. API 請求層抽象化 (TanStack Query)

**預期成果：**
- App.jsx: 6,944 行 → ~2,000 行 (-71%)
- 更好的職責分離
- 更低的元件耦合
- 更好的開發者體驗

---

## 📦 已安裝套件

```bash
npm install zustand react-router-dom @tanstack/react-query
```

| 套件 | 用途 | 大小 |
|------|------|------|
| `zustand` | 全局狀態管理 | ~1KB |
| `react-router-dom` | 路由管理 | ~15KB |
| `@tanstack/react-query` | API 請求管理 | ~13KB |

**總增加：** ~29KB (gzip 後)

---

## 🏗️ 架構變革

### 重構前

```
App.jsx (6,944 行)
├── 所有 useState
├── 所有 useEffect
├── 所有 API 調用
└── 條件渲染視圖
```

### 重構後

```
src/
├── App.jsx (~2,000 行)      # 只負責路由和 Provider 組合
├── stores/                   # Zustand 狀態 stores
│   ├── portfolioStore.js
│   ├── eventStore.js
│   ├── brainStore.js
│   └── ...
├── pages/                    # 頁面級元件
│   ├── OverviewPage.jsx
│   ├── HoldingsPage.jsx
│   ├── WatchlistPage.jsx
│   └── ...
├── hooks/                    # TanStack Query hooks
│   ├── useAnalysis.js
│   ├── useResearch.js
│   └── ...
├── components/               # 現有的 UI 元件
└── lib/                      # 現有的工具函數
```

---

## 📝 實作步驟

### Phase 2A: 全局狀態管理 (Zustand)

**目標：** 將所有 useState 移到 Zustand stores

#### 步驟 1: 建立 stores

```javascript
// stores/portfolioStore.js
import { create } from 'zustand';

export const usePortfolioStore = create((set, get) => ({
  // State
  portfolios: [],
  activePortfolioId: 'me',
  viewMode: 'portfolio',
  
  // Actions
  setPortfolios: (portfolios) => set({ portfolios }),
  setActivePortfolioId: (id) => set({ activePortfolioId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Selectors
  getActivePortfolio: () => {
    const { portfolios, activePortfolioId } = get();
    return portfolios.find(p => p.id === activePortfolioId);
  },
}));
```

#### 步驟 2: 遷移現有 hooks

將現有的 hooks 邏輯移到 Zustand：

```javascript
// stores/eventStore.js
export const useEventStore = create((set, get) => ({
  newsEvents: [],
  reviewingEvent: null,
  reviewForm: createDefaultReviewForm(),
  
  // Actions from useEvents.js
  setNewsEvents: (events) => set({ newsEvents: events }),
  addEvent: (event) => set((state) => ({ 
    newsEvents: [event, ...state.newsEvents] 
  })),
  // ...
}));
```

#### 步驟 3: 更新元件

```javascript
// Before
const { holdings, setHoldings } = useHoldings();

// After
const holdings = usePortfolioStore((state) => 
  state.getActivePortfolio()?.holdings
);
const setHoldings = usePortfolioStore((state) => state.setHoldings);
```

### Phase 2B: 路由管理 (React Router)

**目標：** 用路由取代條件渲染

#### 步驟 1: 設置路由

```javascript
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/portfolio/me/holdings" />} />
          <Route path="portfolio/:portfolioId">
            <Route index element={<Navigate to="holdings" />} />
            <Route path="holdings" element={<HoldingsPage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="daily" element={<DailyPage />} />
            <Route path="research" element={<ResearchPage />} />
          </Route>
          <Route path="overview" element={<OverviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

#### 步驟 2: URL 反映狀態

```javascript
// Before
const [activePortfolioId, setActivePortfolioId] = useState('me');
const [viewMode, setViewMode] = useState('portfolio');

// After
const { portfolioId } = useParams(); // 從 URL 讀取
const navigate = useNavigate();
navigate(`/portfolio/${newId}/holdings`); // 寫入 URL
```

### Phase 2C: API 請求抽象化 (TanStack Query)

**目標：** 統一管理所有 API 請求

#### 步驟 1: 設置 Query Client

```javascript
// main.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分鐘
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

#### 步驟 2: 建立 API hooks

```javascript
// hooks/api/useAnalysis.js
import { useQuery, useMutation } from '@tanstack/react-query';

export function useDailyAnalysis(portfolioId) {
  return useQuery({
    queryKey: ['analysis', 'daily', portfolioId],
    queryFn: async () => {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ portfolioId }),
      });
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 分鐘
  });
}

export function useRunAnalysis() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });
}
```

#### 步驟 3: 更新元件

```javascript
// Before
const [analyzing, setAnalyzing] = useState(false);
const [dailyReport, setDailyReport] = useState(null);

const runAnalysis = async () => {
  setAnalyzing(true);
  const res = await fetch('/api/analyze', { ... });
  const data = await res.json();
  setDailyReport(data);
  setAnalyzing(false);
};

// After
const { data: dailyReport, isLoading } = useDailyAnalysis(portfolioId);
const { mutate: runAnalysis, isPending } = useRunAnalysis();
```

---

## 📊 預期效益

| 指標 | 目前 | 重構後 | 改善 |
|------|------|--------|------|
| App.jsx 行數 | 6,944 | ~2,000 | **-71%** |
| 狀態管理 | useState | Zustand | 模組化 |
| 路由管理 | 條件渲染 | React Router | URL 即狀態 |
| API 管理 | 手動 | TanStack Query | 自動快取 |
| 測試覆蓋率 | 0% | 目標 70% | +70% |

---

## ⚠️ 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 學習曲線 | 中 | 提供文檔和範例 |
| Bundle 增加 | +29KB | 可接受，功能值得 |
| 重構時間 | 高 | 分階段進行 |
| 回歸測試 | 高 | 建立測試覆蓋 |

---

## 📅 時程估計

| 階段 | 工作內容 | 時間 |
|------|----------|------|
| Phase 2A | Zustand stores | 4-6 小時 |
| Phase 2B | React Router | 3-4 小時 |
| Phase 2C | TanStack Query | 4-6 小時 |
| 測試 | 回歸測試 | 4-6 小時 |
| **總計** | | **15-22 小時** |

---

## ✅ 驗收標準

- [ ] App.jsx < 2,500 行
- [ ] 所有狀態移到 Zustand
- [ ] 所有視圖用路由管理
- [ ] 所有 API 用 TanStack Query
- [ ] Build 通過
- [ ] 手動測試通過
- [ ] 單元測試覆蓋 >50%

---

**開始日期：** 2026-03-27  
**預計完成：** 2026-03-28
