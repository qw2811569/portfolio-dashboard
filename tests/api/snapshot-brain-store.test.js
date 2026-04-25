import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSnapshotBrainObjects,
  getSnapshotBrainObjectKey,
  getSnapshotBrainPrefix,
  listSnapshotBrainObjects,
  readSnapshotBrainObject,
  writeSnapshotBrainObject,
} from '../../api/_lib/snapshot-brain-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/snapshot-brain-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_SNAPSHOT_BRAIN
    delete process.env.STORAGE_SHADOW_READ_SNAPSHOT_BRAIN
    delete process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_BRAIN
  })

  it('builds the dated brain keys for the snapshot lane', () => {
    expect(getSnapshotBrainPrefix('2026-04-24')).toBe('snapshot/brain/2026-04-24/')
    expect(getSnapshotBrainObjectKey('2026-04-24', 'strategy-brain.json')).toBe(
      'snapshot/brain/2026-04-24/strategy-brain.json'
    )
    expect(getSnapshotBrainObjectKey('2026-04-24', '/analysis-history/2026/04/23-1.json')).toBe(
      'snapshot/brain/2026-04-24/analysis-history/2026/04/23-1.json'
    )
    expect(() => getSnapshotBrainPrefix('2026/04/24')).toThrow(/date must be YYYY-MM-DD/)
    expect(() => getSnapshotBrainObjectKey('2026-04-24', '')).toThrow(
      /relativePath is required/
    )
  })

  it('routes list/read/write/delete through the snapshot.brain prefix wrapper', async () => {
    const listImpl = vi.fn().mockResolvedValue({
      blobs: [
        {
          pathname: 'snapshot/brain/2026-04-24/strategy-brain.json',
          uploadedAt: '2026-04-24T03:00:00.000Z',
        },
      ],
      cursor: null,
    })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({
        schemaVersion: 4,
        rules: ['keep sizing tight'],
      }),
    })
    const putImpl = vi.fn().mockResolvedValue({
      url: 'https://blob.example/snapshot/brain/2026-04-24/strategy-brain.json',
    })
    const delImpl = vi.fn().mockResolvedValue(undefined)

    const page = await listSnapshotBrainObjects(
      {
        prefix: '2026-04-24/',
        limit: 1,
      },
      {
        token: 'blob-token',
        listImpl,
      }
    )
    const payload = await readSnapshotBrainObject(
      getSnapshotBrainObjectKey('2026-04-24', 'strategy-brain.json'),
      {
        token: 'blob-token',
        getImpl,
      }
    )
    await writeSnapshotBrainObject(
      getSnapshotBrainObjectKey('2026-04-24', 'strategy-brain.json'),
      {
        schemaVersion: 4,
        rules: ['keep sizing tight'],
      },
      {
        token: 'blob-token',
        putImpl,
      }
    )
    const deleteResult = await deleteSnapshotBrainObjects(
      [getSnapshotBrainObjectKey('2026-04-24', 'strategy-brain.json')],
      {
        token: 'blob-token',
        delImpl,
      }
    )

    expect(listImpl).toHaveBeenCalledWith({
      token: 'blob-token',
      prefix: 'snapshot/brain/2026-04-24/',
      cursor: undefined,
      limit: 100,
    })
    expect(getImpl).toHaveBeenCalledWith(
      'snapshot/brain/2026-04-24/strategy-brain.json',
      expect.objectContaining({
        access: 'private',
        token: 'blob-token',
        useCache: false,
      })
    )
    expect(putImpl).toHaveBeenCalledWith(
      'snapshot/brain/2026-04-24/strategy-brain.json',
      expect.any(String),
      expect.objectContaining({
        access: 'private',
        token: 'blob-token',
      })
    )
    expect(delImpl).toHaveBeenCalledWith('snapshot/brain/2026-04-24/strategy-brain.json', {
      token: 'blob-token',
    })
    expect(page).toMatchObject({
      hasMore: false,
      nextCursor: null,
    })
    expect(page.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/brain/2026-04-24/strategy-brain.json',
        uploadedAt: '2026-04-24T03:00:00.000Z',
      }),
    ])
    expect(payload).toEqual({
      schemaVersion: 4,
      rules: ['keep sizing tight'],
    })
    expect(deleteResult).toMatchObject({
      requestedCount: 1,
      deletedKeys: ['snapshot/brain/2026-04-24/strategy-brain.json'],
    })
  })
})
