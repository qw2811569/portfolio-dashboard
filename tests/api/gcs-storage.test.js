import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { Storage } = vi.hoisted(() => ({
  Storage: vi.fn(),
}))

vi.mock('@google-cloud/storage', () => ({
  Storage,
}))

function createFileMock(overrides = {}) {
  return {
    download: vi.fn(),
    getMetadata: vi.fn(),
    save: vi.fn(),
    ...overrides,
  }
}

describe('api/_lib/gcs-storage.js', () => {
  beforeEach(() => {
    vi.resetModules()
    Storage.mockReset()
    process.env.GCS_PROJECT = 'jcv-dev-2026'
  })

  afterEach(() => {
    delete process.env.GCS_PROJECT
  })

  it('reads an object and returns body + metadata', async () => {
    const file = createFileMock({
      getMetadata: vi.fn().mockResolvedValue([
        {
          etag: 'etag-1',
          contentType: 'application/json',
          generation: '123',
        },
      ]),
      download: vi.fn().mockResolvedValue([Buffer.from('{"ok":true}')]),
    })

    Storage.mockImplementation(function MockStorage() {
      return {
        bucket: vi.fn(() => ({
          file: vi.fn(() => file),
        })),
      }
    })

    const { gcsRead } = await import('../../api/_lib/gcs-storage.js')
    const result = await gcsRead('jcv-dev-private', 'last-success-daily-snapshot.json')

    expect(Storage).toHaveBeenCalledWith({ projectId: 'jcv-dev-2026' })
    expect(result).toMatchObject({
      body: Buffer.from('{"ok":true}'),
      etag: 'etag-1',
      contentType: 'application/json',
      generation: '123',
    })
  })

  it('returns null for missing reads and heads', async () => {
    const missingError = Object.assign(new Error('missing'), { code: 404 })
    const file = createFileMock({
      getMetadata: vi.fn().mockRejectedValue(missingError),
      download: vi.fn().mockRejectedValue(missingError),
    })

    Storage.mockImplementation(function MockStorage() {
      return {
        bucket: vi.fn(() => ({
          file: vi.fn(() => file),
        })),
      }
    })

    const { gcsRead, gcsHead } = await import('../../api/_lib/gcs-storage.js')

    await expect(gcsRead('jcv-dev-private', 'missing.json')).resolves.toBeNull()
    await expect(gcsHead('jcv-dev-private', 'missing.json')).resolves.toBeNull()
  })

  it('writes an object with content metadata', async () => {
    const file = createFileMock({
      getMetadata: vi.fn().mockResolvedValue([
        {
          etag: 'etag-2',
          generation: '456',
          contentType: 'text/plain; charset=utf-8',
          cacheControl: 'no-store',
        },
      ]),
    })

    Storage.mockImplementation(function MockStorage() {
      return {
        bucket: vi.fn(() => ({
          file: vi.fn(() => file),
        })),
      }
    })

    const { gcsWrite } = await import('../../api/_lib/gcs-storage.js')
    const result = await gcsWrite(
      'jcv-dev-private',
      'last-success-daily-snapshot.json',
      'payload',
      {
        contentType: 'text/plain; charset=utf-8',
        cacheControl: 'no-store',
      }
    )

    expect(file.save).toHaveBeenCalledWith('payload', {
      resumable: false,
      metadata: {
        contentType: 'text/plain; charset=utf-8',
        cacheControl: 'no-store',
      },
    })
    expect(result).toMatchObject({
      key: 'last-success-daily-snapshot.json',
      bucketName: 'jcv-dev-private',
      contentType: 'text/plain; charset=utf-8',
      cacheControl: 'no-store',
      generation: '456',
      etag: 'etag-2',
    })
  })

  it('passes generation preconditions through to the SDK save call', async () => {
    const file = createFileMock({
      getMetadata: vi.fn().mockResolvedValue([
        {
          etag: 'etag-3',
          generation: '789',
          contentType: 'application/json',
        },
      ]),
    })

    Storage.mockImplementation(function MockStorage() {
      return {
        bucket: vi.fn(() => ({
          file: vi.fn(() => file),
        })),
      }
    })

    const { gcsWrite } = await import('../../api/_lib/gcs-storage.js')
    await gcsWrite('jcv-dev-private', 'cas.json', '{"ok":true}', {
      contentType: 'application/json',
      ifGenerationMatch: 0,
    })

    expect(file.save).toHaveBeenCalledWith('{"ok":true}', {
      resumable: false,
      metadata: {
        contentType: 'application/json',
      },
      preconditionOpts: {
        ifGenerationMatch: 0,
      },
    })
  })

  it('adds a retry hint for transient backend failures', async () => {
    const transientError = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
    const file = createFileMock({
      getMetadata: vi.fn().mockRejectedValue(transientError),
      download: vi.fn().mockRejectedValue(transientError),
    })

    Storage.mockImplementation(function MockStorage() {
      return {
        bucket: vi.fn(() => ({
          file: vi.fn(() => file),
        })),
      }
    })

    const { gcsRead } = await import('../../api/_lib/gcs-storage.js')

    await expect(gcsRead('jcv-dev-private', 'flaky.json')).rejects.toThrow(/retry suggested/)
  })
})
