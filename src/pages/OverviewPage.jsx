/**
 * Overview Page
 * 
 * Cross-portfolio overview and summary view
 */

import { createElement as h } from 'react';
import { OverviewPanel } from '../components/overview/index.js';
import { usePortfolioStore } from '../stores/portfolioStore.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';
import { useEventStore } from '../stores/eventStore.js';

export function OverviewPage() {
  // Get state from stores
  const portfolios = usePortfolioStore(state => state.portfolios);
  const activePortfolioId = usePortfolioStore(state => state.activePortfolioId);
  const switchPortfolio = usePortfolioStore(state => state.setActivePortfolioId);
  const exitOverview = usePortfolioStore(state => state.setViewMode);
  const viewMode = usePortfolioStore(state => state.viewMode);
  
  const holdings = useHoldingsStore(state => state.holdings);
  const newsEvents = useEventStore(state => state.newsEvents);
  
  // Calculate portfolio summaries
  const overviewPortfolios = portfolios.map(portfolio => {
    // TODO: Get holdings and events for each portfolio
    const holdingCount = 0;
    const pendingEvents = 0;
    const retPct = 0;
    const totalPnl = 0;
    const notes = { riskProfile: '', preferences: '', customNotes: '' };
    
    return {
      ...portfolio,
      holdingCount,
      pendingEvents,
      retPct,
      totalPnl,
      notes,
    };
  });
  
  // Calculate totals
  const overviewTotalValue = overviewPortfolios.reduce((sum, p) => sum + p.totalValue, 0);
  const overviewTotalPnl = overviewPortfolios.reduce((sum, p) => sum + p.totalPnl, 0);
  
  // Find duplicate holdings across portfolios
  const overviewDuplicateHoldings = []; // TODO: Calculate
  
  // Find pending items across portfolios
  const overviewPendingItems = newsEvents
    .filter(e => e.status === 'pending')
    .slice(0, 16)
    .map(e => ({
      id: e.id,
      portfolioId: 'me',
      portfolioName: '我',
      title: e.title,
      date: e.eventDate,
      pred: e.pred,
      predReason: e.predReason,
    }));
  
  return h(OverviewPanel, {
    portfolioCount: portfolios.length,
    totalValue: overviewTotalValue,
    totalPnl: overviewTotalPnl,
    portfolios: overviewPortfolios,
    activePortfolioId,
    duplicateHoldings: overviewDuplicateHoldings,
    pendingItems: overviewPendingItems,
    onExit: () => exitOverview('portfolio'),
    onSwitch: switchPortfolio,
  });
}
