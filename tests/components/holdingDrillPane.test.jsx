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
})
