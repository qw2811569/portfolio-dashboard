# Phase 3: UI Components Extraction - Status Report

**Date:** 2026-03-27  
**Status:** 🔄 In Progress (Started)

## Overview

Phase 3 focuses on extracting UI components from App.jsx into reusable, maintainable React components organized by feature domain.

## Completed Components

### ✅ Holdings Components

#### 1. HoldingsPanel.jsx
**Lines:** ~280  
**Purpose:** Main holdings view with summary metrics and health check

**Sub-components:**
- `HoldingsSummary` - Total cost, market value, count metrics
- `HoldingsIntegrityWarning` - Missing price warnings
- `PortfolioHealthCheck` - Industry/strategy/period distribution
- `Top5Holdings` - Top 5 holdings by market value
- `WinLossSummary` - Winners and losers summary

**Features:**
- Industry distribution bar chart
- Strategy framework breakdown
- Holding period analysis
- Position sizing analysis
- Industry concentration warnings
- Top 5 market value占比
- Win/loss summaries

#### 2. HoldingsTable.jsx
**Lines:** ~200  
**Purpose:** Holdings table with expandable rows

**Sub-components:**
- `HoldingRow` - Single holding row with expandable details
- `HoldingsTable` - Full table with sorting

**Features:**
- Expandable row details
- Target price editing
- Alert editing
- Sorting by code/value/pnl/pct
- Empty state handling

#### 3. index.js
**Purpose:** Centralized exports

---

## Remaining Components to Extract

### 🔴 Watchlist Components (~300 lines)

**Files to create:**
```
src/components/watchlist/
├── WatchlistPanel.jsx      # Main watchlist view
├── WatchlistRow.jsx        # Single watchlist item
├── RelayPlanCard.jsx       # Relay plan summary
└── index.js
```

**Key features:**
- Watchlist table with price/target
- Relay plan (接力計畫) display
- Status indicators (scKey colors)
- Catalyst display
- Note editing

---

### 🔴 Events Components (~600 lines)

**Files to create:**
```
src/components/events/
├── EventsPanel.jsx         # Main events view
├── EventCard.jsx           # Single event card
├── EventForm.jsx           # Add/edit event form
├── EventReviewModal.jsx    # Review dialog
├── CalendarView.jsx        # Month calendar
└── index.js
```

**Key features:**
- Event status badges (pending/tracking/closed)
- Event CRUD operations
- Status transitions
- Review workflow with actual vs pred
- Calendar view with event markers
- Multi-stock event handling
- Stock outcomes display

---

### 🔴 Reports Components (~400 lines)

**Files to create:**
```
src/components/reports/
├── ReportsPanel.jsx        # Main reports view
├── DailyReportCard.jsx     # Daily report display
├── AnalysisHistoryList.jsx # History list
├── ReportRefreshMeta.jsx   # Refresh queue display
└── index.js
```

**Key features:**
- Daily report display with sections
- Analysis history timeline
- Report expansion/collapse
- News expansion
- Refresh queue status
- Delete confirmation

---

### 🔴 Brain Components (~500 lines)

**Files to create:**
```
src/components/brain/
├── StrategyBrainPanel.jsx  # Main brain view
├── BrainRulesDisplay.jsx   # Rules list with status
├── BrainChecklists.jsx     # Checklists display
├── BrainValidationPanel.jsx # Validation casebook
├── BrainRuleEditor.jsx     # Rule editor
└── index.js
```

**Key features:**
- Rules by status (active/candidate/archived)
- Validation score display
- Staleness indicators
- Evidence references
- Historical analogs
- Checklist management
- Rule lifecycle visualization

---

### 🔴 Overview Components (~300 lines)

**Files to create:**
```
src/components/overview/
├── OverviewPanel.jsx       # Main overview view
├── PortfolioSummaryGrid.jsx # Portfolio cards grid
└── index.js
```

**Key features:**
- Portfolio summaries grid
- Duplicate holdings display
- Pending items across portfolios
- Total metrics
- Quick switch buttons

---

## Component Architecture

### Design Principles

1. **Single Responsibility** - Each component does one thing well
2. **Composability** - Components can be nested and combined
3. **Controlled/Uncontrolled** - Support both patterns
4. **Accessibility** - Proper ARIA labels and roles
5. **Responsive** - Mobile-friendly layouts

