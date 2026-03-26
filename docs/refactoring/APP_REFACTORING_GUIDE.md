# App.jsx Refactoring Guide

**Last updated:** 2026-03-27  
**Status:** In progress - Phase 1 complete

## Overview

This document describes the ongoing refactoring of `App.jsx` (9520 lines) into a more maintainable modular structure.

## Goals

1. **Reduce App.jsx to ~500 lines** - Main orchestration only
2. **Improve maintainability** - Clear separation of concerns
3. **Enable testing** - Pure utility functions in isolated modules
4. **Preserve backward compatibility** - Re-export from utils.js

## New Directory Structure

```
src/
├── App.jsx                          # Main app (to be reduced)
├── main.jsx                         # Entry point
├── theme.js                         # Theme/colors
├── seedData.js                      # Seed data
├── constants.js                     # Constants and storage keys
├── utils.js                         # Legacy re-exports + storage helpers
│
├── hooks/
│   ├── usePortfolioManagement.js    # ✅ Existing - Portfolio management
│   ├── useCloudSync.js              # TODO - Cloud sync logic
│   ├── useMarketData.js             # TODO - Price sync, quotes
│   ├── useStrategyBrain.js          # TODO - Brain logic
│   └── useEvents.js                 # TODO - Event tracking
│
├── components/
│   ├── Header.jsx                   # ✅ Existing - Header
│   ├── Md.jsx                       # ✅ Existing - Markdown renderer
│   ├── Form.jsx                     # ✅ Existing - Form inputs
│   │
│   ├── common/                      # ✅ New - Common UI components
│   │   ├── Base.jsx                 # Card, MetricCard, Badge, Button, etc.
│   │   └── index.js
│   │
│   ├── holdings/                    # TODO - Holdings UI
│   │   ├── HoldingsTable.jsx
│   │   ├── HoldingRow.jsx
│   │   └── HoldingSummary.jsx
│   │
│   ├── watchlist/                   # TODO - Watchlist UI
│   │   ├── WatchlistPanel.jsx
│   │   └── RelayPlanCard.jsx
│   │
│   ├── events/                      # TODO - Events UI
│   │   ├── EventsPanel.jsx
│   │   ├── EventCard.jsx
│   │   └── EventForm.jsx
│   │
│   ├── reports/                     # TODO - Reports UI
│   │   ├── ReportsPanel.jsx
│   │   ├── DailyReportCard.jsx
│   │   └── AnalysisHistoryPanel.jsx
│   │
│   ├── brain/                       # TODO - Strategy Brain UI
│   │   ├── StrategyBrainPanel.jsx
│   │   ├── BrainRulesDisplay.jsx
│   │   ├── BrainChecklists.jsx
│   │   └── BrainValidationPanel.jsx
│   │
│   └── overview/                    # TODO - Overview UI
│       ├── OverviewPanel.jsx
│       └── PortfolioSummaryGrid.jsx
│
└── lib/                             # ✅ New - Utility modules
    ├── index.js                     # Centralized exports
    ├── holdings.js                  # ✅ Holdings calculations
    ├── brain.js                     # ✅ Strategy brain helpers
    ├── datetime.js                  # ✅ Date/time utilities
    ├── market.js                    # ✅ Market data utilities
    └── events.js                    # TODO - Event tracking helpers
```

## Completed Modules

### ✅ lib/holdings.js

All holdings-related calculations and normalizations:

- `resolveHoldingPrice()` - Price resolution with fallbacks
- `getHoldingCostBasis()` - Cost basis calculation
- `getHoldingMarketValue()` - Market value calculation
- `getHoldingUnrealizedPnl()` - P&L calculation
- `getHoldingReturnPct()` - Return percentage
- `normalizeHoldingMetrics()` - Normalize holding metrics
- `normalizeHoldingRow()` - Normalize single holding row
- `normalizeHoldings()` - Normalize multiple holdings
- `applyMarketQuotesToHoldings()` - Apply market quotes
- `applyTradeEntryToHoldings()` - Apply trade entry (buy/sell)
- `shouldAdoptCloudHoldings()` - Cloud vs local decision
- `buildHoldingPriceHints()` - Build price hints from history
- Aggregation helpers (getPortfolioValue, getPortfolioCost, etc.)
- Sorting helpers (sortHoldingsByPnl, sortHoldingsByReturn)
- Filtering helpers (getHoldingsWithAlerts, getHoldingsMissingPrices)

