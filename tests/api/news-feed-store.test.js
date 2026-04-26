import { describe, expect, it, vi } from 'vitest'

import { headNewsFeed, readNewsFeed, writeNewsFeed } from '../../api/_lib/news-feed-store.js'
import { createJsonStream } from './store-test-helpers.js'

describe('api/_lib/news-feed-store.js', () => {
  it('preserves exact public key wiring and HEAD support', async () => {
    const putImpl = vi.fn().mockResolvedValue({ ok: true })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ items: [{ title: 'foo' }], collectedAt: '2026-04-25T00:00:00Z' }),
    })
    const headImpl = vi.fn().mockResolvedValue({ pathname: 'news-feed/latest.json' })

    await writeNewsFeed({ items: [] }, { token: 'blob-token', putImpl })
    const payload = await readNewsFeed({ token: 'blob-token', getImpl })
    const metadata = await headNewsFeed({ token: 'blob-token', headImpl })

    expect(putImpl).toHaveBeenCalledWith(
      'news-feed/latest.json',
      expect.any(String),
      expect.objectContaining({ access: 'public', token: 'blob-token' })
    )
    expect(getImpl).toHaveBeenCalledWith(
      'news-feed/latest.json',
      expect.objectContaining({ access: 'public', token: 'blob-token' })
    )
    expect(headImpl).toHaveBeenCalledWith('news-feed/latest.json', { token: 'blob-token' })
    expect(payload).toMatchObject({ collectedAt: '2026-04-25T00:00:00Z' })
    expect(metadata).toMatchObject({ pathname: 'news-feed/latest.json' })
  })
})
