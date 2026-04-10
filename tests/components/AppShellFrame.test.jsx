import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/components/AppPanels.jsx', () => ({
  default: ({ tab }) => <div>panel:{tab}</div>,
}))

vi.mock('../../src/components/Header.jsx', () => ({
  default: ({ tab }) => <div>header:{tab}</div>,
}))

vi.mock('../../src/components/ErrorBoundary.jsx', () => ({
  ErrorBoundary: ({ children }) => <>{children}</>,
}))

vi.mock('../../src/components/common/index.js', () => ({
  ConfirmDialog: ({ open, title }) => (open ? <div>confirm:{title}</div> : null),
}))

vi.mock('../../src/contexts/PortfolioPanelsContext.jsx', () => ({
  PortfolioPanelsProvider: ({ children }) => <>{children}</>,
}))

import AppShellFrame from '../../src/components/AppShellFrame.jsx'

describe('components/AppShellFrame.jsx', () => {
  it('renders loading state before runtime is ready', () => {
    render(
      <AppShellFrame
        ready={false}
        loadingMessage="載入中..."
        loadingState={{
          phase: 'load-snapshot',
          title: '正在載入本機投組',
          detail: '讀取持倉、事件與分析快照',
          elapsedMs: 2200,
        }}
        headerBoundaryCopy={{ title: 'header', description: 'desc' }}
        headerProps={{}}
        panelsData={{}}
        panelsActions={{}}
        panelsProps={{ viewMode: 'portfolio', overviewViewMode: 'overview', tab: 'holdings' }}
        confirmDialogProps={{ open: false }}
      />
    )

    expect(screen.getByText('正在載入本機投組')).toBeInTheDocument()
    expect(screen.getByText('讀取持倉、事件與分析快照')).toBeInTheDocument()
    expect(screen.getByText('PORTFOLIO OS')).toBeInTheDocument()
  })

  it('renders header, panels and confirm dialog when ready', () => {
    render(
      <AppShellFrame
        ready
        loadingMessage="載入中..."
        loadingState={null}
        headerBoundaryCopy={{ title: 'header', description: 'desc' }}
        headerProps={{ tab: 'holdings' }}
        panelsData={{}}
        panelsActions={{}}
        panelsProps={{
          viewMode: 'portfolio',
          overviewViewMode: 'overview',
          tab: 'research',
          errorBoundaryCopy: {},
        }}
        confirmDialogProps={{ open: true, title: '確認' }}
      />
    )

    expect(screen.getByText('header:holdings')).toBeInTheDocument()
    expect(screen.getByText('panel:research')).toBeInTheDocument()
    expect(screen.getByText('confirm:確認')).toBeInTheDocument()
  })
})
