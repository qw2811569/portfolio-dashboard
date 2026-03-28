import { ErrorBoundary } from './ErrorBoundary.jsx'
import { HoldingsPanel, HoldingsTable } from './holdings/index.js'
import { WatchlistPanel } from './watchlist/index.js'
import { EventsPanel } from './events/index.js'
import { DailyReportPanel } from './reports/index.js'
import { ResearchPanel } from './research/index.js'
import { TradePanel } from './trade/index.js'
import { LogPanel } from './log/index.js'
import { NewsAnalysisPanel } from './news/index.js'
import { OverviewPanel } from './overview/index.js'

export default function AppPanels({
  viewMode,
  overviewViewMode,
  tab,
  errorBoundaryCopy,
  overviewProps,
  holdingsProps,
  holdingsTableProps,
  watchlistProps,
  eventsProps,
  dailyProps,
  researchProps,
  tradeProps,
  logProps,
  newsProps,
}) {
  const activePanelKey = viewMode === overviewViewMode ? 'overview' : tab

  const panelRegistry = {
    overview: {
      scope: 'overview-panel',
      title: errorBoundaryCopy.overview.title,
      content: <OverviewPanel {...overviewProps} />,
    },
    holdings: {
      scope: 'holdings-panel',
      title: errorBoundaryCopy.holdings.title,
      content: (
        <HoldingsPanel {...holdingsProps}>
          <HoldingsTable {...holdingsTableProps} />
        </HoldingsPanel>
      ),
    },
    watchlist: {
      scope: 'watchlist-panel',
      title: errorBoundaryCopy.watchlist.title,
      content: <WatchlistPanel {...watchlistProps} />,
    },
    events: {
      scope: 'events-panel',
      title: errorBoundaryCopy.events.title,
      content: <EventsPanel {...eventsProps} />,
    },
    daily: {
      scope: 'daily-report-panel',
      title: errorBoundaryCopy.daily.title,
      content: <DailyReportPanel {...dailyProps} />,
    },
    research: {
      scope: 'research-panel',
      title: errorBoundaryCopy.research.title,
      content: <ResearchPanel {...researchProps} />,
    },
    trade: {
      scope: 'trade-panel',
      title: errorBoundaryCopy.trade.title,
      content: <TradePanel {...tradeProps} />,
    },
    log: {
      scope: 'log-panel',
      title: errorBoundaryCopy.log.title,
      content: <LogPanel {...logProps} />,
    },
    news: {
      scope: 'news-analysis-panel',
      title: errorBoundaryCopy.news.title,
      content: <NewsAnalysisPanel {...newsProps} />,
    },
  }

  const activePanel = panelRegistry[activePanelKey]
  if (!activePanel) return null

  return (
    <ErrorBoundary scope={activePanel.scope} title={activePanel.title}>
      {activePanel.content}
    </ErrorBoundary>
  )
}
