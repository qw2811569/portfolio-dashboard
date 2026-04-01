import { Suspense, lazy } from 'react'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import {
  usePortfolioPanelsActions,
  usePortfolioPanelsData,
} from '../contexts/PortfolioPanelsContext.jsx'

const lazyNamedExport = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })))

const OverviewPanel = lazyNamedExport(() => import('./overview/index.js'), 'OverviewPanel')
const HoldingsPanelChunk = lazy(() => import('./holdings/HoldingsPanelChunk.jsx'))
const WatchlistPanel = lazyNamedExport(() => import('./watchlist/index.js'), 'WatchlistPanel')
const EventsPanel = lazyNamedExport(() => import('./events/index.js'), 'EventsPanel')
const DailyReportPanel = lazyNamedExport(() => import('./reports/index.js'), 'DailyReportPanel')
const ResearchPanel = lazyNamedExport(() => import('./research/index.js'), 'ResearchPanel')
const TradePanel = lazyNamedExport(() => import('./trade/index.js'), 'TradePanel')
const LogPanel = lazyNamedExport(() => import('./log/index.js'), 'LogPanel')
const NewsAnalysisPanel = lazyNamedExport(() => import('./news/index.js'), 'NewsAnalysisPanel')

function PanelLoadingFallback() {
  return (
    <div
      style={{
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--app-text-mute, #9aa4b2)',
        fontSize: 13,
      }}
    >
      正在載入內容...
    </div>
  )
}

export default function AppPanels({ viewMode, overviewViewMode, tab, errorBoundaryCopy }) {
  const data = usePortfolioPanelsData()
  const actions = usePortfolioPanelsActions()
  const activePanelKey = viewMode === overviewViewMode ? 'overview' : tab

  const overviewProps = { ...data.overview, ...actions.overview }
  const holdingsProps = { ...data.holdings, ...actions.holdings }
  const holdingsTableProps = { ...data.holdingsTable, ...actions.holdingsTable }
  const watchlistProps = { ...data.watchlist, ...actions.watchlist }
  const eventsProps = { ...data.events, ...actions.events }
  const dailyProps = { ...data.daily, ...actions.daily }
  const researchProps = { ...data.research, ...actions.research }
  const tradeProps = { ...data.trade, ...actions.trade }
  const logProps = { ...data.log, ...actions.log }
  const newsProps = { ...data.news, ...actions.news }

  const panelRegistry = {
    overview: {
      scope: 'overview-panel',
      title: errorBoundaryCopy.overview.title,
      Component: OverviewPanel,
      props: overviewProps,
    },
    holdings: {
      scope: 'holdings-panel',
      title: errorBoundaryCopy.holdings.title,
      Component: HoldingsPanelChunk,
      props: { panelProps: holdingsProps, tableProps: holdingsTableProps },
    },
    watchlist: {
      scope: 'watchlist-panel',
      title: errorBoundaryCopy.watchlist.title,
      Component: WatchlistPanel,
      props: watchlistProps,
    },
    events: {
      scope: 'events-panel',
      title: errorBoundaryCopy.events.title,
      Component: EventsPanel,
      props: eventsProps,
    },
    daily: {
      scope: 'daily-report-panel',
      title: errorBoundaryCopy.daily.title,
      Component: DailyReportPanel,
      props: dailyProps,
    },
    research: {
      scope: 'research-panel',
      title: errorBoundaryCopy.research.title,
      Component: ResearchPanel,
      props: researchProps,
    },
    trade: {
      scope: 'trade-panel',
      title: errorBoundaryCopy.trade.title,
      Component: TradePanel,
      props: tradeProps,
    },
    log: {
      scope: 'log-panel',
      title: errorBoundaryCopy.log.title,
      Component: LogPanel,
      props: logProps,
    },
    news: {
      scope: 'news-analysis-panel',
      title: errorBoundaryCopy.news.title,
      Component: NewsAnalysisPanel,
      props: newsProps,
    },
  }

  const activePanel = panelRegistry[activePanelKey]
  if (!activePanel) return null
  const { Component, props } = activePanel

  return (
    <ErrorBoundary scope={activePanel.scope} title={activePanel.title}>
      <Suspense fallback={<PanelLoadingFallback />}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}
