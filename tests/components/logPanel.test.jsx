// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LogPanel } from '../../src/components/log/LogPanel.jsx'

const originalMatchMedia = window.matchMedia

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function buildTradeLogEntry(overrides = {}) {
  return {
    id: 101,
    action: '買進',
    code: '2330',
    name: '台積電',
    qty: 1,
    price: 950,
    date: '2026/04/24',
    time: '09:10',
    qa: [{ q: '為什麼選這檔？核心邏輯是什麼？', a: '測試 memo' }],
    ...overrides,
  }
}

function buildAuditEntry(trade = buildTradeLogEntry(), overrides = {}) {
  return {
    ts: '2026-04-24T01:10:00.000Z',
    portfolioId: 'me',
    action: 'trade.confirm',
    disclaimerAckedAt: '2026-04-24T01:00:00.000Z',
    before: { holdings: [], tradeLogCount: 0 },
    after: {
      holdings: [{ code: trade.code, qty: trade.qty }],
      tradeLogCount: 1,
      appendedTradeLogEntries: [trade],
      targetPriceUpdates: [],
    },
    sourceFile: 'trade-audit-2026-04.jsonl',
    ...overrides,
  }
}

describe('components/LogPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (typeof originalMatchMedia === 'function') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
      return
    }

    delete window.matchMedia
  })

  it('shows skeleton loading while trade audit data is hydrating', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}))

    render(<LogPanel tradeLog={null} portfolioId="me" />)

    expect(screen.getByText('交易日誌整理中')).toBeInTheDocument()
    expect(document.querySelector('[data-skeleton]')).toBeTruthy()
  })

  it('renders trade audit entries and shows detail after selecting an item', async () => {
    const auditTrade = buildTradeLogEntry()
    const localOnlyTrade = buildTradeLogEntry({
      id: 202,
      code: '2454',
      name: '聯發科',
      price: 1220,
      qty: 2,
      qa: [{ q: '理由', a: '' }],
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [buildAuditEntry(auditTrade)],
        summary: {
          portfolioId: 'me',
          count: 1,
          lastUpdatedAt: '2026-04-24T01:10:00.000Z',
        },
      }),
    })

    render(<LogPanel tradeLog={[auditTrade, localOnlyTrade]} portfolioId="me" />)

    await waitFor(() => {
      expect(screen.getByText('台積電')).toBeInTheDocument()
    })

    const list = screen.getByTestId('trade-log-list')
    expect(within(list).getByText('交易稽核')).toBeInTheDocument()
    expect(within(list).getByText('聯發科')).toBeInTheDocument()

    fireEvent.click(within(list).getByText('台積電'))

    await waitFor(() => {
      expect(screen.getByTestId('trade-log-detail')).toBeInTheDocument()
    })

    const detail = screen.getByTestId('trade-log-detail')
    expect(within(detail).getByText('Trade Audit')).toBeInTheDocument()
    expect(within(detail).getByText('trade-audit-2026-04.jsonl')).toBeInTheDocument()
    expect(within(detail).getByText('免責聲明確認')).toBeInTheDocument()
  })

  it('filters trade log entries by search text, action, month, and stock', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [],
        summary: { portfolioId: 'me', count: 0, lastUpdatedAt: '' },
      }),
    })

    render(
      <LogPanel
        tradeLog={[
          buildTradeLogEntry({
            id: 1,
            action: '買進',
            code: '2330',
            name: '台積電',
            date: '2026/04/24',
            qa: [{ q: '理由', a: '先進封裝擴產' }],
          }),
          buildTradeLogEntry({
            id: 2,
            action: '賣出',
            code: '2454',
            name: '聯發科',
            date: '2026/03/18',
            qa: [{ q: '理由', a: '停利調節' }],
          }),
          buildTradeLogEntry({
            id: 3,
            action: '買進',
            code: '2303',
            name: '聯電',
            date: '2026/04/19',
            qa: [{ q: '理由', a: '成熟製程轉強' }],
          }),
        ]}
        portfolioId="me"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('trade-log-filters')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('trade-log-search'), { target: { value: '封裝' } })
    let list = screen.getByTestId('trade-log-list')
    expect(within(list).getByText('台積電')).toBeInTheDocument()
    expect(within(list).queryByText('聯發科')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('trade-log-search'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('trade-log-action-filter'), { target: { value: '賣出' } })
    list = screen.getByTestId('trade-log-list')
    expect(within(list).getByText('聯發科')).toBeInTheDocument()
    expect(within(list).queryByText('台積電')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('trade-log-action-filter'), { target: { value: '全部' } })
    fireEvent.change(screen.getByTestId('trade-log-month-filter'), { target: { value: '2026/04' } })
    list = screen.getByTestId('trade-log-list')
    expect(within(list).getByText('台積電')).toBeInTheDocument()
    expect(within(list).getByText('聯電')).toBeInTheDocument()
    expect(within(list).queryByText('聯發科')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('trade-log-stock-filter'), { target: { value: '2303' } })
    list = screen.getByTestId('trade-log-list')
    expect(within(list).getByText('聯電')).toBeInTheDocument()
    expect(within(list).queryByText('台積電')).not.toBeInTheDocument()
  })

  it('uses the mobile single-column branch on <=768px', async () => {
    mockMatchMedia(true)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [],
        summary: { portfolioId: 'me', count: 0, lastUpdatedAt: '' },
      }),
    })

    render(<LogPanel tradeLog={[buildTradeLogEntry()]} portfolioId="me" />)

    await waitFor(() => {
      expect(screen.getByTestId('trade-log-panel')).toHaveAttribute(
        'data-layout',
        'mobile-single-column'
      )
    })

    expect(screen.getByTestId('trade-log-layout')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr)',
    })
  })
})
