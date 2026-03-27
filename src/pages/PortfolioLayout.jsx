/**
 * Portfolio Layout
 * 
 * Layout component for portfolio pages with header and navigation
 */

import { createElement as h } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { usePortfolioStore } from '../stores/portfolioStore.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';
import { useMarketDataStore } from '../stores/marketStore.js';
import { C, A, alpha } from '../theme.js';

const TABS = [
  { k: 'holdings', label: '持倉' },
  { k: 'watchlist', label: '觀察股' },
  { k: 'events', label: '行事曆' },
  { k: 'news', label: '事件分析' },
  { k: 'daily', label: '收盤分析' },
  { k: 'research', label: '深度研究' },
  { k: 'trade', label: '上傳成交' },
  { k: 'log', label: '交易日誌' },
];

export function PortfolioLayout() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  
  // Get state from stores
  const activePortfolioId = usePortfolioStore(state => state.activePortfolioId);
  const viewMode = usePortfolioStore(state => state.viewMode);
  const portfolioSummaries = usePortfolioStore(state => state.portfolios.map(p => ({
    ...p,
    holdingCount: 0, // TODO: Calculate
    totalValue: 0, // TODO: Calculate
    totalPnl: 0, // TODO: Calculate
    retPct: 0, // TODO: Calculate
  })));
  const cloudSync = false; // TODO: Get from cloud sync store
  const saved = '';
  const refreshing = useMarketDataStore(state => state.refreshing);
  const lastUpdate = useMarketDataStore(state => state.lastUpdate);
  const marketPriceSync = useMarketDataStore(state => state.marketPriceSync);
  
  // Calculate derived state
  const displayedTotalPnl = 0; // TODO: Calculate
  const displayedRetPct = 0; // TODO: Calculate
  const urgentCount = 0; // TODO: Calculate
  const todayAlertSummary = '無事件'; // TODO: Calculate
  
  // Handlers
  const refreshPrices = () => {
    // TODO: Implement
  };
  
  const copyWeeklyReport = () => {
    // TODO: Implement
  };
  
  const exportLocalBackup = () => {
    // TODO: Implement
  };
  
  const importLocalBackup = (e) => {
    // TODO: Implement
  };
  
  const createPortfolio = () => {
    // TODO: Implement
  };
  
  const switchPortfolio = (pid) => {
    // TODO: Implement
  };
  
  const openOverview = () => {
    navigate('/overview');
  };
  
  const exitOverview = () => {
    navigate(`/portfolio/${portfolioId || 'me'}/holdings`);
  };
  
  const showPortfolioManager = usePortfolioStore(state => state.showPortfolioManager);
  const setShowPortfolioManager = usePortfolioStore(state => state.setShowPortfolioManager);
  const renamePortfolio = () => {}; // TODO: Implement
  const deletePortfolio = () => {}; // TODO: Implement
  
  const portfolioNotes = {}; // TODO: Get from store
  const setPortfolioNotes = () => {}; // TODO: Implement
  
  const overviewTotalValue = 0; // TODO: Calculate
  
  const tab = 'holdings'; // TODO: Get from URL
  const setTab = (newTab) => {
    navigate(`/portfolio/${portfolioId || 'me'}/${newTab}`);
  };
  
  return h('div', { style: { minHeight: '100vh' } },
    h(Header, {
      C,
      A,
      alpha,
      cloudSync,
      saved,
      refreshPrices,
      refreshing,
      copyWeeklyReport,
      exportLocalBackup,
      backupFileInputRef: { current: null },
      importLocalBackup,
      priceSyncStatusTone: '#888', // TODO: Calculate
      priceSyncStatusLabel: marketPriceSync?.status || '未同步',
      activePriceSyncAt: marketPriceSync?.syncedAt ? new Date(marketPriceSync.syncedAt) : null,
      lastUpdate,
      pc: (p) => p >= 0 ? C.up : C.down,
      displayedTotalPnl,
      displayedRetPct,
      activePortfolioId,
      switchPortfolio,
      ready: true,
      portfolioSwitching: false,
      portfolioSummaries,
      createPortfolio,
      viewMode,
      exitOverview,
      openOverview,
      showPortfolioManager,
      setShowPortfolioManager,
      renamePortfolio,
      deletePortfolio,
      OWNER_PORTFOLIO_ID: 'me',
      overviewTotalValue,
      portfolioNotes,
      setPortfolioNotes,
      PORTFOLIO_VIEW_MODE: 'portfolio',
      OVERVIEW_VIEW_MODE: 'overview',
      urgentCount,
      todayAlertSummary,
      TABS,
      tab,
      setTab,
    }),
    h('div', { style: { padding: '10px 14px' } },
      h(Outlet) // Render child route
    )
  );
}
