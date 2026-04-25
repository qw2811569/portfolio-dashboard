import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSnapshotResearchObjects,
  getSnapshotResearchIndexKey,
  getSnapshotResearchPortfolioHistoryKey,
  getSnapshotResearchPrefix,
  listSnapshotResearchObjects,
  readSnapshotResearchObject,
  writeSnapshotResearchObject,
} from '../../api/_lib/snapshot-research-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/snapshot-research-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_SNAPSHOT_RESEARCH
    delete process.env.STORAGE_SHADOW_READ_SNAPSHOT_RESEARCH
    delete process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_RESEARCH
  })

  it('builds the dated research keys for the snapshot lane', () => {
    expect(getSnapshotResearchPrefix('2026-04-24')).toBe('snapshot/research/2026-04-24/')
    expect(getSnapshotResearchIndexKey('2026-04-24')).toBe(
      'snapshot/research/2026-04-24/research-index.json'
    )
    expect(getSnapshotResearchPortfolioHistoryKey('2026-04-24', 'me')).toBe(
      'snapshot/research/2026-04-24/portfolio-me-research-history.json'
    )
    expect(() => getSnapshotResearchPrefix('2026/04/24')).toThrow(/date must be YYYY-MM-DD/)
    expect(() => getSnapshotResearchPortfolioHistoryKey('2026-04-24', '')).toThrow(
      /portfolioId is required/
    )
  })

  it('routes list/read/write/delete through the snapshot.research prefix wrapper', async () => {
    const listImpl = vi.fn().mockResolvedValue({
      blobs: [
        {
          pathname: 'snapshot/research/2026-04-24/research-index.json',
          uploadedAt: '2026-04-24T03:00:00.000Z',
        },
      ],
      cursor: null,
    })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({
        schemaVersion: 1,
        items: [{ id: 'research-1' }],
      }),
    })
    const putImpl = vi.fn().mockResolvedValue({
      url: 'https://blob.example/snapshot/research/2026-04-24/research-index.json',
    })
    const delImpl = vi.fn().mockResolvedValue(undefined)

    const page = await listSnapshotResearchObjects(
      {
        prefix: '2026-04-24/',
        limit: 1,
      },
      {
        token: 'blob-token',
        listImpl,
      }
    )
    const payload = await readSnapshotResearchObject(getSnapshotResearchIndexKey('2026-04-24'), {
      token: 'blob-token',
      getImpl,
    })
    await writeSnapshotResearchObject(
      getSnapshotResearchIndexKey('2026-04-24'),
      {
        schemaVersion: 1,
        items: [{ id: 'research-1' }],
      },
      {
        token: 'blob-token',
        putImpl,
      }
    )
    const deleteResult = await deleteSnapshotResearchObjects(
      [getSnapshotResearchIndexKey('2026-04-24')],
      {
        token: 'blob-token',
        delImpl,
      }
    )

    expect(listImpl).toHaveBeenCalledWith({
      token: 'blob-token',
      prefix: 'snapshot/research/2026-04-24/',
      cursor: undefined,
      limit: 100,
    })
    expect(getImpl).toHaveBeenCalledWith(
      'snapshot/research/2026-04-24/research-index.json',
      expect.objectContaining({
        access: 'private',
        token: 'blob-token',
        useCache: false,
      })
    )
    expect(putImpl).toHaveBeenCalledWith(
      'snapshot/research/2026-04-24/research-index.json',
      expect.any(String),
      expect.objectContaining({
        access: 'private',
        token: 'blob-token',
      })
    )
    expect(delImpl).toHaveBeenCalledWith('snapshot/research/2026-04-24/research-index.json', {
      token: 'blob-token',
    })
    expect(page).toMatchObject({
      hasMore: false,
      nextCursor: null,
    })
    expect(page.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/research/2026-04-24/research-index.json',
        uploadedAt: '2026-04-24T03:00:00.000Z',
      }),
    ])
    expect(payload).toEqual({
      schemaVersion: 1,
      items: [{ id: 'research-1' }],
    })
    expect(deleteResult).toMatchObject({
      requestedCount: 1,
      deletedKeys: ['snapshot/research/2026-04-24/research-index.json'],
    })
  })
})
