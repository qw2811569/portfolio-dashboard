import { ErrorBoundary } from './ErrorBoundary.jsx'
import {
  usePortfolioPanelsActions,
  usePortfolioPanelsData,
} from '../contexts/PortfolioPanelsContext.jsx'
import { OverviewPanel } from './overview/index.js'
import HoldingsPanelChunk from './holdings/HoldingsPanelChunk.jsx'
import { WatchlistPanel } from './watchlist/index.js'
import { EventsPanel } from './events/index.js'
import { DailyReportPanel } from './reports/index.js'
import { ResearchPanel } from './research/index.js'
import { TradePanel } from './trade/index.js'
import { LogPanel } from './log/index.js'
import { NewsAnalysisPanel } from './news/index.js'

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
      <Component {...props} />
    </ErrorBoundary>
  )
}
