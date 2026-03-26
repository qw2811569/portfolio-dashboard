/**
 * Trade Log Page
 * 
 * View trade history and logs
 */

import { createElement as h } from 'react';
import { LogPanel } from '../components/log/index.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';

export function LogPage() {
  // Get trade log from holdings store (or separate store)
  const tradeLog = useHoldingsStore(state => state.tradeLog) || [];
  
  return h(LogPanel, {
    tradeLog,
  });
}
