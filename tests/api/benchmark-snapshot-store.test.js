import { describe, expect, it, vi } from 'vitest'

import {
  listBenchmarkSnapshotKeys,
  readBenchmarkSnapshot,
  writeBenchmarkSnapshotStore,
} from '../../api/_lib/benchmark-snapshot-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/benchmark-snapshot-store.js', () => {
  it('wires dated benchmark snapshots and prefix listing through the generic store', async () => {
    const listImpl = vi.fn().mockResolvedValue({
      blobs: [{ pathname: 'snapshot/benchmark/2026-04-25.json' }],
      cursor: null,
    })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ date: '2026-04-25', close: 100 }),
    })
    const putImpl = vi.fn().mockResolvedValue({ ok: true })

    const keys = await listBenchmarkSnapshotKeys({ token: 'blob-token', listImpl })
    const payload = await readBenchmarkSnapshot('2026-04-25', { token: 'blob-token', getImpl })
    await writeBenchmarkSnapshotStore(
      '2026-04-25',
      { date: '2026-04-25', close: 100 },
      { token: 'blob-token', putImpl }
    )

    expect(listImpl).toHaveBeenCalledWith({
      token: 'blob-token',
      prefix: 'snapshot/benchmark',
      cursor: undefined,
      limit: 1000,
    })
    expect(getImpl).toHaveBeenCalledWith(
      'snapshot/benchmark/2026-04-25.json',
      expect.objectContaining({ access: 'private', token: 'blob-token', useCache: false })
    )
    expect(putImpl).toHaveBeenCalledWith(
      'snapshot/benchmark/2026-04-25.json',
      expect.any(String),
      expect.objectContaining({ access: 'private', token: 'blob-token' })
    )
    expect(keys).toEqual(['snapshot/benchmark/2026-04-25.json'])
    expect(payload).toMatchObject({ date: '2026-04-25', close: 100 })
  })
})
