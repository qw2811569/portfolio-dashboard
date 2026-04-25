import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSnapshotPortfolioStateObjects,
  getSnapshotPortfolioStateObjectKey,
  getSnapshotPortfolioStatePortfolioPrefix,
  getSnapshotPortfolioStatePrefix,
  listSnapshotPortfolioStateObjects,
  readSnapshotPortfolioStateObject,
  writeSnapshotPortfolioStateObject,
} from '../../api/_lib/snapshot-portfolio-state-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/snapshot-portfolio-state-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_SNAPSHOT_PORTFOLIO_STATE
    delete process.env.STORAGE_SHADOW_READ_SNAPSHOT_PORTFOLIO_STATE
    delete process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_PORTFOLIO_STATE
  })

  it('builds the dated portfolio-state keys for the snapshot lane', () => {
    expect(getSnapshotPortfolioStatePrefix('2026-04-24')).toBe(
      'snapshot/portfolio-state/2026-04-24/'
    )
    expect(getSnapshotPortfolioStatePortfolioPrefix('2026-04-24', 'me')).toBe(
      'snapshot/portfolio-state/2026-04-24/me/'
    )
    expect(getSnapshotPortfolioStateObjectKey('2026-04-24', 'me', 'holdings.json')).toBe(
      'snapshot/portfolio-state/2026-04-24/me/holdings.json'
    )
    expect(
      getSnapshotPortfolioStateObjectKey('2026-04-24', 'me', '/targets/future-targets.json')
    ).toBe('snapshot/portfolio-state/2026-04-24/me/targets/future-targets.json')
    expect(() => getSnapshotPortfolioStatePrefix('2026/04/24')).toThrow(
      /date must be YYYY-MM-DD/
    )
    expect(() => getSnapshotPortfolioStatePortfolioPrefix('2026-04-24', '')).toThrow(
      /portfolioId is required/
    )
    expect(() => getSnapshotPortfolioStateObjectKey('2026-04-24', 'me', '')).toThrow(
      /relativePath is required/
    )
  })

  it('routes list/read/write/delete through the snapshot.portfolio_state prefix wrapper', async () => {
    const listImpl = vi.fn().mockResolvedValue({
      blobs: [
        {
          pathname: 'snapshot/portfolio-state/2026-04-24/me/holdings.json',
          uploadedAt: '2026-04-24T03:00:00.000Z',
        },
      ],
      cursor: null,
    })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream([{ code: '2330', qty: 1 }]),
    })
    const putImpl = vi.fn().mockResolvedValue({
      url: 'https://blob.example/snapshot/portfolio-state/2026-04-24/me/holdings.json',
    })
    const delImpl = vi.fn().mockResolvedValue(undefined)

    const page = await listSnapshotPortfolioStateObjects(
      {
        prefix: '2026-04-24/me/',
        limit: 1,
      },
      {
        token: 'blob-token',
        listImpl,
      }
    )
    const payload = await readSnapshotPortfolioStateObject(
      getSnapshotPortfolioStateObjectKey('2026-04-24', 'me', 'holdings.json'),
      {
        token: 'blob-token',
        getImpl,
      }
    )
    await writeSnapshotPortfolioStateObject(
      getSnapshotPortfolioStateObjectKey('2026-04-24', 'me', 'holdings.json'),
      [{ code: '2330', qty: 1 }],
      {
        token: 'blob-token',
        putImpl,
      }
    )
    const deleteResult = await deleteSnapshotPortfolioStateObjects(
      [getSnapshotPortfolioStateObjectKey('2026-04-24', 'me', 'holdings.json')],
      {
        token: 'blob-token',
        delImpl,
      }
    )

    expect(listImpl).toHaveBeenCalledWith({
      token: 'blob-token',
      prefix: 'snapshot/portfolio-state/2026-04-24/me/',
      cursor: undefined,
      limit: 100,
    })
    expect(getImpl).toHaveBeenCalledWith(
      'snapshot/portfolio-state/2026-04-24/me/holdings.json',
      expect.objectContaining({
        access: 'private',
        token: 'blob-token',
        useCache: false,
      })
    )
    expect(putImpl).toHaveBeenCalledWith(
      'snapshot/portfolio-state/2026-04-24/me/holdings.json',
      expect.any(String),
      expect.objectContaining({
        access: 'private',
        token: 'blob-token',
      })
    )
    expect(delImpl).toHaveBeenCalledWith(
      'snapshot/portfolio-state/2026-04-24/me/holdings.json',
      {
        token: 'blob-token',
      }
    )
    expect(page).toMatchObject({
      hasMore: false,
      nextCursor: null,
    })
    expect(page.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/portfolio-state/2026-04-24/me/holdings.json',
        uploadedAt: '2026-04-24T03:00:00.000Z',
      }),
    ])
    expect(payload).toEqual([{ code: '2330', qty: 1 }])
    expect(deleteResult).toMatchObject({
      requestedCount: 1,
      deletedKeys: ['snapshot/portfolio-state/2026-04-24/me/holdings.json'],
    })
  })
})
