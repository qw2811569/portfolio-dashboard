/**
 * Holdings Page
 * 
 * Main holdings view for a portfolio
 */

import { createElement as h } from 'react';
import { HoldingsPanel, HoldingsTable } from '../components/holdings/index.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';
import { useMarketDataStore } from '../stores/marketStore.js';
import { usePortfolioStore } from '../stores/portfolioStore.js';
import { useEventStore } from '../stores/eventStore.js';
import { useBrainStore } from '../stores/brainStore.js';

export function HoldingsPage() {
  // Get state from stores
  const holdings = useHoldingsStore(state => state.holdings);
  const setHoldings = useHoldingsStore(state => state.setHoldings);
  const updateTargetPrice = useHoldingsStore(state => state.updateTargetPrice);
  const updateAlert = useHoldingsStore(state => state.updateAlert);
  const updateReversal = useHoldingsStore(state => state.updateReversal);
  
  const scanQuery = useHoldingsStore(state => state.scanQuery);
  const setScanQuery = useHoldingsStore(state => state.setScanQuery);
  const scanFilter = useHoldingsStore(state => state.scanFilter);
  const setScanFilter = useHoldingsStore(state => state.setScanFilter);
  const sortBy = useHoldingsStore(state => state.sortBy);
  const setSortBy = useHoldingsStore(state => state.setSortBy);
  const showReversal = useHoldingsStore(state => state.showReversal);
  const setShowReversal = useHoldingsStore(state => state.setShowReversal);
  const reversalConditions = useHoldingsStore(state => state.reversalConditions);
  const attentionCount = useHoldingsStore(state => state.attentionCount);
  const pendingCount = useHoldingsStore(state => state.pendingCount);
  const targetUpdateCount = useHoldingsStore(state => state.targetUpdateCount);
  
  const expandedStock = useBrainStore(state => state.expandedStock);
  const setExpandedStock = useBrainStore(state => state.setExpandedStock);
  
  const reviewingEvent = useEventStore(state => state.reviewingEvent);
  const setReviewingEvent = useEventStore(state => state.setReviewingEvent);
  
  const marketQuotes = useMarketDataStore(state => state.marketPriceCache?.prices);
  
  // Calculate derived state
  const totalVal = holdings.reduce((sum, h) => sum + (h.value || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.cost || 0) * (h.qty || 0), 0);
  
  const winners = holdings.filter(h => (h.pct || 0) > 0).sort((a, b) => (b.pct || 0) - (a.pct || 0));
  const losers = holdings.filter(h => (h.pct || 0) < 0).sort((a, b) => (a.pct || 0) - (b.pct || 0));
  const top5 = holdings.sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);
  
  const holdingsIntegrityIssues = holdings.filter(h => h.integrityIssue === 'missing-price');
  
  // Filter and sort holdings
  const filteredRows = holdings.filter(h => {
    if (scanFilter === '全部') return true;
    if (scanFilter === '需處理') return h.alert || h.integrityIssue;
    if (scanFilter === '待處理') return false; // TODO: Implement pending logic
    if (scanFilter === '目標更新') return false; // TODO: Implement target update logic
    if (scanFilter === '虧損') return (h.pct || 0) < 0;
    if (scanFilter === '權證') return h.type === '權證';
    return true;
  });
  
  const displayed = filteredRows
    .filter(h => {
      if (!scanQuery) return true;
      const query = scanQuery.toLowerCase();
      return h.name.toLowerCase().includes(query) || 
             h.code.toLowerCase().includes(query) ||
             (h.type && h.type.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'value':
          aVal = a.value || 0;
          bVal = b.value || 0;
          break;
        case 'pnl':
          aVal = a.pnl || 0;
          bVal = b.pnl || 0;
          break;
        case 'pct':
          aVal = a.pct || 0;
          bVal = b.pct || 0;
          break;
        default:
          aVal = a.code;
          bVal = b.code;
      }
      return bVal - aVal;
    })
    .map(h => ({
      h,
      meta: null, // TODO: Get from STOCK_META
      T: null, // TODO: Get target reports
      relatedEvents: [], // TODO: Get related events
      hasPending: false,
      needsAttention: h.alert || h.integrityIssue,
      priority: 0,
    }));
  
  return h(HoldingsPanel, {
    holdings,
    totalVal,
    totalCost,
    winners,
    losers,
    top5,
    holdingsIntegrityIssues,
    showReversal,
    setShowReversal,
    reversalConditions,
    reviewingEvent,
    setReviewingEvent,
    updateReversal,
    attentionCount,
    pendingCount,
    targetUpdateCount,
    scanQuery,
    setScanQuery,
    scanFilter,
    setScanFilter,
    sortBy,
    setSortBy,
    expandedStock,
    setExpandedStock,
  }, h(HoldingsTable, {
    holdings,
    expandedStock,
    setExpandedStock,
    onUpdateTarget: updateTargetPrice,
    onUpdateAlert: updateAlert,
  }));
}