### ✅ lib/brain.js

Strategy brain normalization and lifecycle:

- Date helpers (parseFlexibleDate, daysSince, computeStaleness)
- Rule text extraction (brainRuleText, brainRuleKey)
- Staleness management (normalizeBrainRuleStaleness, deriveBrainRuleStaleness)
- Validation score (deriveBrainRuleValidationScore)
- Evidence references (normalizeBrainEvidenceRef, mergeBrainEvidenceRefs)
- Rule normalization (normalizeBrainRule)
- Checklist helpers (normalizeBrainChecklistStage, brainChecklistStageLabel)
- Analog case helpers (normalizeBrainAnalogCase, normalizeBrainAnalogCases)
- Rule formatting (brainRuleMetaParts, formatBrainRulesForPrompt)
- Sorting (compareBrainRulesByStrength)

### ✅ lib/datetime.js

Date and time utilities:

- `parseStoredDate()` - Parse stored date string
- `parseFlexibleDate()` - Flexible date parsing (multiple formats)
- `todayStorageDate()` - Get current date as ISO string
- `daysSince()` - Calculate days between dates
- `computeStaleness()` - Compute staleness based on age
- `getTaipeiClock()` - Get Taipei market clock
- `canRunPostClosePriceSync()` - Check if post-close sync can run
- Formatting functions (formatDateTW, formatDateMD, formatTime, formatDateTime, getRelativeTime)

### ✅ lib/market.js

Market data utilities:

- `createEmptyMarketPriceCache()` - Create empty cache
- `normalizeMarketPriceCache()` - Normalize cache from storage
- `normalizeMarketPriceSync()` - Normalize sync metadata
- `getCachedQuotesForCodes()` - Get cached quotes for codes
- `getPersistedMarketQuotes()` - Get persisted quotes from localStorage
- `getCurrentPrice()` - Get current price for a stock
- `getPriceChangePct()` - Calculate price change percentage
- `getPriceStatus()` - Get price status (up/down/flat)
- `fetchJsonWithTimeout()` - Fetch JSON with timeout

### ✅ components/common/Base.jsx

Common UI components:

- `Card` - Base card component with highlighting
- `MetricCard` - Metric display with label and value
- `Badge` - Badge component with colors and sizes
- `Button` - Button with variants (ghost/filled) and colors
- `SectionHeader` - Section header with title, description, action
- `EmptyState` - Empty state with icon, title, description, action

### ✅ utils.js (Updated)

Now serves as:
1. Re-export hub for backward compatibility
2. Storage helpers (load, save, pfKey, etc.)
3. Portfolio-specific utilities (createDefaultPortfolios, clonePortfolioNotes)
4. Analysis history normalization
5. Brain audit normalization

## Import Examples

### New way (recommended)

```javascript
// Import from specific lib modules
import { 
  normalizeHoldings, 
  getHoldingMarketValue,
  resolveHoldingPrice 
} from "./lib/holdings.js";

import {
  normalizeBrainRule,
  brainRuleText,
  deriveBrainRuleValidationScore
} from "./lib/brain.js";

import {
  getTaipeiClock,
  formatDateTW,
  parseFlexibleDate
} from "./lib/datetime.js";

// Import common UI components
import { Card, Button, Badge, MetricCard } from "./components/common";
```

### Legacy way (still works)

```javascript
// Re-exported from utils.js for backward compatibility
import {
  normalizeHoldings,
  getHoldingMarketValue,
  getTaipeiClock,
  // ... etc
} from "./utils.js";
```

## Next Steps

