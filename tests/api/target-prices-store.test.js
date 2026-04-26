import { describe, expect, it, vi } from 'vitest'

import {
  readTargetPriceSnapshot,
  writeTargetPriceSnapshot,
} from '../../api/_lib/target-prices-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/target-prices-store.js', () => {
  it('wires target-price snapshots to the generic singleton store', async () => {
    const putImpl = vi.fn().mockResolvedValue({ ok: true })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ code: '2330', targets: { coverageState: 'firm-reports' } }),
    })

    await writeTargetPriceSnapshot('2330', { code: '2330' }, { token: 'blob-token', putImpl })
    const payload = await readTargetPriceSnapshot('2330', { token: 'blob-token', getImpl })

    expect(putImpl).toHaveBeenCalledWith(
      'target-prices/2330.json',
      expect.any(String),
      expect.objectContaining({ access: 'private', token: 'blob-token' })
    )
    expect(getImpl).toHaveBeenCalledWith(
      'target-prices/2330.json',
      expect.objectContaining({ access: 'private', token: 'blob-token', useCache: false })
    )
    expect(payload).toMatchObject({ code: '2330', targets: { coverageState: 'firm-reports' } })
  })
})
