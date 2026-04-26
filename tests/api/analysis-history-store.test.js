import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateAnalysisHistoryIndex } from '../../api/_lib/analysis-history.js'
import {
  getAnalysisHistoryKey,
  listAnalysisHistoryObjects,
  readAnalysisHistoryIndex,
  readAnalysisHistoryRecord,
} from '../../api/_lib/analysis-history-store.js'

describe('api/_lib/analysis-history-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.STORAGE_PRIMARY_ANALYSIS_HISTORY = 'gcs'
    process.env.STORAGE_SHADOW_READ_ANALYSIS_HISTORY = 'false'
    process.env.STORAGE_SHADOW_WRITE_ANALYSIS_HISTORY = 'false'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_ANALYSIS_HISTORY
    delete process.env.STORAGE_SHADOW_READ_ANALYSIS_HISTORY
    delete process.env.STORAGE_SHADOW_WRITE_ANALYSIS_HISTORY
  })

  it('keeps slashy date ids stable and routes reads/lists through the analysis-history wrapper', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'analysis-history-store-'))
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const key = getAnalysisHistoryKey('2026/04/23', '1')
      const gcsReadImpl = vi.fn().mockResolvedValue({
        body: Buffer.from('{"id":"1"}'),
      })
      const items = await listAnalysisHistoryObjects(undefined, {
        gcsListPrefixImpl: vi.fn().mockResolvedValue({
          items: [{ key }],
          cursor: null,
        }),
      })
      const payload = await readAnalysisHistoryRecord('2026/04/23', '1', { gcsReadImpl })

      expect(key).toBe('analysis-history/2026/04/23-1.json')
      expect(items).toEqual([
        expect.objectContaining({
          key,
        }),
      ])
      expect(payload).toEqual({ id: '1' })
      expect(gcsReadImpl).toHaveBeenCalledWith('jcv-dev-private', key)
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('uses CAS retry so concurrent analysis-history index updates do not drop entries', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'analysis-history-cas-'))
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const options = {
        gcsReadImpl: vi.fn().mockResolvedValue(null),
        gcsWriteImpl: vi.fn().mockResolvedValue({ generation: '1' }),
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: false,
          shadowWrite: false,
        },
      }

      await Promise.all([
        updateAnalysisHistoryIndex({ id: 1, date: '2026-04-24' }, options),
        updateAnalysisHistoryIndex({ id: 2, date: '2026-04-25' }, options),
      ])

      expect(await readAnalysisHistoryIndex(options)).toEqual([
        expect.objectContaining({ id: 2, date: '2026-04-25' }),
        expect.objectContaining({ id: 1, date: '2026-04-24' }),
      ])
    } finally {
      process.chdir(originalCwd)
    }
  })
})