### Common Props Pattern

```javascript
// Base component pattern
export function Component({
  // Data
  data,
  
  // State
  expanded = false,
  loading = false,
  error = null,
  
  // Callbacks
  onToggle = () => {},
  onUpdate = () => {},
  onDelete = () => {},
  
  // Styling
  className = "",
  style = {},
  
  // Children
  children,
}) {
  // Implementation
}
```

### Styling Convention

```javascript
// Use inline styles with theme colors
const card = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "12px 14px",
  boxShadow: `${C.insetLine}, ${C.shadow}`,
};

// Usage
h("div", { style: card }, children)
```

---

## Integration Guide

### Step 1: Import Components

```javascript
import { HoldingsPanel, HoldingsTable } from "./components/holdings";
import { WatchlistPanel } from "./components/watchlist";
import { EventsPanel } from "./components/events";
// ... etc
```

### Step 2: Replace Inline JSX

**Before:**
```javascript
{tab === "holdings" && (
  <div>
    {/* 300 lines of inline JSX */}
  </div>
)}
```

**After:**
```javascript
{tab === "holdings" && (
  <HoldingsPanel
    holdings={holdings}
    totalVal={totalVal}
    totalCost={totalCost}
    winners={winners}
    losers={losers}
  >
    <HoldingsTable
      holdings={holdings}
      expandedStock={expandedStock}
      setExpandedStock={setExpandedStock}
    />
  </HoldingsPanel>
)}
```

### Step 3: Remove Unused Code

After extraction, remove the original inline JSX from App.jsx.

---

## Migration Priority

### Week 1: Core Views
1. ✅ HoldingsPanel (Done)
2. ⏳ WatchlistPanel
3. ⏳ EventsPanel

### Week 2: Analysis Views
4. ⏳ ReportsPanel
5. ⏳ BrainPanel

### Week 3: Supporting Views
6. ⏳ OverviewPanel
7. ⏳ Common components refactoring

### Week 4: Final Cleanup
8. ⏳ App.jsx reduction
9. ⏳ Import updates
10. ⏳ Build verification

---

## Estimated Impact

### Before Extraction
- **App.jsx:** ~9,518 lines
- **UI components:** 0 lines (all inline)
- **Maintainability:** Low

### After Extraction (Target)
- **App.jsx:** ~6,500 lines (-3,000)
- **UI components:** ~3,000 lines
- **Maintainability:** High

### Benefits
- ✅ Easier to find and modify UI code
- ✅ Reusable components across views
- ✅ Independent testing of components
- ✅ Better code organization
- ✅ Reduced merge conflicts

---

## Testing Strategy

### Component Tests

```javascript
// HoldingsPanel.test.js
import { render, screen } from '@testing-library/react';
import { HoldingsPanel } from './HoldingsPanel';

test('renders summary metrics', () => {
  render(
    <HoldingsPanel
      holdings={[{ code: '2330', name: '台積電', qty: 1000, cost: 500, price: 600 }]}
      totalVal={600000}
      totalCost={500000}
    />
  );
  
  expect(screen.getByText('總市值')).toBeInTheDocument();
  expect(screen.getByText('600,000')).toBeInTheDocument();
});

test('shows integrity warning', () => {
  render(
    <HoldingsPanel
      holdings={[]}
      holdingsIntegrityIssues={[{ code: '2330', name: '台積電' }]}
    />
  );
  
  expect(screen.getByText(/偵測到 1 檔持股缺少可用價格/)).toBeInTheDocument();
});
```

---

## Current Blockers

None - extraction can proceed in parallel for different component groups.

---

## Next Actions

1. **Complete Watchlist components** (~300 lines)
2. **Complete Events components** (~600 lines)
3. **Complete Reports components** (~400 lines)
4. **Complete Brain components** (~500 lines)
5. **Complete Overview components** (~300 lines)
6. **Update App.jsx imports**
7. **Remove extracted code from App.jsx**
8. **Verify build**

---

## Conclusion

Phase 3 has started with the Holdings components extraction. The remaining work will reduce App.jsx by approximately 3,000 lines and create a well-organized component library for the application.

**Progress:** 2/6 component groups complete (33%)  
**Estimated completion:** 2-3 weeks
