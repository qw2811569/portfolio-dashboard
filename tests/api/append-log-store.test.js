import { describe, expect, it, vi } from 'vitest'

import {
  createAppendLogStore,
  inferAppendLogKeyspaceId,
} from '../../api/_lib/append-log-store.js'
import {
  appendBlobJsonLine,
  getDailySnapshotLogKey,
  getRestoreRehearsalLogKey,
} from '../../api/_lib/daily-snapshot.js'
import { appendMorningNoteLog, getMorningNoteLogKey } from '../../api/_lib/morning-note.js'

function createConflictError() {
  const error = new Error('version conflict')
  error.code = 'VERSION_CONFLICT'
  return error
}

function createCasBackend({ body = '', versionToken = null, conflictOnce = false, conflictBody = '' } = {}) {
  const state = {
    body,
    versionToken,
    readCount: 0,
    writeCount: 0,
    conflictOnce,
  }

  return {
    state,
    backend: {
      async readWithVersion() {
        state.readCount += 1
        return state.versionToken == null
          ? null
          : {
              body: state.body,
              versionToken: state.versionToken,
            }
      },
      async writeIfVersion(_descriptor, nextBody, expectedVersionToken) {
        state.writeCount += 1
        if (state.conflictOnce) {
          state.conflictOnce = false
          state.body = conflictBody
          state.versionToken = 'v2'
          throw createConflictError()
        }
        if (expectedVersionToken !== state.versionToken) {
          throw createConflictError()
        }
        state.body = nextBody
        state.versionToken = `v${Number(String(state.versionToken || 'v0').slice(1)) + 1}`
        return {
          body: nextBody,
          versionToken: state.versionToken,
        }
      },
    },
  }
}

describe('api/_lib/append-log-store.js', () => {
  it('retries a CAS conflict and preserves the concurrently appended line', async () => {
    const { backend, state } = createCasBackend({
      body: '{"line":"a"}\n',
      versionToken: 'v1',
      conflictOnce: true,
      conflictBody: '{"line":"a"}\n{"line":"b"}\n',
    })
    const store = createAppendLogStore('daily_snapshot_log')

    const result = await store.appendLine(
      'logs/daily-snapshot-2026-04.jsonl',
      '{"line":"c"}',
      {
        storagePolicyOverride: { primary: 'gcs', shadowRead: false, shadowWrite: false },
        gcsBackend: backend,
        retryDelayMs: 0,
      }
    )

    expect(result.attempts).toBe(2)
    expect(state.body).toBe('{"line":"a"}\n{"line":"b"}\n{"line":"c"}\n')
    expect(state.writeCount).toBe(2)
  })

  it('fails fast after max retries on repeated CAS conflicts', async () => {
    const store = createAppendLogStore('daily_snapshot_log')
    const backend = {
      readWithVersion: vi.fn().mockResolvedValue({ body: '', versionToken: 'v1' }),
      writeIfVersion: vi.fn().mockRejectedValue(createConflictError()),
    }

    await expect(
      store.appendLine('logs/daily-snapshot-2026-04.jsonl', '{"line":"x"}', {
        storagePolicyOverride: { primary: 'gcs', shadowRead: false, shadowWrite: false },
        gcsBackend: backend,
        maxRetries: 3,
        retryDelayMs: 0,
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })

    expect(backend.readWithVersion).toHaveBeenCalledTimes(3)
    expect(backend.writeIfVersion).toHaveBeenCalledTimes(3)
  })

  it('uses monthly rotation keys for Class 3 wrappers', () => {
    const now = new Date('2026-04-26T03:00:00.000Z')

    expect(getDailySnapshotLogKey(now)).toBe('logs/daily-snapshot-2026-04.jsonl')
    expect(getRestoreRehearsalLogKey(now)).toBe('logs/restore-rehearsal-2026-04.jsonl')
    expect(getMorningNoteLogKey(now)).toBe('logs/morning-note-2026-04.jsonl')
    expect(inferAppendLogKeyspaceId('logs/daily-snapshot-2026-04.jsonl')).toBe(
      'daily_snapshot_log'
    )
  })

  it('routes daily snapshot appends through the append-log store wrapper', async () => {
    const { backend, state } = createCasBackend()

    const result = await appendBlobJsonLine(
      'logs/daily-snapshot-2026-04.jsonl',
      { ts: '2026-04-26T00:00:00.000Z', status: 'success' },
      {
        token: 'blob-token',
        storagePolicyOverride: { primary: 'gcs', shadowRead: false, shadowWrite: false },
        gcsBackend: backend,
        retryDelayMs: 0,
      }
    )

    expect(result).toEqual({
      key: 'logs/daily-snapshot-2026-04.jsonl',
      line: '{"ts":"2026-04-26T00:00:00.000Z","status":"success"}',
    })
    expect(state.body).toBe('{"ts":"2026-04-26T00:00:00.000Z","status":"success"}\n')
  })

  it('routes morning note appends through the append-log store wrapper', async () => {
    const { backend, state } = createCasBackend()

    const result = await appendMorningNoteLog(
      { ts: '2026-04-26T00:00:00.000Z', status: 'fresh' },
      {
        token: 'blob-token',
        storagePolicyOverride: { primary: 'gcs', shadowRead: false, shadowWrite: false },
        gcsBackend: backend,
        retryDelayMs: 0,
      }
    )

    expect(result).toEqual({
      key: 'logs/morning-note-2026-04.jsonl',
      line: '{"ts":"2026-04-26T00:00:00.000Z","status":"fresh"}',
    })
    expect(state.body).toBe('{"ts":"2026-04-26T00:00:00.000Z","status":"fresh"}\n')
  })
})
