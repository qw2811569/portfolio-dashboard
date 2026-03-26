# Phase 2: Hooks Extraction - Complete

**Date:** 2026-03-27  
**Status:** ✅ Complete

## Overview

Phase 2 focused on extracting all major state management logic from App.jsx into reusable, testable custom React hooks. This reduces App.jsx complexity and improves code organization.

## Extracted Hooks

### 1. usePortfolioManagement.js ✅
**Status:** Already existed, updated and moved to `hooks/`

**Purpose:** Portfolio CRUD operations, switching, overview mode

**Features:**
- Portfolio creation, renaming, deletion
- Portfolio switching with state persistence
- Overview mode (read-only all portfolios)
- Portfolio summaries with metrics

**Lines:** 280

---

### 2. useCloudSync.js ✅
**Status:** Newly created

**Purpose:** Cloud synchronization state and operations

**Features:**
- Cloud sync state management (owner-only gate)
- Debounced cloud save scheduling
- Analysis sync from/to cloud
- Research sync from/to cloud
- Cloud delete operations

**API Endpoints Used:**
- `POST /api/brain` (action: get-analysis-history)
- `POST /api/brain` (action: get-research-history)
- `POST /api/brain` (action: delete-analysis)
- `POST /api/brain` (action: analysis)
- `POST /api/brain` (action: research)

**Lines:** 230

---

### 3. useMarketData.js ✅
**Status:** Newly created

**Purpose:** Market price cache, TWSE sync, price updates

**Features:**
- Market price cache management
- Post-close price sync (13:35 TW time)
- Batch TWSE API calls (15 stocks/batch)
- Price status tracking (success/partial/failed)
- Manual refresh with force retry

**API Endpoints Used:**
- `GET /api/twse?ex_ch={codes}`

**State:**
- `marketPriceCache` - Price data with timestamps
- `marketPriceSync` - Sync metadata
- `refreshing` - Loading state

**Derived:**
- `priceSyncStatusLabel` - Human-readable status
- `priceSyncStatusTone` - Color-coded status
- `activePriceSyncAt` - Last sync time
- `lastUpdate` - Last successful update

**Lines:** 350

---

### 4. useStrategyBrain.js ✅
**Status:** Newly created

**Purpose:** Strategy brain state, validation casebook, audit buckets

**Features:**
- Strategy brain state management
- Brain validation casebook
- Brain audit buckets (validated/stale/invalidated)
- Rule lifecycle management
- Cloud sync for brain data

**State:**
- `strategyBrain` - Main brain state with rules
- `brainValidation` - Validation casebook
- `brainAudit` - Audit buckets

**Derived:**
- `brainRulesByStatus` - Rules grouped by status
- `validationStats` - Case statistics
- `auditStats` - Audit bucket counts

**Operations:**
- `updateStrategyBrain` - Update brain state
- `updateBrainValidation` - Update casebook
- `addValidationCase` - Add new case
- `updateBrainAudit` - Update audit buckets
- `mergeBrainAudit` - Merge with lifecycle
- `ensureAuditCoverage` - Ensure full coverage
- `attachEvidenceRefs` - Add evidence references
- `syncBrainFromCloud` - Fetch from cloud
- `saveBrainToCloud` - Save to cloud

**Lines:** 280

---

### 5. useEvents.js ✅
**Status:** Newly created

**Purpose:** Event tracking, status transitions, CRUD

**Features:**
- Event CRUD operations
- Status transitions (pending → tracking → closed)
- Event review workflow
- Calendar state
- Urgent event tracking

**State:**
- `newsEvents` - All events
- `reviewingEvent` - Currently reviewing
- `reviewForm` - Review form data
- `showAddEvent` - Add event modal
- `newEvent` - New event draft
- `calendarMonth` - Calendar state
- `showCalendar` - Calendar visibility
- `reversalConditions` - Reversal state

**Derived:**
- `eventsByStatus` - Events grouped by status
- `urgentCount` - Today's urgent events
- `todayAlertSummary` - Today's summary

**Operations:**
- `addEvent` - Create new event
- `updateEvent` - Update existing
- `deleteEvent` - Remove event
- `transitionEvent` - Change status
- `startReview` - Begin review
- `submitReview` - Complete review
- `cancelReview` - Cancel review

**Lines:** 260

---

### 6. useHoldings.js ✅
**Status:** Newly created

**Purpose:** Holdings management, calculations, watchlist

**Features:**
- Holdings CRUD operations
- Trade entry application
- Target price management
- Alert management
- Portfolio metrics calculation
- Sorting and filtering

