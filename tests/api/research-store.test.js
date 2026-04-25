import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getBrainProposalKey,
  getResearchArtifactKey,
  getResearchPrefix,
  listResearchObjects,
  writeResearchArtifact,
} from '../../api/_lib/research-store.js'

describe('api/_lib/research-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.STORAGE_PRIMARY_RESEARCH = 'vercel'
    process.env.STORAGE_SHADOW_READ_RESEARCH = 'true'
    process.env.STORAGE_SHADOW_WRITE_RESEARCH = 'true'
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_RESEARCH
    delete process.env.STORAGE_SHADOW_READ_RESEARCH
    delete process.env.STORAGE_SHADOW_WRITE_RESEARCH
    delete process.env.BLOB_READ_WRITE_TOKEN
  })

  it('builds research keys and routes list/write calls through the research wrapper', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'research-store-'))
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const putImpl = vi.fn().mockResolvedValue({ url: 'https://blob.example/research/2330/123.json' })
      const gcsWriteImpl = vi.fn().mockResolvedValue({ generation: '1' })
      const items = await listResearchObjects(getResearchPrefix('2330'), {
        listImpl: vi.fn().mockResolvedValue({
          blobs: [{ pathname: 'research/2330/123.json' }],
          cursor: null,
        }),
      })

      await writeResearchArtifact('2330', '123', { ok: true }, { putImpl, gcsWriteImpl })

      expect(getResearchPrefix('2330')).toBe('research/2330/')
      expect(getResearchArtifactKey('2330', '123')).toBe('research/2330/123.json')
      expect(getBrainProposalKey('proposal-1')).toBe('brain-proposals/proposal-1.json')
      expect(items).toEqual([
        expect.objectContaining({
          key: 'research/2330/123.json',
        }),
      ])
      expect(putImpl).toHaveBeenCalledWith(
        'research/2330/123.json',
        expect.any(String),
        expect.objectContaining({
          access: 'private',
        })
      )
      expect(gcsWriteImpl).toHaveBeenCalledWith(
        'jcv-dev-private',
        'research/2330/123.json',
        expect.any(String),
        expect.objectContaining({
          public: false,
        })
      )
    } finally {
      process.chdir(originalCwd)
    }
  })
})
