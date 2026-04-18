import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShellFrame from '../../src/components/AppShellFrame.jsx'
import { useEventStore } from '../../src/stores/eventStore.js'
import { useHoldingsStore } from '../../src/stores/holdingsStore.js'

vi.mock('../../src/components/Header.jsx', () => ({
  default: () => <div>header</div>,
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

vi.mock('../../src/components/AppPanels.jsx', () => ({
  default: ({ tab }) => (
    <div>
      <div>panel:{tab}</div>
      <button type="button">2330 台積電</button>
      <button type="button">台燿 Q4財報法說會</button>
      <div data-testid="concentration-dashboard">concentration</div>
    </div>
  ),
}))

function renderShell({
  setTab = vi.fn(),
  openOverview = vi.fn(),
  setExpandedStock = vi.fn(),
} = {}) {
  render(
    <AppShellFrame
      ready
      loadingMessage="載入中..."
      loadingState={null}
      headerBoundaryCopy={{ title: 'header', description: 'desc' }}
      headerProps={{ setTab, openOverview }}
      panelsData={{}}
      panelsActions={{ holdingsTable: { setExpandedStock } }}
      panelsProps={{
        viewMode: 'portfolio',
        overviewViewMode: 'overview',
        tab: 'holdings',
        errorBoundaryCopy: {},
      }}
      confirmDialogProps={{ open: false }}
    />
  )

  return { setTab, openOverview, setExpandedStock }
}

describe('components/CmdKPalette integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T08:00:00Z'))

    useHoldingsStore.setState({
      holdings: [
        { code: '2330', name: '台積電' },
        { code: '2317', name: '鴻海' },
      ],
    })

    useEventStore.setState({
      newsEvents: [
        {
          id: 1,
          date: '2026/04/10',
          title: '台燿 Q4財報法說會',
          detail: '法說焦點',
          stocks: ['台燿 6274'],
        },
        {
          id: 2,
          date: '2026/02/01',
          title: '過期事件',
          detail: '不該出現在最近 30 天',
          stocks: ['台積電 2330'],
        },
      ],
    })

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback) => window.setTimeout(callback, 0),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('toggles palette with Cmd+K and Ctrl+K', () => {
    renderShell()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog', { name: '全局搜尋' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.queryByRole('dialog', { name: '全局搜尋' })).not.toBeInTheDocument()
  })

  it('shows all four result sources when query is empty', () => {
    renderShell()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getByLabelText('持股結果')).toBeInTheDocument()
    expect(screen.getByLabelText('頁面結果')).toBeInTheDocument()
    expect(screen.getByLabelText('事件結果')).toBeInTheDocument()
    expect(screen.getByLabelText('指令結果')).toBeInTheDocument()
  })

  it('shows empty state when no result matches', () => {
    renderShell()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByLabelText('搜尋內容'), { target: { value: 'zzz-no-match' } })

    expect(
      screen.getByText('找不到符合結果，試試股票代碼、事件名稱或頁面名稱。')
    ).toBeInTheDocument()
  })

  it('moves active selection with arrow keys', () => {
    renderShell()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByLabelText('搜尋內容'), { target: { value: '打開' } })

    let selected = screen
      .getAllByRole('button')
      .filter((node) => node.getAttribute('aria-selected') === 'true')
    const firstSelectedText = selected[0].textContent

    fireEvent.keyDown(screen.getByLabelText('搜尋內容'), { key: 'ArrowDown' })

    selected = screen
      .getAllByRole('button')
      .filter((node) => node.getAttribute('aria-selected') === 'true')
    expect(selected[0].textContent).not.toBe(firstSelectedText)
  })

  it('executes tab navigation on Enter', () => {
    const { setTab } = renderShell()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByLabelText('搜尋內容'), { target: { value: '深度研究' } })
    fireEvent.keyDown(screen.getByLabelText('搜尋內容'), { key: 'Enter' })

    expect(setTab).toHaveBeenCalledWith('research')
    expect(screen.queryByRole('dialog', { name: '全局搜尋' })).not.toBeInTheDocument()
  })

  it('closes palette on Escape', () => {
    renderShell()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.keyDown(screen.getByLabelText('搜尋內容'), { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '全局搜尋' })).not.toBeInTheDocument()
  })

  it('enters a holding result and scrolls to the row', () => {
    const { setTab, setExpandedStock } = renderShell()
    const scrollIntoView = window.HTMLElement.prototype.scrollIntoView

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByLabelText('搜尋內容'), { target: { value: '2330' } })
    fireEvent.keyDown(screen.getByLabelText('搜尋內容'), { key: 'Enter' })

    expect(setTab).toHaveBeenCalledWith('holdings')
    expect(setExpandedStock).toHaveBeenCalledWith('2330')

    vi.runAllTimers()
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('runs command stubs and overview navigation on Enter', () => {
    const { openOverview } = renderShell()
    const commandSpy = vi.fn()
    window.addEventListener('cmdk:command', commandSpy)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByLabelText('搜尋內容'), { target: { value: '顯示集中度' } })
    fireEvent.keyDown(screen.getByLabelText('搜尋內容'), { key: 'Enter' })

    expect(openOverview).toHaveBeenCalled()
    expect(commandSpy).toHaveBeenCalledTimes(1)
  })
})
