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
        headerBoundaryCopy={{ title: 'header', description: 'desc' }}
        headerProps={{}}
        panelsData={{}}
        panelsActions={{}}
        panelsProps={{ viewMode: 'portfolio', overviewViewMode: 'overview', tab: 'holdings' }}
        confirmDialogProps={{ open: false }}
      />
    )

    expect(screen.getByText('載入中...')).toBeInTheDocument()
  })

  it('renders header, panels and confirm dialog when ready', () => {
    render(
      <AppShellFrame
        ready
        loadingMessage="載入中..."
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