### Phase 2: Extract Hooks (Priority: High)

1. **useCloudSync.js** - Extract cloud sync logic from App.jsx
   - Cloud save/load
   - Sync state management
   - Owner-only gate

2. **useMarketData.js** - Extract market data logic
   - Price sync
   - Quote management
   - Cache handling

3. **useStrategyBrain.js** - Extract strategy brain logic
   - Brain state management
   - Rule lifecycle
   - Validation casebook

4. **useEvents.js** - Extract event tracking logic
   - Event CRUD
   - Status transitions (pending → tracking → closed)
   - Review workflow

### Phase 3: Extract UI Components (Priority: Medium)

1. **Holdings components** - Extract from App.jsx holdings tab
2. **Watchlist components** - Extract watchlist and relay plan UI
3. **Events components** - Extract events panel UI
4. **Reports components** - Extract reports and analysis history UI
5. **Brain components** - Extract strategy brain UI
6. **Overview components** - Extract overview panel UI

### Phase 4: Final Cleanup (Priority: Low)

1. Remove duplicate code in App.jsx
2. Update all imports to use new modules
3. Reduce App.jsx to main orchestration only
4. Add unit tests for lib modules
5. Update documentation

## Migration Guidelines

### When extracting new modules:

1. **Keep functions pure** - No side effects, easy to test
2. **Use JSDoc comments** - Document purpose and parameters
3. **Group related functions** - By domain (holdings, brain, events, etc.)
4. **Export from index.js** - Centralize exports for easy imports
5. **Maintain backward compatibility** - Re-export from utils.js

### When creating new components:

1. **Single responsibility** - One component, one purpose
2. **Props interface** - Clear props with PropTypes or TypeScript
3. **Theme integration** - Use theme.js colors
4. **Responsive design** - Mobile-friendly where applicable
5. **Accessibility** - Proper ARIA labels and roles

## Build Status

⚠️ **Current build error:** Pre-existing duplicate variable declarations in App.jsx (line 4105)

This error is unrelated to the refactoring work. It needs to be fixed in App.jsx directly.

## Files Changed

### Created
- `src/components/common/Base.jsx`
- `src/components/common/index.js`
- `src/components/holdings/` (directory)
- `src/components/watchlist/` (directory)
- `src/components/events/` (directory)
- `src/components/reports/` (directory)
- `src/components/brain/` (directory)
- `src/components/overview/` (directory)
- `src/lib/index.js`
- `src/lib/holdings.js`
- `src/lib/brain.js`
- `src/lib/datetime.js`
- `src/lib/market.js`

### Modified
- `src/utils.js` - Now re-exports from lib modules

### Unchanged (for now)
- `src/App.jsx` - Still 9520 lines, to be reduced in later phases
- `src/hooks/usePortfolioManagement.js` - Already extracted

## Testing Strategy

Once modules are fully extracted:

1. **Unit tests for lib modules** - Test pure functions
2. **Component tests** - Test UI components in isolation
3. **Integration tests** - Test hook interactions
4. **E2E tests** - Test full user flows

## Benefits

### Before (single App.jsx)
- ❌ 9520 lines, hard to navigate
- ❌ Mixed concerns (UI, logic, utilities)
- ❌ Difficult to test
- ❌ Hard to onboard new developers
- ❌ High risk of merge conflicts

### After (modular structure)
- ✅ Clear separation of concerns
- ✅ Easy to find and modify code
- ✅ Testable pure functions
- ✅ Better onboarding experience
- ✅ Reduced merge conflicts
- ✅ Scalable for future features

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project overview
- [QWEN.md](../../QWEN.md) - Qwen Code guidelines
- [docs/superpowers/specs/2026-03-24-holding-dossier-and-refresh-architecture.md](../../docs/superpowers/specs/2026-03-24-holding-dossier-and-refresh-architecture.md)

## Contact

For questions about this refactoring:
- Review the completed modules in `src/lib/`
- Check import examples above
- Refer to this guide for migration patterns
