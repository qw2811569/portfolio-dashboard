import { Suspense, lazy } from 'react'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import PanelMount from './common/PanelMount.jsx'
import {
  usePortfolioPanelsActions,
  usePortfolioPanelsData,
} from '../contexts/PortfolioPanelsContext.jsx'
import { DashboardPanel, OverviewPanel } from './overview/index.js'
import HoldingsPanelChunk from './holdings/HoldingsPanelChunk.jsx'
import { WatchlistPanel } from './watchlist/index.js'
import { EventsPanel } from './events/index.js'
import { DailyReportPanel } from './reports/index.js'
import { ResearchPanel } from './research/index.js'
import { TradePanel } from './trade/index.js'
import { LogPanel } from './log/index.js'
import { NewsAnalysisPanel } from './news/index.js'
import { createLazyPanelLoader } from '../lib/lazyPanelLoader.js'

const shouldUseEagerPanels = import.meta.env.DEV || import.meta.env.MODE === 'test'

function createPanelComponent({ eagerComponent, loader, exportName, panelKey }) {
  if (shouldUseEagerPanels) return eagerComponent
  return lazy(
    createLazyPanelLoader({
      loader,
      exportName,
      panelKey,
    })
  )
}

function PanelSuspenseFallback({ title }) {
  return (
    <section
      aria-label={`${title} loading`}
      style={{
        borderRadius: 16,
        border: '1px solid rgba(217, 211, 209, 0.9)',
        background: 'rgba(231, 224, 214, 0.95)',
        padding: '20px 18px',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div
          style={{
            width: 96,
            height: 10,
            borderRadius: 8,
            background: 'rgba(131, 133, 133, 0.18)',
          }}
        />
        <div
          style={{
            width: 'min(320px, 78%)',
            height: 28,
            borderRadius: 16,
            background: 'rgba(47, 50, 50, 0.1)',
          }}
        />
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            width: '100%',
            height: 72,
            borderRadius: 16,
            background: 'rgba(47, 50, 50, 0.06)',
          }}
        />
        <div
          style={{
            width: '100%',
            height: 72,
            borderRadius: 16,
            background: 'rgba(47, 50, 50, 0.05)',
          }}
        />
      </div>
    </section>
  )
}

const DashboardPanelComponent = createPanelComponent({
  eagerComponent: DashboardPanel,
  loader: () => import('./overview/index.js'),
  exportName: 'DashboardPanel',
  panelKey: 'dashboard',
})

const OverviewPanelComponent = createPanelComponent({
  eagerComponent: OverviewPanel,
  loader: () => import('./overview/index.js'),
  exportName: 'OverviewPanel',
  panelKey: 'overview',
})

const HoldingsPanelComponent = createPanelComponent({
  eagerComponent: HoldingsPanelChunk,
  loader: () => import('./holdings/HoldingsPanelChunk.jsx'),
  exportName: 'default',
  panelKey: 'holdings',
})

const WatchlistPanelComponent = createPanelComponent({
  eagerComponent: WatchlistPanel,
  loader: () => import('./watchlist/index.js'),
  exportName: 'WatchlistPanel',
  panelKey: 'watchlist',
})

const EventsPanelComponent = createPanelComponent({
  eagerComponent: EventsPanel,
  loader: () => import('./events/index.js'),
  exportName: 'EventsPanel',
  panelKey: 'events',
})

const DailyReportPanelComponent = createPanelComponent({
  eagerComponent: DailyReportPanel,
  loader: () => import('./reports/index.js'),
  exportName: 'DailyReportPanel',
  panelKey: 'daily',
})

const ResearchPanelComponent = createPanelComponent({
  eagerComponent: ResearchPanel,
  loader: () => import('./research/index.js'),
  exportName: 'ResearchPanel',
  panelKey: 'research',
})

const TradePanelComponent = createPanelComponent({
  eagerComponent: TradePanel,
  loader: () => import('./trade/index.js'),
  exportName: 'TradePanel',
  panelKey: 'trade',
})

const LogPanelComponent = createPanelComponent({
  eagerComponent: LogPanel,
  loader: () => import('./log/index.js'),
  exportName: 'LogPanel',
  panelKey: 'log',
})

const NewsAnalysisPanelComponent = createPanelComponent({
  eagerComponent: NewsAnalysisPanel,
  loader: () => import('./news/index.js'),
  exportName: 'NewsAnalysisPanel',
  panelKey: 'news',
})

export default function AppPanels({ viewMode, overviewViewMode, tab, errorBoundaryCopy }) {
  const data = usePortfolioPanelsData()
  const actions = usePortfolioPanelsActions()
  const activePanelKey = viewMode === overviewViewMode ? 'overview' : tab

  const dashboardProps = { ...data.dashboard, ...actions.dashboard }
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
    dashboard: {
      scope: 'dashboard-panel',
      title: errorBoundaryCopy.dashboard?.title || '看板',
      Component: DashboardPanelComponent,
      props: dashboardProps,
    },
    overview: {
      scope: 'overview-panel',
      title: errorBoundaryCopy.overview.title,
      Component: OverviewPanelComponent,
      props: overviewProps,
    },
    holdings: {
      scope: 'holdings-panel',
      title: errorBoundaryCopy.holdings.title,
      Component: HoldingsPanelComponent,
      props: { panelProps: holdingsProps, tableProps: holdingsTableProps },
    },
    watchlist: {
      scope: 'watchlist-panel',
      title: errorBoundaryCopy.watchlist.title,
      Component: WatchlistPanelComponent,
      props: watchlistProps,
    },
    events: {
      scope: 'events-panel',
      title: errorBoundaryCopy.events.title,
      Component: EventsPanelComponent,
      props: eventsProps,
    },
    daily: {
      scope: 'daily-report-panel',
      title: errorBoundaryCopy.daily.title,
      Component: DailyReportPanelComponent,
      props: dailyProps,
    },
    research: {
      scope: 'research-panel',
      title: errorBoundaryCopy.research.title,
      Component: ResearchPanelComponent,
      props: researchProps,
    },
    trade: {
      scope: 'trade-panel',
      title: errorBoundaryCopy.trade.title,
      Component: TradePanelComponent,
      props: tradeProps,
    },
    log: {
      scope: 'log-panel',
      title: errorBoundaryCopy.log.title,
      Component: LogPanelComponent,
      props: logProps,
    },
    news: {
      scope: 'news-analysis-panel',
      title: errorBoundaryCopy.news.title,
      Component: NewsAnalysisPanelComponent,
      props: newsProps,
    },
  }

  const activePanel = panelRegistry[activePanelKey]
  if (!activePanel) return null
  const { Component, props } = activePanel

  return (
    <ErrorBoundary scope={activePanel.scope} title={activePanel.title}>
      <Suspense fallback={<PanelSuspenseFallback title={activePanel.title} />}>
        <PanelMount key={activePanelKey} data-testid="panel-mount">
          <Component {...props} />
        </PanelMount>
      </Suspense>
    </ErrorBoundary>
  )
}
