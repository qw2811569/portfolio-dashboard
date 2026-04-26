import { describe, expect, it, vi } from 'vitest'

import {
  readMorningNoteSnapshotStore,
  writeMorningNoteSnapshotStore,
} from '../../api/_lib/morning-note-snapshot-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/morning-note-snapshot-store.js', () => {
  it('wires the dated morning-note snapshot key correctly', async () => {
    const putImpl = vi.fn().mockResolvedValue({ ok: true })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ marketDate: '2026-04-25', portfolios: {} }),
    })

    await writeMorningNoteSnapshotStore(
      '2026-04-25',
      { marketDate: '2026-04-25' },
      { token: 'blob-token', putImpl }
    )
    const payload = await readMorningNoteSnapshotStore('2026-04-25', {
      token: 'blob-token',
      getImpl,
    })

    expect(putImpl).toHaveBeenCalledWith(
      'snapshot/morning-note/2026-04-25.json',
      expect.any(String),
      expect.objectContaining({ access: 'private', token: 'blob-token' })
    )
    expect(getImpl).toHaveBeenCalledWith(
      'snapshot/morning-note/2026-04-25.json',
      expect.objectContaining({ access: 'private', token: 'blob-token', useCache: false })
    )
    expect(payload).toMatchObject({ marketDate: '2026-04-25' })
  })
})
