import { describe, expect, it, vi } from 'vitest'

import {
  readDailyEventsSnapshot,
  writeDailyEventsSnapshot,
} from '../../api/_lib/daily-events-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/daily-events-store.js', () => {
  it('wires the public latest daily-events snapshot through the generic store', async () => {
    const putImpl = vi.fn().mockResolvedValue({ ok: true })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ generatedAt: '2026-04-25T00:00:00Z', events: [] }),
    })

    await writeDailyEventsSnapshot({ events: [] }, { token: 'blob-token', putImpl })
    const payload = await readDailyEventsSnapshot({ token: 'blob-token', getImpl })

    expect(putImpl).toHaveBeenCalledWith(
      'daily-events/latest.json',
      expect.any(String),
      expect.objectContaining({ access: 'public', token: 'blob-token' })
    )
    expect(getImpl).toHaveBeenCalledWith(
      'daily-events/latest.json',
      expect.objectContaining({ access: 'public', token: 'blob-token' })
    )
    expect(payload).toMatchObject({ generatedAt: '2026-04-25T00:00:00Z' })
  })
})