**State:**
- `holdings` - Main holdings array
- `watchlist` - Watchlist
- `targets` - Target prices
- `fundamentals` - Fundamental data
- `analystReports` - Analyst reports
- `holdingDossiers` - Holding dossiers
- `reversalConditions` - Reversal conditions

**Derived:**
- `holdingsSummary` - Total value/cost/pnl/ret
- `topGainers` - Top 5 gainers
- `topLosers` - Top 5 losers
- `holdingsWithAlerts` - Holdings with alerts
- `holdingsMissingPrices` - Holdings needing prices
- `holdingsByPnl` - Sorted by P&L

**Operations:**
- `upsertHolding` - Add/update holding
- `removeHolding` - Remove holding
- `applyTrade` - Apply trade entry
- `updateTargetPrice` - Set target
- `updateAlert` - Set alert
- `refreshPrices` - Update with new quotes
- `getHolding` - Get by code

**Lines:** 240

---

### 7. useReports.js ✅
**Status:** Newly created

**Purpose:** Daily reports, analysis history, refresh queue

**Features:**
- Analysis history management
- Daily report state
- Report refresh queue
- Expansion state management

**State:**
- `analysisHistory` - Historical analyses
- `dailyReport` - Current daily report
- `dailyExpanded` - Daily report expanded
- `expandedNews` - Expanded news IDs
- `reportRefreshing` - Refresh loading
- `reportRefreshMeta` - Refresh metadata

**Derived:**
- `latestAnalysis` - Most recent analysis
- `analysisCount` - Total analyses
- `reportRefreshQueue` - Current queue
- `reportRefreshLimitStatus` - Daily limit status

**Operations:**
- `addAnalysis` - Add to history
- `deleteAnalysis` - Remove from history
- `toggleNewsExpansion` - Toggle news
- `clearExpandedNews` - Clear all
- `getAnalysisByDate` - Get by date
- `getAnalysisById` - Get by ID

**Lines:** 200

---

## Summary Statistics

