/**
 * Daily Analysis Page
 * 
 * Daily market analysis and report view
 */

import { createElement as h } from 'react';
import { DailyReportPanel } from '../components/reports/index.js';
import { useReportsStore } from '../stores/reportsStore.js';
import { useEventStore } from '../stores/eventStore.js';
import { useBrainStore } from '../stores/brainStore.js';
import { useRunDailyAnalysis, useRunStressTest } from '../hooks/api/useAnalysis.js';

export function DailyPage() {
  // Get state from stores
  const dailyReport = useReportsStore(state => state.dailyReport);
  const setDailyReport = useReportsStore(state => state.setDailyReport);
  const dailyExpanded = useReportsStore(state => state.dailyExpanded);
  const setDailyExpanded = useReportsStore(state => state.setDailyExpanded);
  const analyzing = useReportsStore(state => state.analyzing);
  const setAnalyzing = useReportsStore(state => state.setAnalyzing);
  const analyzeStep = useReportsStore(state => state.analyzeStep);
  const setAnalyzeStep = useReportsStore(state => state.setAnalyzeStep);
  const stressResult = useReportsStore(state => state.stressResult);
  const setStressResult = useReportsStore(state => state.setStressResult);
  const stressTesting = useReportsStore(state => state.stressTesting);
  const setStressTesting = useReportsStore(state => state.setStressTesting);
  
  const newsEvents = useEventStore(state => state.newsEvents);
  const setExpandedNews = useEventStore(state => state.setExpandedNews);
  const expandedStock = useBrainStore(state => state.expandedStock);
  const setExpandedStock = useBrainStore(state => state.setExpandedStock);
  const strategyBrain = useBrainStore(state => state.strategyBrain);
  
  // API hooks
  const runDailyAnalysisMutation = useRunDailyAnalysis();
  const runStressTestMutation = useRunStressTest();
  
  // Handlers
  const runDailyAnalysis = async () => {
    setAnalyzing(true);
    setAnalyzeStep('正在分析今日收盤數據...');
    
    try {
      const result = await runDailyAnalysisMutation.mutateAsync({
        portfolioId: 'me',
        data: {},
      });
      
      setDailyReport(result);
      setAnalyzing(false);
    } catch (error) {
      console.error('Daily analysis failed:', error);
      setAnalyzing(false);
    }
  };
  
  const runStressTest = async () => {
    setStressTesting(true);
    
    try {
      const result = await runStressTestMutation.mutateAsync({
        portfolioId: 'me',
      });
      
      setStressResult(result);
    } catch (error) {
      console.error('Stress test failed:', error);
    } finally {
      setStressTesting(false);
    }
  };
  
  const closeStressResult = () => {
    setStressResult(null);
  };
  
  return h(DailyReportPanel, {
    dailyReport,
    analyzing,
    analyzeStep,
    stressResult,
    stressTesting,
    dailyExpanded,
    setDailyExpanded,
    runDailyAnalysis,
    runStressTest,
    closeStressResult,
    newsEvents,
    setTab: () => {}, // TODO: Implement navigation
    setExpandedNews,
    expandedStock,
    setExpandedStock,
    strategyBrain,
  });
}
