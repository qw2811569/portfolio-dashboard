// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HoldingDrillPane from '../../src/components/holdings/HoldingDrillPane.jsx'

describe('components/HoldingDrillPane', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows a stale targets badge when the latest target is older than 7 days', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 304,
        ok: false,
        json: async () => ({}),
      }))
    )

    const staleDate = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    render(
      <HoldingDrillPane
        viewMode="retail"
        holding={{ code: '2330', name: '台積電', price: 950 }}
        dossier={{
          code: '2330',
          name: '台積電',
          position: { price: 950 },
          thesis: { statement: 'AI 需求延續', pillars: [{ title: '需求', status: 'stable' }] },
          targets: [{ firm: '元大', target: 1200, date: staleDate }],
          targetSource: 'analyst',
          fundamentals: { updatedAt: new Date().toISOString() },
        }}
      />
    )

    expect(screen.getByTestId('holding-targets-stale-badge-2330')).toHaveTextContent('9 天前')
  })

  it('shows degraded FinMind stale copy when fallback timestamps use timezone offsets', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 304,
        ok: false,
        json: async () => ({}),
      }))
    )

    render(
      <HoldingDrillPane
        viewMode="retail"
        holding={{ code: '2308', name: '台達電', price: 1440, type: '股票' }}
        dossier={{
          code: '2308',
          name: '台達電',
          position: { price: 1440, type: '股票' },
          targets: [],
          fundamentals: { updatedAt: '2026-03-20T16:00:00.000+08:00' },
          finmindDegraded: {
            reason: 'api-timeout',
            fallbackAt: '2026-04-23T16:00:00.000+08:00',
            staleCopy: '這裡的數字是 昨天 · 現在的盤還沒拉到。',
          },
        }}
      />
    )

    expect(screen.getByText('這裡的數字是 昨天 · 現在的盤還沒拉到。')).toBeInTheDocument()
  })

  it('shows thesis content when the dossier has a thesis statement', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 304,
        ok: false,
        json: async () => ({}),
      }))
    )

    render(
      <HoldingDrillPane
        viewMode="retail"
        holding={{ code: '2330', name: '台積電', price: 950 }}
        dossier={{
          code: '2330',
          name: '台積電',
          position: { price: 950 },
          thesis: { summary: 'AI 需求延續', pillars: [{ text: '先進製程需求', status: 'stable' }] },
          targets: [],
          fundamentals: { updatedAt: new Date().toISOString() },
        }}
      />
    )

    expect(screen.getByText('當初買進理由')).toBeInTheDocument()
    expect(screen.getByText('AI 需求延續')).toBeInTheDocument()
  })

  it('hides the thesis section completely when the dossier has no thesis content', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 304,
        ok: false,
        json: async () => ({}),
      }))
    )

    render(
      <HoldingDrillPane
        viewMode="retail"
        holding={{ code: '2454', name: '聯發科', price: 1400 }}
        dossier={{
          code: '2454',
          name: '聯發科',
          position: { price: 1400 },
          thesis: null,
          targets: [],
          fundamentals: { updatedAt: new Date().toISOString() },
        }}
      />
    )

    expect(screen.queryByText('當初買進理由')).not.toBeInTheDocument()
    expect(screen.queryByText(/還沒整理成卡片/)).not.toBeInTheDocument()
  })
})
