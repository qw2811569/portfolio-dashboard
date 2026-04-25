import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readBrain, writeBrain } from '../../api/_lib/brain-store.js'

describe('api/_lib/brain-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.STORAGE_PRIMARY_BRAIN = 'gcs'
    process.env.STORAGE_SHADOW_READ_BRAIN = 'false'
    process.env.STORAGE_SHADOW_WRITE_BRAIN = 'false'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_BRAIN
    delete process.env.STORAGE_SHADOW_READ_BRAIN
    delete process.env.STORAGE_SHADOW_WRITE_BRAIN
  })

  it('routes strategy-brain reads and writes through the brain env prefix', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'brain-store-'))
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const gcsReadImpl = vi.fn().mockResolvedValue({
        body: Buffer.from('{"version":4}'),
      })
      const gcsWriteImpl = vi.fn().mockResolvedValue({ generation: '1' })

      const brain = await readBrain({ gcsReadImpl })
      await writeBrain({ version: 5 }, { gcsWriteImpl })

      expect(brain).toEqual({ version: 4 })
      expect(gcsReadImpl).toHaveBeenCalledWith('jcv-dev-private', 'strategy-brain.json')
      expect(gcsWriteImpl).toHaveBeenCalledWith(
        'jcv-dev-private',
        'strategy-brain.json',
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
