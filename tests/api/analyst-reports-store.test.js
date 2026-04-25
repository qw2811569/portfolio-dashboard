import { describe, expect, it, vi } from 'vitest'

import {
  readAnalystReportsSnapshot,
  writeAnalystReportsSnapshot,
} from '../../api/_lib/analyst-reports-store.js'

describe('api/_lib/analyst-reports-store.js', () => {
  it('keeps the public list+fetch read path and exact write key', async () => {
    const listImpl = vi.fn().mockResolvedValue({
      blobs: [{ url: 'https://blob.example/analyst-reports/2330.json' }],
    })
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '2330', items: [] }),
    })
    const putImpl = vi.fn().mockResolvedValue({ ok: true })

    const payload = await readAnalystReportsSnapshot('2330', {
      token: 'blob-token',
      listImpl,
      fetchImpl,
    })
    await writeAnalystReportsSnapshot('2330', { code: '2330' }, { token: 'blob-token', putImpl })

    expect(listImpl).toHaveBeenCalledWith({
      prefix: 'analyst-reports/2330.json',
      limit: 1,
      token: 'blob-token',
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://blob.example/analyst-reports/2330.json')
    expect(putImpl).toHaveBeenCalledWith(
      'analyst-reports/2330.json',
      expect.any(String),
      expect.objectContaining({ access: 'public', token: 'blob-token' })
    )
    expect(payload).toMatchObject({ code: '2330' })
  })
})
