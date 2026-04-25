import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ORIGINAL_ENV = {
  APP_ORIGIN: process.env.APP_ORIGIN,
  INTERNAL_API_ORIGIN: process.env.INTERNAL_API_ORIGIN,
  VERCEL_URL: process.env.VERCEL_URL,
  BLOB_SIGNING_SECRET: process.env.BLOB_SIGNING_SECRET,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  PUB_BLOB_TELEMETRY_TOKEN: process.env.PUB_BLOB_TELEMETRY_TOKEN,
  PUB_BLOB_READ_WRITE_TOKEN: process.env.PUB_BLOB_READ_WRITE_TOKEN,
  BRIDGE_AUTH_TOKEN: process.env.BRIDGE_AUTH_TOKEN,
  BRIDGE_INTERNAL_TOKEN: process.env.BRIDGE_INTERNAL_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  VITEST: process.env.VITEST,
}

describe('api/_lib/signed-url', () => {
  beforeEach(() => {
    delete process.env.APP_ORIGIN
    delete process.env.INTERNAL_API_ORIGIN
    delete process.env.VERCEL_URL
    delete process.env.BLOB_SIGNING_SECRET
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.PUB_BLOB_TELEMETRY_TOKEN
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
    delete process.env.BRIDGE_AUTH_TOKEN
    delete process.env.BRIDGE_INTERNAL_TOKEN
    delete process.env.CRON_SECRET
    delete process.env.VITEST
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('uses APP_ORIGIN before legacy VERCEL_URL and keeps request host precedence', async () => {
    process.env.APP_ORIGIN = 'https://app.example.com'
    process.env.BLOB_SIGNING_SECRET = 'signed-secret'

    const { createSignedBlobReadUrl, resolveSignedBlobOrigin } =
      await import('../../api/_lib/signed-url.js')

    expect(
      resolveSignedBlobOrigin({
        headers: {
          host: 'preview.example.com',
        },
      })
    ).toBe('https://preview.example.com')

    const signedUrl = createSignedBlobReadUrl('reports/demo.json', {
      expiresAt: Date.now() + 60_000,
    })

    expect(new URL(signedUrl).origin).toBe('https://app.example.com')
  })

  it('prefers INTERNAL_API_ORIGIN over APP_ORIGIN and request-derived fallback', async () => {
    process.env.APP_ORIGIN = 'https://app.example.com'
    process.env.INTERNAL_API_ORIGIN = 'http://127.0.0.1:3002'

    const { resolveInternalApiOrigin } = await import('../../api/_lib/signed-url.js')

    expect(
      resolveInternalApiOrigin({
        headers: {
          host: 'public.example.com',
          'x-forwarded-proto': 'https',
        },
      })
    ).toBe('http://127.0.0.1:3002')

    delete process.env.INTERNAL_API_ORIGIN
    expect(resolveInternalApiOrigin()).toBe('https://app.example.com')
  })

  it('falls back from BLOB_SIGNING_SECRET to Blob tokens only', async () => {
    process.env.CRON_SECRET = 'cron-secret'
    process.env.BRIDGE_AUTH_TOKEN = 'bridge-auth-token'
    process.env.BRIDGE_INTERNAL_TOKEN = 'bridge-internal-token'
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'

    const { getSignedBlobSecret } = await import('../../api/_lib/signed-url.js')

    expect(getSignedBlobSecret()).toBe('blob-token')

    delete process.env.BLOB_READ_WRITE_TOKEN
    expect(() => getSignedBlobSecret()).toThrow('signed blob secret not configured')

    process.env.BLOB_SIGNING_SECRET = 'signed-secret'
    expect(getSignedBlobSecret()).toBe('signed-secret')
  })
})
