import { describe, expect, it, vi } from 'vitest'

import { readValuationSnapshot, writeValuationSnapshot } from '../../api/_lib/valuation-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/valuation-store.js', () => {
  it('wires valuation snapshots to the generic singleton store', async () => {
    const putImpl = vi.fn().mockResolvedValue({ ok: true })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ code: '2330', method: 'historical-per-band' }),
    })

    await writeValuationSnapshot('2330', { code: '2330' }, { token: 'blob-token', putImpl })
    const payload = await readValuationSnapshot('2330', { token: 'blob-token', getImpl })

    expect(putImpl).toHaveBeenCalledWith(
      'valuation/2330.json',
      expect.any(String),
      expect.objectContaining({ access: 'private', token: 'blob-token' })
    )
    expect(getImpl).toHaveBeenCalledWith(
      'valuation/2330.json',
      expect.objectContaining({ access: 'private', token: 'blob-token', useCache: false })
    )
    expect(payload).toMatchObject({ code: '2330', method: 'historical-per-band' })
  })
})
