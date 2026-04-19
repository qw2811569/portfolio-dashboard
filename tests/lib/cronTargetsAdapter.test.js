import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchCronTargets,
  isCronTargetUsable,
} from '../../src/lib/dataAdapters/cronTargetsAdapter.js'

describe('cronTargetsAdapter', () => {
  describe('isCronTargetUsable', () => {
    it('returns true when updatedAt is within 30 days', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const snapshot = {
        targets: {
          reports: [{ firm: '元大', target: 1200, date: '2026/04/10' }],
          updatedAt: twoDaysAgo.toISOString(),
        },
      }
      expect(isCronTargetUsable(snapshot)).toBe(true)
    })

    it('returns false when updatedAt is older than 30 days', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
      const snapshot = {
        targets: {
          reports: [{ firm: '元大', target: 1200, date: '2026/03/03' }],
          updatedAt: fortyDaysAgo.toISOString(),
        },
      }
      expect(isCronTargetUsable(snapshot)).toBe(false)
    })

    it('returns false when snapshot is null', () => {
      expect(isCronTargetUsable(null)).toBe(false)
    })

    it('returns false when targets.updatedAt is missing', () => {
      expect(isCronTargetUsable({ targets: {} })).toBe(false)
    })

    it('returns false when updatedAt is invalid', () => {
      expect(isCronTargetUsable({ targets: { updatedAt: 'garbage' } })).toBe(false)
    })

    it('respects custom maxAgeDays', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      const snapshot = { targets: { updatedAt: eightDaysAgo.toISOString() } }
      expect(isCronTargetUsable(snapshot, { maxAgeDays: 7 })).toBe(false)
      expect(isCronTargetUsable(snapshot, { maxAgeDays: 10 })).toBe(true)
    })
  })

  describe('fetchCronTargets', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('returns snapshot on 200 with valid reports', async () => {
      const snapshot = {
        code: '2330',
        targets: {
          reports: [{ firm: '元大', target: 1200, date: '2026/04/10' }],
          updatedAt: new Date().toISOString(),
        },
      }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => snapshot,
      })

      const result = await fetchCronTargets('2330')
      expect(result).toEqual(snapshot)
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/target-prices?code=2330')
    })

    it('throws on non-200 response so callers can surface the status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      await expect(fetchCronTargets('9999')).rejects.toMatchObject({
        status: 404,
      })
    })

    it('returns null when snapshot has no reports', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: '2330', targets: { reports: [] } }),
      })

      const result = await fetchCronTargets('2330')
      expect(result).toBeNull()
    })

    it('returns aggregate-only snapshots so downstream can treat them as degraded coverage', async () => {
      const snapshot = {
        code: '2330',
        targets: {
          reports: [],
          aggregate: {
            medianTarget: 2352.5,
            firmsCount: 36,
          },
          updatedAt: new Date().toISOString(),
        },
      }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => snapshot,
      })

      const result = await fetchCronTargets('2330')
      expect(result).toEqual(snapshot)
    })
  })
})
