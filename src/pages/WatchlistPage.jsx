/**
 * Watchlist Page
 * 
 * Watchlist and relay plan view
 */

import { createElement as h } from 'react';
import { WatchlistPanel } from '../components/watchlist/index.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';
import { useEventStore } from '../stores/eventStore.js';
import { useBrainStore } from '../stores/brainStore.js';

export function WatchlistPage() {
  // Get state from stores
  const watchlist = useHoldingsStore(state => state.watchlist);
  const setWatchlist = useHoldingsStore(state => state.setWatchlist);
  const upsertWatchlist = useHoldingsStore(state => state.upsertWatchlist);
  const removeWatchlist = useHoldingsStore(state => state.removeWatchlist);
  
  const expandedStock = useBrainStore(state => state.expandedStock);
  const setExpandedStock = useBrainStore(state => state.setExpandedStock);
  
  const newsEvents = useEventStore(state => state.newsEvents);
  
  // Calculate watchlist focus (first item or selected)
  const watchlistFocus = watchlist.length > 0 ? {
    item: watchlist[0],
    trackingCount: 0,
    relatedEvents: [],
    summary: watchlist[0]?.note || '',
    action: '',
    upside: null,
  } : null;
  
  // Map watchlist rows with related data
  const watchlistRows = watchlist.map((item, index) => ({
    item,
    index,
    relatedEvents: [], // TODO: Get related events
    hits: 0,
    misses: 0,
    pendingCount: 0,
    trackingCount: 0,
    upside: null,
  }));
  
  // Handlers
  const openWatchlistAddModal = () => {
    // TODO: Implement modal
    const code = prompt('輸入股票代碼：');
    const name = prompt('輸入股票名稱：');
    if (code && name) {
      upsertWatchlist({ code, name, price: 0, target: 0, status: '', catalyst: '', note: '', scKey: 'blue' });
    }
  };
  
  const openWatchlistEditModal = (item) => {
    // TODO: Implement modal
    const note = prompt('編輯備註：', item.note);
    if (note !== null) {
      upsertWatchlist({ ...item, note });
    }
  };
  
  const handleWatchlistDelete = (code) => {
    removeWatchlist(code);
  };
  
  const formatEventStockOutcomeLine = (outcome) => {
    if (!outcome) return '';
    return `${outcome.name || outcome.code}: ${outcome.note || ''}`;
  };
  
  return h(WatchlistPanel, {
    watchlistFocus,
    watchlistRows,
    expandedStock,
    setExpandedStock,
    openWatchlistAddModal,
    openWatchlistEditModal,
    handleWatchlistDelete,
    formatEventStockOutcomeLine,
  });
}
