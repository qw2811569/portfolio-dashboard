import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readTelemetry, writeTelemetry } from '../../api/_lib/telemetry-store.js'

describe('api/_lib/telemetry-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
    process.env.STORAGE_PRIMARY_TELEMETRY = 'vercel'
    process.env.STORAGE_SHADOW_READ_TELEMETRY = 'false'
    process.env.STORAGE_SHADOW_WRITE_TELEMETRY = 'true'
    process.env.PUB_BLOB_TELEMETRY_TOKEN = 'telemetry-token'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.STORAGE_PRIMARY_TELEMETRY
    delete process.env.STORAGE_SHADOW_READ_TELEMETRY
    delete process.env.STORAGE_SHADOW_WRITE_TELEMETRY
    delete process.env.PUB_BLOB_TELEMETRY_TOKEN
  })

  it('uses the public bucket/token contract for telemetry reads and writes', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'telemetry-store-'))
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const putImpl = vi.fn().mockResolvedValue({ url: 'https://blob.example/telemetry-events.json' })
      const gcsWriteImpl = vi.fn().mockResolvedValue({ generation: '1' })
      const listImpl = vi.fn().mockResolvedValue({
        blobs: [{ pathname: 'telemetry-events.json', url: 'https://blob.example/telemetry-events.json' }],
        cursor: null,
      })
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ entries: [{ id: '1' }] }),
      })

      await writeTelemetry({ entries: [{ id: '1' }] }, { putImpl, gcsWriteImpl })
      const payload = await readTelemetry({ listImpl, fetchImpl })

      expect(payload).toEqual({ entries: [{ id: '1' }] })
      expect(putImpl).toHaveBeenCalledWith(
        'telemetry-events.json',
        expect.any(String),
        expect.objectContaining({
          access: 'public',
          token: 'telemetry-token',
        })
      )
      expect(gcsWriteImpl).toHaveBeenCalledWith(
        'jcv-dev-public',
        'telemetry-events.json',
        expect.any(String),
        expect.objectContaining({
          public: true,
        })
      )
    } finally {
      process.chdir(originalCwd)
    }
  })
})
