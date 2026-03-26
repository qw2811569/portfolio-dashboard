/**
 * Research Page
 * 
 * AutoResearch and deep research view
 */

import { createElement as h } from 'react';
import { ResearchPanel } from '../components/research/index.js';
import { useReportsStore } from '../stores/reportsStore.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';
import { useRunResearch, useEnrichResearchToDossier, useRefreshAnalystReports } from '../hooks/api/useResearch.js';

export function ResearchPage() {
  // Get state from stores
  const researching = useReportsStore(state => state.researching);
  const setResearching = useReportsStore(state => state.setResearching);
  const researchTarget = useReportsStore(state => state.researchTarget);
  const setResearchTarget = useReportsStore(state => state.setResearchTarget);
  const researchResults = useReportsStore(state => state.researchResults);
  const setResearchResults = useReportsStore(state => state.setResearchResults);
  const researchHistory = useReportsStore(state => state.researchHistory);
  const setResearchHistory = useReportsStore(state => state.setResearchHistory);
  const enrichingResearchCode = useReportsStore(state => state.enrichingResearchCode);
  const setEnrichingResearchCode = useReportsStore(state => state.setEnrichingResearchCode);
  const reportRefreshing = useReportsStore(state => state.reportRefreshing);
  const setReportRefreshing = useReportsStore(state => state.setReportRefreshing);
  const reportRefreshStatus = useReportsStore(state => state.reportRefreshStatus);
  const setReportRefreshStatus = useReportsStore(state => state.setReportRefreshStatus);
  const dataRefreshRows = []; // TODO: Calculate from fundamentals/targets
  
  const holdings = useHoldingsStore(state => state.holdings);
  
  // API hooks
  const runResearchMutation = useRunResearch();
  const enrichResearchToDossierMutation = useEnrichResearchToDossier();
  const refreshAnalystReportsMutation = useRefreshAnalystReports();
  
  // Handlers
  const runResearch = async (mode, target) => {
    setResearching(true);
    setResearchTarget(mode === 'single' ? target?.code : mode.toUpperCase());
    
    try {
      const result = await runResearchMutation.mutateAsync({
        portfolioId: 'me',
        target: mode === 'single' ? target.code : mode,
        mode,
      });
      
      setResearchResults(result);
      
      // Add to history
      setResearchHistory(prev => [result, ...prev].slice(0, 30));
    } catch (error) {
      console.error('Research failed:', error);
    } finally {
      setResearching(false);
      setResearchTarget(null);
    }
  };
  
  const enrichResearchToDossier = async (researchResults) => {
    if (!researchResults?.code) return;
    
    setEnrichingResearchCode(researchResults.code);
    
    try {
      await enrichResearchToDossierMutation.mutateAsync({
        portfolioId: 'me',
        code: researchResults.code,
        researchResults,
      });
    } catch (error) {
      console.error('Enrich to dossier failed:', error);
    } finally {
      setEnrichingResearchCode(null);
    }
  };
  
  const refreshAnalystReports = async ({ force = false } = {}) => {
    setReportRefreshing(true);
    setReportRefreshStatus('正在刷新公開報告...');
    
    try {
      await refreshAnalystReportsMutation.mutateAsync({
        portfolioId: 'me',
        force,
      });
      
      setReportRefreshStatus('✅ 報告已刷新');
      setTimeout(() => setReportRefreshStatus(''), 3000);
    } catch (error) {
      console.error('Refresh reports failed:', error);
      setReportRefreshStatus('❌ 刷新失敗');
      setTimeout(() => setReportRefreshStatus(''), 3000);
    } finally {
      setReportRefreshing(false);
    }
  };
  
  // Calculate counts
  const missingTargetCount = 0; // TODO: Calculate
  const staleTargetCount = 0; // TODO: Calculate
  const missingFundamentalCount = 0; // TODO: Calculate
  const staleFundamentalCount = 0; // TODO: Calculate
  
  return h(ResearchPanel, {
    holdings,
    researching,
    researchTarget,
    reportRefreshing,
    reportRefreshStatus,
    dataRefreshRows,
    researchResults,
    researchHistory,
    enrichingResearchCode,
    STOCK_META: {}, // TODO: Import from seedData
    IND_COLOR: {}, // TODO: Import from seedData
    onEvolve: () => runResearch('evolve'),
    onRefresh: refreshAnalystReports,
    onResearch: runResearch,
    onEnrich: enrichResearchToDossier,
    onSelectHistory: setResearchResults,
  });
}
