import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OverviewPanel } from '../../src/components/overview/OverviewPanel.jsx'

describe('OverviewPanel concentration dashboard', () => {
  it('renders concentration dashboard between KPI cards and principle cards', () => {
    render(
      <OverviewPanel
        portfolioCount={1}
        totalValue={100000}
        totalPnl={5000}
        portfolios={[
          {
            id: 'me',
            name: '主組合',
            holdingCount: 3,
            pendingEvents: 0,
            retPct: 5,
            totalPnl: 5000,
            holdings: [
              { code: '2330', name: '台積電', value: 42000, industry: '半導體' },
              { code: '2308', name: '台達電', value: 22000, industry: '電子零組件' },
              { code: '1799', name: '易威', value: 10000, industry: '生技' },
            ],
          },
        ]}
        activePortfolioId="me"
        duplicateHoldings={[]}
        pendingItems={[]}
        watchlistCount={0}
        missingTargetCount={0}
        onExit={() => {}}
        onSwitch={() => {}}
      />
    )

    expect(screen.getByTestId('overview-kpi-cards')).toBeInTheDocument()
    expect(screen.getByTestId('concentration-dashboard')).toBeInTheDocument()
    expect(screen.getByText('組合集中度')).toBeInTheDocument()
    expect(screen.getAllByText('心法').length).toBeGreaterThan(0)
  })
})
