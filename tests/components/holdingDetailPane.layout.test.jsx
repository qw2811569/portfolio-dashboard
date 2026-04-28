// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HoldingDetailPane from '../../src/components/holdings/HoldingDetailPane.jsx'

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

const baseDetail = {
  code: '2330',
  displayName: '台積電',
  status: { tone: 'on_track', label: '進度中' },
  pillarStatus: 'on_track',
  thesis: { text: '主線仍在', pillars: [] },
  position: { qty: 20, cost: 900, price: 950 },
  valuation: { per: 24.5 },
  freshness: { thesis: 'fresh' },
  recentResearch: { date: '2026/03/20', summary: '...' },
  events: [],
  institutionalFlow: { total5d: 38226085, series: [], lastUpdated: '2026-04-25' },
}

describe('HoldingDetailPane layout (R31+1 modal scroll fix)', () => {
  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  })

  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('overlay uses 100dvh so iOS Safari URL bar does not push panel off-screen', () => {
    mockMatchMedia(true) // mobile branch
    render(<HoldingDetailPane open detail={baseDetail} onClose={() => {}} />)

    const overlay = screen.getByTestId('holding-detail-pane-overlay')
    expect(overlay.style.position).toBe('fixed')
    // Visual-viewport-aware sizing — fixes the user-reported "滾不到下方" bug where
    // `inset: 0` alone (layout viewport) hid the bottom of the panel behind the URL bar.
    expect(overlay.style.height).toBe('100dvh')
    expect(overlay.style.maxHeight).toBe('100dvh')
  })

  it('mobile inner panel uses % of overlay (not raw vh) so it tracks visual viewport', () => {
    mockMatchMedia(true) // mobile branch
    render(<HoldingDetailPane open detail={baseDetail} onClose={() => {}} />)

    const panel = screen.getByTestId('holding-detail-pane-mobile')
    expect(panel.style.height).toBe('90%')
    expect(panel.style.maxHeight).toBe('90%')
    // Grid layout invariant: header / scrollable content / sticky close button
    expect(panel.style.gridTemplateRows).toBe('auto 1fr auto')
  })

  it('desktop branch retains calc(100% - 24px) sizing', () => {
    mockMatchMedia(false) // desktop branch
    render(<HoldingDetailPane open detail={baseDetail} onClose={() => {}} />)

    const panel = screen.getByTestId('holding-detail-pane-desktop')
    expect(panel.style.height).toBe('calc(100% - 24px)')
    expect(panel.style.maxHeight).toBe('calc(100% - 24px)')
  })

  it('renders the bottom close button as a sticky row inside the modal', () => {
    mockMatchMedia(true)
    render(<HoldingDetailPane open detail={baseDetail} onClose={() => {}} />)

    const closeBottom = screen.getByTestId('holding-detail-pane-close-bottom')
    expect(closeBottom).toBeInTheDocument()
    // Close button must live inside the panel (not as a separate sibling), so it is
    // always reachable when the user scrolls the inner content to the end.
    const panel = screen.getByTestId('holding-detail-pane-mobile')
    expect(panel.contains(closeBottom)).toBe(true)
  })
})