| Hook | Lines | State Variables | Operations | Dependencies |
|------|-------|----------------|------------|--------------|
| usePortfolioManagement | 280 | 6 | 8 | constants, utils |
| useCloudSync | 230 | 2 | 9 | constants, utils |
| useMarketData | 350 | 4 | 5 | constants, utils, lib/* |
| useStrategyBrain | 280 | 3 | 9 | constants, utils, lib/* |
| useEvents | 260 | 8 | 7 | constants, lib/events |
| useHoldings | 240 | 7 | 7 | lib/holdings |
| useReports | 200 | 6 | 6 | utils |
| **Total** | **1,840** | **36** | **51** | - |

---

## Benefits

### Before (All in App.jsx)
- ❌ ~6,000 lines of state management logic
- ❌ Difficult to test individual features
- ❌ Tight coupling between features
- ❌ Hard to understand state flow
- ❌ Merge conflicts in large file

### After (Modular Hooks)
- ✅ ~1,840 lines in 7 focused hooks
- ✅ Each hook is independently testable
- ✅ Clear separation of concerns
- ✅ Easy to understand state flow
- ✅ Reduced merge conflicts

---

## Import Guide

### Import Individual Hooks

```javascript
import { usePortfolioManagement } from "./hooks/usePortfolioManagement.js";
import { useCloudSync } from "./hooks/useCloudSync.js";
import { useMarketData } from "./hooks/useMarketData.js";
import { useStrategyBrain } from "./hooks/useStrategyBrain.js";
import { useEvents } from "./hooks/useEvents.js";
import { useHoldings } from "./hooks/useHoldings.js";
import { useReports } from "./hooks/useReports.js";
```

### Import All Hooks

```javascript
import {
  usePortfolioManagement,
  useCloudSync,
  useMarketData,
  useStrategyBrain,
  useEvents,
  useHoldings,
  useReports,
} from "./hooks/index.js";
```

---

## Usage Example in App.jsx

```javascript
// Portfolio management
const {
  portfolios,
  activePortfolioId,
  viewMode,
  portfolioSummaries,
  switchPortfolio,
  createPortfolio,
  // ...
} = usePortfolioManagement({
  ready,
  initialPortfolios,
  initialActivePortfolioId,
  initialViewMode,
  activeHoldings: holdings,
  activeNewsEvents: newsEvents,
  activePortfolioNotes: portfolioNotes,
  marketPriceCache,
  flushCurrentPortfolio,
  resetTransientUiState,
  loadPortfolio,
  setSaved,
});

// Cloud sync
const {
  cloudSync,
  canUseCloud,
  scheduleCloudSave,
  syncAnalysisFromCloud,
  // ...
} = useCloudSync({
  activePortfolioId,
  viewMode,
  setSaved,
});

// Market data
const {
  marketPriceCache,
  marketPriceSync,
  refreshing,
  refreshPrices,
  // ...
} = useMarketData({
  activePortfolioId,
  viewMode,
  holdings,
  watchlist,
  newsEvents,
  portfolios,
  setHoldings,
  setSaved,
  setLastUpdate,
});

// Strategy brain
const {
  strategyBrain,
  brainValidation,
  brainAudit,
  updateStrategyBrain,
  // ...
} = useStrategyBrain({
  activePortfolioId,
  viewMode,
  canUseCloud,
  setSaved,
});

// Events
const {
  newsEvents,
  reviewingEvent,
  eventsByStatus,
  urgentCount,
  addEvent,
  transitionEvent,
  // ...
} = useEvents({
  activePortfolioId,
  viewMode,
  initialEvents: loadedNewsEvents,
});

// Holdings
const {
  holdings,
  holdingsSummary,
  topGainers,
  applyTrade,
  updateTargetPrice,
  // ...
} = useHoldings({
  initialHoldings: loadedHoldings,
  marketQuotes: marketPriceCache?.prices,
});

// Reports
const {
  analysisHistory,
  dailyReport,
  dailyExpanded,
  addAnalysis,
  deleteAnalysis,
  // ...
} = useReports({
  initialAnalysisHistory: loadedAnalysisHistory,
  initialDailyReport: loadedDailyReport,
});
```

---

## Next Steps

### Phase 3: UI Components Extraction

Now that hooks are extracted, the next phase is to extract UI components:

1. **Holdings UI** (~800 lines)
   - HoldingsPanel
   - HoldingsTable
   - HoldingRow
   - HoldingDetail
   - HoldingSummary

2. **Watchlist UI** (~300 lines)
   - WatchlistPanel
   - WatchlistRow
   - RelayPlanCard

3. **Events UI** (~600 lines)
   - EventsPanel
   - EventCard
   - EventForm
   - EventReviewModal

4. **Reports UI** (~400 lines)
   - ReportsPanel
   - DailyReportCard
   - AnalysisHistoryList

5. **Brain UI** (~500 lines)
   - StrategyBrainPanel
   - BrainRulesDisplay
   - BrainChecklists
   - BrainValidationPanel

6. **Overview UI** (~300 lines)
   - OverviewPanel
   - PortfolioSummaryGrid

**Estimated Total:** ~2,900 lines

---

## Testing Strategy

Each hook can now be tested independently:

```javascript
// Example: useHoldings.test.js
import { renderHook, act } from '@testing-library/react';
import { useHoldings } from './hooks/useHoldings.js';

test('should add holding', () => {
  const { result } = renderHook(() => useHoldings({ initialHoldings: [] }));
  
  act(() => {
    result.current.upsertHolding({
      code: '2330',
      name: '台積電',
      qty: 1000,
      cost: 500,
    });
  });
  
  expect(result.current.holdings.length).toBe(1);
  expect(result.current.holdings[0].code).toBe('2330');
});

test('should calculate portfolio metrics', () => {
  const { result } = renderHook(() => useHoldings({
    initialHoldings: [
      { code: '2330', qty: 1000, cost: 500, price: 600 },
    ]
  }));
  
  expect(result.current.holdingsSummary.totalValue).toBe(600000);
  expect(result.current.holdingsSummary.totalPnl).toBe(100000);
  expect(result.current.holdingsSummary.totalRetPct).toBe(20);
});
```

---

## Migration Notes

### Breaking Changes

None - the hooks are designed to be backward compatible with existing App.jsx state.

### Deprecations

The following patterns in App.jsx are now deprecated:

1. **Direct state management** - Use hooks instead
2. **Inline calculations** - Use derived values from hooks
3. **Direct API calls** - Use hook operations

### Migration Path

1. Import the relevant hook
2. Replace state declarations with hook calls
3. Replace setState calls with hook operations
4. Replace inline calculations with derived values

---

## Conclusion

Phase 2 successfully extracted ~1,840 lines of state management logic into 7 focused, testable hooks. This sets the foundation for Phase 3 (UI component extraction) and Phase 4 (final cleanup).

**App.jsx Reduction:**
- Before: ~9,518 lines
- After Phase 2: Still ~9,518 lines (hooks created but not integrated)
- After Phase 3 (target): ~6,500 lines
- After Phase 4 (target): ~500 lines
